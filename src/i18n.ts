// English source strings are the default catalog and translation keys.
// Add a catalog and a selector option to support another interface language.
// Keep documentation, source comments and technical console diagnostics in English.
export const de = {
	'Server URL': 'Server-URL',
	'Address of the /v2/check endpoint. Defaults to the free public LanguageTool API (api.languagetool.org). Alternatively, use a self-hosted server, e.g. https://languagetool.example.org/v2/check':
		'Adresse des /v2/check-Endpunkts. Standard ist die kostenlose öffentliche LanguageTool-API (api.languagetool.org). Alternativ einen eigenen Server verwenden, z. B. https://languagetool.example.org/v2/check',
	'Language': 'Prüfsprache',
	'Language code such as de-DE or en-US. Use "auto" for automatic language detection by LanguageTool.':
		'Sprachcode wie de-DE oder en-US. Mit "auto" erkennt LanguageTool die Sprache automatisch.',
	'Mother tongue': 'Muttersprache',
	'Helps LanguageTool apply rules for common mistakes made by speakers of other languages. Leave empty to disable.':
		'Hilft LanguageTool bei Regeln für typische Fehler von Sprechern anderer Sprachen. Zum Deaktivieren leer lassen.',
	'Check automatically': 'Automatisch prüfen',
	'Checks the note while typing: after the configured delay or starts a check at least every 5 seconds during continuous typing. Warning: this automatically sends the note text to the LanguageTool server.':
		'Prüft die Notiz beim Tippen nach der eingestellten Wartezeit bzw. startet bei fortlaufender Eingabe spätestens alle 5 Sekunden eine Prüfung. Achtung: Der Notiztext wird automatisch an den LanguageTool-Server übertragen.',
	'Delay before automatic checking (ms)': 'Wartezeit vor automatischer Prüfung (ms)',
	'Only used when "Check automatically" is enabled.':
		'Wird nur verwendet, wenn "Automatisch prüfen" aktiviert ist.',
	'Mask Markdown syntax': 'Markdown-Syntax ausblenden',
	'Masks Markdown syntax (#, *, `, links, code blocks, etc.) before checking to reduce false positives.':
		'Blendet Markdown-Syntax (#, *, `, Links, Codeblöcke usw.) vor der Prüfung aus, um Fehlalarme zu reduzieren.',
	'Disabled rules': 'Deaktivierte Regeln',
	'Comma-separated LanguageTool rule IDs, e.g. GERMAN_SPELLER_RULE. Add entries using the editor context menu.':
		'Kommagetrennte LanguageTool-Regel-IDs, z. B. GERMAN_SPELLER_RULE. Einträge können über das Rechtsklickmenü im Editor hinzugefügt werden.',
	'Disabled categories': 'Deaktivierte Kategorien',
	'Comma-separated category IDs, e.g. TYPOGRAPHY, STYLE.':
		'Kommagetrennte Kategorie-IDs, z. B. TYPOGRAPHY, STYLE.',
	'Personal dictionary': 'Eigenes Wörterbuch',
	'Words to ignore, separated by commas or newlines. Add entries using the editor context menu.':
		'Zu ignorierende Wörter, durch Kommas oder Zeilenumbrüche getrennt. Einträge können über das Rechtsklickmenü im Editor hinzugefügt werden.',
	'Username (optional)': 'Benutzername (optional)',
	'Only required if the server needs an API username, e.g. LanguageTool Premium.':
		'Nur nötig, wenn der Server einen API-Benutzernamen benötigt, z. B. LanguageTool Premium.',
	'API key (optional)': 'API-Schlüssel (optional)',
	'Only required if the server needs an API key.':
		'Nur nötig, wenn der Server einen API-Schlüssel benötigt.',
	'Apply': 'Übernehmen',
	'Cancel': 'Abbrechen',
	'unknown': 'unbekannt',
	'Unknown error': 'Unbekannter Fehler',
	'No note selected.': 'Keine Notiz ausgewählt.',
	'LanguageTool check failed': 'LanguageTool-Prüfung fehlgeschlagen',
	'Please check the server URL in the settings.': 'Bitte die Server-URL in den Einstellungen prüfen.',
	'Highlights are only available in the Markdown editor (CodeMirror). Spell checking in the rich text editor is not supported.':
		'Hervorhebungen sind nur im Markdown-Editor (CodeMirror) verfügbar. Die Rechtschreibprüfung im Rich-Text-Editor wird nicht unterstützt.',
	'The note was only checked up to the text length limit (30000 characters).':
		'Die Notiz wurde nur bis zur Textlängenbegrenzung (30000 Zeichen) geprüft.',
	'No changes were applied: the note or check result has changed, or the selection contains overlapping matches. Please check again and select only one correction for each overlapping text range.':
		'Es wurde nichts übernommen: Die Notiz oder das Prüfergebnis hat sich geändert, oder die Auswahl enthält überlappende Fundstellen. Bitte erneut prüfen und je überlappender Textstelle nur eine Korrektur auswählen.',
	'LanguageTool: Check note': 'LanguageTool: Notiz prüfen',
	'LanguageTool: Clear highlights': 'LanguageTool: Hervorhebungen entfernen',
	'LanguageTool: Apply suggestion': 'LanguageTool: Vorschlag übernehmen',
	'LanguageTool: Ignore word': 'LanguageTool: Wort ignorieren',
	'LanguageTool: Disable rule': 'LanguageTool: Regel deaktivieren',
	'Delete': 'Löschen',
	'Always ignore "{word}"': '"{word}" immer ignorieren',
	'Disable rule "{rule}"': 'Regel "{rule}" deaktivieren',
	'Select a correction': 'Korrektur auswählen',
	'Leave unchanged': 'Unverändert lassen',
	'Rule:': 'Regel:',
	'LanguageTool check': 'LanguageTool-Prüfung',
	'{count} match(es), detected language: {language}': '{count} Fundstelle(n), erkannte Sprache: {language}',
	'No errors found.': 'Keine Fehler gefunden.',
	'Select a suggestion for as many matches as you like. Only "Apply" changes the text. "Cancel" discards the entire selection.':
		'Wählen Sie bei beliebig vielen Fundstellen einen Vorschlag. Erst "Übernehmen" ändert den Text. "Abbrechen" verwirft die gesamte Auswahl.',
	'Applying corrections is unavailable. Please check again in the Markdown editor.':
		'Übernahme nicht verfügbar. Bitte im Markdown-Editor erneut prüfen.',
	'Matches and correction suggestions': 'Fundstellen und Korrekturvorschläge',
	'No server URL configured.': 'Keine Server-URL konfiguriert.',
	'Server unreachable ({url}): {detail}': 'Server nicht erreichbar ({url}): {detail}',
	' Hint: the URL usually needs to end with "/v2/check".': ' Hinweis: Die URL muss meist auf "/v2/check" enden.',
	'Server returned HTTP {status} ({url}){detail}{hint}': 'Server antwortete mit HTTP {status} ({url}){detail}{hint}',
	'The server response is not valid JSON.': 'Die Serverantwort ist kein gültiges JSON.',
	'Unexpected server response structure (no "matches" array).': 'Unerwartete Antwortstruktur des Servers (keine "matches"-Liste).',
};

export type TranslationKey = keyof typeof de;
export type UiLanguage = 'en' | 'de';
export const catalogs: Record<string, Partial<Record<TranslationKey, string>>> = { en: {}, de };
let activeLanguage: UiLanguage = 'en';

export function normalizeUiLanguage(value: unknown): UiLanguage {
	return value === 'de' ? 'de' : 'en';
}

export function setUiLanguage(value: unknown): void {
	activeLanguage = normalizeUiLanguage(value);
}

export function getUiLanguage(): UiLanguage {
	return activeLanguage;
}

export function t(key: TranslationKey, values: Record<string, string | number> = {}): string {
	const translated = catalogs[activeLanguage]?.[key] || key;
	// Replace once, without interpreting replacement text as HTML or another template.
	return translated.replace(/\{(\w+)\}/g, (placeholder, name) =>
		Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder);
}

// Settings metadata is generated from the same English strings as the catalog.
export function translateSetting(text: string): string {
	return t(text as TranslationKey);
}
