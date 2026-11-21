# Security practices

How LernLab keeps its code, its builds and its users safe. It follows the
[OpenSSF Scorecard](https://scorecard.dev) checks, the
[OpenSSF Best Practices](https://www.bestpractices.dev) criteria and the
[Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security).
Everything here uses free tools and works without any paid account or AI agent.

To report a vulnerability, see [SECURITY.md](../SECURITY.md). Don't open a public issue.

## Supply chain

The code we didn't write is the easiest way in. These checks run by themselves:

| What | Where | What it does |
|---|---|---|
| Lockfile | `package-lock.json`, `npm ci` | Everyone, and every CI run, installs exactly the same versions. |
| Dependabot | `.github/dependabot.yml` | Opens a pull request when a library or CI action has a security fix (at once) or a new version (weekly, grouped). |
| Dependency review | `.github/workflows/supply-chain.yml` | Fails a pull request that adds a library with a known high or critical vulnerability, or a GPL/AGPL licence. |
| Registry signatures | `npm audit signatures` in the same workflow | Proves every installed package came from the npm registry unchanged. |
| Known vulnerabilities | `npm audit --audit-level=high` in the same workflow | Fails on high or critical advisories anywhere in the tree. |
| Pinned actions | every workflow | Third-party actions are pinned to a full commit SHA with the version in a comment, and container images to a digest. A tag can be moved; a SHA can't. `apps/desktop/electron/workflows.test.ts` fails on an unpinned one. |
| Least-privilege tokens | every workflow | The workflow-wide `GITHUB_TOKEN` is read-only; a job that must write asks for exactly that permission. The same test enforces it. |
| CodeQL | `.github/workflows/codeql.yml` | GitHub's code scanner reads the TypeScript and the workflows on every pull request and weekly (`security-extended` queries). Results: Security → Code scanning. |
| Scorecard | `.github/workflows/scorecard.yml` | Scores the project's practices weekly and on every push to `dev`. Public result: [scorecard.dev](https://scorecard.dev/viewer/?uri=github.com/n1m5l5ss/lernlab). |

### Handling a Dependabot pull request

1. Read the release notes it links. A security fix goes first.
2. Let CI run. If it's green, squash-merge it into `dev` like any other pull request.
3. If CI fails, fix the code on the Dependabot branch or close it with a comment that says why.
   A major version of Electron, React or Vite usually needs its own small pull request.

Don't add a dependency without asking in the issue first (see [CONTRIBUTING.md](../CONTRIBUTING.md)).

## Settings only an owner can change

These live in the repository settings, not in files. Check them once a year and after a handover:

- **Settings → Code security:** private vulnerability reporting, Dependabot alerts and security updates,
  secret scanning, and push protection all **on**.
- **Settings → Branches:** `dev` and `main` require a pull request and passing CI; no force pushes.
- **Settings → Actions → General:** workflow permissions "Read repository contents".

## The desktop app (Electron security checklist)

| Item | Where | Status |
|---|---|---|
| No Node.js in the page, context isolation, sandbox | `electron/main.ts` `webPreferences` | On |
| Only `window.lernlab.invoke` exposed to the page; every IPC call checks its sender | `electron/preload.ts`, `trusted()` in `main.ts` | On |
| Content Security Policy: only the app's own scripts, no eval, no remote fetch, no frames | `apps/desktop/index.html` | On |
| Links open in the system browser; navigation and new windows are blocked | `setWindowOpenHandler`, `will-navigate` | On |
| Permissions: microphone for the app page only, never the camera | `electron/media-permission.ts` | On |
| Fuses: no `ELECTRON_RUN_AS_NODE`, no `NODE_OPTIONS`, no `--inspect`, only the packaged `app.asar` and only if it is unmodified | `build.electronFuses` in `apps/desktop/package.json` | On (packaged builds) |
| Media served from the data folder only, by file name | `lernlab-media://` handler | On |
| No SQL or heavy work in the main process | `electron/no-sql.test.ts` | On |
| Current Electron | Dependabot | Weekly |

`apps/desktop/electron/hardening.test.ts` fails if the CSP or the fuses are loosened. To read the fuses of a
built app: `npx @electron/fuses read --app <path to the app>`.

Deck media may also be an `https://` link. LernLab never loads one unless the user turns on Settings → Privacy →
"Allow pictures and sounds from the internet" and accepts a warning (#177); until then the card shows a note
instead (`apps/desktop/src/remote-media.ts`). The CSP still allows `https:` images and sound for that opt-in.

## Releases

Every release built by `.github/workflows/release.yml` carries:

- **An SBOM** (`LernLab-<version>-sbom.cdx.json`, CycloneDX): every library in the release, from the lockfile.
  Check it against a new advisory without building anything.
- **Build provenance:** GitHub signs a statement that each installer and the SBOM were built from this
  repository by this workflow, at a given commit. To check a download, with the [GitHub CLI](https://cli.github.com):

  ```bash
  gh attestation verify LernLab-Setup-1.2.0.exe --repo n1m5l5ss/lernlab
  ```

  This works even though the installers aren't code-signed yet ([CODE_SIGNING.md](CODE_SIGNING.md)).
- **Smoke tests:** each installer is installed and started on its own system before it is attached.
