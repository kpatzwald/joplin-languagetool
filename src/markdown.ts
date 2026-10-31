// Masks Markdown syntax in the note so LanguageTool checks readable text only.
//
// Important: every removed character is replaced with exactly one space.
// This preserves the text length so LanguageTool match offsets map directly
// to the original editor text. Accented characters, emoji and line breaks
// remain unchanged.

const replaceWithSpaces = (match: string): string => ' '.repeat(match.length);

// Replaces all matches of `re` in `s`. `re` must have two groups:
// group 1 = marker (masked), group 2 = inner text (preserved).
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

	// Heading markers (# ...).
	s = s.replace(/^(\s{0,3}#{1,6})(\s+)/, replaceWithSpaces);

	// Blockquote markers (> ...).
	s = s.replace(/^(\s{0,3}>{1,})(\s?)/, replaceWithSpaces);

	// List markers including task checkboxes: - * + 1. - [ ] - [x].
	s = s.replace(/^(\s{0,3})([-*+]|\d{1,3}\.)(\s+\[[ xX]\]\s*|\s+)(?=\S)/, replaceWithSpaces);

	// Table separator rows (| --- | :--- |) and horizontal rules (---, ***).
	if (/^[\s|:-]+$/.test(s) && (s.includes('-') || s.includes('|'))) {
		return blankLine(s);
	}
	if (/^(\s*([-*_])\s*){3,}$/.test(s)) {
		return blankLine(s);
	}

	// Mask images entirely: ![alt](url).
	s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, replaceWithSpaces);

	// Links: [text](url) -> preserve the text only.
	s = s.replace(/\[([^\]]*)\]\(([^)]*)\)/g, (match, text) => {
		if (typeof text !== 'string') return ' '.repeat(match.length);
		return ' ' + text + ' '.repeat(Math.max(0, match.length - text.length - 1));
	});

	// Reference links: [text][ref] -> preserve the text only.
	s = s.replace(/\[([^\]]*)\]\[[^\]]*\]/g, (match, text) => {
		if (typeof text !== 'string') return ' '.repeat(match.length);
		return ' ' + text + ' '.repeat(Math.max(0, match.length - text.length - 1));
	});

	// Mask inline code (`...`) entirely.
	s = s.replace(/`+[^`\n]*`+/g, replaceWithSpaces);

	// Math: $...$.
	s = s.replace(/\$[^$\n]+\$/g, replaceWithSpaces);

	// Mask HTML tags entirely.
	s = s.replace(/<\/?[a-zA-Z][^>]*>/g, replaceWithSpaces);

	// Bold/italic/strikethrough: ***text*** **text** *text* ___text___ __text__ ~~text~~.
	s = blankMarkers(s, /(\*\*\*|___)(\S(?:[^*_]*?\S)?)\1/g);
	s = blankMarkers(s, /(\*\*|__)(\S(?:[^*_]*?\S)?)\1/g);
	s = blankMarkers(s, /(\*|~~)(\S(?:[^*_]*?\S)?)\1/g);

	// _text_ at word boundaries only (not underscores in snake_case).
	s = s.replace(/(^|\W)(_+)(\S(?:[^_]*?\S)?)(_+)(?=\W|$)/g, (match, lead, marker, inner) => {
		if (typeof marker !== 'string' || typeof inner !== 'string') {
			return ' '.repeat(match.length);
		}
		const pad = Math.max(0, match.length - lead.length - marker.length - inner.length);
		return ' '.repeat(lead.length) + ' '.repeat(marker.length) + inner + ' '.repeat(pad);
	});

	// Mask remaining table pipes.
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
