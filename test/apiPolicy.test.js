// Public-service policy, consent and background-call regression tests.
// All network responses, clocks and Joplin APIs used here are mocked.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

function loadSource(name, mocks = {}, cache = {}) {
	if (mocks[name]) return mocks[name];
	if (cache[name]) return cache[name].exports;
	const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', name + '.ts'), 'utf8'), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
	}).outputText;
	const module = { exports: {} };
	cache[name] = module;
	new Function('require', 'module', 'exports', code)(
		(key) => key.startsWith('./') ? loadSource(key.slice(2), mocks, cache) : mocks[key] || require(key),
		module, module.exports,
	);
	return module.exports;
}

const PUBLIC = 'https://api.languagetool.org/v2/check';
const CUSTOM = 'https://languagetool.example.org/v2/check';
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

async function testClientPolicy() {
	const policy = loadSource('apiPolicy');
	for (const url of [
		PUBLIC, 'api.languagetool.org', 'HTTPS://API.LANGUAGETOOL.ORG.:443/other',
		'https://user:password@api.languagetool.org/v2/check?apiKey=test',
		'https://languagetool.org/v2/check', 'https://www.languagetool.org/check',
	]) assert.strictEqual(policy.isPublicEndpoint(url), true, url);
	for (const url of [CUSTOM, 'https://api.languagetool.org.example.net/check']) {
		assert.strictEqual(policy.isPublicEndpoint(url), false, url);
	}
	assert.strictEqual(policy.displayEndpoint('https://user:password@example.org/check?apiKey=secret#hidden'),
		'https://example.org/check?[redacted]');

	for (const text of ['abc', 'äé漢', '😀'.repeat(6000), '\ud800', 'ab😀cd', 'e\u0301']) {
		assert.strictEqual(policy.utf8Length(text), Buffer.byteLength(text, 'utf8'));
		for (const max of [0, 1, 2, 3, 4, 5, 19000]) {
			const prefix = policy.truncateUtf8(text, max);
			assert.ok(Buffer.byteLength(prefix, 'utf8') <= max);
			assert.ok(text.startsWith(prefix));
			if (prefix.length && text.includes('😀')) assert.ok(!/[\uD800-\uDBFF]$/.test(prefix), 'no split surrogate pair');
		}
	}
	const budget = new policy.PublicRequestBudget();
	for (let i = 0; i < 10; i++) assert.strictEqual(budget.reserve(1, 1000), true);
	assert.strictEqual(budget.reserve(1, 1001), false);
	assert.strictEqual(budget.reserve(1, 61000), true);
	const byteBudget = new policy.PublicRequestBudget();
	assert.strictEqual(byteBudget.reserve(19000, 1000), true);
	assert.strictEqual(byteBudget.reserve(19000, 1000), true);
	assert.strictEqual(byteBudget.reserve(19000, 1000), true);
	assert.strictEqual(byteBudget.reserve(19000, 1000), false);
	byteBudget.coolDown(120, 1000);
	assert.strictEqual(byteBudget.reserve(1, 61000), false);
	assert.strictEqual(byteBudget.reserve(1, 121000), true);

	const originalFetch = global.fetch;
	const originalNow = Date.now;
	let now = 100000;
	let requests = 0;
	const client = loadSource('languagetool');
	try {
		Date.now = () => now;
		global.fetch = async (url, options) => {
			requests++;
			assert.strictEqual(options.method, 'POST');
			assert.strictEqual(options.redirect, 'error');
			assert.strictEqual(new URLSearchParams(options.body).get('language'), 'auto');
			assert.ok(Buffer.byteLength(new URLSearchParams(options.body).get('text')) <= 19000);
			return { ok: true, json: async () => ({ matches: [] }) };
		};
		await assert.rejects(client.checkText('test', { url: PUBLIC, language: 'auto', trigger: 'background' }), /manually started/);
		await assert.rejects(client.checkText('test', { url: PUBLIC, language: 'auto', apiKey: 'paid-key' }), /manually started/);
		await assert.rejects(client.checkText('test', { url: PUBLIC.replace('https:', 'http:'), language: 'auto', trigger: 'manual' }), /HTTPS/);
		await assert.rejects(client.checkText('😀'.repeat(5000), { url: PUBLIC, trigger: 'manual' }), /19000/);
		assert.strictEqual(requests, 0, 'rejected calls never reach fetch');
		for (let i = 0; i < 10; i++) await client.checkText('test', { url: PUBLIC, language: 'auto', trigger: 'manual' });
		await assert.rejects(client.checkText('test', { url: PUBLIC, trigger: 'manual' }), /Local public API limit/);
		assert.strictEqual(requests, 10);
		now += 60000;
		await client.checkText('test', { url: PUBLIC, language: 'auto', trigger: 'manual' });

		const cooldownClient = loadSource('languagetool');
		global.fetch = async () => {
			requests++;
			return { ok: false, status: 429, headers: { get: () => '120' }, text: async () => 'rate limited' };
		};
		await assert.rejects(cooldownClient.checkText('test', { url: PUBLIC, trigger: 'manual' }), /HTTP 429/);
		const count = requests;
		now += 60000;
		await assert.rejects(cooldownClient.checkText('test', { url: PUBLIC, trigger: 'manual' }), /Local public API limit/);
		assert.strictEqual(requests, count, '429 cooldown blocks requests without automatic retries');
	} finally {
		global.fetch = originalFetch;
		Date.now = originalNow;
	}
}

async function createApp(options = {}) {
	const cache = {};
	const i18n = loadSource('i18n', {}, cache);
	i18n.setUiLanguage(options.language || 'en');
	const policy = loadSource('apiPolicy', {}, cache);
	let plugin;
	let contentMessage;
	let noteChange;
	let text = options.text || 'A Tesdt.';
	const settings = {
		url: options.url || PUBLIC, approvedServer: options.approved === false ? '' : options.url || PUBLIC,
		autoCheck: options.autoCheck === undefined ? true : options.autoCheck,
		autoCheckDelay: 1000, language: 'auto', ignoredWords: '', disabledRules: '', stripMarkdown: false,
	};
	const commands = {};
	const calls = [];
	const html = {};
	const opened = [];
	const timers = [];
	const fake = {
		plugins: { register: (value) => { plugin = value; } },
		contentScripts: { register: async () => {}, onMessage: async (_id, cb) => { contentMessage = cb; } },
		workspace: {
			selectedNote: async () => ({ id: 'n1', body: text }),
			onNoteChange: async (cb) => { noteChange = cb; },
			onNoteSelectionChange: async () => {}, filterEditorContextMenu: async () => {},
		},
		settings: {
			value: async (key) => settings[key.split('.').pop()],
			setValue: async (key, value) => { settings[key.split('.').pop()] = value; },
		},
		commands: {
			register: async (command) => { commands[command.name] = command; },
			execute: async (_command, args) => {
				if (args.name === 'ltGetText') {
					if (options.switchDuringRead) settings.url = CUSTOM;
					return text;
				}
				if (args.name === 'ltShowMistakes') return 17;
				if (args.name === 'ltReplaceBatch') {
					const edit = args.args[0][0];
					text = text.slice(0, edit.from) + edit.text + text.slice(edit.to);
					return true;
				}
				return true;
			},
		},
		views: {
			dialogs: {
				create: async (id) => id, setFitToContent: async () => {}, setButtons: async () => {},
				setHtml: async (id, value) => { html[id] = value; },
				open: async (id) => {
					opened.push(id);
					if (id === 'languagetool-consent') {
						if (options.switchDuringConsent) settings.url = CUSTOM;
						return { id: options.decline ? 'cancel' : 'ok' };
					}
					if (id === 'languagetool-results' && options.apply) {
						return { id: 'ok', formData: { ltForm: { choice_0: '0' } } };
					}
					return { id: 'cancel' };
				},
			},
			menuItems: { create: async () => {} }, toolbarButtons: { create: async () => {} },
		},
	};
	loadSource('index', {
		i18n, apiPolicy: policy,
		api: { default: fake },
		'api/types': { ContentScriptType: {}, MenuItemLocation: {}, ToolbarButtonLocation: {} },
		settings: {
			registerSettings: async () => {}, getSettings: async () => ({ ...settings }),
			ignoredWordsSet: () => new Set(),
			addWordToIgnored: (_current, word) => word,
			addRuleToDisabled: (_current, rule) => rule,
		},
		languagetool: {
			...loadSource('languagetool', {}, cache),
			checkText: async (value, config) => {
				calls.push({ text: value, ...config });
				return { matches: [{
					offset: 2, length: 5, message: 'Typo', replacements: [{ value: 'Test' }],
					rule: { id: 'TEST', description: 'Typo', issueType: 'misspelling' },
				}] };
			},
		},
	}, cache);
	await plugin.onStart();
	async function edits() {
		const originalSet = global.setTimeout;
		const originalClear = global.clearTimeout;
		try {
			global.setTimeout = (callback) => { timers.push(callback); return timers.length; };
			global.clearTimeout = () => {};
			contentMessage({ type: 'ltTextChanged' });
			noteChange();
			await settle();
			for (const timer of timers.splice(0)) { timer(); await settle(); }
		} finally {
			global.setTimeout = originalSet;
			global.clearTimeout = originalClear;
		}
	}
	return { calls, settings, html, opened, commands, edits, getText: () => text };
}

async function testAppPolicy() {
	// Even a migrated autoCheck=true may not schedule a free-public request.
	const app = await createApp({ apply: true });
	await app.edits();
	assert.strictEqual(app.calls.length, 0);
	await app.commands.languagetoolCheckNote.execute();
	assert.strictEqual(app.calls.length, 1, 'applying suggestions does not trigger a public refresh');
	assert.strictEqual(app.calls[0].trigger, 'manual');
	assert.strictEqual(app.getText(), 'A Test.');
	await app.commands.languagetoolIgnoreWord.execute('Tesdt');
	await app.commands.languagetoolIgnoreRule.execute('TEST');
	await app.edits();
	assert.strictEqual(app.calls.length, 1, 'ignore commands and edits never cause public background calls');

	const own = await createApp({ url: CUSTOM });
	await own.edits();
	assert.ok(own.calls.some((call) => call.trigger === 'background'), 'approved custom server supports opt-in automatic checks');
	const off = await createApp({ url: CUSTOM, autoCheck: false, apply: true });
	await off.edits();
	assert.strictEqual(off.calls.length, 0);
	await off.commands.languagetoolCheckNote.execute();
	assert.strictEqual(off.calls.length, 1, 'disabled automatic checking also disables correction refreshes');
	const unapproved = await createApp({ url: CUSTOM, approved: false });
	await unapproved.edits();
	assert.strictEqual(unapproved.calls.length, 0, 'no custom background traffic before consent');

	for (const language of ['en', 'de', 'fr']) {
		const cancelled = await createApp({ language, approved: false, decline: true });
		await cancelled.commands.languagetoolCheckNote.execute();
		assert.strictEqual(cancelled.calls.length, 0, 'declining sends no text');
		const consent = new JSDOM(cancelled.html['languagetool-consent']).window.document;
		assert.ok(consent.querySelector('a[href="https://languagetool.org"]'));
		assert.ok(consent.querySelector('a[href="https://languagetool.org/legal/privacy"]'));
		const approved = await createApp({ language, approved: false });
		await approved.commands.languagetoolCheckNote.execute();
		assert.strictEqual(approved.settings.approvedServer, PUBLIC);
		assert.strictEqual(approved.calls.length, 1);
		assert.strictEqual(approved.opened.filter((id) => id === 'languagetool-consent').length, 1);
		await approved.commands.languagetoolCheckNote.execute();
		assert.strictEqual(approved.opened.filter((id) => id === 'languagetool-consent').length, 1, 'approval is reused for the same endpoint');
		await approved.commands.languagetoolRevokeConsent.execute();
		assert.strictEqual(approved.settings.approvedServer, '');
		await approved.commands.languagetoolCheckNote.execute();
		assert.strictEqual(approved.opened.filter((id) => id === 'languagetool-consent').length, 2, 'revocation requires renewed consent');
	}
	const changed = await createApp({ approved: false, switchDuringConsent: true });
	await changed.commands.languagetoolCheckNote.execute();
	assert.strictEqual(changed.calls.length, 0, 'endpoint change during consent sends nothing');
	const changedDuringRead = await createApp({ switchDuringRead: true });
	await changedDuringRead.commands.languagetoolCheckNote.execute();
	assert.strictEqual(changedDuringRead.calls.length, 0, 'endpoint revalidated immediately before transmission');
	const revoked = await createApp({ url: CUSTOM });
	await revoked.commands.languagetoolRevokeConsent.execute();
	await revoked.edits();
	assert.strictEqual(revoked.calls.length, 0, 'revocation blocks custom automatic checks');
	const long = await createApp({ text: '😀'.repeat(6000) });
	await long.commands.languagetoolCheckNote.execute();
	assert.strictEqual(Buffer.byteLength(long.calls[0].text), 19000);
	assert.strictEqual(long.calls[0].text.length, 9500);
	assert.ok(long.html['languagetool-results'].includes('19000'));
	const manual = await createApp({ url: CUSTOM, approved: false });
	await manual.commands.languagetoolCheckNote.execute();
	manual.settings.url = PUBLIC;
	await manual.edits();
	assert.strictEqual(manual.calls.length, 1, 'switching from approved custom service to public never inherits background access');
}

(async () => {
	await testClientPolicy();
	await testAppPolicy();
	console.log('Public API manual-only guards, UTF-8 caps, local budgets, cooldowns, consent, endpoint changes and custom-server opt-in tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
