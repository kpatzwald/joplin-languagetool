# Text transmission and privacy

LanguageTool for Joplin checks note text by sending it to a configured LanguageTool endpoint. It is not an offline proofreader unless you configure a local server, and configuring a local server is the user's responsibility.

## Before the first request

The plugin asks for approval before sending any note text to a previously unapproved endpoint. The dialog displays the endpoint with credentials and query values redacted, describes text transmission, and links to LanguageTool. For the free public API, it also links to the provider's [privacy policy](https://languagetool.org/legal/privacy).

"Allow checking" stores approval locally in Joplin for the exact normalized endpoint. "Cancel" sends no text. Changing the endpoint requires new approval. No consent values or endpoint configuration are shipped in source or release archives.

Approval is a plugin safeguard, not a statement that the chosen server is appropriate for your data. Only approve a service you trust, and check with its operator before sending confidential, personal, school, or work information.

## What is sent

- The checked prefix of the selected note, with Markdown masking applied if enabled.
- The selected checking language and any configured mother tongue, disabled rules, and disabled categories.
- The configured API username and key, if supplied.

The plugin does not send the personal dictionary as a separate field, but words from it may naturally occur in the note text. Ignoring a word is a local filtering preference, not a guarantee that the word is removed before checking.

Public checks send no more than 19000 UTF-8 bytes of text in a single request. Custom-server checks send no more than the first 30000 UTF-16 string units. There is no automatic chunking of the rest of the note.

The plugin does not implement analytics or a second collection endpoint. HTTP redirects are rejected instead of forwarding requests to a different service. It cannot control processing, storage, logging, retention, or onward transfers by the chosen provider; see that provider's policy and contractual terms.

## Manual and automatic checking

The free public API is always manual-only. LanguageTool's published rules prohibit automated requests and direct automated users to self-hosting or Enterprise access ([public API rules](https://dev.languagetool.org/public-http-api.html)). Only starting "LanguageTool: Check note" can initiate a public check. Typing, corrections, ignored words/rules, and note changes do not trigger a public request.

For other endpoints, automatic checking is off by default and also requires endpoint approval. If enabled, note edits can cause background text transmission. Enable this only where the service permits automated requests. Putting a proxy in front of the free public service does not change that service's restrictions.

Local public-service budgets and HTTP 429 cooldowns reduce accidental excessive use but cannot account for other clients on your network. There are no automatic retries.

## Revoke approval

Run **LanguageTool: Revoke server consent** from the Tools menu or command palette. This clears approval, cancels the pending automatic-check timer, and clears editor highlights. The next manual check asks again, and background checks remain blocked until approval is renewed.

Revoking approval cannot recall text already transmitted or guarantee deletion by a provider. Disable "Check automatically" if you want manual-only operation with a custom server too.

## Transport and error reporting

Use HTTPS for remote servers. The public endpoint requires HTTPS; custom HTTP endpoints are allowed for local/private setups but show an unencrypted-connection warning before approval.

Diagnostic messages can contain provider error text and endpoint information. The plugin redacts URL credentials and query values in its own endpoint display, but a server's error response may itself contain sensitive data. Review logs, screenshots, and issue attachments before making them public. Do not attach real notes, API credentials, or private hostnames to bug reports.
