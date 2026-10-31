import { MistakePayload } from './common';
import { getUiLanguage, t } from './i18n';

export interface DialogChoice {
	mistakeIndex: number;
	suggestionIndex: number;
}

export interface BatchReplacement {
	from: number;
	to: number;
	text: string;
	expected: string;
}

export function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Include up to 180 characters before and after each match.
export function contextHtml(text: string, mistake: MistakePayload): string {
	const from = Math.max(0, mistake.offset - 180);
	const to = Math.min(text.length, mistake.offset + mistake.length + 180);
	return `${from ? '…' : ''}${escapeHtml(text.slice(from, mistake.offset))}<mark>${escapeHtml(
		text.slice(mistake.offset, mistake.offset + mistake.length),
	) || '│'}</mark>${escapeHtml(text.slice(mistake.offset + mistake.length, to))}${to < text.length ? '…' : ''}`;
}

export function buildResultsHtml(
	language: string, mistakes: MistakePayload[], text: string, notes: string, canApply: boolean,
): string {
	const items = mistakes.map((mistake, index) => {
		const options = mistake.replacements.map((suggestion, suggestionIndex) =>
			`<label class="lt-option"><input type="radio" name="choice_${index}" value="${suggestionIndex}" ${canApply ? '' : 'disabled'}>
			<span>${escapeHtml(suggestion === '' ? `[${t('Delete')}]` : suggestion)}</span></label>`).join('');
		return `<li>
			<h4>${escapeHtml(mistake.message)}</h4>
			<div class="lt-context">${contextHtml(text, mistake)}</div>
			<fieldset><legend>${escapeHtml(t('Select a correction'))}</legend>
				<label class="lt-option"><input type="radio" name="choice_${index}" value="-1" checked>
				<span>${escapeHtml(t('Leave unchanged'))}</span></label>${options}
			</fieldset>
			<small>${escapeHtml(t('Rule:'))} ${escapeHtml(mistake.ruleId)}${mistake.category ? ` (${escapeHtml(mistake.category)})` : ''}</small>
		</li>`;
	}).join('');
	return `<style>
		html, body { height: 100%; margin: 0; overflow: hidden; }
		body { font-family: sans-serif; font-size: 14px; line-height: 1.5; }
		.lt-dialog { box-sizing: border-box; height: 100vh; padding: 12px; display: flex; flex-direction: column; overflow: hidden; }
		.lt-dialog-header { flex: 0 0 auto; }
		.lt-dialog-header h3 { margin-top: 0; }
		.lt-dialog-header p { margin: 6px 0; }
		.lt-results-scroll { flex: 1 1 0; min-height: 0; overflow-y: scroll; overflow-x: hidden; scrollbar-gutter: stable; padding-right: 12px; margin-top: 8px; }
		.lt-results-scroll:focus-visible { outline: 2px solid #888; outline-offset: -2px; }
		ul { list-style: none; padding: 0; }
		li { border-bottom: 1px solid #8886; padding: 12px 0 18px; }
		h4 { margin: 0 0 8px; }
		.lt-context { white-space: pre-wrap; overflow-wrap: anywhere; border-left: 3px solid #888; padding: 8px 12px; margin-bottom: 10px; }
		mark { background: #ffe59a; color: #231b00; border-bottom: 2px solid #b45400; padding: 1px 2px; }
		fieldset { border: 0; padding: 0; margin: 6px 0; }
		legend, small, .lt-note { opacity: .8; }
		.lt-option { display: inline-flex; align-items: center; gap: 5px; margin: 4px 12px 4px 0; cursor: pointer; }
		.lt-option input:checked + span { font-weight: bold; text-decoration: underline; }
	</style>
	<div class="lt-dialog" lang="${getUiLanguage()}">
	<header class="lt-dialog-header">
	<h3>${escapeHtml(t('LanguageTool check'))}</h3>
	<p>${escapeHtml(mistakes.length ? t('{count} match(es), detected language: {language}', {
		count: mistakes.length, language,
	}) : t('No errors found.'))}</p>
	<p>${escapeHtml(t('Select a suggestion for as many matches as you like. Only "Apply" changes the text. "Cancel" discards the entire selection.'))}</p>
	${!canApply ? `<p>${escapeHtml(t('Applying corrections is unavailable. Please check again in the Markdown editor.'))}</p>` : ''}
	</header>
	<div class="lt-results-scroll" role="region" aria-label="${escapeHtml(t('Matches and correction suggestions'))}" tabindex="0">
	<form name="ltForm"><ul>${items}</ul></form>
	${notes ? `<p class="lt-note">${escapeHtml(notes)}</p>` : ''}
	</div>
	</div>`;
}

export function parseDialogChoices(form: unknown, mistakes: MistakePayload[]): DialogChoice[] {
	if (!form || typeof form !== 'object') return [];
	const choices: DialogChoice[] = [];
	for (let i = 0; i < mistakes.length; i++) {
		const raw = (form as Record<string, unknown>)[`choice_${i}`];
		if (typeof raw !== 'string' || !/^\d+$/.test(raw)) continue;
		const index = Number(raw);
		if (!Number.isSafeInteger(index) || index >= mistakes[i].replacements.length) continue;
		choices.push({ mistakeIndex: i, suggestionIndex: index });
	}
	return choices;
}

// Validate all edits before making the first text change.
export function validateBatch(text: string, edits: unknown): BatchReplacement[] | null {
	if (!Array.isArray(edits) || !edits.length) return null;
	const sorted: BatchReplacement[] = [];
	for (const edit of edits) {
		if (!edit || !Number.isSafeInteger(edit.from) || !Number.isSafeInteger(edit.to)
			|| typeof edit.text !== 'string' || typeof edit.expected !== 'string'
			|| edit.from < 0 || edit.to < edit.from || edit.to > text.length
			|| text.slice(edit.from, edit.to) !== edit.expected) return null;
		sorted.push({ from: edit.from, to: edit.to, text: edit.text, expected: edit.expected });
	}
	sorted.sort((a, b) => a.from - b.from || a.to - b.to);
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i].from < sorted[i - 1].to || sorted[i].from === sorted[i - 1].from) return null;
	}
	return sorted;
}
