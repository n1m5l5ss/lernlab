# Code signing policy

LernLab is free and open source, and it is signed only with free services for open-source projects. We don't pay for certificates, and we never will just to remove a warning.

| System | Signed? | By whom | What users see the first time |
|---|---|---|---|
| Windows | No, for now (owner decision, 21 November 2026). Free signing through SignPath Foundation is prepared and switches on when the secret is added (see [Apply to SignPath](#apply-to-signpath-owner-checklist)) | — | "Windows protected your PC": More info → Run anyway (see [Windows](#windows-unsigned-for-now)) |
| macOS | Ad-hoc only (no Apple certificate) | electron-builder, on GitHub's build machines | "Apple could not verify…": open it once through System Settings (see [macOS](#macos-unsigned-by-choice)) |
| Linux | No | — | Nothing; AppImage and deb don't use signatures this way |

## Windows: unsigned for now

**The Windows installer ships unsigned.** The owner decided on 21 November 2026 not to apply to SignPath for now and not to pay for a certificate. Free signing through SignPath Foundation is fully prepared below and stays dormant: it switches on when the owner follows the [checklist](#apply-to-signpath-owner-checklist) and adds the secret. Nothing else needs to change in the code.

- **The first open needs two extra clicks.** Microsoft Defender SmartScreen shows "Windows protected your PC" for apps it doesn't know yet. Press **More info**, then **Run anyway** (the box shows "Publisher: Unknown publisher"). Edge or Chrome may first say the download "isn't commonly downloaded": choose **Keep** (in Edge, then **Show more → Keep anyway**). The installer then installs just for the current user, without an admin prompt. The illustrated guide is on the [website](https://n1m5l5ss.github.io/lernlab/#win-guide) and in the [README](../README.md#opening-lernlab-on-windows-for-the-first-time).
- **Automatic updates still work on Windows.** electron-updater checks an update's signature only when the app was built signed, so unsigned updates install as before.
- **Smart App Control** (on some new Windows 11 PCs) blocks unsigned apps with no Run anyway button. Only signing fixes that.

## Windows: SignPath Foundation (prepared, not active)

When signing is switched on, the download page and this page carry SignPath's credit line, as its terms require:

> Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

The website keeps it in a comment in `apps/site/public/index.html` (footer) until then.

### What is signed

- `LernLab.exe`, the program itself (SignPath artifact configuration `app`, in [`.signpath/artifact-configurations/app.xml`](../.signpath/artifact-configurations/app.xml)).
- `LernLab-Setup-X.Y.Z.exe`, the installer (artifact configuration `installer`, in [`.signpath/artifact-configurations/installer.xml`](../.signpath/artifact-configurations/installer.xml)).

Only files built from this repository are signed. The Electron and Chromium libraries shipped next to `LernLab.exe` keep their makers' signatures (or none); we don't sign other people's code with our certificate.

### How it runs

Everything happens in "Build installers" (`.github/workflows/release.yml`) on GitHub-hosted runners, so SignPath can check that each file was built from this repository by this workflow:

1. electron-builder builds the unpacked app (`release/win-unpacked`).
2. The folder is uploaded as a workflow artifact and the official [SignPath action](https://github.com/SignPath/github-action-submit-signing-request) (pinned to a full commit) asks SignPath to sign `LernLab.exe`.
3. electron-builder builds the installer from the signed folder (`--prepackaged`).
4. The installer is signed the same way.
5. `apps/desktop/electron/signed-installer.ts` puts the signed installer in place and rewrites its `sha512`, `size` and `.blockmap` in `latest.yml`. Signing changes the file, and auto-update rejects a download whose checksum doesn't match.
6. The workflow checks both signatures (`Get-AuthenticodeSignature`) and runs the usual install smoke test on the signed installer.

**Without the SignPath secret and variable, none of this runs:** Windows builds unsigned exactly as before, and the release still succeeds. Pull requests and forks never have the secret, so they never sign anything.

Each signing request with the `release-signing` policy waits for an approver to accept it in SignPath (two requests per release: the app, then the installer). The workflow waits up to an hour for each.

### Roles

SignPath Foundation requires a project to name who does what. For LernLab:

| Role | Who | What they may do |
|---|---|---|
| Authors and committers | [Repository collaborators](https://github.com/n1m5l5ss/lernlab/graphs/contributors) | Change the source. Every change reaches `dev` and `main` only through a reviewed pull request with green checks (see [RELEASING.md](RELEASING.md#branch-protection-set-once-in-github--settings--rules--rulesets)). |
| Reviewers | The owner ([@n1m5l5ss](https://github.com/n1m5l5ss)) | Review and approve pull requests, including every outside contribution. |
| Approvers | The owner ([@n1m5l5ss](https://github.com/n1m5l5ss)) | Approve each release signing request in SignPath. |

Everyone with one of these roles uses multi-factor authentication on GitHub and on SignPath.

### Privacy

LernLab does not send information to other computers unless the person using it asks for it, with one exception they can switch off: it checks GitHub for updates (Settings → "Update automatically"). It also goes online when the user opens the deck gallery. An AI assistant the user connects (MCP, off by default) talks to LernLab only on the same computer; what it reads goes to that assistant's AI company. There is no telemetry, no account and no analytics. See the principles in [PLAN.md](PLAN.md).

### Apply to SignPath (owner checklist)

Only the owner can do this. Check the current terms at <https://signpath.org/terms> first; they may have changed since this was written.

1. **Check the project meets the terms.**
   - [x] An OSI-approved licence (MIT) and no proprietary parts.
   - [x] Already released and working (v0.3.0 and earlier on GitHub Releases).
   - [x] Built in public on GitHub-hosted runners from this repository.
   - [x] This page: what is signed, roles, privacy statement, and the SignPath credit line above. It must be reachable from the project's home page (it is linked from the README and the website footer).
   - [ ] Put the credit line back in the website footer: remove the comment around `footer-signing` in `apps/site/public/index.html` (SignPath requires the download page to mention it), and update `win-guide.test.ts`, which checks it stays hidden while Windows is unsigned.
   - [ ] Update the Windows guide on the website and in the README: SmartScreen may still warn until the certificate has built up reputation, but the publisher then shows "SignPath Foundation".
   - [ ] Multi-factor authentication switched on for your GitHub account.
2. **Apply** with the form at <https://signpath.org/apply>. You'll need: the repository URL (`https://github.com/n1m5l5ss/lernlab`), the website (`https://n1m5l5ss.github.io/lernlab/`), a short description ("Free, open-source desktop flashcard app with spaced repetition for Windows, macOS and Linux"), the link to this page, and the files to sign (`LernLab.exe` and the NSIS installer `LernLab-Setup-X.Y.Z.exe`, built with electron-builder on GitHub Actions).
3. **Wait for approval.** SignPath Foundation reviews the project and invites you to a SignPath organisation. Switch on multi-factor authentication there too.
4. **Set up the SignPath project** (in the SignPath web app):
   - Project slug: `lernlab` (or set the repository variable `SIGNPATH_PROJECT_SLUG` to yours).
   - Add the GitHub trusted build system and link the repository `n1m5l5ss/lernlab`.
   - Artifact configurations: create `app` and `installer`, pasting the XML from `.signpath/artifact-configurations/`.
   - Signing policies: `release-signing` (with you as approver) is what the workflow uses. To use another one, e.g. `test-signing` for a first try, set the repository variable `SIGNPATH_SIGNING_POLICY_SLUG`.
   - Create a CI user, give it submitter rights on the signing policy, and copy its API token.
5. **Add to GitHub** (Settings → Secrets and variables → Actions):
   - Secret `SIGNPATH_API_TOKEN`: the CI user's API token.
   - Variable `SIGNPATH_ORGANIZATION_ID`: your SignPath organisation ID (shown in SignPath under your organisation).
   - Optional variables: `SIGNPATH_PROJECT_SLUG` (default `lernlab`), `SIGNPATH_SIGNING_POLICY_SLUG` (default `release-signing`).
6. **First signed build.** Run "Build installers" by hand (Actions → Build installers → Run workflow, no tag), approve the two requests in SignPath, and check that the run's "Check the signatures" step passes. From then on every release and beta is signed.
7. You can remove the old unused secrets if they exist: `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`. The workflow no longer reads them.

## macOS: unsigned by choice

Apple only signs and notarises apps for members of its paid developer programme (99 USD a year). LernLab doesn't pay for it, and there is no free or open-source alternative that macOS trusts. So:

- **The Mac app is ad-hoc signed** (`"identity": "-"` in `apps/desktop/package.json`). This is a free, local signature with no developer name. It keeps the app intact on Apple silicon: without it, macOS says the app "is damaged". It does not make the warning go away.
- **The first open needs one extra step.** macOS shows "Apple could not verify 'LernLab' is free of malware". On macOS 15 Sequoia and later: press **Done**, open **System Settings → Privacy & Security**, press **Open Anyway**, then **Open Anyway** again and enter your password. On macOS 14 and earlier you can also Control-click (right-click) the app and choose **Open**. The illustrated guide is on the [website](https://n1m5l5ss.github.io/lernlab/#mac-guide) and in the [README](../README.md#opening-lernlab-on-a-mac-for-the-first-time).
- **No automatic updates on the Mac.** electron-updater can only install updates into an app signed with an Apple Developer ID, so the Mac app never looks for updates (`apps/desktop/electron/updates.ts` creates no updater on macOS; `update-policy.test.ts` keeps it that way). Mac users download new versions from the website. Windows and Linux update themselves.

If the project ever gets an Apple Developer ID (for example through a sponsor), signing and notarising needs the certificate as secrets, `identity` removed from the config, `hardenedRuntime` back on, and `MacUpdater` in `updates.ts`. The owner decided against paying Apple (November 2026); changing that is his decision (see "Code signing" in [PLAN.md](PLAN.md)).

## Check a download yourself

Every file on the website is the same file as on the [GitHub Releases page](https://github.com/n1m5l5ss/lernlab/releases); the website links straight to it.

- **Any system:** work out the file's SHA-256 and compare it with the `sha256:` checksum GitHub shows next to each file on the release page. The commands:
  - macOS: `shasum -a 256 ~/Downloads/LernLab-X.Y.Z-arm64.dmg`
  - Windows (PowerShell): `Get-FileHash .\LernLab-Setup-X.Y.Z.exe -Algorithm SHA256`
  - Linux: `sha256sum LernLab-X.Y.Z.AppImage`
- **Windows, signed releases (once signing is on):** right-click the installer → Properties → Digital Signatures. The signer is "SignPath Foundation". In PowerShell: `Get-AuthenticodeSignature .\LernLab-Setup-X.Y.Z.exe` shows `Valid`.
- **macOS:** `codesign -dv /Applications/LernLab.app` shows `Signature=adhoc`. That is expected; it only proves the app wasn't changed after it was built.

## Report a problem

If a LernLab file is signed by someone else, or a signed file looks wrong, please [open an issue](https://github.com/n1m5l5ss/lernlab/issues) or write to the owner privately through GitHub. Signing certificates misused by anyone can be revoked by SignPath Foundation.
