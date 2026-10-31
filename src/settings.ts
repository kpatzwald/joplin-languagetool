import joplin from 'api';
import { SettingItemType } from 'api/types';
import { resolveUiLanguage, setUiLanguage, translateSetting } from './i18n';

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
	approvedServer: string;
}

export async function registerSettings(): Promise<void> {
	await joplin.settings.registerSection('languagetool', {
		label: 'LanguageTool',
		iconName: 'fas fa-spell-check',
	});

	await joplin.settings.registerSettings({
		// Approval is tied to the complete normalized endpoint, not a global opt-in.
		'languagetool.approvedServer': {
			value: '', type: SettingItemType.String, public: false, label: 'Approved server endpoint',
		},
		// Bootstrap this setting before reading its persisted value. Keep its
		// label multilingual so it is recognizable in every supported language.
		'languagetool.uiLanguage': {
			value: 'auto',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			isEnum: true,
			options: { auto: 'Automatic (Joplin)', en: 'English', de: 'Deutsch', fr: 'Français' },
			label: 'Interface language / Sprache / Langue',
			description: 'Restart Joplin after changing this setting. / Joplin nach dem Ändern neu starten. / Redémarrez Joplin après modification.',
		},
	});
	const preference = await joplin.settings.value('languagetool.uiLanguage');
	let locale: unknown;
	if (preference === 'auto' || preference === undefined || preference === null) {
		try {
			// Prefer the current API; retain compatibility with older Joplin versions.
			if (typeof joplin.settings.globalValues === 'function') {
				[locale] = await joplin.settings.globalValues(['locale']);
			} else if (typeof joplin.settings.globalValue === 'function') {
				locale = await joplin.settings.globalValue('locale');
			}
		} catch (error) {
			console.warn('LanguageTool: Could not read Joplin locale; using English.', error);
		}
	}
	setUiLanguage(resolveUiLanguage(preference, locale));

	const items = {
		'languagetool.url': {
			value: 'https://api.languagetool.org/v2/check',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Server URL',
			description: 'Address of the /v2/check endpoint. Defaults to the free public LanguageTool API (api.languagetool.org). Alternatively, use a self-hosted server, e.g. https://languagetool.example.org/v2/check',
		},
		'languagetool.language': {
			value: 'auto',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Language',
			description: 'Language code such as de-DE or en-US. Use "auto" for automatic language detection by LanguageTool.',
		},
		'languagetool.motherTongue': {
			value: 'de-DE',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Mother tongue',
			description: 'Helps LanguageTool apply rules for common mistakes made by speakers of other languages. Leave empty to disable.',
		},
		'languagetool.autoCheck': {
			value: false,
			type: SettingItemType.Bool,
			section: 'languagetool',
			public: true,
			label: 'Check automatically',
			description: 'Only for self-hosted or authorized services, after server consent. Never used with the free public API. Automatically sends note text while typing.',
		},
		'languagetool.autoCheckDelay': {
			value: 1000,
			type: SettingItemType.Int,
			section: 'languagetool',
			public: true,
			label: 'Delay before automatic checking (ms)',
			description: 'Only used when "Check automatically" is enabled.',
		},
		'languagetool.stripMarkdown': {
			value: true,
			type: SettingItemType.Bool,
			section: 'languagetool',
			public: true,
			label: 'Mask Markdown syntax',
			description: 'Masks Markdown syntax (#, *, `, links, code blocks, etc.) before checking to reduce false positives.',
		},
		'languagetool.disabledRules': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Disabled rules',
			description: 'Comma-separated LanguageTool rule IDs, e.g. GERMAN_SPELLER_RULE. Add entries using the editor context menu.',
		},
		'languagetool.disabledCategories': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Disabled categories',
			description: 'Comma-separated category IDs, e.g. TYPOGRAPHY, STYLE.',
		},
		'languagetool.ignoredWords': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Personal dictionary',
			description: 'Words to ignore, separated by commas or newlines. Add entries using the editor context menu.',
		},
		'languagetool.username': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'Username (optional)',
			description: 'Only required if the server needs an API username, e.g. LanguageTool Premium.',
		},
		'languagetool.apiKey': {
			value: '',
			type: SettingItemType.String,
			section: 'languagetool',
			public: true,
			label: 'API key (optional)',
			description: 'Only required if the server needs an API key.',
		},
	};
	for (const item of Object.values(items)) {
		item.label = translateSetting(item.label);
		item.description = translateSetting(item.description);
	}
	await joplin.settings.registerSettings(items);
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
		joplin.settings.value('languagetool.approvedServer'),
	]);

	return {
		url: String(values[0] || ''),
		language: String(values[1] || 'auto'),
		motherTongue: String(values[2] || ''),
		autoCheck: Boolean(values[3]),
		autoCheckDelay: Number(values[4] || 1000),
		stripMarkdown: Boolean(values[5]),
		disabledRules: String(values[6] || ''),
		disabledCategories: String(values[7] || ''),
		ignoredWords: String(values[8] || ''),
		username: String(values[9] || ''),
		apiKey: String(values[10] || ''),
		approvedServer: String(values[11] || ''),
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
