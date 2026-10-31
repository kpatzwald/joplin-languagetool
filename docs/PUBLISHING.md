# Publishing LanguageTool for Joplin on GitHub

This checklist covers a public source repository and downloadable GitHub Releases, without submitting the plugin to the Joplin plugin repository. GitHub Releases can contain compiled binaries, and Joplin supports manually installing `.jpl` files ([GitHub release documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), [Joplin installation documentation](https://joplinapp.org/help/apps/plugins/)).

The prepared plugin version is 1.6.0. API safeguards and build-dependency fixes are implemented, but no GitHub upload, repository visibility change, npm publication, or Joplin directory submission has been performed.

## Implemented release safeguards

- **Public API usage:** version 1.6.0 blocks all public-service background checks, including correction and ignore refreshes. The free service is manual-only, consistent with its published restriction on automated requests ([LanguageTool public API rules](https://dev.languagetool.org/public-http-api.html)).
- **Text limits and request budgets:** public checks use a single prefix of at most 19000 UTF-8 bytes, with local rolling request/text budgets and HTTP 429 cooldowns. No automatic chunking or retries are used. The provider publishes a 20 KB per-request text limit and per-IP limits; local per-instance budgets cannot account for other clients sharing an IP ([LanguageTool public API rules](https://dev.languagetool.org/public-http-api.html)).
- **Privacy and attribution:** the interface includes a visible LanguageTool link, consent before first transmission to each endpoint, revocation, a provider privacy link for public checks, and custom HTTP warnings. Read [PRIVACY.md](PRIVACY.md) and keep it consistent with future changes.
- **Build dependencies:** vulnerable toolchain dependencies have been upgraded. The full npm audit reported zero known findings when preparing 1.6.0; rerun it immediately before release. A clean audit is not a guarantee that every dependency is safe.

## Remaining checks before distributing a build

- **Sensitive history:** inspect the entire history you intend to push, not just current files, for the private server address used during development. Inspect historical ZIP and `.jpl` files too. Deleting a value from the latest file or adding a pattern to `.gitignore` does not remove it from past commits ([GitHub sensitive-data guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)). Do not push a history containing private details. Preserve a private backup, then choose a deliberate cleanup strategy; history rewriting changes commit IDs. Revoke or rotate any exposed credentials first, if any were committed ([GitHub sensitive-data guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)).
- **Real Joplin testing:** automated checks have passed, but the build still needs a complete end-to-end test in Joplin. Test installation from the actual `.jpl`, upgrades, consent and cancellation before transmission, revocation, note switching, stale/overlapping corrections, undo, scrolling, and all three languages. Test automatic locale detection and manual overrides after restarting Joplin. Confirm there is no public background traffic, and test opt-in automatic checking only with an appropriate custom service.

Do not change the default to any private server address. A self-hosted service must be configured by its user, not shipped with the author's private hostname.

## Review release identity and documentation

- Keep `author` as `Kay Patzwald`, and retain `LICENSE`, bundled `src/LICENSE`, and the existing third-party attribution notes.
- Keep the plugin ID `de.osz2.languagetool` for continuity with existing installations. The ID is unrelated to the repository name and is not a server address.
- Verify the repository and homepage metadata point to `https://github.com/kpatzwald/joplin-languagetool`.
- Keep the version consistent in `package.json`, the root entries of `package-lock.json`, and `src/manifest.json`. Use a new version for a changed release build; the prepared version is 1.6.0.
- Declare only tested compatibility. The current `app_min_version` is 3.1.1; Joplin defines that field as the minimum compatible version, so do not claim that minimum without testing it ([Joplin manifest reference](https://joplinapp.org/help/api/references/plugin_manifest/)). The manifest now explicitly declares `"platforms": ["desktop"]`.
- Keep README content and code comments in English. Document installation from file, supported editor/platforms, supported interface languages, server configuration, privacy, limits, and known limitations.
- Add an English changelog, screenshots using non-sensitive sample notes, and issue-report instructions. For an early release, recommend a backup and test profile.
- Review your Git commit author name and email before making the history public. Do not publish API keys, local settings, real notes, or machine-specific paths in documentation or screenshots.

## Inspect your existing local repository

Run these commands in your own local clone. They inspect state and do not upload anything.

```bash
git status --short
git branch --show-current
git remote -v
git log --oneline -10
git config user.name
git config user.email
```

Inspect earlier settings and documentation locally; do not paste sensitive output into public issues:

```bash
git log --all --oneline -- src/settings.ts README.md
git log --all -p -- src/settings.ts README.md
```

This inspection is not a complete secret scan. Include other files, branches, tags, and archived binaries in your review. Avoid `git push --all` and `git push --tags` for the initial publication.

If `origin` still uses the misspelled repository name, update it after renaming the GitHub repository. `git remote set-url` changes the URL of an existing remote ([GitHub remote documentation](https://docs.github.com/en/get-started/git-basics/managing-remote-repositories)).

```bash
git remote set-url origin https://github.com/kpatzwald/joplin-languagetool.git
git remote -v
```

Do not run `git init`, reclone over your work, discard commits, or force-push merely to connect the existing local repository.

## Build the reviewed release

Use Node.js 20.9 or later in the 20.x series, or Node.js 22 or later. Run these commands only after addressing the remaining release checks above and committing or reviewing the intended source changes. `npm ci` runs this project's `prepare` build; the explicit build command below makes the release-build step clear.

```bash
npm ci
npm run dist
npm test
npx tsc --noEmit --skipLibCheck --pretty false
npm audit --audit-level=low
git diff --check
git status --short
```

The installer is `publish/de.osz2.languagetool.jpl`. Test that exact file in Joplin, not only a development-plugin checkout. Manual installation uses the plugin settings gear menu, "Install from file", followed by a restart ([Joplin installation documentation](https://joplinapp.org/help/apps/plugins/)).

Review the output before committing. The project's `.gitignore` excludes `node_modules/`, `dist/`, and `publish/`, but its project workspace currently already tracks the release files in `publish/`. Check `git ls-files publish` in your own clone; decide deliberately whether to retain generated release files in Git or distribute them only as release assets. Do not commit every historical source ZIP simply because it is present in a working directory.

Optionally create a checksum file after the final build:

```bash
sha256sum publish/de.osz2.languagetool.jpl
(cd publish && sha256sum de.osz2.languagetool.jpl) > SHA256SUMS.txt
```

The checksum file is intended as an additional release attachment. If you change or rebuild the installer, regenerate and retest the final artifact before attaching it.

## Push the intended branch and create a tag

The following commands publish to the remote when executed. They are instructions, not actions already performed.

First review and commit only the intended files. If all intended work is already committed, skip the staging/commit step.

```bash
git diff
git diff --cached
# Stage only reviewed source/documentation changes, then commit if needed.
git status
git push -u origin HEAD
```

`HEAD` here means the current local branch; inspect `git branch --show-current` first and do not use this example from a detached HEAD. If the push is rejected because the remote already has different history, stop and inspect it rather than using `--force`.

After the release commit is finalized, read the actual version and tag that commit:

```bash
VERSION=$(node -p "require('./package.json').version")
git tag -a "v$VERSION" -m "LanguageTool for Joplin v$VERSION"
git push origin "v$VERSION"
```

Do not move an already published release tag to another commit. Fixes should receive a new version, tag, and release.

## Create the GitHub Release

GitHub's documented workflow is **Releases → Draft a new release**, select the existing tag, enter a title and description, attach binary assets, and either save a draft or publish; a release can also be marked as a pre-release ([GitHub release documentation](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)).

- Select the tag created above.
- Attach `de.osz2.languagetool.jpl`, plus `SHA256SUMS.txt` if prepared.
- Include an English summary, exact tested Joplin versions, installation instructions, privacy/server notices, and known limitations.
- For an initial public test build, select **This is a pre-release** and explain that it is a preview. A pre-release label is not a substitute for fixing the API usage or privacy issues.
- Save as a draft until you have checked the tag, files, and text. Publish only when you intend public distribution.
- Tell users to download the `.jpl` attachment, not a source archive, to install the plugin.

A GitHub source push or release is not a submission to the Joplin plugin repository; that repository is a separate distribution channel, while manual `.jpl` installation is supported independently ([Joplin plugin documentation](https://joplinapp.org/help/apps/plugins/)). For this release route, provide explicit instructions for downloading and installing later `.jpl` updates; do not promise automatic updates from GitHub Releases.

No npm publication is part of the workflow in this checklist.
