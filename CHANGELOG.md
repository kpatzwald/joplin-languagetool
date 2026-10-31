# Changelog

## 1.6.0

### Public API and privacy

- Make the free public API strictly manual-only, including for upgrades with an existing `autoCheck=true` preference.
- Block public background requests from typing, correction refreshes, ignored words/rules, note changes, and pending automatic-check timers.
- Disable automatic checking by default for new installations. Retain opt-in automatic checking for approved self-hosted or authorized services.
- Ask for endpoint-specific consent before the first text transmission. Remember approval locally and require it again after endpoint changes.
- Add **LanguageTool: Revoke server consent** to the command palette and Tools menu.
- Limit public text to a single, surrogate-safe prefix of 19000 UTF-8 bytes and disclose truncation.
- Add per-instance rolling public budgets of 10 requests and 60000 text bytes per minute, plus a minimum 60-second HTTP 429 cooldown with `Retry-After` handling.
- Do not retry automatically, split notes into automatic chunks, follow redirects, or fall back to another service.
- Add visible LanguageTool attribution, a public-provider privacy link, custom HTTP warnings, and English privacy documentation.
- Translate the new interface messages into German and French. Keep README content and code comments in English.

### Build and validation

- Upgrade `copy-webpack-plugin` to 14.x, `glob` to 14.x, and `tar` to 7.5.22 or later, with exact resolved versions recorded in the lockfile.
- Require Node.js 20.9 or later in the 20.x series, or Node.js 22 or later, for builds.
- Fail the build if archive creation fails instead of swallowing the error.
- Declare the implemented platform as desktop while retaining the existing plugin ID and author.
- Add regression coverage for consent/cancellation/revocation, endpoint changes, public background blocking, UTF-8 limits, request budgets, HTTP 429 cooldowns, and custom-server opt-in.
- Exercise the actual main script extracted from the `.jpl` in an isolated VM with mocked Joplin and HTTP APIs.
- The full npm audit reports zero known vulnerabilities at release preparation time. This does not guarantee future advisory status or absence of vulnerabilities.

### Release status

The build and automated tests have been checked in the development environment. All HTTP tests use mocks; no private notes are sent as part of testing. A real Joplin GUI acceptance test and a review of the publisher's local Git history are still required before public release.

## 1.5.0

- Follow Joplin's interface language automatically, with manual overrides.
- Add French alongside English and German.
- Preserve existing explicit language choices and independent checking-language settings.

## 1.4.0

- Add an extensible interface translation catalog with English and German.
- Keep documentation and source comments in English.
