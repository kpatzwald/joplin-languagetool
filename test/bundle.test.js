// Exercise the actual main script extracted from the release .jpl.
// This is an isolated JavaScript VM with mocked Joplin and fetch, not a GUI test.
const assert = require('assert');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');
const tar = require('tar');

const archive = path.join(__dirname, '../publish/de.osz2.languagetool.jpl');
const entries = {};
tar.t({ file: archive, sync: true, onReadEntry: (entry) => {
	const chunks = [];
	entry.on('data', (chunk) => chunks.push(chunk));
	entry.on('end', () => { entries[entry.path] = Buffer.concat(chunks).toString('utf8'); });
} });
const extract = (name) => {
	assert.ok(entries[name], 'missing archive entry: ' + name);
	return entries[name];
};
const manifest = JSON.parse(extract('manifest.json'));
assert.strictEqual(manifest.version, require('../package.json').version);
assert.strictEqual(manifest.author, 'Kay Patzwald');
assert.deepStrictEqual(manifest.platforms, ['desktop']);
const endpoint = 'https://api.languagetool.org/v2/check';
const saved = {
	'languagetool.url': endpoint,
	'languagetool.uiLanguage': 'auto',
	'languagetool.autoCheck': true, // Simulate a pre-1.6.0 installation.
};
let plugin;
let textChanged;
let noteChanged;
let consent = false;
let transmissions = 0;
let consentDialogs = 0;
let resultHtml = '';
const commands = {};
const html = {};

const joplin = {
	plugins: { register: (value) => { plugin = value; } },
	settings: {
		registerSection: async () => {},
		registerSettings: async (items) => {
			for (const [key, item] of Object.entries(items)) {
				if (!(key in saved)) saved[key] = item.value;
			}
		},
		value: async (key) => saved[key],
		setValue: async (key, value) => { saved[key] = value; },
		globalValues: async () => ['fr_FR'],
	},
	contentScripts: {
		register: async () => {},
		onMessage: async (_id, callback) => { textChanged = callback; },
	},
	workspace: {
		selectedNote: async () => ({ id: 'test', body: 'A Tesdt.' }),
		onNoteSelectionChange: async () => {},
		onNoteChange: async (callback) => { noteChanged = callback; },
		filterEditorContextMenu: async () => {},
	},
	commands: {
		register: async (command) => { commands[command.name] = command; },
		execute: async (_command, args) => args.name === 'ltGetText' ? 'A Tesdt.'
			: args.name === 'ltShowMistakes' ? 42 : true,
	},
	views: {
		dialogs: {
			create: async (id) => id,
			setFitToContent: async () => {}, setButtons: async () => {},
			setHtml: async (id, value) => {
				html[id] = value;
				if (id === 'languagetool-results') resultHtml = value;
			},
			open: async (id) => {
				if (id === 'languagetool-consent') {
					consentDialogs++;
					const doc = new JSDOM(html[id]).window.document;
					assert.strictEqual(doc.querySelector('h3').textContent, 'Transmission du texte et confidentialité');
					assert.ok(doc.querySelector('a[href="https://languagetool.org/legal/privacy"]'));
					return { id: consent ? 'ok' : 'cancel' };
				}
				return { id: 'cancel' };
			},
		},
		menuItems: { create: async () => {} }, toolbarButtons: { create: async () => {} },
	},
};

vm.runInNewContext(extract('index.js'), {
	joplin, console, URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
	fetch: async (url, options) => {
		transmissions++;
		assert.strictEqual(url, endpoint);
		assert.strictEqual(saved['languagetool.approvedServer'], endpoint);
		assert.strictEqual(options.method, 'POST');
		assert.strictEqual(options.redirect, 'error');
		assert.strictEqual(new URLSearchParams(options.body).get('text'), 'A Tesdt.');
		return { ok: true, json: async () => ({ matches: [] }) };
	},
}, { filename: 'packaged-index.js' });

(async () => {
	await plugin.onStart();
	assert.strictEqual(commands.languagetoolCheckNote.label, 'LanguageTool : vérifier la note');
	await commands.languagetoolCheckNote.execute();
	assert.strictEqual(transmissions, 0, 'packaged plugin honors consent cancellation');
	consent = true;
	await commands.languagetoolCheckNote.execute();
	assert.strictEqual(transmissions, 1, 'packaged plugin sends exactly one approved manual request');
	assert.ok(resultHtml.includes('Aucune erreur trouvée.'));
	const attribution = new JSDOM(resultHtml).window.document.querySelector('a[href="https://languagetool.org"]');
	assert.ok(attribution && !attribution.rel.includes('nofollow'));
	textChanged({ type: 'ltTextChanged' });
	noteChanged();
	for (let i = 0; i < 30; i++) await Promise.resolve();
	assert.strictEqual(transmissions, 1, 'packaged plugin blocks old autoCheck=true on the public API');
	await commands.languagetoolRevokeConsent.execute();
	assert.strictEqual(saved['languagetool.approvedServer'], '');
	await commands.languagetoolCheckNote.execute();
	assert.strictEqual(consentDialogs, 3, 'packaged plugin asks again after revocation');
	assert.strictEqual(transmissions, 2);
	console.log('Packaged .jpl smoke test passed: locale, consent, one manual POST, no public background traffic and revocation.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
