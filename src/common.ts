// Gemeinsame Typen und Hilfsfunktionen, die sowohl im Hauptskript als auch
// im Editor-Content-Script verwendet werden (jedes Bundle erhält seine eigene Kopie).

// Maximale Textlänge, die an LanguageTool geschickt wird. Das entspricht dem
// Standardwert von LanguageTool (serverseitig konfigurierbar über maxCheckLength).
export const LT_MAX_TEXT = 30000;

// Ein Treffer aus der LanguageTool-Antwort (nur die benötigten Felder).
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
	// Absolute Position im Notiz-Text (0-basiert, wie im Editor-Dokument)
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

// Einfacher, schneller String-Hash (djb2). Muss in Hauptskript und
// Content-Script identisch sein, damit veraltete Ergebnisse erkannt werden.
export function hashString(s: string): number {
	let h = 5381;
	for (let i = 0; i < s.length; i++) {
		h = ((h << 5) + h + s.charCodeAt(i)) | 0;
	}
	return h;
}

// Wandelt einen LanguageTool-Treffer in ein Highlight-Payload um.
// `originalText` ist der Notiztext, `maskedText` der zur Prüfung gesendete
// (längengleiche) Text. Treffer, die (teilweise) ausgeblendete Markdown-
// Syntax überdecken, werden verworfen: Eine Korrektur könnte sonst
// Formatierung zerstören. Ebenso Treffer, die nur Leerzeichen umfassen
// (Rauschen durch die Markdown-Ausblendung), und Wörter aus dem eigenen
// Wörterbuch.
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
		message: String(match.message || match.rule?.description || 'Unbekannter Fehler'),
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
