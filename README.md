# LanguageTool for Joplin

Author: Kay Patzwald. Project name: `joplin-languagetool`. npm package name: `joplin-plugin-languagetool`.

GitHub repository address configured in the metadata: https://github.com/kpatzwald/joplin-languagetool. Renaming the GitHub repository previously called `joplin-langugetool` and uploading code are separate steps; building this package does not perform either action.

Spelling and grammar checking for Joplin notes using LanguageTool. The default endpoint is the free public API at https://api.languagetool.org. Alternatively, configure a self-hosted server, such as `https://languagetool.example.org`, to send text to your own service.

Developed for Joplin's CodeMirror 6 editor, inspired by [tito21/joplin-langugetool](https://github.com/tito21/joplin-langugetool) (MIT). The different spelling in that address belongs to the original third-party project and is intentionally preserved in the attribution.

The existing plugin ID, `de.osz2.languagetool`, remains unchanged for update compatibility. It is not a server endpoint. No private server addresses are included.

## Features

- **Check note:** run `LanguageTool: Check note` from the Tools menu, note toolbar, or command palette (`Ctrl+Shift+P`). If necessary, show the toolbar button using the toolbar's customization menu.
- **Editor highlights:** red wavy underlines for spelling, orange wavy underlines for grammar and punctuation, and gray dotted underlines for style suggestions. Hover over a match to see its message.
- **Context menu suggestions:** right-click a highlighted match to apply a suggestion, always ignore the word, or disable the rule.
- **Results dialog:** view larger excerpts with up to 180 characters before and after each highlighted match. Select suggestions for multiple matches, then click "Apply" to apply them together. "Cancel" discards the selection.
- **Optional automatic checking:** disabled by default. Available only for self-hosted or authorized services after endpoint-specific consent. When enabled, starts a check after a typing pause or at least every five seconds during continuous typing. Always blocked for the free public API, even if an older installation has automatic checking enabled. Response times and ongoing edits can delay highlights.
- **Consent and public API safeguards:** asks before sending text to a new endpoint, supports revoking approval, and enforces public-service manual-only checks, UTF-8 limits, local request budgets, and a cooldown after HTTP 429.
- **Markdown-friendly checking:** masks headings, links, code blocks, tables, and other Markdown syntax before checking, while preserving match positions.
- **Personal dictionary and disabled rules/categories:** configurable in the plugin settings.
- **Multilingual interface:** follows Joplin's interface language automatically by default. English, German, and French are supported, with English as the fallback. You can also select any supported language manually. The checking language is configured independently. Messages, suggestions, category names, and detected language names returned by LanguageTool are displayed as received. Documentation, source comments, and technical console diagnostics remain in English.

## Requirements

- Joplin Desktop with the CodeMirror 6 Markdown editor. The declared minimum is 3.1.1; this is not a claim that a complete GUI test has been performed on every version. Enable that editor in the settings if your Joplin version does not use it by default.
- The rich text editor (WYSIWYG) is not supported.
- An accessible LanguageTool endpoint: the default public API, `https://api.languagetool.org/v2/check`, or a self-hosted endpoint such as `https://languagetool.example.org/v2/check`.

## Installation

1. Obtain `publish/de.osz2.languagetool.jpl` from this package or a release.
2. In Joplin, open Tools → Options → Plugins, then use the gear menu to select "Install from file" and choose the `.jpl` file. Menu wording may vary with Joplin's interface language.
3. Restart Joplin.
4. Check the server URL in the LanguageTool settings. The default is `https://api.languagetool.org/v2/check`; replace it there to use your own server.

To build from source, use Node.js 20.9 or later in the 20.x series, or Node.js 22 or later, and npm. Node.js is needed for building only, not for installing the `.jpl` into Joplin. Run:

```bash
npm ci
npm run dist
```

The resulting `.jpl` file is written to `publish/`. For local development, add the plugin's source directory to Joplin's development plugin settings.

## Usage

1. Open a note in the Markdown editor.
2. Open the command palette with `Ctrl+Shift+P` and run `LanguageTool: Check note`, or use the Tools menu or toolbar button.
3. Before the first transmission to an endpoint, review the server and privacy notice. "Allow checking" remembers approval for that exact normalized endpoint; "Cancel" sends no note text. Errors are underlined after the check completes. Right-click a match to see its message and suggestions.
4. Selecting a suggestion from the context menu applies it immediately. In the results dialog, select one suggestion per match for as many matches as needed; the note stays unchanged until you click "Apply". "Leave unchanged" clears the choice for a match, and "Cancel" discards all choices. After applying, the dialog closes once. With the free public API, run "Check note" again to refresh results; there is no automatic follow-up request.
5. Use the context menu to add words to the personal dictionary or disable individual rules. Highlights are cleared. Background refreshes occur only for an approved non-public endpoint with automatic checking explicitly enabled.
6. Use `LanguageTool: Revoke server consent` from the Tools menu or command palette to remove approval and stop future automatic checks. An already transmitted request cannot be recalled. The next manual check asks for consent again.

Automatic checking pauses while the results dialog is open so a newer result cannot invalidate the selection. All selected edits are validated before they are applied in a single editor transaction. Overlapping matches and stale results are rejected without applying part of the selection. If matches overlap, check again and select only one of the conflicting corrections.

The match list has its own vertical scroll region. The header stays outside that list, while "Apply" and "Cancel" remain in Joplin's separate button bar. Use Tab to focus the scroll region, then use the arrow keys or Page Up/Page Down to scroll.

## Settings

| Setting | Default | Description |
|---|---|---|
| Interface language / Sprache / Langue | `Automatic (Joplin)` | Follow Joplin, or choose `English`, `Deutsch`, or `Français`; restart Joplin after changing |
| Server URL | `https://api.languagetool.org/v2/check` | Free public API or self-hosted server |
| Language | `auto` | For example, `de-DE`, `en-US`, or `auto` |
| Mother tongue | `de-DE` | Helps apply rules for common language-learning mistakes |
| Check automatically | Disabled | Only for approved self-hosted or authorized services; always ignored for the free public API |
| Delay before automatic checking | 1000 ms | Delay after a typing pause; a check starts at least every 5 seconds during continuous typing |
| Mask Markdown syntax | Enabled | Reduce false positives |
| Disabled rules / categories | Empty | Comma-separated IDs |
| Personal dictionary | Empty | Words separated by commas or newlines |
| Username / API key | Empty | Only needed for servers requiring credentials |

Changing the interface language does not change existing settings or the `de-DE` mother-tongue default. To check English text explicitly, set "Language" to `en-US` or another supported English variant; "auto" keeps automatic detection.

## Public API use and privacy

LanguageTool's free public endpoint prohibits automated requests, limits text to 20 KB per request, and publishes per-IP limits of 20 requests and 75 KB of text per minute; it does not guarantee performance or availability ([public API rules](https://dev.languagetool.org/public-http-api.html)). This plugin uses the public service only when the user explicitly starts "Check note". Typing, applying corrections, ignoring words/rules, and changing notes never trigger public background requests.

Public checks send a single prefix of at most 19000 UTF-8 bytes without splitting a surrogate pair. There is no automatic chunking, retry, or fallback to another service. Local safeguards allow at most 10 requests and 60000 text bytes per rolling minute per running plugin instance. Failed attempts count toward the local budget. HTTP 429 adds a cooldown of at least 60 seconds, respecting a longer `Retry-After` value. These local budgets do not account for other clients sharing the same IP or activity before a restart, so the server can still reject requests.

Checked text and configured language options go to the configured endpoint; configured authentication fields are also sent when supplied. With the public endpoint, processing is governed by the provider's [privacy policy](https://languagetool.org/legal/privacy). With a custom endpoint, ask its operator about processing and retention. The plugin cannot promise that any external server keeps text private or deletes it. Do not approve a server for sensitive notes unless its handling is appropriate.

Consent is stored locally in Joplin for the exact normalized endpoint. Changing that endpoint requires new approval before transmission. Automatic checking is off by default and cannot start before consent, including after upgrading. For custom services, enable it only if the service permits automated requests; a proxy forwarding to the free public endpoint does not grant permission. Requests use POST and do not follow HTTP redirects, so a redirect cannot silently transfer text to a different endpoint. HTTP connections to a custom server are possible but show an unencrypted-connection warning.

For a self-hosted service, configure its URL, run a manual check and approve that endpoint, then enable "Check automatically" if desired. Existing custom-server automatic-check preferences are preserved, but the new endpoint approval is still required. Public-service restrictions apply regardless of a stored automatic-check preference or API credentials.

## Interface languages

New installations default to **Automatic (Joplin)**. At plugin startup, the plugin reads Joplin's `locale` setting and selects English, German, or French. Regional variants are supported: for example, `de_DE`, `de-CH`, `fr_FR`, and `fr-CA` select their respective base language. Unsupported languages or unavailable locale information fall back to English.

To override automatic detection, open the plugin's LanguageTool settings and select `English`, `Deutsch`, or `Français` under **Interface language / Sprache / Langue**, save the setting, and restart Joplin. Select `Automatic (Joplin)` to follow Joplin again. A restart applies the choice consistently to command/menu labels, settings descriptions, dialogs, accessibility labels, and plugin-generated error messages. Language selection does not apply immediately to an already running plugin.

Existing explicit choices from earlier releases are preserved: if version 1.4.0 stored `English` or `Deutsch`, that remains a manual override after updating. Select `Automatic (Joplin)` once to opt into automatic detection. The plugin never overwrites saved language choices, checking settings, or dictionary entries.

The language selector intentionally has a multilingual label and restart instruction so it remains recognizable in all three interface languages. The plugin's name and marketplace description remain English metadata. LanguageTool's own descriptions and suggestions, raw server errors, and detected language names are not translated by this plugin.

Automatic detection uses [`joplin.settings.globalValues(['locale'])`](https://joplinapp.org/api/references/plugin_api/classes/joplinsettings.html); `locale` is defined in [Joplin's built-in settings metadata](https://raw.githubusercontent.com/laurent22/joplin/dev/packages/lib/models/settings/builtInMetadata.ts). A compatibility fallback uses `globalValue('locale')` when only that older API is available. If no API is available or reading fails, the interface stays usable in English. Manual overrides do not need to read global settings.

### Adding another translation

Translations live in `src/i18n.ts`. English source strings are the keys and fallback; the German and French catalogs supply translations. Missing preferences use automatic detection. Unsupported locales, invalid preferences, and missing individual translations fall back to English.

To add a language:

1. Add a catalog with the same keys as `de`. Use `Record<TranslationKey, string>` to enforce completeness.
2. Add its code to `UiLanguage`, `catalogs`, and `normalizeUiLanguage()`.
3. Add a native-language option to `languagetool.uiLanguage` in `src/settings.ts`.
4. Preserve placeholders such as `{word}`, `{count}`, and `{language}` exactly. Interpolation is single-pass, and dialog text must still be HTML-escaped.
5. Add language-specific test cases and run the complete build and test suite.

Keep README content, developer documentation, and code comments in English. Do not translate user note text, correction replacements, protocol fields, command IDs, setting keys, or the plugin ID.

## Technical notes and limitations

- The public endpoint is manual-only. If a request is rejected or the local budget is exhausted, wait before starting another manual check; the plugin does not automatically retry.
- Server URLs are normalized automatically: missing schemes default to `https://`, trailing slashes are removed, and the standard `/v2/check` path is appended where appropriate. Thus, `https://languagetool.example.org` also works. Custom paths, for example behind a reverse proxy, are preserved.
- Network requests go only to the configured server. There is no automatic fallback to another service. When using the public API, checked text is transmitted to LanguageTool's servers. Configure a trusted self-hosted endpoint for sensitive notes.
- Results are tied to the text that was checked. If the text or selected note changes, stale results are rejected.
- Each check result receives a unique token. Any text change, clearing highlights, or a newer result invalidates that token. Corrections require a matching note, text, and token. The editor also synchronously checks the expected original text and document boundaries.
- Public checks cover at most 19000 UTF-8 bytes; custom-server checks cover at most 30000 UTF-16 string units. The results dialog states when text was truncated. Content after that prefix is not sent or checked.
- Context menu corrections and the results dialog are desktop features; they are not currently available on Joplin Mobile.
- Known limitation: masking Markdown list markers or checkboxes can make LanguageTool report incorrect capitalization warnings for the following word, such as German rule `DE_CASE`. Disabling that rule affects all notes and is therefore not generally recommended.

## Version and test status

Version 1.6.0 hardens public API usage and updates the build toolchain. Public checks are manual-only, automatic checking defaults to off, and every endpoint requires consent before sending text. The release adds UTF-8-aware public input limits, local rolling budgets, HTTP 429 cooldowns, visible LanguageTool attribution, and a revocation command. The build uses updated `copy-webpack-plugin`, `glob`, and `tar`, and archive failures now fail the build. The full npm audit reported zero known vulnerabilities when this release was prepared; this is a point-in-time result, not a permanent security guarantee.

Joplin locale detection, English/German/French interfaces, author Kay Patzwald, the plugin ID, and correction safety checks are retained. README content and code comments remain English. See [privacy details](docs/PRIVACY.md), [release notes](CHANGELOG.md), and the [publishing checklist](docs/PUBLISHING.md).

Automated tests cover the editor integration using real CodeMirror state, native form values in a DOM environment, and main-script flows using a mocked Joplin API. Scroll-region structure and CSS are checked with 100 matches; these DOM tests do not measure actual screen dimensions. Tests require no running LanguageTool server and do not replace an end-to-end test in the Joplin GUI.

To reproduce the checks:

```bash
npm ci
npm run dist
npm test
npx tsc --noEmit --skipLibCheck --pretty false
npm audit --audit-level=low
```

The form and main-script tests run in English, German, and French and inspect actual values after selecting multiple suggestions. Editor tests verify atomic application and complete rejection of invalid or overlapping changes. Localization tests cover automatic Joplin locale detection, regional variants, manual overrides and upgrade preservation, current and legacy API paths, missing or failing APIs, English fallbacks, settings preservation, catalog coverage, placeholder consistency, escaped interpolation, and localized client errors. Policy tests verify public background-call blocking, old automatic-check preferences, correction and ignore paths, byte-safe truncation, rolling budgets, cooldowns, consent/cancellation/revocation, endpoint changes, and custom-server opt-in. A smoke test extracts the actual main script from the `.jpl` and exercises locale detection, consent, a single manual POST, public background blocking, attribution, and revocation in an isolated JavaScript VM. All HTTP responses and Joplin locale reads in these tests are mocked.

## License

MIT; see `LICENSE`. The files `webpack.config.js`, `api/`, and `GENERATOR_DOC.md` originate from the official Joplin plugin template (`generator-joplin`, MIT).
