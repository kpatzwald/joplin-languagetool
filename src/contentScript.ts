// Content script for Joplin's CodeMirror 6 Markdown editor.
//
// Registers editor commands (called from the main script using
// `editor.execCommand`), stores error highlights in a StateField,
// and synchronously records the most recent right-click position.

import { Range, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { MistakePayload, hashString } from './common';
import { validateBatch } from './resultsDialog';

interface ContentScriptContext {
	contentScriptId: string;
	postMessage: (message: unknown) => Promise<unknown>;
}

interface ShowMistakesPayload {
	mistakes: MistakePayload[];
	hash: number;
	noteId: string;
}

interface ClickContext {
	pos: number;
	hash: number;
}

const setMistakesEffect = StateEffect.define<ShowMistakesPayload>();
const clearMistakesEffect = StateEffect.define<null>();
const setResultTokenEffect = StateEffect.define<number>();
const clearResultTokenEffect = StateEffect.define<null>();

// Unique identifier of the currently valid check result. Invalidated
// whenever the text changes or highlights are cleared.
const resultTokenField = StateField.define<number | null>({
	create: () => null,
	update(value, tr) {
		if (tr.docChanged) return null;
		for (const effect of tr.effects) {
			if (effect.is(setResultTokenEffect)) value = effect.value;
			else if (effect.is(clearResultTokenEffect)) value = null;
		}
		return value;
	},
});

function classForIssueType(issueType: string): string {
	switch (issueType) {
		case 'spelling':
		case 'UnknownWord':
		case 'misspelling':
			return 'lt-spelling';
		case 'style':
			return 'lt-style';
		default:
			// Grammar, punctuation, typography, etc.
			return 'lt-grammar';
	}
}

const mistakeField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value: DecorationSet, tr) {
		// As soon as the document text changes, all existing
		// highlights are stale and must be discarded.
		if (tr.docChanged) {
			value = Decoration.none;
		} else {
			value = value.map(tr.changes);
		}
		for (const effect of tr.effects) {
			if (effect.is(setMistakesEffect)) {
				const docLength = tr.state.doc.length;
				const ranges: Range<Decoration>[] = [];
				for (const mistake of effect.value.mistakes) {
					const from = Math.max(0, Math.min(mistake.offset, docLength));
					const to = Math.max(from, Math.min(mistake.offset + mistake.length, docLength));
					if (to <= from) continue;
					ranges.push(
						Decoration.mark({
							class: classForIssueType(mistake.issueType),
							attributes: { title: mistake.message },
						}).range(from, to),
					);
				}
				value = Decoration.set(ranges, true);
			} else if (effect.is(clearMistakesEffect)) {
				value = Decoration.none;
			}
		}
		return value;
	},
	provide: (field) => EditorView.decorations.from(field),
});

export default (context: ContentScriptContext) => {
	return {
		plugin: (codeMirrorWrapper: any) => {
			const view: EditorView | undefined = codeMirrorWrapper?.cm6 ?? codeMirrorWrapper?.editor;
			if (!view) {
				console.warn('LanguageTool: No EditorView found; content script inactive.');
				return;
			}

			// Last right-click position in the document (set synchronously
			// on the contextmenu DOM event, before the menu is built).
			let lastClickContext: ClickContext | null = null;

			// Counter for unique result tokens.
			let resultTokenCounter = 0;

			codeMirrorWrapper.addExtension(mistakeField);
			codeMirrorWrapper.addExtension(resultTokenField);

			// Report every text change to the main script, which schedules
			// debounced checks for live highlighting.
			const textChangedField = StateField.define<number>({
				create: () => 0,
				update: (value, tr) => {
					if (tr.docChanged) {
						try {
							void context.postMessage({ type: 'ltTextChanged' });
						} catch {
							// Notification is optional; manual checking still works.
						}
					}
					return value;
				},
			});
			codeMirrorWrapper.addExtension(textChangedField);

			const currentText = (): string => view.state.doc.toString();
			const currentHash = (): number => hashString(currentText());

			// Retrieve the current editor text (identical to the note text).
			codeMirrorWrapper.registerCommand('ltGetText', () => currentText());

			codeMirrorWrapper.registerCommand('ltGetHash', () => currentHash());

			// Retrieve the last right-click position for the context menu.
			// Reading consumes the context so a later menu request
			// without a new click cannot return old data.
			codeMirrorWrapper.registerCommand('ltGetClickContext', () => {
				const context = lastClickContext;
				lastClickContext = null;
				// Stale context (text changed since the click)?
				if (context && context.hash !== currentHash()) return null;
				return context;
			});

			// Set error highlights. Discard stale results if the text has
			// changed since the check. Return a unique result token
			// when highlights are accepted, or false otherwise.
			codeMirrorWrapper.registerCommand('ltShowMistakes', (payload: ShowMistakesPayload | undefined) => {
				if (!payload || typeof payload.hash !== 'number' || !Array.isArray(payload.mistakes)) {
					return false;
				}
				if (currentHash() !== payload.hash) {
					console.info('LanguageTool: Check result discarded; text has changed.');
					return false;
				}
				const token = ++resultTokenCounter;
				view.dispatch({
					effects: [setMistakesEffect.of(payload), setResultTokenEffect.of(token)],
				});
				return token;
			});

			codeMirrorWrapper.registerCommand('ltClearMistakes', () => {
				view.dispatch({ effects: [clearMistakesEffect.of(null), clearResultTokenEffect.of(null)] });
				return true;
			});

			// One CodeMirror write operation; all positions refer to the
			// same original text. No partial application on failure.
			codeMirrorWrapper.registerCommand(
				'ltReplaceBatch',
				(edits: unknown, resultToken: number, expectedDocument: string) => {
					if (typeof resultToken !== 'number'
						|| view.state.field(resultTokenField, false) !== resultToken
						|| typeof expectedDocument !== 'string'
						|| currentText() !== expectedDocument) return false;
					const batch = validateBatch(expectedDocument, edits);
					if (!batch) return false;
					view.dispatch({
						changes: batch.map(({ from, to, text }) => ({ from, to, insert: text })),
						userEvent: 'input.languagetool',
					});
					return true;
				},
			);

			// Replace a text range, bound to the current check result.
			// The result token must still be valid (invalidated by any text
			// change, ltClearMistakes, or a newer check result), and the
			// text being replaced must be unchanged.
			codeMirrorWrapper.registerCommand(
				'ltReplaceRange',
				(from: number, to: number, text: string, expected: string, resultToken: number) => {
					const activeToken = view.state.field(resultTokenField, false);
					if (typeof resultToken !== 'number' || activeToken === null || activeToken !== resultToken) {
						console.info('LanguageTool: Correction rejected; no valid check result.');
						return false;
					}
					if (typeof from !== 'number' || typeof to !== 'number' || typeof text !== 'string' || typeof expected !== 'string') {
						return false;
					}
					if (from < 0 || to < from || to > view.state.doc.length) {
						console.info('LanguageTool: Correction rejected; range outside the document.');
						return false;
					}
					if (view.state.doc.sliceString(from, to) !== expected) {
						console.info('LanguageTool: Correction rejected; text has changed.');
						return false;
					}
					view.dispatch({ changes: { from, to, insert: text } });
					return true;
				},
			);

			view.dom.addEventListener(
				'contextmenu',
				(event: MouseEvent) => {
					// Always discard the old context; only set a new
					// context for a valid position.
					lastClickContext = null;
					try {
						const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
						if (pos === null) return;
						lastClickContext = { pos, hash: currentHash() };
					} catch {
						lastClickContext = null;
					}
				},
				true,
			);
		},
		assets: () => [{ name: './lt-styles.css' }],
	};
};
