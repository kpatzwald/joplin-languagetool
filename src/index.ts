import joplin from 'api';
import { t } from './i18n';
import { ContentScriptType, MenuItemLocation, ToolbarButtonLocation, ViewHandle } from 'api/types';
import { LT_MAX_TEXT, MistakePayload, hashString, mapMatches } from './common';
import { LTCheckResponse, checkText, normalizeCheckUrl } from './languagetool';
import { displayEndpoint, isPublicEndpoint, PUBLIC_TEXT_BYTES, truncateUtf8 } from './apiPolicy';
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
	// Unique editor result token if the highlights were
	// actually accepted; null otherwise.
	token: number | null;
	text: string;
}

let lastCheck: CheckState | null = null;
let autoCheckTimer: ReturnType<typeof setTimeout> | null = null;
let checkSequence = 0;
let resultsDialogOpen = false;
let checkInProgress = false;

async function approveServer(settings: PluginSettings): Promise<boolean> {
	const endpoint = normalizeCheckUrl(settings.url);
	if (settings.approvedServer === endpoint) return true;
	const handle = await getDialog('languagetool-consent');
	await joplin.views.dialogs.setFitToContent(handle, true);
	await joplin.views.dialogs.setButtons(handle, [
		{ id: 'ok', title: t('Allow checking') }, { id: 'cancel', title: t('Cancel') },
	]);
	const publicService = isPublicEndpoint(endpoint);
	await joplin.views.dialogs.setHtml(handle, `<h3>${escapeHtml(t('Text transmission and privacy'))}</h3>
		<p>${escapeHtml(t('Checking sends note text and configured language options to this server:'))}</p>
		<p><code>${escapeHtml(displayEndpoint(endpoint))}</code></p>
		<p>${escapeHtml(t('Notes may contain sensitive information. Only approve a server you trust. Approval is remembered for this endpoint and can be revoked using the LanguageTool command.'))}</p>
		<p>${escapeHtml(publicService ? t('The free public API is manual-only. Automatic checking and background refreshes are blocked.')
			: t('If automatic checking is enabled, notes are sent while typing. Only enable this if the server permits automated requests. Ask its operator about data handling.'))}</p>
		${new URL(endpoint).protocol === 'http:' ? `<p>${escapeHtml(t('Warning: this HTTP connection is not encrypted.'))}</p>` : ''}
		<p><a href="https://languagetool.org">LanguageTool</a>${publicService
			? ` | <a href="https://languagetool.org/legal/privacy">${escapeHtml(t('Privacy policy'))}</a>` : ''}</p>`);
	const result = await joplin.views.dialogs.open(handle);
	if (result.id !== 'ok') return false;
	// A server change while this dialog is open must never inherit approval.
	if (normalizeCheckUrl((await getSettings()).url) !== endpoint) return false;
	await joplin.settings.setValue('languagetool.approvedServer', endpoint);
	return true;
}

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
		console.warn('LanguageTool: Could not open dialog', error);
	}
}

async function clearEditor(): Promise<void> {
	lastCheck = null;
	checkSequence++; // Invalidate checks in progress.
	try {
		await joplin.commands.execute('editor.execCommand', { name: 'ltClearMistakes' });
	} catch {
		// No supported editor available (e.g. rich text editor); nothing to do.
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
		console.warn('LanguageTool: Applying corrections from the dialog failed', error);
		return false;
	}
}

async function showResultsDialog(
	result: LTCheckResponse,
	check: CheckState,
	notes: string,
): Promise<DialogChoice[] | null> {
	resultsDialogOpen = true;
	// Automatic check results must not replace the selection in an open dialog.
	++checkSequence;
	if (autoCheckTimer) clearTimeout(autoCheckTimer);
	try {
		const handle = await getDialog(RESULTS_DIALOG_ID);
		await joplin.views.dialogs.setFitToContent(handle, false);
		await joplin.views.dialogs.setButtons(handle, [
			{ id: 'ok', title: t('Apply') }, { id: 'cancel', title: t('Cancel') },
		]);
		const language = result.language?.detectedLanguage?.name || result.language?.name || t('unknown');
		await joplin.views.dialogs.setHtml(handle, buildResultsHtml(
			language, check.mistakes, check.text, notes, check.token !== null,
		));
		const dialogResult = await joplin.views.dialogs.open(handle);
		if (dialogResult.id !== 'ok') return null;
		return parseDialogChoices(dialogResult.formData?.ltForm, check.mistakes);
	} catch (error) {
		console.warn('LanguageTool: Could not open results dialog', error);
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
		// Command unavailable; probably not a Markdown editor.
	}
	return undefined;
}

async function runCheck(showDialog: boolean): Promise<void> {
	if (resultsDialogOpen || checkInProgress) return;
	checkInProgress = true;
	try {
		await performCheck(showDialog);
	} catch (error) {
		console.warn('LanguageTool: Check could not be started', error);
		if (showDialog) await showMessageBox(`<p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`);
	} finally {
		checkInProgress = false;
	}
}

async function performCheck(showDialog: boolean): Promise<void> {
	const settings = await getSettings();
	const endpoint = normalizeCheckUrl(settings.url);
	const publicService = isPublicEndpoint(endpoint);
	// Enforce this for every caller, including old stored autoCheck=true,
	// correction refreshes, ignored words/rules, and pending timers.
	if (!showDialog && (publicService || !settings.autoCheck || settings.approvedServer !== endpoint)) return;
	const note = await joplin.workspace.selectedNote();
	if (!note) {
		if (showDialog) await showMessageBox(`<p>${escapeHtml(t('No note selected.'))}</p>`);
		return;
	}
	if (showDialog && !await approveServer(settings)) return;
	// Do not send a different note or endpoint if either changed during consent.
	const currentNote = await joplin.workspace.selectedNote();
	const currentSettings = await getSettings();
	if (!currentNote || currentNote.id !== note.id || normalizeCheckUrl(currentSettings.url) !== endpoint
		|| currentSettings.approvedServer !== endpoint) return;

	const seq = ++checkSequence;

	const editorText = await getEditorText();
	const hasEditorIntegration = editorText !== undefined;
	const text = editorText !== undefined ? editorText : String(note.body || '');

	let textToCheck = text;
	if (settings.stripMarkdown) {
		textToCheck = stripMarkdownForCheck(textToCheck);
	}
	const originalLength = textToCheck.length;
	textToCheck = publicService ? truncateUtf8(textToCheck, PUBLIC_TEXT_BYTES) : textToCheck.slice(0, LT_MAX_TEXT);
	const truncated = textToCheck.length < originalLength;

	let result: LTCheckResponse;
	try {
		const latest = await getSettings();
		const selected = await joplin.workspace.selectedNote();
		if (seq !== checkSequence || !selected || selected.id !== note.id
			|| normalizeCheckUrl(latest.url) !== endpoint || latest.approvedServer !== endpoint
			|| (!showDialog && !latest.autoCheck)) return;
		result = await checkText(textToCheck, {
			trigger: showDialog ? 'manual' : 'background',
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
				`<p><b>${escapeHtml(t('LanguageTool check failed'))}</b></p><p>${escapeHtml(message)}</p><p>${escapeHtml(t('Please check the server URL in the settings.'))}</p>`,
			);
		}
		return;
	}

	// Discard this result if a newer check has started in the meantime.
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
			console.warn('LanguageTool: Could not set highlights', error);
		}
	}

	// Check again: highlights may have been cleared or the selected note
	// may have changed during the editor handoff.
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
		if (publicService) notes.push(t('The free public API is manual-only. Automatic checking and background refreshes are blocked.'));
		if (!hasEditorIntegration) {
			notes.push(
				t('Highlights are only available in the Markdown editor (CodeMirror). Spell checking in the rich text editor is not supported.'),
			);
		}
		if (truncated) {
			notes.push(publicService ? t('Only the first 19000 UTF-8 bytes were checked. The remaining text was not sent.')
				: t('The note was only checked up to the text length limit (30000 characters).'));
		}
		const dialogCheck = lastCheck;
		const choices = await showResultsDialog(result, dialogCheck, notes.join(' '));
		if (choices && choices.length) {
			if (await applyDialogReplacements(dialogCheck, choices)) {
				// Only refresh highlights after applying the batch.
				// Do not reopen the dialog.
				// This runs within the current check lock; still enforce the
				// background policy without reopening the results dialog.
				await performCheck(false);
			} else {
				await showMessageBox(`<p>${escapeHtml(t('No changes were applied: the note or check result has changed, or the selection contains overlapping matches. Please check again and select only one correction for each overlapping text range.'))}</p>`);
			}
		}
	}
}

// Time of the last automatic check, used to schedule checks
// even during continuous typing.
let lastAutoCheckAt = 0;

function scheduleAutoCheck(): void {
	if (resultsDialogOpen) return;
	if (autoCheckTimer) clearTimeout(autoCheckTimer);
	void getSettings().then((settings) => {
		if (resultsDialogOpen) return;
		if (!settings.autoCheck || isPublicEndpoint(settings.url)
			|| settings.approvedServer !== normalizeCheckUrl(settings.url)) return;
		if (autoCheckTimer) clearTimeout(autoCheckTimer);
		// Check after the configured delay following a typing pause.
		// During continuous typing, start a check at least every 5 seconds.
		// Network latency and stale-result rejection can delay highlights.
		const delay = Math.max(300, settings.autoCheckDelay);
		const sinceLastCheck = Date.now() - lastAutoCheckAt;
		const wait = Math.min(delay, Math.max(0, 5000 - sinceLastCheck));
		autoCheckTimer = setTimeout(() => {
			lastAutoCheckAt = Date.now();
			void runCheck(false);
		}, wait);
	}).catch((error) => console.warn('LanguageTool: Could not schedule check', error));
}

joplin.plugins.register({
	onStart: async () => {
		await registerSettings();

		await joplin.contentScripts.register(
			ContentScriptType.CodeMirrorPlugin,
			CONTENT_SCRIPT_ID,
			'./contentScript.js',
		);

		// Live checking: the content script reports every editor text change.
		// scheduleAutoCheck() debounces events, with a maximum wait
		// during continuous typing.
		await joplin.contentScripts.onMessage(CONTENT_SCRIPT_ID, (message: any) => {
			if (message && message.type === 'ltTextChanged') scheduleAutoCheck();
		});

		// Note selection change: remove highlights and stale results.
		// clearEditor also invalidates ongoing checks using checkSequence.
		await joplin.workspace.onNoteSelectionChange(() => {
			void clearEditor();
			if (autoCheckTimer) clearTimeout(autoCheckTimer);
		});

		// Note content changed: schedule automatic checking if enabled.
		await joplin.workspace.onNoteChange(() => {
			scheduleAutoCheck();
		});

		await joplin.commands.register({
			name: 'languagetoolCheckNote',
			label: t('LanguageTool: Check note'),
			iconName: 'fas fa-spell-check',
			execute: async () => {
				await runCheck(true);
			},
		});

		await joplin.commands.register({
			name: 'languagetoolRevokeConsent',
			label: t('LanguageTool: Revoke server consent'),
			execute: async () => {
				await joplin.settings.setValue('languagetool.approvedServer', '');
				if (autoCheckTimer) clearTimeout(autoCheckTimer);
				await clearEditor();
			},
		});

		await joplin.commands.register({
			name: 'languagetoolClear',
			label: t('LanguageTool: Clear highlights'),
			execute: async () => {
				await clearEditor();
			},
		});

		await joplin.commands.register({
			name: 'languagetoolReplace',
			label: t('LanguageTool: Apply suggestion'),
			// A correction is bound to its check result: the note must still
			// be selected and the result token must be valid. The content
			// script also synchronously checks the token and expected
			// original text.
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
					console.warn('LanguageTool: Applying correction failed', error);
				}
			},
		});

		await joplin.commands.register({
			name: 'languagetoolIgnoreWord',
			label: t('LanguageTool: Ignore word'),
			execute: async (word: string) => {
				if (!word || typeof word !== 'string') return;
				const current = String((await joplin.settings.value('languagetool.ignoredWords')) || '');
				await joplin.settings.setValue('languagetool.ignoredWords', addWordToIgnored(current, word));
				await clearEditor();
				await runCheck(false);
			},
		});

		await joplin.commands.register({
			name: 'languagetoolIgnoreRule',
			label: t('LanguageTool: Disable rule'),
			execute: async (ruleId: string) => {
				if (!ruleId || typeof ruleId !== 'string') return;
				const current = String((await joplin.settings.value('languagetool.disabledRules')) || '');
				await joplin.settings.setValue('languagetool.disabledRules', addRuleToDisabled(current, ruleId));
				await clearEditor();
				await runCheck(false);
			},
		});

		await joplin.views.menuItems.create(
			'languagetoolRevokeConsentMenuItem',
			'languagetoolRevokeConsent',
			MenuItemLocation.Tools,
		);

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

		// Editor context menu: suggestions for the match at the click position.
		// Retrieve the position and text hash synchronously from the editor;
		// stale results or results without highlights yield no menu entries.
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
						label: suggestion === '' ? t('Delete') : `"${suggestion}"`,
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
					label: t('Always ignore "{word}"', { word: mistake.word }),
					commandName: 'languagetoolIgnoreWord',
					commandArgs: [mistake.word],
				});
				if (mistake.ruleId) {
					items.push({
						label: t('Disable rule "{rule}"', { rule: mistake.ruleId }),
						commandName: 'languagetoolIgnoreRule',
						commandArgs: [mistake.ruleId],
					});
				}

				object.items = [...object.items, ...items];
			} catch (error) {
				console.warn('LanguageTool: Context menu error', error);
			}
			return object;
		});
	},
});
