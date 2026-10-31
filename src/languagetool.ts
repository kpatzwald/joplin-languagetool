// Minimaler Client für die LanguageTool-HTTP-API (v2).
// Dokumentation: https://api.languagetool.org/api/ (gilt auch für eigene Instanzen)

export interface LTReplacement {
	value: string;
}

import { LTMatch } from './common';
export { LTMatch };

export interface LTCheckResponse {
	software?: {
		name?: string;
		version?: string;
	};
	language?: {
		name?: string;
		code?: string;
		detectedLanguage?: {
			name?: string;
			code?: string;
			confidence?: number;
		};
	};
	matches: LTMatch[];
	warnings?: {
		incompleteResults?: boolean;
	};
}

export interface LTCheckOptions {
	url: string;
	language: string;
	motherTongue?: string;
	disabledRules?: string;
	disabledCategories?: string;
	username?: string;
	apiKey?: string;
}

export class LTError extends Error {
	public readonly statusCode?: number;

	public constructor(message: string, statusCode?: number) {
		super(message);
		this.name = 'LTError';
		this.statusCode = statusCode;
	}
}

function hostOf(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url;
	}
}

export async function checkText(text: string, options: LTCheckOptions): Promise<LTCheckResponse> {
	const body = new URLSearchParams();
	body.set('text', text);
	body.set('language', options.language && options.language.trim() ? options.language.trim() : 'auto');
	if (options.motherTongue && options.motherTongue.trim()) body.set('motherTongue', options.motherTongue.trim());
	if (options.disabledRules && options.disabledRules.trim()) body.set('disabledRules', options.disabledRules.trim());
	if (options.disabledCategories && options.disabledCategories.trim()) body.set('disabledCategories', options.disabledCategories.trim());
	if (options.username && options.username.trim()) body.set('username', options.username.trim());
	if (options.apiKey && options.apiKey.trim()) body.set('apiKey', options.apiKey.trim());

	let response: Response;
	try {
		response = await fetch(options.url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: body.toString(),
		});
	} catch (error) {
		throw new LTError(
			`Server nicht erreichbar (${hostOf(options.url)}): ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	if (!response.ok) {
		let detail = '';
		try {
			const text = await response.text();
			detail = text.slice(0, 300);
		} catch {
			// Ignorieren
		}
		throw new LTError(
			`Server antwortete mit HTTP ${response.status}${detail ? ` – ${detail}` : ''}`,
			response.status,
		);
	}

	let data: LTCheckResponse;
	try {
		data = (await response.json()) as LTCheckResponse;
	} catch {
		throw new LTError('Antwort des Servers ist kein gültiges JSON.');
	}

	if (!data || !Array.isArray(data.matches)) {
		throw new LTError('Unerwartete Antwortstruktur des Servers (keine "matches"-Liste).');
	}

	return data;
}
