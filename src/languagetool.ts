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

// Normalisiert die konfigurierte Server-URL: Schema ergänzen (falls
// vergessen), Leer- und End-Schrägstriche entfernen und den üblichen
// API-Pfad /v2/check ergänzen, falls nur der Host (oder .../v2) angegeben
// ist. Eigene Pfade (z. B. hinter einem Reverse-Proxy) werden respektiert.
export function normalizeCheckUrl(raw: string): string {
	let url = String(raw || '').trim();
	if (!url) throw new LTError('Keine Server-URL konfiguriert.');
	if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
	// End-Schrägstriche entfernen (nur ohne Query-String sinnvoll).
	if (!url.includes('?')) url = url.replace(/\/+$/, '');
	if (/\/v2$/i.test(url)) {
		url += '/check';
	} else {
		try {
			const parsed = new URL(url);
			// Nur ergänzen, wenn überhaupt kein Pfad angegeben ist – fremde
			// Pfade (Reverse-Proxy) werden nicht angetastet.
			if (parsed.pathname === '' || parsed.pathname === '/') {
				url += '/v2/check';
			}
		} catch {
			// unverändert lassen
		}
	}
	return url;
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
	const checkUrl = normalizeCheckUrl(options.url);
	try {
		response = await fetch(checkUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: body.toString(),
		});
	} catch (error) {
		throw new LTError(
			`Server nicht erreichbar (${checkUrl}): ${error instanceof Error ? error.message : String(error)}`,
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
		const hint = response.status === 404
			? ' Hinweis: Die URL muss meist auf „/v2/check“ enden.'
			: '';
		throw new LTError(
			`Server antwortete mit HTTP ${response.status} (${checkUrl})${detail ? ` – ${detail}` : ''}${hint}`,
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
