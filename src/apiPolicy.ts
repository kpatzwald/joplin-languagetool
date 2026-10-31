// Local safeguards for the public service. These are not a service guarantee
// and cannot account for traffic from other clients sharing the same IP.
export const PUBLIC_TEXT_BYTES = 19000;
export const PUBLIC_REQUESTS_PER_MINUTE = 10;
export const PUBLIC_BYTES_PER_MINUTE = 60000;

export function isPublicEndpoint(raw: string): boolean {
	try {
		const value = String(raw || '').trim();
		const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
		const host = url.hostname.toLowerCase().replace(/\.+$/, '');
		// Do not let another path, port, trailing dot, or credentials bypass
		// the public-service restriction. The homepage hosts are guarded too.
		return host === 'api.languagetool.org' || host === 'languagetool.org' || host === 'www.languagetool.org';
	} catch {
		return true; // Malformed endpoints must never enable background requests.
	}
}

export function utf8Length(text: string): number {
	let bytes = 0;
	for (const character of text) {
		const code = character.codePointAt(0)!;
		bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
	}
	return bytes;
}

export function truncateUtf8(text: string, maxBytes: number): string {
	let bytes = 0;
	let end = 0;
	for (const character of text) {
		const size = utf8Length(character);
		if (bytes + size > maxBytes) break;
		bytes += size;
		end += character.length;
	}
	return text.slice(0, end);
}

export function displayEndpoint(raw: string): string {
	try {
		const url = new URL(raw);
		// Do not render credentials, query tokens, or fragments in the consent UI.
		return `${url.protocol}//${url.host}${url.pathname}${url.search ? '?[redacted]' : ''}`;
	} catch {
		return '[invalid URL]';
	}
}

export class PublicRequestBudget {
	private entries: { at: number; bytes: number }[] = [];
	private blockedUntil = 0;

	public reserve(bytes: number, now = Date.now()): boolean {
		this.entries = this.entries.filter((item) => now - item.at < 60000);
		if (now < this.blockedUntil || this.entries.length >= PUBLIC_REQUESTS_PER_MINUTE
			|| this.entries.reduce((sum, item) => sum + item.bytes, 0) + bytes > PUBLIC_BYTES_PER_MINUTE) return false;
		this.entries.push({ at: now, bytes });
		return true;
	}

	public coolDown(seconds: number, now = Date.now()): void {
		this.blockedUntil = Math.max(this.blockedUntil, now + Math.max(60, seconds) * 1000);
	}
}
