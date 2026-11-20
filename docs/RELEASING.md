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
2. **Stable.** Open a pull request `dev → main` titled `release: X.Y.Z` and merge it with a merge commit (not squash).
3. **release-please** sees the new commits on `main`, opens a release PR that bumps the version in `package.json` and adds the section to `CHANGELOG.md`, and updates that PR as more commits arrive.
4. Merging the release PR creates the tag `vX.Y.Z` and the GitHub Release. The release-please workflow then calls the "Build installers" workflow directly (a tag made with `GITHUB_TOKEN` can't trigger other workflows), which builds, signs and publishes the installers, and `latest*.yml` lets installed apps auto-update.
5. A workflow opens a pull request `main → dev`, so the version bump and changelog reach `dev` too. Merge it with a merge commit.

Pull requests opened by a workflow (the release PR and the `main → dev` sync) don't trigger `pull_request` runs, because GitHub doesn't let `GITHUB_TOKEN` start other workflows that way. The release-please workflow therefore starts `ci` and `pr-title` on them with `workflow_dispatch`, which `GITHUB_TOKEN` may do. The check runs land on the PR's head commit under the same names, so the required checks pass without a personal token or an admin bypass.

## Auto-update

- The app looks for a new version 30 s after it starts, and then at most once a day (`apps/desktop/electron/updates.ts`). It reads `latest*.yml` from the newest GitHub Release, downloads in the background and installs on the next restart. Home shows a quiet "Restart now" note, never a session.
- Before installing, the data process copies the database to `backups/`.
- **Settings:** "Update automatically" (on by default) and "Get beta updates" (off). Every build publishes `latest*.yml` (`detectUpdateChannel` is off), and beta testers take the newest release including pre-releases. Turning beta off never downgrades: the app waits for the next stable release.
- **Platforms:** Windows (NSIS) and Linux (AppImage, deb) update themselves. macOS needs a signed app first (#39), so the Mac build doesn't update itself yet.

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
| "Beta release" workflow on `dev` | signed builds for all 3 systems → GitHub pre-release |
| Release PR merged (release-please calls "Build installers"); or a tag `vX.Y.Z` pushed by hand (draft release) | signed and notarised builds → GitHub Release (stable channel) |

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
