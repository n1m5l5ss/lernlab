# Branches, versions, changelog and releases

## Branches

```
feature/…  ─┐
fix/…      ─┼──► dev ──(release PR)──► main ──► tag vX.Y.Z ──► installers on GitHub Releases
chore/…    ─┘     │                     ▲
                  └─ beta tags          └── hotfix/… (urgent fixes only)
```

| Branch | Purpose | Who writes to it |
|---|---|---|
| `main` | Released code. What users download. Always stable. | Only by pull request from `dev`, from a `hotfix/*` branch, or the automated release PR |
| `dev` | Integration. Everything finished but not yet released. Always passes CI. | Only by pull request from short-lived branches |
| `feature/<issue>-<name>` | A new feature, branched from `dev` | One ticket each, deleted after merge |
| `fix/<issue>-<name>` | A bug fix, branched from `dev` | One bug each |
| `hotfix/<issue>-<name>` | An urgent fix to a released version, branched from `main` | Merged to `main`, then `main` is merged back into `dev` automatically |

There is no separate staging branch. A **beta release** cut from `dev` plays that role, and testers opt into the beta update channel in Settings.

## Flow for every change

1. Create `feature/12-home-screen` (or `fix/…`) from `dev`.
2. Write tests first, then code. Run `npm run test:all`.
3. Open a pull request into `dev`. Its title must follow Conventional Commits, because the title becomes the changelog line:
   - `feat: add session length picker on Home`, which becomes **Added**;
   - `fix: keep streak when the clock changes`, which becomes **Fixed**;
   - `perf:`, `docs:`, `refactor:`, `test:`, `chore:` for other changes; `feat!:` marks a breaking change.
4. CI runs (see below). Review, then **squash-merge** into `dev`.

## Making a release

1. **Beta (optional).** Run the "Beta release" workflow on `dev`. It tags `vX.Y.Z-beta.N` and publishes a GitHub pre-release with installers for all three systems. `X.Y.Z` defaults to the next patch after the last release; type another version when running it if the next release is a minor or major one. Testers on the beta channel get it.
2. **Stable.** Update the docs (see [Docs for every release](#docs-for-every-release)), then open a pull request `dev → main` titled `release: X.Y.Z` and merge it with a merge commit (not squash).
3. **release-please** sees the new commits on `main`, opens a release PR that bumps the version in `package.json` and adds the section to `CHANGELOG.md`, and updates that PR as more commits arrive.
4. Merging the release PR creates the tag `vX.Y.Z` and the GitHub Release. The release-please workflow then calls the "Build installers" workflow directly (a tag made with `GITHUB_TOKEN` can't trigger other workflows), which builds, smoke-tests and publishes the installers (see [Installers](#installers)), and `latest*.yml` lets installed apps auto-update.
5. A workflow opens a pull request `main → dev`, so the version bump and changelog reach `dev` too. Merge it with a merge commit.

**By hand.** Pushing a tag `vX.Y.Z` (admins only) runs "Build installers" too and attaches everything to a **draft** GitHub Release, to review and publish yourself. A stable tag must equal the version in `package.json`, and a pre-release tag (`vX.Y.Z-beta.N`) must lead up to a newer version; otherwise the run stops before building (`apps/desktop/electron/release-version.ts`). "Run workflow" on "Build installers" with a tag rebuilds that release's installers and re-attaches them, e.g. after a failed run; without a tag it only builds artifacts.

## Docs for every release

Every release, major, minor or patch, leaves the docs matching what shipped:

- **Automatic:** the release PR bumps the version in `package.json`, `apps/desktop/package.json`, `CHANGELOG.md`, and the lines marked `x-release-please-version` in `README.md` and `docs/USER-GUIDE.md` (release-please `extra-files`). `apps/site/src/docs-version.test.ts` fails if those lines and `package.json` disagree.
- **By hand, before merging the `dev → main` pull request:**
  - `README.md`: the feature bullets cover what this release adds;
  - `docs/USER-GUIDE.md`: every new screen or option is explained;
  - `docs/ROADMAP.md`: shipped items move from **Next** to **Done**.

## Installers

"Build installers" (`.github/workflows/release.yml`) runs the tests once, then builds on real Windows, macOS and Linux runners (`npm run dist:win`, `dist:mac`, `dist:linux`). The version inside the app and in the file names comes from the tag.

| System | Files | Installs |
|---|---|---|
| Windows 10 and 11 | `LernLab-Setup-X.Y.Z.exe` | NSIS one-click, per user into `%LOCALAPPDATA%\Programs`, no admin rights |
| macOS | `LernLab-X.Y.Z-arm64.dmg`, `LernLab-X.Y.Z-x64.dmg` | Open, drag to Applications |
| Linux | `LernLab-X.Y.Z.AppImage`, `lernlab_X.Y.Z_amd64.deb` | AppImage runs as is; the deb installs to `/opt/LernLab` |

Each release also carries `latest*.yml` and `.blockmap` files for auto-update.

**Smoke test.** Before uploading, each runner installs its installers the way a user would (runs the Windows setup silently, mounts both dmgs, runs the AppImage and installs the deb) and starts the app with `--smoke-test`. In that mode the app uses a fresh, throw-away data folder, skips the welcome, waits until Home is on screen, prints `LERNLAB_SMOKE_OK` and quits; anything else fails the run (`apps/desktop/electron/smoke.ts`). On a Linux computer: `npm run dist:linux`, then `xvfb-run -a release/linux-unpacked/lernlab --no-sandbox --smoke-test` (or without `xvfb-run` on a desktop).

**Signing.** See the [code signing policy](CODE_SIGNING.md). Windows is signed for free by SignPath Foundation: once the repository has the secret `SIGNPATH_API_TOKEN` and the variable `SIGNPATH_ORGANIZATION_ID`, the Windows job builds the app folder, has SignPath sign `LernLab.exe`, builds the installer from it, has SignPath sign the installer, and rewrites `latest.yml` for the signed file (`apps/desktop/electron/signed-installer.ts`). Each request waits for the owner's approval in SignPath. Without them, Windows builds unsigned and the run still passes. The release-please and beta workflows hand the secret on with `secrets: inherit`. macOS is ad-hoc signed only (no paid Apple certificate), and Linux isn't signed.

Pull requests opened by a workflow (the release PR and the `main → dev` sync) don't trigger `pull_request` runs, because GitHub doesn't let `GITHUB_TOKEN` start other workflows that way. The release-please workflow therefore starts `ci` and `pr-title` on them with `workflow_dispatch`, which `GITHUB_TOKEN` may do. The check runs land on the PR's head commit under the same names, so the required checks pass without a personal token or an admin bypass.

## Website

The landing page lives in `apps/site`: plain HTML and CSS in `public/`, and a small script (`src/main.ts`, compiled by `src/build.ts`) that guesses the visitor's system and highlights its download. It loads nothing from other sites: no web fonts, CDNs, analytics or cookies (a Content-Security-Policy enforces it).

- **Download links.** `npm run build -w @lernlab/site` fills in each button. The "Website" workflow (`.github/workflows/pages.yml`) passes it the newest published release (`gh release view --json tagName,assets`), so the links use that release's real file names; without one, the names come from `artifactName` in `apps/desktop/package.json` and the version in `package.json`. `apps/site/src/downloads.test.ts` checks both against the table above.
- **Preview:** `npm run preview -w @lernlab/site`, then open http://localhost:5180.
- **Publishing.** The workflow runs on pushes to `main` that change the site, after each release (release-please or "Build installers"), and by hand. It deploys with the official Pages actions.
- **One-time setup (owner):** Settings → Pages → Source: **GitHub Actions**. The default branch is `dev`, so also allow `main` under Settings → Environments → `github-pages` → Deployment branches.

## Auto-update

- The app looks for a new version 30 s after it starts, and then at most once a day (`apps/desktop/electron/updates.ts`). It reads `latest*.yml` from the newest GitHub Release, downloads in the background and installs on the next restart. Home shows a quiet "Restart now" note, never a session.
- Before installing, the data process copies the database to `backups/`.
- **Settings:** "Update automatically" (on by default) and "Get beta updates" (off). Every build publishes `latest*.yml` (`detectUpdateChannel` is off), and beta testers take the newest release including pre-releases. Turning beta off never downgrades: the app waits for the next stable release.
- **Platforms:** Windows (NSIS) and Linux (AppImage, deb) update themselves. The Mac app doesn't: electron-updater only installs updates into an app signed with a paid Apple Developer ID, which LernLab doesn't have ([CODE_SIGNING.md](CODE_SIGNING.md#macos-unsigned-by-choice)), so the Mac build never checks for updates and Mac users download each new version from the website.

## Version numbers (SemVer)

- **MAJOR (2.0.0):** an incompatible change, such as removing a feature, a deck format version 2, or a database change older versions can't read.
- **MINOR (1.3.0):** new features.
- **PATCH (1.3.1):** bug fixes only.
- **Pre-release (1.3.0-beta.2):** beta builds.

## Changelog and "What's new"

- `CHANGELOG.md` follows the Keep a Changelog style: **Added**, **Fixed**, **Changed**, **Performance**, **Security**. It is generated from pull-request titles, so write titles in plain language for users.
- At build time, `scripts/whats-new.ts` turns the changelog sections since the last release into `whats-new.json`, bundled inside the app. It works offline.
- After an update, on the first launch the app compares the saved `lastSeenVersion` with the current version. If it's newer, it shows a calm "What's new in X.Y.Z" panel before Home, never during study:
  - up to 5 **New** items and 5 **Fixed** items;
  - a "Full changelog" link.
- The "Update ready — restart to install" prompt shows the same notes, taken from the GitHub Release.

## CI per trigger

| Trigger | Runs |
|---|---|
| Pull request into `dev` or `main` | lint, type check, unit + property tests, coverage gate, component tests, visual + accessibility tests, Linux packaged end-to-end smoke test, performance comparison, bundle size, PR-title check |
| Push to `dev` | the above + end-to-end tests on all 3 systems + unsigned nightly build artifact |
| "Beta release" workflow on `dev` | builds for all 3 systems (Windows signed through SignPath once set up) → GitHub pre-release |
| Release PR merged (release-please calls "Build installers"); or a tag `vX.Y.Z` pushed by hand (draft release) | tag check, tests, builds for all 3 systems, installer smoke tests → GitHub Release (stable channel); Windows signed through SignPath once set up, macOS ad-hoc signed ([CODE_SIGNING.md](CODE_SIGNING.md)) |

## Branch protection (set once in GitHub → Settings → Rules → Rulesets)

**`main` and `dev`:**
- Require a pull request before merging.
- Require status checks (use these exact check names): `test (ubuntu-latest)`, `test (windows-latest)`, `test (macos-latest)`, `conventional-title`. Branches must be up to date.
- Require conversations to be resolved.
- Block force pushes and deletion.
- Allowed merges: squash on `dev`; merge commits on `main` (for release PRs from `dev`).
- Require 1 approving review, except for the owner (give the admin role a bypass, so Claude Code's PRs can be approved by you, and yours can merge after checks).

**Tags `v*`:** only the release workflow and admins may create them.

## Collaborators

- **Now (personal account):** Settings → Collaborators → Add people. Collaborators can push branches and merge PRs, but rulesets still force PRs and checks.
- **Later (more contributors):** move the repo to a free GitHub organisation (Settings → Transfer). Issues, stars and links carry over. Then use teams with Triage, Write or Maintain roles, and keep Admin for yourself.
- **Outside contributors** fork the repo and open PRs. Their workflows run without secrets, and first-time contributors need your approval to run CI.
- **`.github/CODEOWNERS`** automatically asks you to review changes to the core engine, the main process and the workflows.
