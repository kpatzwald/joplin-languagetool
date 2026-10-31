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
export const fr: Record<TranslationKey, string> = {
	'Server URL': 'URL du serveur',
	'Address of the /v2/check endpoint. Defaults to the free public LanguageTool API (api.languagetool.org). Alternatively, use a self-hosted server, e.g. https://languagetool.example.org/v2/check':
		'Adresse du point de terminaison /v2/check. Par défaut, utilise l’API publique gratuite de LanguageTool (api.languagetool.org). Vous pouvez aussi utiliser un serveur auto-hébergé, par exemple https://languagetool.example.org/v2/check',
	'Language': 'Langue de vérification',
	'Language code such as de-DE or en-US. Use "auto" for automatic language detection by LanguageTool.':
		'Code de langue tel que fr-FR ou en-US. Utilisez "auto" pour la détection automatique de la langue par LanguageTool.',
	'Mother tongue': 'Langue maternelle',
	'Helps LanguageTool apply rules for common mistakes made by speakers of other languages. Leave empty to disable.':
		'Aide LanguageTool à appliquer les règles relatives aux erreurs courantes des locuteurs d’autres langues. Laissez vide pour désactiver.',
	'Check automatically': 'Vérifier automatiquement',
	'Checks the note while typing: after the configured delay or starts a check at least every 5 seconds during continuous typing. Warning: this automatically sends the note text to the LanguageTool server.':
		'Vérifie la note pendant la saisie après le délai configuré, ou lance une vérification au moins toutes les 5 secondes lors d’une saisie continue. Attention : le texte de la note est automatiquement envoyé au serveur LanguageTool.',
	'Delay before automatic checking (ms)': 'Délai avant la vérification automatique (ms)',
	'Only used when "Check automatically" is enabled.':
		'Utilisé uniquement si "Vérifier automatiquement" est activé.',
	'Mask Markdown syntax': 'Masquer la syntaxe Markdown',
	'Masks Markdown syntax (#, *, `, links, code blocks, etc.) before checking to reduce false positives.':
		'Masque la syntaxe Markdown (#, *, `, liens, blocs de code, etc.) avant la vérification pour réduire les faux positifs.',
	'Disabled rules': 'Règles désactivées',
	'Comma-separated LanguageTool rule IDs, e.g. GERMAN_SPELLER_RULE. Add entries using the editor context menu.':
		'Identifiants de règles LanguageTool séparés par des virgules, par exemple GERMAN_SPELLER_RULE. Ajoutez des entrées via le menu contextuel de l’éditeur.',
	'Disabled categories': 'Catégories désactivées',
	'Comma-separated category IDs, e.g. TYPOGRAPHY, STYLE.':
		'Identifiants de catégories séparés par des virgules, par exemple TYPOGRAPHY, STYLE.',
	'Personal dictionary': 'Dictionnaire personnel',
	'Words to ignore, separated by commas or newlines. Add entries using the editor context menu.':
		'Mots à ignorer, séparés par des virgules ou des sauts de ligne. Ajoutez des entrées via le menu contextuel de l’éditeur.',
	'Username (optional)': 'Nom d’utilisateur (facultatif)',
	'Only required if the server needs an API username, e.g. LanguageTool Premium.':
		'Nécessaire uniquement si le serveur exige un nom d’utilisateur pour l’API, par exemple LanguageTool Premium.',
	'API key (optional)': 'Clé API (facultative)',
	'Only required if the server needs an API key.':
		'Nécessaire uniquement si le serveur exige une clé API.',
	'Apply': 'Appliquer',
	'Cancel': 'Annuler',
	'unknown': 'inconnue',
	'Unknown error': 'Erreur inconnue',
	'No note selected.': 'Aucune note sélectionnée.',
	'LanguageTool check failed': 'Échec de la vérification LanguageTool',
	'Please check the server URL in the settings.': 'Veuillez vérifier l’URL du serveur dans les paramètres.',
	'Highlights are only available in the Markdown editor (CodeMirror). Spell checking in the rich text editor is not supported.':
		'Le surlignage est disponible uniquement dans l’éditeur Markdown (CodeMirror). La vérification orthographique dans l’éditeur de texte enrichi n’est pas prise en charge.',
	'The note was only checked up to the text length limit (30000 characters).':
		'La note n’a été vérifiée que jusqu’à la limite de longueur du texte (30000 caractères).',
	'No changes were applied: the note or check result has changed, or the selection contains overlapping matches. Please check again and select only one correction for each overlapping text range.':
		'Aucune modification n’a été appliquée : la note ou le résultat de la vérification a changé, ou la sélection contient des passages qui se chevauchent. Relancez la vérification et ne sélectionnez qu’une seule correction pour chaque zone de chevauchement.',
	'LanguageTool: Check note': 'LanguageTool : vérifier la note',
	'LanguageTool: Clear highlights': 'LanguageTool : effacer le surlignage',
	'LanguageTool: Apply suggestion': 'LanguageTool : appliquer la suggestion',
	'LanguageTool: Ignore word': 'LanguageTool : ignorer le mot',
	'LanguageTool: Disable rule': 'LanguageTool : désactiver la règle',
	'Delete': 'Supprimer',
	'Always ignore "{word}"': 'Toujours ignorer "{word}"',
	'Disable rule "{rule}"': 'Désactiver la règle "{rule}"',
	'Select a correction': 'Choisir une correction',
	'Leave unchanged': 'Laisser inchangé',
	'Rule:': 'Règle :',
	'LanguageTool check': 'Vérification LanguageTool',
	'{count} match(es), detected language: {language}': '{count} passage(s) signalé(s), langue détectée : {language}',
	'No errors found.': 'Aucune erreur trouvée.',
	'Select a suggestion for as many matches as you like. Only "Apply" changes the text. "Cancel" discards the entire selection.':
		'Choisissez une suggestion pour autant de passages que vous le souhaitez. Seul "Appliquer" modifie le texte. "Annuler" abandonne toute la sélection.',
	'Applying corrections is unavailable. Please check again in the Markdown editor.':
		'L’application des corrections est indisponible. Relancez la vérification dans l’éditeur Markdown.',
	'Matches and correction suggestions': 'Passages signalés et suggestions de correction',
	'No server URL configured.': 'Aucune URL de serveur configurée.',
	'Server unreachable ({url}): {detail}': 'Serveur inaccessible ({url}) : {detail}',
	' Hint: the URL usually needs to end with "/v2/check".': ' Conseil : l’URL doit généralement se terminer par "/v2/check".',
	'Server returned HTTP {status} ({url}){detail}{hint}': 'Le serveur a renvoyé HTTP {status} ({url}){detail}{hint}',
	'The server response is not valid JSON.': 'La réponse du serveur n’est pas un JSON valide.',
	'Unexpected server response structure (no "matches" array).': 'Structure inattendue de la réponse du serveur (tableau "matches" absent).',
};

export type UiLanguage = 'en' | 'de' | 'fr';
export const catalogs: Record<string, Partial<Record<TranslationKey, string>>> = { en: {}, de, fr };
let activeLanguage: UiLanguage = 'en';

export function normalizeUiLanguage(value: unknown): UiLanguage {
	// Joplin locales use underscores; also accept BCP 47 tags and region variants.
	const base = typeof value === 'string' ? value.trim().toLowerCase().split(/[-_]/)[0] : '';
	return base === 'de' || base === 'fr' ? base : 'en';
}

export function resolveUiLanguage(preference: unknown, joplinLocale?: unknown): UiLanguage {
	// Preserve explicit choices from earlier releases. Invalid stored choices
	// fall back to English; missing preferences use the new automatic default.
	if (preference === undefined || preference === null || preference === 'auto') {
		return normalizeUiLanguage(joplinLocale);
	}
	return normalizeUiLanguage(preference);
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
