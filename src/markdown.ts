// Entfernt Markdown-Syntax aus dem Notiztext, damit LanguageTool nur den
// lesbaren Text prüft.
//
// Wichtig: Jede Ersetzung ersetzt jedes entfernte Zeichen durch genau ein
// Leerzeichen. Die Länge des Textes bleibt dadurch exakt gleich und die
// Offsets der LanguageTool-Fundstellen passen direkt auf den Originaltext
// im Editor. Umlaute, Emojis und Zeilenumbrüche bleiben unverändert.

const replaceWithSpaces = (match: string): string => ' '.repeat(match.length);

// Ersetzt in `s` alle Treffer von `re`. `re` muss zwei Gruppen haben:
// Gruppe 1 = Marker (wird geleert), Gruppe 2 = innerer Text (bleibt erhalten).
function blankMarkers(s: string, re: RegExp): string {
	return s.replace(re, (match, marker, inner) => {
		if (typeof marker !== 'string' || typeof inner !== 'string') {
			return ' '.repeat(match.length);
		}
		const pad = Math.max(0, match.length - marker.length - inner.length);
		return ' '.repeat(marker.length) + inner + ' '.repeat(pad);
	});
}

function blankLine(line: string): string {
	return line.replace(/\S/g, ' ');
}

function stripLine(line: string): string {
	let s = line;

	// Überschriften-Marker (# ...)
	s = s.replace(/^(\s{0,3}#{1,6})(\s+)/, replaceWithSpaces);

	// Blockquote-Marker (> ...)
	s = s.replace(/^(\s{0,3}>{1,})(\s?)/, replaceWithSpaces);

	// Listen-Marker inkl. Aufgaben-Checkboxen: - * + 1. - [ ] - [x]
	s = s.replace(/^(\s{0,3})([-*+]|\d{1,3}\.)(\s+\[[ xX]\]\s*|\s+)(?=\S)/, replaceWithSpaces);

	// Tabellen-Trennzeilen (| --- | :--- |) und horizontale Linien (---, ***)
	if (/^[\s|:-]+$/.test(s) && (s.includes('-') || s.includes('|'))) {
		return blankLine(s);
	}
	if (/^(\s*([-*_])\s*){3,}$/.test(s)) {
		return blankLine(s);
	}

	// Bilder vollständig leeren: ![alt](url)
	s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, replaceWithSpaces);

	// Links: [Text](url) -> nur den Text behalten
	s = s.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (match, text) => {
		if (typeof text !== 'string') return ' '.repeat(match.length);
		return ' ' + text + ' '.repeat(Math.max(0, match.length - text.length - 1));
	});

	// Referenz-Links [text][ref] -> nur den Text behalten
	s = s.replace(/\[([^\]]*)\]\[[^\]]*\]/g, (match, text) => {
		if (typeof text !== 'string') return ' '.repeat(match.length);
		return ' ' + text + ' '.repeat(Math.max(0, match.length - text.length - 1));
	});

	// Inline-Code (`...`) vollständig leeren
	s = s.replace(/`+[^`\n]*`+/g, replaceWithSpaces);

	// Mathematik $...$
	s = s.replace(/\$[^$\n]+\$/g, replaceWithSpaces);

	// HTML-Tags vollständig leeren
	s = s.replace(/<\/?[a-zA-Z][^>]*>/g, replaceWithSpaces);

	// Fett/Kursiv/Durchgestrichen: ***text*** **text** *text* ___text___ __text__ ~~text~~
	s = blankMarkers(s, /(\*\*\*|___)(\S(?:[^*_]*?\S)?)\1/g);
	s = blankMarkers(s, /(\*\*|__)(\S(?:[^*_]*?\S)?)\1/g);
	s = blankMarkers(s, /(\*|~~)(\S(?:[^*_]*?\S)?)\1/g);

	// _text_ nur an Wortgrenzen (keine Unterstriche in snake_case)
	s = s.replace(/(^|\W)(_+)(\S(?:[^_]*?\S)?)(_+)(?=\W|$)/g, (match, lead, marker, inner) => {
		if (typeof marker !== 'string' || typeof inner !== 'string') {
			return ' '.repeat(match.length);
		}
		const pad = Math.max(0, match.length - lead.length - marker.length - inner.length);
		return ' '.repeat(lead.length) + ' '.repeat(marker.length) + inner + ' '.repeat(pad);
	});

	// Verbleibende Tabellen-Pipes leeren
	s = s.replace(/\|/g, ' ');

	return s;
}

export function stripMarkdownForCheck(body: string): string {
	const lines = body.split('\n');

	let inFence = false;
	let fenceChar = '';
	let inFrontMatter = false;

	const result = lines.map((line, index) => {
		const fenceMatch = /^(\s{0,3})(`{3,}|~{3,})/.exec(line);
		if (fenceMatch) {
			const marker = fenceMatch[2][0];
			if (!inFence) {
				inFence = true;
				fenceChar = marker;
				return blankLine(line);
			}
			if (marker === fenceChar) {
				inFence = false;
			}
			return blankLine(line);
		}
		if (inFence) return blankLine(line);

		if (index === 0 && /^---+\s*$/.test(line)) {
			inFrontMatter = true;
			return blankLine(line);
		}
		if (inFrontMatter) {
			if (/^(---+|\.\.\.+)\s*$/.test(line)) {
				inFrontMatter = false;
			}
			return blankLine(line);
		}

		return stripLine(line);
	});

	return result.join('\n');
}
