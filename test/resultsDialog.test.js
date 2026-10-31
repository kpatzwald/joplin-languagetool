// Echte DOM-Formularwerte plus Hauptskript-Ablauf mit gemockter Joplin-API.
// Kein Serveraufruf und kein vollständiger Joplin-GUI-Test.
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

const ui = loadSource('resultsDialog');
const text = 'Dieser längere Satz enthält einen Tesdt und einen Feler zur Kontrolle.';
const mistakes = ['Tesdt', 'Feler'].map((word) => ({
	offset: text.indexOf(word), length: word.length, word,
	message: 'Fehler <script>nicht ausführen</script>',
	replacements: word === 'Tesdt' ? ['Test', 'Text'] : ['Fehler', ''],
	issueType: 'spelling', ruleId: 'TEST', ruleDescription: '', category: '',
}));

function selectChoices(html) {
	const dom = new JSDOM(html);
	const doc = dom.window.document;
	const form = doc.forms.ltForm;
	assert.ok(doc.querySelector('.lt-context').textContent.includes('Dieser längere Satz'));
	assert.strictEqual(doc.querySelector('mark').textContent, 'Tesdt');
	assert.strictEqual(doc.querySelectorAll('script').length, 0, 'HTML escaped');
	let submissions = 0;
	form.addEventListener('submit', (event) => { submissions++; event.preventDefault(); });
	// Native Radiobuttons bleiben im Dialog, kein Submit beim Anklicken.
	doc.querySelector('input[name=choice_0][value="0"]').click();
	doc.querySelector('input[name=choice_1][value="0"]').click();
	doc.querySelector('input[name=choice_0][value="1"]').click();
	assert.strictEqual(submissions, 0, 'Auswahl schließt den Dialog nicht');
	const values = Object.fromEntries(new dom.window.FormData(form));
	assert.deepStrictEqual(values, { choice_0: '1', choice_1: '0' });
	assert.deepStrictEqual(ui.parseDialogChoices(values, mistakes), [
		{ mistakeIndex: 0, suggestionIndex: 1 }, { mistakeIndex: 1, suggestionIndex: 0 },
	]);
	return values;
}

selectChoices(ui.buildResultsHtml('Deutsch', mistakes, text, '', true));
// Viele Fundstellen bleiben in einem begrenzten, tastaturbedienbaren
// Scrollbereich. JSDOM prüft DOM/CSS und Formularwerte, nicht Pixel-Layout.
const manyMistakes = Array.from({ length: 100 }, () => mistakes[0]);
const longDialog = new JSDOM(ui.buildResultsHtml('Deutsch', manyMistakes, text, '', true));
const scroll = longDialog.window.document.querySelector('.lt-results-scroll');
assert.ok(scroll.contains(longDialog.window.document.forms.ltForm));
assert.strictEqual(scroll.tabIndex, 0, 'Scrollbereich per Tastatur erreichbar');
const scrollStyle = longDialog.window.getComputedStyle(scroll);
assert.strictEqual(scrollStyle.overflowY, 'scroll');
assert.strictEqual(scrollStyle.minHeight, '0', 'Flex-Inhalt kann auf Dialoghöhe begrenzt werden');
assert.strictEqual(longDialog.window.document.querySelectorAll('li').length, 100);
longDialog.window.document.querySelector('input[name=choice_99][value="0"]').click();
assert.strictEqual(new longDialog.window.FormData(
	longDialog.window.document.forms.ltForm,
).get('choice_99'), '0', 'auch letzte Fundstelle wird serialisiert');
assert.deepStrictEqual(ui.parseDialogChoices({ choice_0: '-1', choice_1: '99' }, mistakes), []);
assert.deepStrictEqual(ui.parseDialogChoices({ choice_0: 'abc', choice_1: '' }, mistakes), []);
assert.strictEqual(ui.validateBatch(text, []), null);
const hostile = { ...mistakes[0], offset: 0, length: 8 };
assert.ok(ui.contextHtml('<script>Hallo</script>', hostile).includes('&lt;script&gt;'));
const longText = 'A'.repeat(500) + 'Tesdt' + 'B'.repeat(500);
const context = ui.contextHtml(longText, { ...mistakes[0], offset: 500 });
assert.strictEqual((new JSDOM(context)).window.document.body.textContent.length, 367);

async function testMain(action) {
	let plugin;
	let currentText = text;
	let html = '';
	let batchCalls = 0;
	let checks = 0;
	let resultsOpened = 0;
	const registered = {};
	const messages = [];
	const note = { id: 'n1', body: text };
	let contentMessage;
	const fake = {
		plugins: { register: (value) => { plugin = value; } },
		contentScripts: {
			register: async () => {},
			onMessage: async (_id, callback) => { contentMessage = callback; },
		},
		workspace: {
			selectedNote: async () => note,
			onNoteSelectionChange: async () => {}, onNoteChange: async () => {},
			filterEditorContextMenu: async () => {},
		},
		commands: {
			register: async (command) => { registered[command.name] = command; },
			execute: async (_command, args) => {
				if (args.name === 'ltGetText') return currentText;
				if (args.name === 'ltShowMistakes') return 17;
				if (args.name === 'ltReplaceBatch') {
					batchCalls++;
					const [edits, token, expected] = args.args;
					assert.strictEqual(token, 17);
					assert.strictEqual(expected, text);
					if (expected !== currentText) return false;
					for (const edit of [...edits].sort((a, b) => b.from - a.from)) {
						currentText = currentText.slice(0, edit.from) + edit.text + currentText.slice(edit.to);
					}
					return true;
				}
			},
		},
		views: {
			dialogs: {
				create: async (id) => id, setFitToContent: async () => {},
				setHtml: async (handle, value) => {
					if (handle === 'languagetool-results') html = value;
					else messages.push(value);
				},
				setButtons: async (handle, buttons) => {
					if (handle === 'languagetool-results') assert.deepStrictEqual(
						buttons.map((button) => button.title), ['Übernehmen', 'Abbrechen'],
					);
				},
				open: async (handle) => {
					if (handle !== 'languagetool-results') return { id: 'ok' };
					resultsOpened++;
					contentMessage({ type: 'ltTextChanged' }); // darf Auswahl nicht durch Neuprüfung entwerten
					const formData = { ltForm: selectChoices(html) };
					if (action === 'stale') currentText += ' geändert';
					if (action === 'note') note.id = 'n2';
					return { id: action === 'cancel' ? 'cancel' : 'ok', formData };
				},
			},
			menuItems: { create: async () => {} }, toolbarButtons: { create: async () => {} },
		},
	};
	const result = {
		language: { name: 'Deutsch' },
		matches: mistakes.map((mistake) => ({
			offset: mistake.offset, length: mistake.length, message: mistake.message,
			replacements: mistake.replacements.map((value) => ({ value })),
			rule: { id: 'TEST', issueType: 'misspelling', description: '' },
		})),
	};
	loadSource('index', {
		api: { default: fake },
		'api/types': { ContentScriptType: {}, MenuItemLocation: {}, ToolbarButtonLocation: {} },
		settings: {
			registerSettings: async () => {},
			getSettings: async () => ({ stripMarkdown: false, ignoredWords: '', autoCheck: false }),
			ignoredWordsSet: () => new Set(),
		},
		languagetool: { checkText: async () => { checks++; return result; } },
	});
	await plugin.onStart();
	await registered.languagetoolCheckNote.execute();
	assert.strictEqual(resultsOpened, 1, 'Dialog nach gemeinsamer Übernahme nicht erneut geöffnet');
	if (action === 'apply') {
		assert.strictEqual(batchCalls, 1);
		assert.strictEqual(currentText, text.replace('Tesdt', 'Text').replace('Feler', 'Fehler'));
		assert.strictEqual(checks, 2, 'nach Übernahme lautlose Neuprüfung');
	} else if (action === 'cancel') {
		assert.strictEqual(batchCalls, 0);
		assert.strictEqual(currentText, text);
	} else {
		assert.strictEqual(checks, 1);
		assert.ok(messages.some((message) => message.includes('nichts übernommen')));
	}
	if (action === 'note') assert.strictEqual(batchCalls, 0, 'andere Notiz wird nicht beschrieben');
}

(async () => {
	for (const action of ['apply', 'cancel', 'stale', 'note']) await testMain(action);
	console.log('Dialog-DOM, Sammelauswahl, Hauptskript-Ablauf, Abbrechen und veraltete Auswahl: bestanden.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
