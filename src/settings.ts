import joplin from 'api';
import { SettingItemType } from 'api/types';

export interface PluginSettings {
	url: string;
	language: string;
	motherTongue: string;
	autoCheck: boolean;
	autoCheckDelay: number;
	stripMarkdown: boolean;
	disabledRules: string;
	disabledCategories: string;
	ignoredWords: string;
	username: string;
	apiKey: string;
}

export async function registerSettings(): Promise<void> {
	await joplin.settings.registerSection('languagetool', {
		label: 'LanguageTool',
		iconName: 'fas fa-spell-check',
	});

	await joplin.settings.registerSettings({
		'languagetool.url': {
			value: 'https://api.languagetool.org/v2/check',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Server-URL',
			description: 'Adresse des /v2/check-Endpunkts der eigenen LanguageTool-Instanz, z. B. https://api.languagetool.org/v2/check',
		},
		'languagetool.language': {
			value: 'auto',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Sprache',
			description: 'Sprachcode wie de-DE oder en-US. "auto" = automatische Spracherkennung durch LanguageTool.',
		},
		'languagetool.motherTongue': {
			value: 'de-DE',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Muttersprache',
			description: 'Hilft LanguageTool bei Regeln, die typische Fehler von Muttersprachlern anderer Sprachen abdecken. Leer lassen zum Deaktivieren.',
		},
		'languagetool.autoCheck': {
			value: false,
			type: SettingItemType.Bool,
			section: 'languagetool',
			public: true,
			label: 'Automatisch prüfen',
			description: 'Prüft die Notiz automatisch einige Sekunden nach dem letzten Tastendruck. Achtung: Der Notiztext wird dabei automatisch an den LanguageTool-Server übertragen.',
		},
		'languagetool.autoCheckDelay': {
			value: 3000,
			type: SettingItemType.Int,
			section: 'languagetool',
			public: true,
			label: 'Wartezeit vor automatischer Prüfung (ms)',
			description: 'Wird nur verwendet, wenn "Automatisch prüfen" aktiviert ist.',
		},
		'languagetool.stripMarkdown': {
			value: true,
			type: SettingItemType.Bool,
			section: 'languagetool',
			public: true,
			label: 'Markdown-Syntax ausblenden',
			description: 'Entfernt Markdown-Zeichen (#, *, `, Links, Codeblöcke …) vor der Prüfung. Dadurch werden weniger falsche Fehler gemeldet.',
		},
		'languagetool.disabledRules': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Deaktivierte Regeln',
			description: 'Komma-getrennte Liste von LanguageTool-Regel-IDs, z. B. GERMAN_SPELLER_RULE. Neue Einträge können über das Rechtsklickmenü im Editor hinzugefügt werden.',
		},
		'languagetool.disabledCategories': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Deaktivierte Kategorien',
			description: 'Komma-getrennte Liste von Kategorie-IDs, z. B. TYPOGRAPHY, STYLE.',
		},
		'languagetool.ignoredWords': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Eigenes Wörterbuch',
			description: 'Wörter, die ignoriert werden sollen (Komma- oder Zeilen-getrennt). Neue Einträge können über das Rechtsklickmenü im Editor hinzugefügt werden.',
		},
		'languagetool.username': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Benutzername (optional)',
			description: 'Nur nötig, falls die Instanz einen API-Benutzernamen verlangt (z. B. LanguageTool Premium).',
		},
		'languagetool.apiKey': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'API-Schlüssel (optional)',
			description: 'Nur nötig, falls die Instanz einen API-Schlüssel verlangt.',
		},
	});
}

export async function getSettings(): Promise<PluginSettings> {
	const values = await Promise.all([
		joplin.settings.value('languagetool.url'),
		joplin.settings.value('languagetool.language'),
		joplin.settings.value('languagetool.motherTongue'),
		joplin.settings.value('languagetool.autoCheck'),
		joplin.settings.value('languagetool.autoCheckDelay'),
		joplin.settings.value('languagetool.stripMarkdown'),
		joplin.settings.value('languagetool.disabledRules'),
		joplin.settings.value('languagetool.disabledCategories'),
		joplin.settings.value('languagetool.ignoredWords'),
		joplin.settings.value('languagetool.username'),
		joplin.settings.value('languagetool.apiKey'),
	]);

	return {
		url: String(values[0] || ''),
		language: String(values[1] || 'auto'),
		motherTongue: String(values[2] || ''),
		autoCheck: Boolean(values[3]),
		autoCheckDelay: Number(values[4] || 3000),
		stripMarkdown: Boolean(values[5]),
		disabledRules: String(values[6] || ''),
		disabledCategories: String(values[7] || ''),
		ignoredWords: String(values[8] || ''),
		username: String(values[9] || ''),
		apiKey: String(values[10] || ''),
	};
}

export function ignoredWordsSet(ignoredWords: string): Set<string> {
	const set = new Set<string>();
	for (const token of ignoredWords.split(/[\n,]+/)) {
		const word = token.trim().toLowerCase();
		if (word) set.add(word);
	}
	return set;
}

export function addWordToIgnored(ignoredWords: string, word: string): string {
	const trimmed = word.trim();
	if (!trimmed) return ignoredWords;
	const set = ignoredWordsSet(ignoredWords);
	if (set.has(trimmed.toLowerCase())) return ignoredWords;
	const joiner = ignoredWords.includes('\n') || !ignoredWords.includes(',') ? '\n' : ', ';
	const clean = ignoredWords.trim();
	if (!clean) return trimmed.toLowerCase();
	return clean + joiner + trimmed.toLowerCase();
}

export function addRuleToDisabled(disabledRules: string, ruleId: string): string {
	const trimmed = ruleId.trim();
	if (!trimmed) return disabledRules;
	if (disabledRules.split(',').some((r) => r.trim().toLowerCase() === trimmed.toLowerCase())) {
		return disabledRules;
	}
	const clean = disabledRules.trim();
	if (!clean) return trimmed;
	return clean + ',' + trimmed;
}
