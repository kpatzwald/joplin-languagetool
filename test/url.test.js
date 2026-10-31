// URL normalization tests (normalizeCheckUrl from src/languagetool.ts).
// Compile the module to JavaScript with tsc before testing
// so the test always checks the current source code.

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
assert.ok(fs.existsSync(path.join(outDir, 'languagetool.js')), 'compiled module created');

const { normalizeCheckUrl } = require(path.join(outDir, 'languagetool.js'));
assert.strictEqual(typeof normalizeCheckUrl, 'function', 'function exported');

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
	assert.strictEqual(normalizeCheckUrl(input), expected, 'Input: ' + input);
}

// Empty URL: error.
assert.throws(() => normalizeCheckUrl('   '), /No server URL/);

console.log('All URL normalization tests passed (' + cases.length + ' cases).');
