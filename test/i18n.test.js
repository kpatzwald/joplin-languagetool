// Localization tests use persisted-setting mocks and never contact a server.
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

const placeholders = (text) => (text.match(/\{\w+\}/g) || []).sort();

async function testStartup(savedLanguage) {
	const cache = {};
	const i18n = loadSource('i18n', {}, cache);
	assert.strictEqual(i18n.getUiLanguage(), 'en', 'fresh process defaults to English');
	const registered = {};
	const saved = {
		'languagetool.uiLanguage': savedLanguage,
		'languagetool.language': 'fr-FR',
		'languagetool.motherTongue': 'es',
		'languagetool.ignoredWords': 'custom',
	};
	let writes = 0;
	const mocks = {
		api: { default: { settings: {
			registerSection: async () => {},
			registerSettings: async (items) => {
				for (const [key, item] of Object.entries(items)) {
					assert.ok(!registered[key], 'each setting is registered only once');
					registered[key] = item;
				}
			},
			value: async (key) => {
				assert.ok(registered[key], 'setting must be registered before being read');
				return saved[key] === undefined ? registered[key].value : saved[key];
			},
			setValue: async () => { writes++; },
		} } },
		'api/types': { SettingItemType: { String: 2, Bool: 3, Int: 1 } },
	};
	const settings = loadSource('settings', mocks, cache);
	await settings.registerSettings();
	const expectedLanguage = savedLanguage === 'de' ? 'de' : 'en';
	assert.strictEqual(i18n.getUiLanguage(), expectedLanguage);
	assert.strictEqual(registered['languagetool.uiLanguage'].value, 'en');
	assert.deepStrictEqual(registered['languagetool.uiLanguage'].options, { en: 'English', de: 'Deutsch' });
	assert.strictEqual(registered['languagetool.uiLanguage'].isEnum, true);
	assert.strictEqual(registered['languagetool.url'].label, expectedLanguage === 'de' ? 'Server-URL' : 'Server URL');
	assert.strictEqual(registered['languagetool.language'].label, expectedLanguage === 'de' ? 'Prüfsprache' : 'Language');
	const values = await settings.getSettings();
	assert.strictEqual(values.language, 'fr-FR', 'UI language must not change checking language');
	assert.strictEqual(values.motherTongue, 'es', 'UI language must not change mother tongue');
	assert.strictEqual(values.ignoredWords, 'custom');
	assert.strictEqual(writes, 0, 'startup does not overwrite saved preferences');

	// Check every settings label and description has a German translation.
	for (const item of Object.values(registered).slice(1)) {
		for (const field of ['label', 'description']) {
			assert.ok(expectedLanguage === 'de'
				? Object.values(i18n.de).includes(item[field])
				: Object.prototype.hasOwnProperty.call(i18n.de, item[field]));
		}
	}

	const common = loadSource('common', mocks, cache);
	const mistake = common.mistakeToPayload(
		{ offset: 0, length: 5, replacements: [{ value: '' }] }, 'erors', 'erors', new Set(),
	);
	assert.strictEqual(mistake.message, expectedLanguage === 'de' ? 'Unbekannter Fehler' : 'Unknown error');
	const ui = loadSource('resultsDialog', mocks, cache);
	const doc = new JSDOM(ui.buildResultsHtml('<img src=x>', [mistake], 'erors', '', false)).window.document;
	assert.strictEqual(doc.querySelector('.lt-dialog').lang, expectedLanguage);
	assert.strictEqual(doc.querySelector('legend').textContent, i18n.t('Select a correction'));
	assert.ok(doc.body.textContent.includes(`[${i18n.t('Delete')}]`));
	assert.ok(doc.body.textContent.includes(i18n.t('Applying corrections is unavailable. Please check again in the Markdown editor.')));
	assert.strictEqual(doc.querySelectorAll('img').length, 0, 'interpolated language name is escaped');

	const client = loadSource('languagetool', mocks, cache);
	assert.throws(() => client.normalizeCheckUrl(''), (error) => error.message === i18n.t('No server URL configured.'));
	const originalFetch = global.fetch;
	try {
		global.fetch = async () => ({ ok: false, status: 404, text: async () => 'server detail' });
		await assert.rejects(client.checkText('test', {
			url: 'https://languagetool.example.org/v2/check', language: 'auto',
		}), (error) => error.statusCode === 404 && error.message.includes(expectedLanguage === 'de'
			? 'Server antwortete mit HTTP 404' : 'Server returned HTTP 404')
			&& error.message.includes('server detail') && error.message.includes(i18n.t(' Hint: the URL usually needs to end with "/v2/check".')));
	} finally {
		global.fetch = originalFetch;
	}
	return i18n;
}

(async () => {
	const i18n = await testStartup('de');
	await testStartup('en');
	await testStartup(undefined);
	await testStartup('unsupported');
	for (const [key, value] of Object.entries(i18n.de)) {
		assert.ok(value.trim(), 'translations must not be empty');
		assert.deepStrictEqual(placeholders(value), placeholders(key), 'placeholder parity: ' + key);
	}
	i18n.setUiLanguage('de');
	assert.strictEqual(i18n.t('Always ignore "{word}"', { word: '{rule}$&<test>' }), '"{rule}$&<test>" immer ignorieren');
	// A missing translation falls back to the original English string.
	const saved = i18n.de.Apply;
	delete i18n.de.Apply;
	assert.strictEqual(i18n.t('Apply'), 'Apply');
	i18n.de.Apply = saved;
	i18n.setUiLanguage('en');
	assert.strictEqual(i18n.t('Apply'), 'Apply');

	// Inspect literal t() calls and keep the translation catalog complete.
	for (const file of fs.readdirSync(path.join(__dirname, '../src')).filter((file) => file.endsWith('.ts'))) {
		const source = fs.readFileSync(path.join(__dirname, '../src', file), 'utf8');
		const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
		function visit(node) {
			if (ts.isCallExpression(node) && node.expression.getText(parsed) === 't'
				&& ts.isStringLiteral(node.arguments[0])) {
				assert.ok(Object.prototype.hasOwnProperty.call(i18n.de, node.arguments[0].text), 'missing translation: ' + node.arguments[0].text);
			}
			ts.forEachChild(node, visit);
		}
		visit(parsed);
	}
	console.log('English/German startup, fallback, catalog coverage, placeholders, escaping, settings and HTTP error tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
