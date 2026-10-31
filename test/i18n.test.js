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

async function testStartup(savedLanguage, locale = 'en_GB', expectedLanguage = 'en', apiMode = 'current') {
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
	let localeReads = 0;
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
	const apiSettings = mocks.api.default.settings;
	if (apiMode === 'current' || apiMode === 'failure') {
		apiSettings.globalValues = async (keys) => {
			assert.deepStrictEqual(keys, ['locale']);
			localeReads++;
			if (apiMode === 'failure') throw new Error('simulated unavailable locale');
			return [locale];
		};
	} else if (apiMode === 'legacy') {
		apiSettings.globalValue = async (key) => {
			assert.strictEqual(key, 'locale');
			localeReads++;
			return locale;
		};
	}
	const settings = loadSource('settings', mocks, cache);
	const warnings = [];
	const originalWarn = console.warn;
	try {
		if (apiMode === 'failure') console.warn = (...args) => { warnings.push(args); };
		await settings.registerSettings();
	} finally {
		console.warn = originalWarn;
	}
	if (apiMode === 'failure') {
		assert.strictEqual(warnings.length, 1);
		assert.ok(warnings[0][0].includes('Could not read Joplin locale; using English.'));
	}
	assert.strictEqual(i18n.getUiLanguage(), expectedLanguage);
	assert.strictEqual(registered['languagetool.uiLanguage'].value, 'auto');
	assert.deepStrictEqual(registered['languagetool.uiLanguage'].options, {
		auto: 'Automatic (Joplin)', en: 'English', de: 'Deutsch', fr: 'Français',
	});
	assert.strictEqual(registered['languagetool.uiLanguage'].isEnum, true);
	assert.strictEqual(registered['languagetool.url'].label, {
		en: 'Server URL', de: 'Server-URL', fr: 'URL du serveur',
	}[expectedLanguage]);
	assert.strictEqual(registered['languagetool.language'].label, {
		en: 'Language', de: 'Prüfsprache', fr: 'Langue de vérification',
	}[expectedLanguage]);
	const automatic = savedLanguage === undefined || savedLanguage === null || savedLanguage === 'auto';
	assert.strictEqual(localeReads, automatic && apiMode !== 'missing' ? 1 : 0,
		'manual overrides do not read the Joplin locale');
	const values = await settings.getSettings();
	assert.strictEqual(values.language, 'fr-FR', 'UI language must not change checking language');
	assert.strictEqual(values.motherTongue, 'es', 'UI language must not change mother tongue');
	assert.strictEqual(values.ignoredWords, 'custom');
	assert.strictEqual(writes, 0, 'startup does not overwrite saved preferences');

	// Check every settings label and description is in the selected catalog.
	for (const [, item] of Object.entries(registered).filter(([key, item]) => item.public && key !== 'languagetool.uiLanguage')) {
		for (const field of ['label', 'description']) {
			assert.ok(expectedLanguage !== 'en'
				? Object.values(i18n.catalogs[expectedLanguage]).includes(item[field])
				: Object.prototype.hasOwnProperty.call(i18n.de, item[field]));
		}
	}

	const common = loadSource('common', mocks, cache);
	const mistake = common.mistakeToPayload(
		{ offset: 0, length: 5, replacements: [{ value: '' }] }, 'erors', 'erors', new Set(),
	);
	assert.strictEqual(mistake.message, {
		en: 'Unknown error', de: 'Unbekannter Fehler', fr: 'Erreur inconnue',
	}[expectedLanguage]);
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
		}), (error) => error.statusCode === 404 && error.message.includes({
			en: 'Server returned HTTP 404', de: 'Server antwortete mit HTTP 404', fr: 'Le serveur a renvoyé HTTP 404',
		}[expectedLanguage])
			&& error.message.includes('server detail') && error.message.includes(i18n.t(' Hint: the URL usually needs to end with "/v2/check".')));
	} finally {
		global.fetch = originalFetch;
	}
	return i18n;
}

(async () => {
	const i18n = await testStartup('de', 'fr_FR', 'de');
	await testStartup('en', 'de_DE', 'en');
	await testStartup('fr', 'de_DE', 'fr');
	await testStartup('auto', 'de_DE', 'de');
	await testStartup('auto', 'fr_FR', 'fr');
	await testStartup('auto', 'fr-CA', 'fr');
	await testStartup('auto', 'DE-at', 'de');
	await testStartup('auto', 'en_US', 'en');
	await testStartup('auto', 'es_ES', 'en');
	await testStartup('auto', null, 'en');
	await testStartup(undefined);
	await testStartup(undefined, 'fr_FR', 'fr');
	await testStartup(null, 'de_DE', 'de');
	await testStartup('unsupported');
	await testStartup('auto', 'fr_FR', 'fr', 'legacy');
	await testStartup('auto', 'fr_FR', 'en', 'missing');
	await testStartup('auto', 'fr_FR', 'en', 'failure');
	for (const catalog of [i18n.de, i18n.fr]) {
		assert.deepStrictEqual(Object.keys(catalog).sort(), Object.keys(i18n.de).sort());
		for (const [key, value] of Object.entries(catalog)) {
			assert.ok(value.trim(), 'translations must not be empty');
			assert.deepStrictEqual(placeholders(value), placeholders(key), 'placeholder parity: ' + key);
		}
	}
	for (const [locale, language] of [
		['de_DE', 'de'], ['de-CH', 'de'], ['FR_ca', 'fr'], [' fr-FR ', 'fr'],
		['en-GB', 'en'], ['it_IT', 'en'], [undefined, 'en'], [{}, 'en'],
	]) assert.strictEqual(i18n.normalizeUiLanguage(locale), language);
	i18n.setUiLanguage('de');
	assert.strictEqual(i18n.t('Always ignore "{word}"', { word: '{rule}$&<test>' }), '"{rule}$&<test>" immer ignorieren');
	// A missing translation falls back to the original English string.
	const saved = i18n.de.Apply;
	delete i18n.de.Apply;
	assert.strictEqual(i18n.t('Apply'), 'Apply');
	i18n.de.Apply = saved;
	i18n.setUiLanguage('fr');
	assert.strictEqual(i18n.t('Apply'), 'Appliquer');
	assert.strictEqual(i18n.t('Cancel'), 'Annuler');
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
	console.log('Automatic locale detection, manual overrides, English/German/French catalogs, API compatibility, fallbacks, placeholders, settings and HTTP error tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
