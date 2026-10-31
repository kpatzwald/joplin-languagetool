// Integration tests for the compiled content script using real @codemirror/state.
// Runs outside Joplin with a mocked CodeMirrorControl wrapper.

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
	let posAtCoordsResult = null; // null = click outside the text.

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
	message: 'Typo',
	replacements: ['Test'],
	issueType: type,
	ruleId: 'X',
	ruleDescription: '',
	category: '',
});

async function run() {
	const text = 'This is one Tesdt with errors.';
	const fx = makeFixture(text);
	const { commands, view, decorations, domListeners } = fx;

	const hash = djb2(text);

	// 1. ltGetText
	assert.strictEqual(commands.ltGetText(), text, 'ltGetText returns the document text');

	// 2. ltShowMistakes with an incorrect hash: rejected, no marks.
	assert.strictEqual(commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: hash + 1, noteId: 'n1' }), false, 'incorrect hash rejected');
	assert.strictEqual(decorations().count, 0, 'no marks after incorrect hash');

	// 3. Correction without a valid check result: rejected.
	assert.strictEqual(commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', 1), false, 'correction without a valid result rejected');

	// 4. ltShowMistakes with the correct hash: accepted, marks set.
	//    Returns a unique numeric result token.
	const token1 = commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt'), MISTAKE(23, 'errors', 'grammar')], hash, noteId: 'n1' });
	assert.ok(typeof token1 === 'number' && token1 > 0, 'ltShowMistakes returns a unique token');
	const d = decorations();
	assert.strictEqual(d.count, 2, 'two marks set');
	assert.deepStrictEqual(d.ranges[0], [12, 17, 'lt-spelling'], 'mark 1 correct');
	assert.deepStrictEqual(d.ranges[1], [23, 29, 'lt-grammar'], 'mark 2 correct');

	// 5. Correction with incorrect expected text: rejected, unchanged.
	const before = commands.ltGetText();
	assert.strictEqual(commands.ltReplaceRange(12, 17, 'Test', 'WRONG-EXPECTATION', token1), false, 'correction with incorrect expected text rejected');
	assert.strictEqual(commands.ltGetText(), before, 'document unchanged after rejected correction');

	// 6. Correction with an incorrect result token: rejected.
	assert.strictEqual(commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', token1 + 999), false, 'correction with incorrect result token rejected');
	assert.strictEqual(commands.ltGetText(), before, 'document unchanged');

	// 7. Correction with the correct token and expected text: applied.
	assert.strictEqual(commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', token1), true, 'correction with valid token applied');
	assert.ok(view.state.doc.toString().includes('one Test with'), 'replacement present in document');

	// 8. Every text change (docChanged) invalidates the result token.
	//    Reject corrections even if the misspelled word is unchanged at
	//    the same position. Edit the document end so the second 'Tesdt'
	//    is not shifted.
	const text2 = 'This is one Tesdt with errors and another Tesdt here.';
	const fx2 = makeFixture(text2);
	const hash2 = djb2(text2);
	const offset2 = text2.lastIndexOf('Tesdt');
	const token2 = fx2.commands.ltShowMistakes({ mistakes: [MISTAKE(offset2, 'Tesdt')], hash: hash2, noteId: 'n2' });
	assert.ok(typeof token2 === 'number', 'token for fx2 set');
	assert.strictEqual(fx2.commands.ltGetText().slice(offset2, offset2 + 5), 'Tesdt', 'misspelled word unchanged at target position');
	// Edit the document end: 'Tesdt' at offset2 remains unchanged.
	fx2.view.dispatch({ changes: { from: text2.length, to: text2.length, insert: ' The end.' } });
	assert.strictEqual(fx2.commands.ltGetText().slice(offset2, offset2 + 5), 'Tesdt', 'misspelled word unchanged after document edit');
	assert.strictEqual(
		fx2.commands.ltReplaceRange(offset2, offset2 + 5, 'Test', 'Tesdt', token2),
		false,
		'correction after text change rejected (token invalidated)',
	);
	assert.ok(fx2.commands.ltGetText().endsWith('The end.'), 'only the manual edit is present in the document');

	// 8b. Tokens are unique and assigned anew for every check result.
	const fx2b = makeFixture(text);
	const hash2b = djb2(text);
	const tokenA = fx2b.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: hash2b, noteId: 'n2b' });
	fx2b.commands.ltClearMistakes();
	const tokenB = fx2b.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: hash2b, noteId: 'n2b' });
	assert.ok(typeof tokenA === 'number' && typeof tokenB === 'number', 'both tokens are numbers');
	assert.notStrictEqual(tokenA, tokenB, 'tokens differ for the same text');
	assert.strictEqual(fx2b.commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', tokenA), false, 'old token rejected after clearing');
	assert.strictEqual(fx2b.commands.ltGetText(), text, 'document unchanged after old token');
	assert.strictEqual(fx2b.commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', tokenB), true, 'current token accepted');
	assert.ok(fx2b.commands.ltGetText().includes('one Test with'), 'replacement applied with current token');

	// 9. Invalid positions are not clamped to document boundaries.
	const fx3 = makeFixture('Short text.');
	const token3 = fx3.commands.ltShowMistakes({ mistakes: [MISTAKE(0, 'Short')], hash: djb2('Short text.'), noteId: 'n3' });
	assert.ok(typeof token3 === 'number', 'token for fx3 set');
	assert.strictEqual(fx3.commands.ltReplaceRange(50, 60, 'X', 'Short', token3), false, 'range beyond document length rejected');
	assert.strictEqual(fx3.commands.ltReplaceRange(-5, 3, 'X', 'Sho', token3), false, 'negative range rejected');

	// 10. ltClearMistakes invalidates the result: reject old corrections.
	const fx4 = makeFixture(text);
	const h4 = djb2(text);
	const token4 = fx4.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: h4, noteId: 'n4' });
	fx4.commands.ltClearMistakes();
	assert.strictEqual(fx4.commands.ltReplaceRange(12, 17, 'Test', 'Tesdt', token4), false, 'correction from discarded result rejected');
	assert.strictEqual(fx4.commands.ltGetText(), text, 'document unchanged');
	assert.strictEqual(fx4.decorations().count, 0, 'marks removed after clearing');

	// 11. Right-click context: clear old context at the start of each event.
	const fx5 = makeFixture(text);
	const h5 = djb2(text);
	fx5.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: h5, noteId: 'n5' });

	assert.strictEqual(fx5.commands.ltGetClickContext(), null, 'no click context without a right-click');

	// Click at position 12 (valid).
	fx5.view.posAtCoordsResult = 12;
	fx5.domListeners.contextmenu({ clientX: 100, clientY: 100 });
	let ctx = fx5.commands.ltGetClickContext();
	assert.deepStrictEqual(ctx, { pos: 12, hash: h5 }, 'click context after valid right-click');
	assert.strictEqual(fx5.commands.ltGetClickContext(), null, 'reading consumes the context');

	// Click outside the text: old context stays discarded.
	fx5.view.posAtCoordsResult = 12;
	fx5.domListeners.contextmenu({ clientX: 100, clientY: 100 });
	fx5.view.posAtCoordsResult = null;
	fx5.domListeners.contextmenu({ clientX: 999, clientY: 999 });
	assert.strictEqual(fx5.commands.ltGetClickContext(), null, 'invalid click returns no old context');

	// 12. Text changes discard marks.
	const fx6 = makeFixture(text);
	fx6.commands.ltShowMistakes({ mistakes: [MISTAKE(12, 'Tesdt')], hash: djb2(text), noteId: 'n6' });
	assert.strictEqual(fx6.decorations().count, 1, 'mark set');
	fx6.view.dispatch({ changes: { from: 0, to: 4, insert: 'That' } });
	assert.strictEqual(fx6.decorations().count, 0, 'marks discarded after text change');

	// 13. Text changes are reported to the main script for live checking.
	const fx7 = makeFixture('Short text.');
	fx7.messages.length = 0;
	fx7.view.dispatch({ changes: { from: 0, to: 6, insert: 'Longer ' } });
	assert.ok(
		fx7.messages.some((m) => m && m.type === 'ltTextChanged'),
		'text change reported as ltTextChanged',
	);
	assert.strictEqual(fx7.messages.filter((m) => m && m.type === 'ltTextChanged').length, 1, 'exactly one notification per change');

	// Batch correction: different replacement lengths, including deletion.
	const batchText = 'Tesdt and erors with repeated repeated.';
	const batchFx = makeFixture(batchText);
	const batchToken = batchFx.commands.ltShowMistakes({
		mistakes: [MISTAKE(0, 'Tesdt')], hash: djb2(batchText), noteId: 'batch',
	});
	const edits = [
		{ from: 0, to: 5, text: 'Test', expected: 'Tesdt' },
		{ from: 10, to: 15, text: 'errors', expected: 'erors' },
		{ from: batchText.lastIndexOf('repeated'), to: batchText.length, text: '', expected: 'repeated.' },
	];
	// An invalid final edit must not allow earlier edits to be applied.
	const countBefore = batchFx.dispatches.length;
	assert.strictEqual(batchFx.commands.ltReplaceBatch(
		[edits[0], { ...edits[1], expected: 'WRONG' }], batchToken, batchText,
	), false);
	assert.strictEqual(batchFx.commands.ltGetText(), batchText);
	assert.strictEqual(batchFx.dispatches.length, countBefore);
	assert.strictEqual(batchFx.commands.ltReplaceBatch(
		[edits[0], { from: 1, to: 3, expected: 'es', text: 'X' }], batchToken, batchText,
	), false, 'overlap rejected');
	assert.strictEqual(batchFx.commands.ltReplaceBatch(
		[edits[0], edits[0]], batchToken, batchText,
	), false, 'duplicate match rejected');
	assert.strictEqual(batchFx.commands.ltReplaceBatch(edits, batchToken + 1, batchText), false);
	assert.strictEqual(batchFx.commands.ltReplaceBatch(edits, batchToken, batchText + 'X'), false);
	assert.strictEqual(batchFx.commands.ltReplaceBatch(edits, batchToken, batchText), true);
	assert.strictEqual(batchFx.commands.ltGetText(), 'Test and errors with repeated ');
	assert.strictEqual(batchFx.dispatches.length, countBefore + 1, 'entire selection applied in one transaction');
	assert.strictEqual(batchFx.commands.ltReplaceBatch(edits, batchToken, batchText), false, 'token invalid after applying');

	console.log('All content script integration tests passed.');
}

run().catch((e) => { console.error('TEST FAILED:', e.message); process.exit(1); });
