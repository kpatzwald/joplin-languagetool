import joplin from 'api';
import { ContentScriptType, MenuItemLocation, ToolbarButtonLocation, ViewHandle } from 'api/types';
import { LT_MAX_TEXT, MistakePayload, hashString, mapMatches } from './common';
import { LTCheckResponse, checkText } from './languagetool';
import { stripMarkdownForCheck } from './markdown';
import { buildResultsHtml, parseDialogChoices, DialogChoice, BatchReplacement, validateBatch } from './resultsDialog';
import {
	PluginSettings,
	addRuleToDisabled,
	addWordToIgnored,
	getSettings,
	ignoredWordsSet,
	registerSettings,
} from './settings';

const CONTENT_SCRIPT_ID = 'languagetool-cm6';
const RESULTS_DIALOG_ID = 'languagetool-results';

const dialogHandles = new Map<string, ViewHandle>();

async function getDialog(id: string): Promise<ViewHandle> {
	let handle = dialogHandles.get(id);
	if (!handle) {
		handle = await joplin.views.dialogs.create(id);
		dialogHandles.set(id, handle);
	}
	return handle;
}

interface CheckState {
	noteId: string;
	hash: number;
	mistakes: MistakePayload[];
	detectedLanguage: string;
	// Eindeutiges Ergebnis-Token des Editors, wenn die Hervorhebungen
	// tatsächlich übernommen wurden, sonst null.
	token: number | null;
	text: string;
}

let lastCheck: CheckState | null = null;
let autoCheckTimer: ReturnType<typeof setTimeout> | null = null;
let checkSequence = 0;
let resultsDialogOpen = false;

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&' + 'amp;')
		.replace(/</g, '&' + 'lt;')
		.replace(/>/g, '&' + 'gt;')
		.replace(/"/g, '&' + 'quot;')
		.replace(/'/g, '&' + '#39;');
}

async function showMessageBox(html: string): Promise<void> {
	try {
		const handle = await getDialog('languagetool-message');
		await joplin.views.dialogs.setFitToContent(handle, true);
		await joplin.views.dialogs.setButtons(handle, [{ id: 'ok', title: 'OK' }]);
		await joplin.views.dialogs.setHtml(handle, html);
		await joplin.views.dialogs.open(handle);
	} catch (error) {
		console.warn('LanguageTool: Dialog konnte nicht geöffnet werden', error);
	}
}

async function clearEditor(): Promise<void> {
	lastCheck = null;
	checkSequence++; // laufende Prüfungen entwerten
	try {
		await joplin.commands.execute('editor.execCommand', { name: 'ltClearMistakes' });
	} catch {
		// Kein Editor vorhanden (z. B. Rich-Text-Editor) – nichts zu tun.
	}
}

async function applyDialogReplacements(check: CheckState, choices: DialogChoice[]): Promise<boolean> {
	if (lastCheck !== check || check.token === null) return false;
	const edits: BatchReplacement[] = choices.map(({ mistakeIndex, suggestionIndex }) => {
		const mistake = check.mistakes[mistakeIndex];
		return {
			from: mistake.offset, to: mistake.offset + mistake.length,
			text: mistake.replacements[suggestionIndex], expected: mistake.word,
		};
	});
	if (!validateBatch(check.text, edits)) return false;
	const note = await joplin.workspace.selectedNote();
	if (!note || note.id !== check.noteId || lastCheck !== check) return false;
	try {
		const accepted = await joplin.commands.execute('editor.execCommand', {
			name: 'ltReplaceBatch',
			args: [edits, check.token, check.text],
		});
		return accepted === true;
	} catch (error) {
		console.warn('LanguageTool: Korrektur aus dem Dialog fehlgeschlagen', error);
		return false;
	}
}

async function showResultsDialog(
	result: LTCheckResponse,
	check: CheckState,
	notes: string,
): Promise<DialogChoice[] | null> {
	resultsDialogOpen = true;
	// Keine automatischen Prüfergebnisse dürfen die offene Auswahl ersetzen.
	++checkSequence;
	if (autoCheckTimer) clearTimeout(autoCheckTimer);
	try {
		const handle = await getDialog(RESULTS_DIALOG_ID);
		await joplin.views.dialogs.setFitToContent(handle, false);
		await joplin.views.dialogs.setButtons(handle, [
			{ id: 'ok', title: 'Übernehmen' }, { id: 'cancel', title: 'Abbrechen' },
		]);
		const language = result.language?.detectedLanguage?.name || result.language?.name || 'unbekannt';
		await joplin.views.dialogs.setHtml(handle, buildResultsHtml(
			language, check.mistakes, check.text, notes, check.token !== null,
		));
		const dialogResult = await joplin.views.dialogs.open(handle);
		if (dialogResult.id !== 'ok') return null;
		return parseDialogChoices(dialogResult.formData?.ltForm, check.mistakes);
	} catch (error) {
		console.warn('LanguageTool: Ergebnisdialog konnte nicht geöffnet werden', error);
		return null;
	} finally {
		resultsDialogOpen = false;
	}
}

async function getEditorText(): Promise<string | undefined> {
	try {
		const text = await joplin.commands.execute('editor.execCommand', { name: 'ltGetText' });
		if (typeof text === 'string') return text;
	} catch {
		// Befehl nicht verfügbar – vermutlich kein Markdown-Editor.
	}
	return undefined;
}

async function runCheck(showDialog: boolean): Promise<void> {
	if (resultsDialogOpen) return;
	const settings = await getSettings();
	const note = await joplin.workspace.selectedNote();
	if (!note) {
		if (showDialog) await showMessageBox('<p>Keine Notiz ausgewählt.</p>');
		return;
	}

	const seq = ++checkSequence;

	const editorText = await getEditorText();
	const hasEditorIntegration = editorText !== undefined;
	const text = editorText !== undefined ? editorText : String(note.body || '');

	let textToCheck = text;
	if (settings.stripMarkdown) {
		textToCheck = stripMarkdownForCheck(textToCheck);
	}
	const truncated = textToCheck.length > LT_MAX_TEXT;
	if (truncated) {
		textToCheck = textToCheck.slice(0, LT_MAX_TEXT);
	}

	let result: LTCheckResponse;
	try {
		result = await checkText(textToCheck, {
			url: settings.url,
			language: settings.language,
			motherTongue: settings.motherTongue,
			disabledRules: settings.disabledRules,
			disabledCategories: settings.disabledCategories,
			username: settings.username,
			apiKey: settings.apiKey,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`LanguageTool: ${message}`);
		if (showDialog) {
			await showMessageBox(
				`<p><b>LanguageTool-Prüfung fehlgeschlagen</b></p><p>${escapeHtml(message)}</p><p>Bitte Server-URL in den Einstellungen prüfen.</p>`,
			);
		}
		return;
	}

	// Inzwischen neuere Prüfung gestartet? Dieses Ergebnis verwerfen.
	if (seq !== checkSequence) return;

	const hash = hashString(text);
	const mistakes = mapMatches(result.matches, text, textToCheck, ignoredWordsSet(settings.ignoredWords));

	let token: number | null = null;
	if (hasEditorIntegration) {
		try {
			const accepted = await joplin.commands.execute('editor.execCommand', {
				name: 'ltShowMistakes',
				args: [{ mistakes, hash, noteId: note.id }],
			});
			token = typeof accepted === 'number' ? accepted : null;
		} catch (error) {
			console.warn('LanguageTool: Hervorhebungen konnten nicht gesetzt werden', error);
		}
	}

	// Erneut prüfen: während der Editor-Übergabe kann ein Löschen oder
	// Notizwechsel stattgefunden haben.
	if (seq !== checkSequence) return;

	lastCheck = {
		noteId: note.id,
		hash,
		mistakes,
		detectedLanguage: String(result.language?.detectedLanguage?.name || ''),
		token,
		text,
	};

	if (showDialog) {
		const notes: string[] = [];
		if (!hasEditorIntegration) {
			notes.push(
				'Hervorhebungen sind nur im Markdown-Editor (CodeMirror) möglich. Rechtschreibprüfung im Rich-Text-Editor wird nicht unterstützt.',
			);
		}
		if (truncated) {
			notes.push('Die Notiz wurde nur bis zur Textlänge-Begrenzung (30000 Zeichen) geprüft.');
		}
		const dialogCheck = lastCheck;
		const choices = await showResultsDialog(result, dialogCheck, notes.join(' '));
		if (choices && choices.length) {
			if (await applyDialogReplacements(dialogCheck, choices)) {
				// Nach gemeinsamer Übernahme nur Hervorhebungen aktualisieren.
				// Kein erneutes Öffnen des Dialogs.
				await runCheck(false);
			} else {
				await showMessageBox('<p>Es wurde nichts übernommen: Die Notiz oder das Prüfergebnis hat sich geändert, oder die Auswahl enthält überlappende Fundstellen. Bitte erneut prüfen und je überlappender Textstelle nur eine Korrektur auswählen.</p>');
			}
		}
	}
}

// Zeitpunkt der letzten automatischen Prüfung – dafür, dass Fehler
// auch bei durchgehender Eingabe laufend erscheinen.
let lastAutoCheckAt = 0;

function scheduleAutoCheck(): void {
	if (resultsDialogOpen) return;
	if (autoCheckTimer) clearTimeout(autoCheckTimer);
	void getSettings().then((settings) => {
		if (resultsDialogOpen) return;
		if (!settings.autoCheck) return;
		if (autoCheckTimer) clearTimeout(autoCheckTimer);
		// Nach jeder Eingabepause wird nach der Wartezeit geprüft. Wird
		// weitergetippt, wird trotzdem spätestens alle 5 Sekunden geprüft,
		// damit die Hervorhebungen auch während des Schreibens aktuell
		// bleiben (wie in der Firefox-Erweiterung).
		const delay = Math.max(300, settings.autoCheckDelay);
		const sinceLastCheck = Date.now() - lastAutoCheckAt;
		const wait = Math.min(delay, Math.max(0, 5000 - sinceLastCheck));
		autoCheckTimer = setTimeout(() => {
			lastAutoCheckAt = Date.now();
			void runCheck(false);
		}, wait);
	});
}

joplin.plugins.register({
	onStart: async () => {
		await registerSettings();

		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			CONTENT_SCRIPT_ID,
			'./contentScript.js',
		);

		// Live-Prüfung: Das Content-Script meldet jede Textänderung im Editor;
		// scheduleAutoCheck() bündelt sie (Debounce) und startet die Prüfung
		// erst, kurz nachdem die Eingabe endet.
		await joplin.contentScripts.onMessage(CONTENT_SCRIPT_ID, (message: any) => {
			if (message && message.type === 'ltTextChanged') scheduleAutoCheck();
		});

		// Notizwechsel: Hervorhebungen und veraltete Ergebnisse entfernen
		// (clearEditor entwertet auch laufende Prüfungen über checkSequence)
		await joplin.workspace.onNoteSelectionChange(() => {
			void clearEditor();
			if (autoCheckTimer) clearTimeout(autoCheckTimer);
		});

		// Notizinhalt geändert: automatische Prüfung (falls aktiviert)
		await joplin.workspace.onNoteChange(() => {
			scheduleAutoCheck();
		});

		await joplin.commands.register({
			name: 'languagetoolCheckNote',
			label: 'LanguageTool: Notiz prüfen',
			iconName: 'fas fa-spell-check',
			execute: async () => {
				await runCheck(true);
			},
		});

		await joplin.commands.register({
			name: 'languagetoolClear',
			label: 'LanguageTool: Hervorhebungen entfernen',
			execute: async () => {
				await clearEditor();
			},
		});

		await joplin.commands.register({
			name: 'languagetoolReplace',
			label: 'LanguageTool: Vorschlag übernehmen',
			// Die Korrektur ist an das Prüfergebnis gebunden: Die Notiz muss
			// noch ausgewählt sein und das Ergebnis-Token muss gültig sein.
			// Das Content-Script prüft zusätzlich synchron Token und
			// erwarteten Originaltext.
			execute: async (from: number, to: number, value: string, expected: string, resultToken: number) => {
				const check = lastCheck;
				if (!check || check.token === null) return;
				if (typeof resultToken !== 'number' || resultToken !== check.token) return;
				const note = await joplin.workspace.selectedNote();
				if (!note || note.id !== check.noteId) return;
				try {
					await joplin.commands.execute('editor.execCommand', {
						name: 'ltReplaceRange',
						args: [from, to, value, expected, resultToken],
					});
				} catch (error) {
					console.warn('LanguageTool: Korrektur fehlgeschlagen', error);
				}
			},
		});

		await joplin.commands.register({
			name: 'languagetoolIgnoreWord',
			label: 'LanguageTool: Wort ignorieren',
			execute: async (word: string) => {
				if (!word || typeof word !== 'string') return;
				const current = String((await joplin.settings.value('languagetool.ignoredWords')) || '');
				await joplin.settings.setValue('languagetool.ignoredWords', addWordToIgnored(current, word));
				await runCheck(false);
			},
		});

		await joplin.commands.register({
			name: 'languagetoolIgnoreRule',
			label: 'LanguageTool: Regel deaktivieren',
			execute: async (ruleId: string) => {
				if (!ruleId || typeof ruleId !== 'string') return;
				const current = String((await joplin.settings.value('languagetool.disabledRules')) || '');
				await joplin.settings.setValue('languagetool.disabledRules', addRuleToDisabled(current, ruleId));
				await runCheck(false);
			},
		});

		await joplin.views.menuItems.create(
			'languagetoolCheckMenuItem',
			'languagetoolCheckNote',
			MenuItemLocation.Tools,
		);

		await joplin.views.toolbarButtons.create(
			'languagetoolCheckToolbar',
			'languagetoolCheckNote',
			ToolbarButtonLocation.NoteToolbar,
		);

		// Rechtsklickmenü im Editor: Korrekturvorschläge für die Fundstelle
		// unter der Klickposition. Position und Text-Hash werden synchron aus
		// dem Editor abgefragt; veraltete oder nicht angezeigte Ergebnisse
		// liefern keine Menüpunkte.
		await joplin.workspace.filterEditorContextMenu(async (object) => {
			try {
				const check = lastCheck;
				if (!check || check.token === null) return object;

				let click: { pos: number; hash: number } | undefined;
				try {
					click = await joplin.commands.execute('editor.execCommand', {
						name: 'ltGetClickContext',
					});
				} catch {
					click = undefined;
				}
				if (!click || click.hash !== check.hash) return object;

				const mistake = check.mistakes.find(
					(m) => click.pos >= m.offset && click.pos < m.offset + m.length,
				);
				if (!mistake) return object;

				const items: any[] = [{ type: 'separator' }];
				items.push({ label: `LanguageTool: ${mistake.message}` });

				for (const suggestion of mistake.replacements.slice(0, 6)) {
					items.push({
						label: suggestion === '' ? 'Löschen' : `„${suggestion}"`,
						commandName: 'languagetoolReplace',
						commandArgs: [
							mistake.offset,
							mistake.offset + mistake.length,
							suggestion,
							mistake.word,
							check.token,
						],
					});
				}

				if (mistake.replacements.length > 0) {
					items.push({ type: 'separator' });
				}
				items.push({
					label: `„${mistake.word}" immer ignorieren`,
					commandName: 'languagetoolIgnoreWord',
					commandArgs: [mistake.word],
				});
				if (mistake.ruleId) {
					items.push({
						label: `Regel „${mistake.ruleId}" deaktivieren`,
						commandName: 'languagetoolIgnoreRule',
						commandArgs: [mistake.ruleId],
					});
				}

				object.items = [...object.items, ...items];
			} catch (error) {
				console.warn('LanguageTool: Kontextmenü-Fehler', error);
			}
			return object;
		});
	},
});
