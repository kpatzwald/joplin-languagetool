// English interface regression tests. All HTTP responses are mocked.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

function loadSource(name, mocks = {}, cache = {}) {
	if (mocks[name]) return mocks[name];
	if (cache[name]) return cache[name].exports;
	const source = fs.readFileSync(path.join(__dirname, '../src', name + '.ts'), 'utf8');
	const code = ts.transpileModule(source, {
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

async function run() {
	const manifest = require('../src/manifest.json');
	const pkg = require('../package.json');
	assert.strictEqual(manifest.name, 'LanguageTool for Joplin');
	assert.strictEqual(manifest.author, 'Kay Patzwald');
	assert.strictEqual(manifest.id, 'de.osz2.languagetool');
	assert.strictEqual(manifest.version, pkg.version);

	const registered = {};
	const settings = loadSource('settings', {
		api: { default: { settings: {
			registerSection: async () => {},
			registerSettings: async (values) => { Object.assign(registered, values); },
			value: async () => 'en',
		} } },
		'api/types': { SettingItemType: {} },
	});
	await settings.registerSettings();
	assert.strictEqual(Object.keys(registered).length, 12);
	assert.strictEqual(registered['languagetool.uiLanguage'].value, 'auto');
	assert.deepStrictEqual(Object.values(registered).slice(1).map((item) => item.label), [
		'Server URL', 'Language', 'Mother tongue', 'Check automatically',
		'Delay before automatic checking (ms)', 'Mask Markdown syntax', 'Disabled rules',
		'Disabled categories', 'Personal dictionary', 'Username (optional)', 'API key (optional)',
	]);
	assert.strictEqual(registered['languagetool.url'].value, 'https://api.languagetool.org/v2/check');
	assert.strictEqual(registered['languagetool.language'].value, 'auto');
	assert.strictEqual(registered['languagetool.motherTongue'].value, 'de-DE');
	assert.strictEqual(registered['languagetool.autoCheck'].value, true);

	const common = loadSource('common');
	const match = { offset: 0, length: 5, replacements: [] };
	const mistake = common.mistakeToPayload(match, 'erors', 'erors', new Set());
	assert.strictEqual(mistake.message, 'Unknown error');
	// Server-supplied text must be preserved, not translated or replaced.
	const serverMessage = 'Server-provided message: \u00fc';
	assert.strictEqual(common.mistakeToPayload(
		{ ...match, message: serverMessage }, 'erors', 'erors', new Set(),
	).message, serverMessage);

	const ui = loadSource('resultsDialog');
	const doc = new JSDOM(ui.buildResultsHtml(
		'English', [{ ...mistake, replacements: ['errors', ''] }], 'erors', '', true,
	)).window.document;
	assert.strictEqual(doc.querySelector('h3').textContent, 'LanguageTool check');
	assert.strictEqual(doc.querySelector('legend').textContent, 'Select a correction');
	assert.strictEqual(doc.querySelector('.lt-option span').textContent, 'Leave unchanged');
	assert.ok(doc.body.textContent.includes('[Delete]'));
	assert.ok(doc.body.textContent.includes('Rule:'));
	assert.strictEqual(doc.querySelector('[role=region]').getAttribute('aria-label'), 'Matches and correction suggestions');
	assert.ok(ui.buildResultsHtml('English', [], '', '', false).includes('No errors found.'));
	assert.ok(ui.buildResultsHtml('English', [], '', '', false).includes('Please check again in the Markdown editor.'));

	const client = loadSource('languagetool');
	const originalFetch = global.fetch;
	const options = { url: 'https://languagetool.example.org/v2/check', language: 'auto' };
	try {
		global.fetch = async () => { throw new Error('offline'); };
		await assert.rejects(client.checkText('test', options), /Server unreachable/);
		global.fetch = async () => ({ ok: false, status: 404, text: async () => 'Not found' });
		await assert.rejects(client.checkText('test', options), (error) =>
			error.statusCode === 404 && error.message.includes('Server returned HTTP 404')
			&& error.message.includes('Hint: the URL usually needs to end with "/v2/check".'));
		global.fetch = async () => ({ ok: true, json: async () => { throw new Error('invalid'); } });
		await assert.rejects(client.checkText('test', options), /The server response is not valid JSON/);
		global.fetch = async () => ({ ok: true, json: async () => ({}) });
		await assert.rejects(client.checkText('test', options), /Unexpected server response structure/);
	} finally {
		global.fetch = originalFetch;
	}
	console.log('English labels, defaults, fallback text and mocked client error tests passed.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
