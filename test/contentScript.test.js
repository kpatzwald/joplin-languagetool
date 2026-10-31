// Integrationstest des kompilierten Content-Scripts mit echtem @codemirror/state.
// Läuft außerhalb von Joplin mit einem gemockten CodeMirrorControl-Wrapper.

const assert = require('assert');
const { EditorState } = require('@codemirror/state');
const { EditorView } = require('@codemirror/view');
const pluginFactory = require('../dist/contentScript.js').default;

function djb2(s) {
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	return h;
}

function makeFixture(text) {
	const extensions = [];
	const commands = {};
	const domListeners = {};
	const messages = [];
	const dispatches = [];
	let state;
	let posAtCoordsResult = null; // null = Klick außerhalb des Texts

	const view = {
		get state() { return state; },
		dispatch(spec) { dispatches.push(spec); state = state.update(spec).state; },
		dom: {
			addEventListener(name, handler) { domListeners[name] = handler; },
		},
		posAtCoords() { return posAtCoordsResult; },
	};
	Object.defineProperty(view, 'posAtCoordsResult', {
		get: () => posAtCoordsResult,
		set: (v) => { posAtCoordsResult = v; },
	});

	const wrapper = {
		cm6: view,
		addExtension: (ext) => extensions.push(ext),
		registerCommand: (name, fn) => { commands[name] = fn; },
	};

	const mod = pluginFactory({ contentScriptId: 'test', postMessage: async (m) => { messages.push(m); return null; } });
	mod.plugin(wrapper);
	state = EditorState.create({ doc: text, extensions });

	const decorations = () => {
		const sets = state.facet(EditorView.decorations);
		let count = 0; const ranges = [];
		for (const set of sets) {
			const iter = set.iter();
			while (iter.value) { count++; ranges.push([iter.from, iter.to, iter.value.spec.class]); iter.next(); }
		}
		return { count, ranges };
	};

	return { view, state: () => state, commands, decorations, domListeners, messages, dispatches };
}

const MISTAKE = (offset, word, type = 'spelling') => ({
	offset,
	length: word.length,
	word,
	message: 'Tippfehler',
	replacements: ['Test'],
	issueType: type,
	ruleId: 'X',
	ruleDescription: '',
	category: '',
});

async function run() {
	const text = 'Das ist ein Tesdt mit Fehlern.';
	const fx = makeFixture(text);
	const { commands, view, decorations, domListeners } = fx;

	const hash = djb2(text);

	// 1. ltGetText
	assert.strictEqual(commands.ltGetText(), text, 'ltGetText liefert den Dokumenttext');

	// 2. ltShowMistakes mit falschem Hash -> abgelehnt, keine Marks
	assert.strictEqual(commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: hash + 1, noteId: 'n1' }), false, 'falscher Hash wird abgelehnt');
	assert.strictEqual(decorations().count, 0, 'keine Marks nach falschem Hash');

	// 3. Korrektur ohne gültiges Prüfergebnis -> abgelehnt
	assert.strictEqual(commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', 1), false, 'Korrektur ohne gültiges Ergebnis abgelehnt');

	// 4. ltShowMistakes mit richtigem Hash -> akzeptiert, Marks gesetzt.
	//    Rückgabe ist ein eindeutiges Ergebnis-Token (Zahl).
	const token1 = commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt'), MISTAKE(22, 'Fehlern', 'grammar')], hash, noteId: 'n1' });
	assert.ok(typeof token1 === 'number' && token1 > 0, 'ltShowMistakes liefert ein eindeutiges Token');
	const d = decorations();
	assert.strictEqual(d.count, 2, 'zwei Marks gesetzt');
	assert.deepStrictEqual(d.ranges[0], [12, 17, 'lt-spelling'], 'Mark 1 korrekt');
	assert.deepStrictEqual(d.ranges[1], [22, 29, 'lt-grammar'], 'Mark 2 korrekt');

	// 5. Korrektur mit falschem erwartetem Text -> abgelehnt, unverändert
	const before = commands.ltGetText();
	assert.strictEqual(commands.ltReplaceRange(12, 17, 'Test', 'FALSCHE-ERWARTUNG', token1), false, 'Korrektur mit falschem erwartetem Text abgelehnt');
	assert.strictEqual(commands.ltGetText(), before, 'Dokument unverändert nach abgelehnter Korrektur');

	// 6. Korrektur mit falschem Ergebnis-Token -> abgelehnt
	assert.strictEqual(commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', token1 + 999), false, 'Korrektur mit falschem Ergebnis-Token abgelehnt');
	assert.strictEqual(commands.ltGetText(), before, 'Dokument unverändert');

	// 7. Korrektur mit korrektem Token und erwartetem Text -> angewendet
	assert.strictEqual(commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', token1), true, 'Korrektur mit gültigem Token angewendet');
	assert.ok(view.state.doc.toString().includes('ein Test mit'), 'Ersetzung im Dokument vorhanden');

	// 8. Nach jeder Textänderung (docChanged) wird das Ergebnis-Token entwertet:
	//    eine Korrektur wird abgelehnt, selbst wenn das Fehlerwort an derselben
	//    Position unverändert weiterexistiert. Die Änderung erfolgt am
	//    Dokumentende, damit das zweite 'Tesdt' nicht verschoben wird.
	const text2 = 'Das ist ein Tesdt mit Fehlern und noch einem Tesdt hier.';
	const fx2 = makeFixture(text2);
	const hash2 = djb2(text2);
	const offset2 = text2.lastIndexOf('Tesdt');
	const token2 = fx2.commands.ltShowMistakes({ mistakes: [MISTAKE(offset2, 'Tesdt')], hash: hash2, noteId: 'n2' });
	assert.ok(typeof token2 === 'number', 'Token für fx2 gesetzt');
	assert.strictEqual(fx2.commands.ltGetText().slice(offset2, offset2 + 5), 'Tesdt', 'Fehlerwort liegt unverändert an der Zielposition');
	// Änderung am Dokumentende: 'Tesdt' an offset2 bleibt unverändert bestehen
	fx2.view.dispatch({ changes: { from: text2.length, to: text2.length, insert: ' Und Ende.' } });
	assert.strictEqual(fx2.commands.ltGetText().slice(offset2, offset2 + 5), 'Tesdt', 'Fehlerwort unverändert nach Dokumentänderung');
	assert.strictEqual(
		fx2.commands.ltReplaceRange(offset2, offset2 + 5, 'Test', 'Tesdt', token2),
		false,
		'Korrektur nach Textänderung abgelehnt (Token entwertet)',
	);
	assert.ok(fx2.commands.ltGetText().endsWith('Und Ende.'), 'nur die manuelle Änderung im Dokument');

	// 8b. Tokens sind eindeutig und werden bei jedem Prüfergebnis neu vergeben.
	const fx2b = makeFixture(text);
	const hash2b = djb2(text);
	const tokenA = fx2b.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: hash2b, noteId: 'n2b' });
	fx2b.commands.ltClearMistakes();
	const tokenB = fx2b.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: hash2b, noteId: 'n2b' });
	assert.ok(typeof tokenA === 'number' && typeof tokenB === 'number', 'beide Tokens sind Zahlen');
	assert.notStrictEqual(tokenA, tokenB, 'Tokens für denselben Text unterscheiden sich');
	assert.strictEqual(fx2b.commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', tokenA), false, 'altes Token nach Verwerfen abgelehnt');
	assert.strictEqual(fx2b.commands.ltGetText(), text, 'Dokument nach altem Token unverändert');
	assert.strictEqual(fx2b.commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', tokenB), true, 'aktuelles Token wird akzeptiert');
	assert.ok(fx2b.commands.ltGetText().includes('ein Test mit'), 'Ersetzung mit aktuellem Token angewendet');

	// 9. Gescheiterte Positionen werden nicht an Dokumentgrenzen begrenzt
	const fx3 = makeFixture('Kurzer Text.');
	const token3 = fx3.commands.ltShowMistakes({ mistakes: [MISTAKE(0, 'Kurzer')], hash: djb2('Kurzer Text.'), noteId: 'n3' });
	assert.ok(typeof token3 === 'number', 'Token für fx3 gesetzt');
	assert.strictEqual(fx3.commands.ltReplaceRange(50, 60, 'X', 'Kurzer', token3), false, 'Bereich jenseits der Dokumentlänge abgelehnt');
	assert.strictEqual(fx3.commands.ltReplaceRange(-5, 3, 'X', 'Kur', token3), false, 'negativer Bereich abgelehnt');

	// 10. ltClearMistakes entwertet das Ergebnis: alte Korrektur wird abgelehnt
	const fx4 = makeFixture(text);
	const h4 = djb2(text);
	const token4 = fx4.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: h4, noteId: 'n4' });
	fx4.commands.ltClearMistakes();
	assert.strictEqual(fx4.commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', token4), false, 'Korrektur aus verworfenem Prüfergebnis abgelehnt');
	assert.strictEqual(fx4.commands.ltGetText(), text, 'Dokument unverändert');
	assert.strictEqual(fx4.decorations().count, 0, 'Marks nach Verwerfen entfernt');

	// 11. Rechtsklick-Kontext: null wird beim Ereignisstart verworfen
	const fx5 = makeFixture(text);
	const h5 = djb2(text);
	fx5.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: h5, noteId: 'n5' });

	assert.strictEqual(fx5.commands.ltGetClickContext(), null, 'kein Klick-Kontext ohne Rechtsklick');

	// Klick auf Position 12 (gültig)
	fx5.view.posAtCoordsResult = 12;
	fx5.domListeners.contextmenu({ clientX: 100, clientY: 100 });
	let ctx = fx5.commands.ltGetClickContext();
	assert.deepStrictEqual(ctx, { pos: 12, hash: h5 }, 'Klick-Kontext nach gültigem Rechtsklick');
	assert.strictEqual(fx5.commands.ltGetClickContext(), null, 'Kontext wird beim Lesen verbraucht');

	// Klick außerhalb des Texts: alter Kontext bleibt verworfen
	fx5.view.posAtCoordsResult = 12;
	fx5.domListeners.contextmenu({ clientX: 100, clientY: 100 });
	fx5.view.posAtCoordsResult = null;
	fx5.domListeners.contextmenu({ clientX: 999, clientY: 999 });
	assert.strictEqual(fx5.commands.ltGetClickContext(), null, 'ungültiger Klick liefert keinen alten Kontext');

	// 12. Textänderung verwirft die Marks
	const fx6 = makeFixture(text);
	fx6.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: djb2(text), noteId: 'n6' });
	assert.strictEqual(fx6.decorations().count, 1, 'Mark gesetzt');
	fx6.view.dispatch({ changes: { from: 0, to: 4, insert: 'Dies' } });
	assert.strictEqual(fx6.decorations().count, 0, 'Marks nach Textänderung verworfen');

	// 13. Textänderungen werden für die Live-Prüfung an das Hauptskript gemeldet
	const fx7 = makeFixture('Kurzer Text.');
	fx7.messages.length = 0;
	fx7.view.dispatch({ changes: { from: 0, to: 6, insert: 'Langer ' } });
	assert.ok(
		fx7.messages.some((m) => m && m.type === 'ltTextChanged'),
		'Textänderung als ltTextChanged gemeldet',
	);
	assert.strictEqual(fx7.messages.filter((m) => m && m.type === 'ltTextChanged').length, 1, 'genau eine Meldung pro Änderung');

	// Mehrfachkorrektur: unterschiedliche Ersatzlängen, auch Löschen.
	const batchText = 'Tesdt und Feler mit doppelt doppelt.';
	const batchFx = makeFixture(batchText);
	const batchToken = batchFx.commands.ltShowMistakes({
		mistakes: [MISTAKE(0, 'Tesdt')], hash: djb2(batchText), noteId: 'batch',
	});
	const edits = [
		{ from: 0, to: 5, text: 'Test', expected: 'Tesdt' },
		{ from: 10, to: 15, text: 'Fehler', expected: 'Feler' },
		{ from: batchText.lastIndexOf('doppelt'), to: batchText.length, text: '', expected: 'doppelt.' },
	];
	// Ungültige letzte Änderung darf nicht die ersten beiden anwenden.
	const countBefore = batchFx.dispatches.length;
	assert.strictEqual(batchFx.commands.ltReplaceBatch(
		[edits[0], { ...edits[1], expected: 'FALSCH' }], batchToken, batchText,
	), false);
	assert.strictEqual(batchFx.commands.ltGetText(), batchText);
	assert.strictEqual(batchFx.dispatches.length, countBefore);
	assert.strictEqual(batchFx.commands.ltReplaceBatch(
		[edits[0], { from: 1, to: 3, expected: 'es', text: 'X' }], batchToken, batchText,
	), false, 'Überlappung abgelehnt');
	assert.strictEqual(batchFx.commands.ltReplaceBatch(
		[edits[0], edits[0]], batchToken, batchText,
	), false, 'doppelte Fundstelle abgelehnt');
	assert.strictEqual(batchFx.commands.ltReplaceBatch(edits, batchToken + 1, batchText), false);
	assert.strictEqual(batchFx.commands.ltReplaceBatch(edits, batchToken, batchText + 'X'), false);
	assert.strictEqual(batchFx.commands.ltReplaceBatch(edits, batchToken, batchText), true);
	assert.strictEqual(batchFx.commands.ltGetText(), 'Test und Fehler mit doppelt ');
	assert.strictEqual(batchFx.dispatches.length, countBefore + 1, 'gesamte Auswahl in einer Transaktion');
	assert.strictEqual(batchFx.commands.ltReplaceBatch(edits, batchToken, batchText), false, 'Token nach Übernahme ungültig');

	console.log('Alle Content-Script-Integrationstests bestanden.');
}

run().catch((e) => { console.error('TEST FEHLGESCHLAGEN:', e.message); process.exit(1); });
