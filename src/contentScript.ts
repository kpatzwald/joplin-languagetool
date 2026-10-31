// Content-Script für den CodeMirror-6-Markdown-Editor von Joplin.
//
// Registriert Editor-Befehle (aufrufbar aus dem Hauptskript über
// `editor.execCommand`), hält die Fehler-Hervorhebungen in einem StateField
// und merkt sich synchron die Position des letzten Rechtsklicks.

import { Range, StateEffect, StateField } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView } from '@codemirror/view';
import { MistakePayload, hashString } from './common';

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

// Eindeutige Kennung des aktuell gültigen Prüfergebnisses. Wird bei
// jeder Textänderung und beim Löschen der Hervorhebungen ungültig.
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
			// Grammatik, Zeichensetzung, Typografie usw.
			return 'lt-grammar';
	}
}

const mistakeField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(value: DecorationSet, tr) {
		// Sobald sich der Dokumenttext ändert, sind alle bestehenden
		// Hervorhebungen veraltet und werden verworfen.
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

export default (_context: ContentScriptContext) => {
	return {
		plugin: (codeMirrorWrapper: any) => {
			const view: EditorView | undefined = codeMirrorWrapper?.cm6 ?? codeMirrorWrapper?.editor;
			if (!view) {
				console.warn('LanguageTool: kein EditorView gefunden – Content-Script inaktiv.');
				return;
			}

			// Position des letzten Rechtsklicks im Dokument (synchron beim
			// contextmenu-DOM-Ereignis gesetzt, bevor das Menü aufgebaut wird).
			let lastClickContext: ClickContext | null = null;

			// Zähler für eindeutige Ergebnis-Token.
			let resultTokenCounter = 0;

			codeMirrorWrapper.addExtension(mistakeField);
			codeMirrorWrapper.addExtension(resultTokenField);

			const currentText = (): string => view.state.doc.toString();
			const currentHash = (): number => hashString(currentText());

			// Aktuellen Editor-Text abfragen (identisch zum Notiz-Text).
			codeMirrorWrapper.registerCommand('ltGetText', () => currentText());

			codeMirrorWrapper.registerCommand('ltGetHash', () => currentHash());

			// Position des letzten Rechtsklicks abfragen (für das Kontextmenü).
			// Der Kontext wird beim Lesen verbraucht, damit ein späterer
			// Menüaufruf ohne neues Klickereignis keine alten Daten liefert.
			codeMirrorWrapper.registerCommand('ltGetClickContext', () => {
				const context = lastClickContext;
				lastClickContext = null;
				// Veralteter Kontext (Text hat sich seit dem Klick geändert)?
				if (context && context.hash !== currentHash()) return null;
				return context;
			});

			// Fehler-Hervorhebungen setzen. Veraltete Ergebnisse (Text hat sich
			// seit der Prüfung geändert) werden verworfen und nicht angewendet.
			// Übergibt die Hervorhebungen und liefert bei Erfolg ein
			// eindeutiges Ergebnis-Token zurück, sonst false.
			codeMirrorWrapper.registerCommand('ltShowMistakes', (payload: ShowMistakesPayload | undefined) => {
				if (!payload || typeof payload.hash !== 'number' || !Array.isArray(payload.mistakes)) {
					return false;
				}
				if (currentHash() !== payload.hash) {
					console.info('LanguageTool: Prüfergebnis verworfen – Text hat sich geändert.');
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

			// Einen Bereich des Texts ersetzen. Gebunden an das aktuelle
			// Prüfergebnis: Das Ergebnis-Token muss noch gültig sein (ungültig
			// nach jeder Textänderung, nach ltClearMistakes oder einem neueren
			// Prüfergebnis) und der zu ersetzende Text muss unverändert sein.
			codeMirrorWrapper.registerCommand(
				'ltReplaceRange',
				(from: number, to: number, text: string, expected: string, resultToken: number) => {
					const activeToken = view.state.field(resultTokenField, false);
					if (typeof resultToken !== 'number' || activeToken === null || activeToken !== resultToken) {
						console.info('LanguageTool: Korrektur abgelehnt – kein gültiges Prüfergebnis.');
						return false;
					}
					if (typeof from !== 'number' || typeof to !== 'number' || typeof text !== 'string' || typeof expected !== 'string') {
						return false;
					}
					if (from < 0 || to < from || to > view.state.doc.length) {
						console.info('LanguageTool: Korrektur abgelehnt – Bereich außerhalb des Dokuments.');
						return false;
					}
					if (view.state.doc.sliceString(from, to) !== expected) {
						console.info('LanguageTool: Korrektur abgelehnt – Text hat sich geändert.');
						return false;
					}
					view.dispatch({ changes: { from, to, insert: text } });
					return true;
				},
			);

			view.dom.addEventListener(
				'contextmenu',
				(event: MouseEvent) => {
					// Alten Kontext immer verwerfen; nur bei gültiger
					// Position neu befüllen.
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
