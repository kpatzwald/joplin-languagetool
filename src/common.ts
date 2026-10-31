// Shared types and helpers used by the main script and editor content script.
// Each bundle receives its own copy.
import { t } from './i18n';

// Maximum text length sent to LanguageTool. Matches the LanguageTool default
// (configurable on the server using maxCheckLength).
export const LT_MAX_TEXT = 30000;

// A match from the LanguageTool response (only the fields we need).
export interface LTMatch {
	message: string;
	shortMessage?: string;
	replacements: { value?: string | null }[];
	offset: number;
	length: number;
	rule: {
		id: string;
		description: string;
		issueType: string;
		category: { id: string; name: string };
	} | undefined;
	type?: {
		typeName?: string;
	} | undefined;
}

export interface MistakePayload {
	// Absolute position in the note text (zero-based, as in the editor document).
	offset: number;
	length: number;
	word: string;
	message: string;
	replacements: string[];
	issueType: string;
	ruleId: string;
	ruleDescription: string;
	category: string;
}

// Simple, fast string hash (djb2). Must be identical in the main script and
// content script so that stale results can be detected.
export function hashString(s: string): number {
	let h = 5381;
	for (let i = 0; i < s.length; i++) {
		h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	}
	return h;
}

// Converts a LanguageTool match to a highlighting payload.
// `originalText` is the note text; `maskedText` is the text sent for checking,
// with the same length. Reject matches that overlap masked Markdown syntax:
// applying a correction there could damage formatting. Also reject matches
// containing only whitespace (noise from Markdown masking) and words in the
// personal dictionary.
export function mistakeToPayload(
	match: LTMatch,
	originalText: string,
	maskedText: string,
	ignoredWords: Set<string>,
): MistakePayload | null {
	const word = maskedText.slice(match.offset, match.offset + match.length);
	if (!word.trim()) return null;

	if (originalText.slice(match.offset, match.offset + match.length) !== word) {
		return null;
	}

	if (ignoredWords.has(word.trim().toLowerCase())) return null;

	const replacements: string[] = [];
	const seen = new Set<string>();
	for (const replacement of match.replacements || []) {
		const value = replacement?.value;
		if (value === undefined || value === null) continue;
		const valueStr = String(value);
		if (seen.has(valueStr)) continue;
		seen.add(valueStr);
		replacements.push(valueStr);
		if (replacements.length >= 10) break;
	}

	return {
		offset: match.offset,
		length: match.length,
		word,
		message: String(match.message || match.rule?.description || t('Unknown error')),
		replacements,
		issueType: String(match.rule?.issueType || match.type?.typeName || 'other'),
		ruleId: String(match.rule?.id || ''),
		ruleDescription: String(match.rule?.description || ''),
		category: String(match.rule?.category?.name || ''),
	};
}

export function mapMatches(
	matches: LTMatch[],
	originalText: string,
	maskedText: string,
	ignoredWords: Set<string>,
): MistakePayload[] {
	const result: MistakePayload[] = [];
	for (const match of [...matches].sort((a, b) => a.offset - b.offset)) {
		const payload = mistakeToPayload(match, originalText, maskedText, ignoredWords);
		if (payload) result.push(payload);
	}
	return result;
}
