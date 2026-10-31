// Minimal client for the LanguageTool HTTP API (v2).
// Documentation: https://api.languagetool.org/api/ (also applies to self-hosted servers).

export interface LTReplacement {
	value: string;
}

import { LTMatch } from './common';
import { t } from './i18n';
import { displayEndpoint, isPublicEndpoint, PUBLIC_TEXT_BYTES, PublicRequestBudget, utf8Length } from './apiPolicy';
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
	trigger: 'manual' | 'background';
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

const publicBudget = new PublicRequestBudget();

// Normalizes the configured server URL: adds a missing scheme, removes
// surrounding whitespace and trailing slashes, and appends the standard
// /v2/check API path if only a host (or .../v2) is specified.
// Preserves custom paths, e.g. behind a reverse proxy.
export function normalizeCheckUrl(raw: string): string {
	let url = String(raw || '').trim();
	if (!url) throw new LTError(t('No server URL configured.'));
	if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
	// Remove trailing slashes only when there is no query string.
	if (!url.includes('?')) url = url.replace(/\/+$/, '');
	if (/\/v2$/i.test(url)) {
		url += '/check';
	} else {
		try {
			const parsed = new URL(url);
			// Only append if no path is specified; leave custom
			// reverse-proxy paths unchanged.
			if (parsed.pathname === '' || parsed.pathname === '/') {
				url += '/v2/check';
			}
		} catch {
			// Leave unchanged.
		}
	}
	return url;
}

export async function checkText(text: string, options: LTCheckOptions): Promise<LTCheckResponse> {
	const checkUrl = normalizeCheckUrl(options.url);
	const publicService = isPublicEndpoint(checkUrl);
	if (publicService) {
		if (options.trigger !== 'manual') throw new LTError(t('The free public API only supports manually started checks.'));
		if (new URL(checkUrl).protocol !== 'https:') throw new LTError(t('Use HTTPS for the public LanguageTool API.'));
		if (utf8Length(text) > PUBLIC_TEXT_BYTES) throw new LTError(t('The public API text limit is 19000 UTF-8 bytes.'));
		if (!publicBudget.reserve(utf8Length(text))) throw new LTError(t('Local public API limit reached. Wait at least one minute before checking again.'));
	}
	const body = new URLSearchParams();
	body.set('text', text);
	body.set('language', options.language && options.language.trim() ? options.language.trim() : 'auto');
	if (options.motherTongue && options.motherTongue.trim()) body.set('motherTongue', options.motherTongue.trim());
	if (options.disabledRules && options.disabledRules.trim()) body.set('disabledRules', options.disabledRules.trim());
	if (options.disabledCategories && options.disabledCategories.trim()) body.set('disabledCategories', options.disabledCategories.trim());
	if (options.username && options.username.trim()) body.set('username', options.username.trim());
	if (options.apiKey && options.apiKey.trim()) body.set('apiKey', options.apiKey.trim());

	let response: Response;
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 20000);
	try {
		response = await fetch(checkUrl, {
			method: 'POST',
			// Never follow a redirect to an unapproved endpoint or public API.
			redirect: 'error',
			signal: controller.signal,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: body.toString(),
		});
	} catch (error) {
		throw new LTError(
			t('Server unreachable ({url}): {detail}', {
				url: displayEndpoint(checkUrl), detail: error instanceof Error ? error.message : String(error),
			}),
		);
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		if (publicService && response.status === 429) {
			const raw = response.headers?.get('Retry-After');
			const seconds = raw && /^\d+$/.test(raw) ? Number(raw)
				: raw ? (Date.parse(raw) - Date.now()) / 1000 : 60;
			publicBudget.coolDown(Number.isFinite(seconds) ? seconds : 60);
		}
		let detail = '';
		try {
			const text = await response.text();
			detail = text.slice(0, 300);
		} catch {
			// Ignore.
		}
		const hint = response.status === 404
			? t(' Hint: the URL usually needs to end with "/v2/check".')
			: '';
		throw new LTError(
			t('Server returned HTTP {status} ({url}){detail}{hint}', {
				status: response.status, url: displayEndpoint(checkUrl), detail: detail ? `: ${detail}` : '', hint,
			}),
			response.status,
		);
	}

	let data: LTCheckResponse;
	try {
		data = (await response.json()) as LTCheckResponse;
	} catch {
		throw new LTError(t('The server response is not valid JSON.'));
	}

	if (!data || !Array.isArray(data.matches)) {
		throw new LTError(t('Unexpected server response structure (no "matches" array).'));
	}

	return data;
}
