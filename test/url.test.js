// Test der URL-Normalisierung (normalizeCheckUrl aus src/languagetool.ts).
// Das Modul wird vor dem Test mit tsc nach JavaScript kompiliert, damit
// Quellcode und Test nicht auseinanderlaufen.

const assert = require('assert');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'dist', 'url-test-build');
execSync(
	'npx tsc src/languagetool.ts src/common.ts --outDir ' +
		JSON.stringify(outDir) +
		' --module commonjs --target es2020 --skipLibCheck --declaration false',
	{ stdio: 'pipe' },
);
assert.ok(fs.existsSync(path.join(outDir, 'languagetool.js')), 'Kompilat erstellt');

const { normalizeCheckUrl } = require(path.join(outDir, 'languagetool.js'));
assert.strictEqual(typeof normalizeCheckUrl, 'function', 'Funktion exportiert');

const cases = [
	['https://languagetool.example.org', 'https://languagetool.example.org/v2/check'],
	['https://api.languagetool.org', 'https://api.languagetool.org/v2/check'],
	['https://languagetool.example.org/', 'https://languagetool.example.org/v2/check'],
	['https://languagetool.example.org///', 'https://languagetool.example.org/v2/check'],
	['https://api.languagetool.org/v2', 'https://api.languagetool.org/v2/check'],
	['https://api.languagetool.org/v2/', 'https://api.languagetool.org/v2/check'],
	['https://languagetool.example.org/v2/check', 'https://languagetool.example.org/v2/check'],
	['https://languagetool.example.org/v2/check/', 'https://languagetool.example.org/v2/check'],
	['languagetool.example.org/v2/check', 'https://languagetool.example.org/v2/check'],
	['  https://languagetool.example.org  ', 'https://languagetool.example.org/v2/check'],
	['https://myserver.example/lt/v2/check', 'https://myserver.example/lt/v2/check'],
];

for (const [input, expected] of cases) {
	assert.strictEqual(normalizeCheckUrl(input), expected, 'Eingabe: ' + input);
}

// Leere URL -> Fehler
assert.throws(() => normalizeCheckUrl('   '), /Keine Server-URL/);

console.log('Alle URL-Normalisierungstests bestanden (' + cases.length + ' F\u00e4lle).');
