# CLAUDE.md — instructions for Claude Code

## What this is
LernLab is a free, open-source desktop flashcard app for any subject. It makes spaced repetition feel like a game. It runs locally, with no account and no server, on Windows, macOS and Linux (Electron + React + TypeScript).

**Read `docs/PLAN.md` before starting any ticket.** It is the source of truth. Also read the doc that matches your ticket:
- `docs/ARCHITECTURE.md` — processes, packages, IPC, storage, startup
- `docs/TESTING.md` — test layers, performance budgets
- `docs/RELEASING.md` — branches, PR titles, versions, changelog
- `docs/design/` — mockups, `tokens.json`, design rules
- `docs/design/style.md` — the visual style: colours, type, spacing, motion, icons, sounds
- `docs/FORMAT.md` — deck files
- `docs/research.md` — learning-science research

## Principles (never break these)
1. **Recall over recognition.** Only real recall attempts change the FSRS schedule, once per card per day. Games never mark a card as known.
2. **Short and varied.** Blocks of 60–90 s, rotating formats. Sessions are 5, 10 or 20 min.
3. **Forgiving.** Streak freezes, no guilt messages, nothing that blocks studying.
4. **Local and private.** No telemetry. The app may go online in only three cases: update checks, the deck gallery when the user asks, and an AI assistant the user connects (MCP), only when turned on.
5. **Open formats.** CSV and `.lernpack` in and out.
6. **Translatable and accessible.** No visible string in code; all text comes from `locales/*.json` through i18next. WCAG 2.2 AA.
7. **One obvious action.** The home screen leads with a single Start button.

## Current state
The repo is an npm workspace. It holds **LernLab 1.0** (released November 21, 2026); 1.x features (#43–#52) are being built. Its layout:
- `packages/core/`: the engine. Answer checking, grading, XP and streaks, card logic, FSRS, session planner, importers and exporters, and the SQLite schema. Pure TypeScript: no Node, DOM, Electron, React or HTTP imports (ESLint enforces it). Platform services (database connection, media files, ids) come in through the `Host` port in `src/host.ts`. Import modules by path, e.g. `@lernlab/core/text`.
- `packages/storage-sqlite/`: the Node/Electron host: `node:sqlite` plus media and progress files in the data folder. Call `installNodeHost()` once at startup.
- `apps/desktop/`: the desktop app.
  - `backend/`: the request table (`handlers.ts`: one validated handler per channel), the data process entry (`process.ts`, an Electron utilityProcess and the only place that opens the database), the AnkiConnect client.
  - `electron/`: main process (windows, menu, routes IPC to the data process, serves media on `lernlab-media://`) and `preload.ts` (exposes only `window.lernlab.invoke`).
  - `src/`: React screens. They reach the app only through `src/api.ts` → `src/bridge.ts`.
  - `server/`: web dev mode only (`npm start`): the same handlers over HTTP on localhost. The desktop app never starts it.
- `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`: one shared config for every package.

**The mockups in `docs/design/` are approved (issue #1); build screens to match them.**

## Commands
```bash
npm install
npm test              # unit + integration tests in every workspace (node:test via tsx)
npm run typecheck     # strict TypeScript in every workspace
npm run lint          # ESLint (one shared config)
npm run format        # Prettier (CI runs format:check)
npm start             # web dev version at http://localhost:5179 (same handlers over HTTP)
npm run desktop       # Electron app
npm run dist:linux    # installers → release/ (dist:mac on a Mac, dist:win on Windows)
```
Node 22.13+ is required (`node:sqlite`).

## How to work a ticket
1. Read the issue and its acceptance criteria. If something is unclear or conflicts with `docs/PLAN.md`, ask in the issue before coding.
2. Branch from `dev`: `feature/<issue>-short-name` or `fix/<issue>-short-name`. One ticket per branch and per pull request. Never commit to `main` or `dev` directly.
3. Test first: write the failing test, make it pass, then refactor. Every feature and bug fix has a test.
4. Run `npm run format`, then `npm test && npm run typecheck && npm run lint` from the repo root before pushing.
5. Open a pull request into `dev`. Its title is a Conventional Commit in plain user language (`feat: add session length picker`, `fix: keep streak when the clock changes`), because it becomes the changelog line. The body says `Closes #<issue>` and lists:
   - what changed;
   - how it was tested;
   - screenshots of any screen change.
6. Keep pull requests small. Split them if they grow past about 400 changed lines, tests excluded.

## Rules
- Ask in the issue before adding a new dependency. Prefer the platform: `node:sqlite`, `Intl`, Web Speech.
- No user-visible text outside the language files. Put strings in `locales/en.json` and show them with `t('key')` (react-i18next); format numbers and dates with the helpers in `apps/desktop/src/i18n.ts`. `apps/desktop/src/i18n.test.ts` fails on hard-coded text in screens; screens still being converted are listed in it, and the list only shrinks.
- Never mark a card as known from a game or recognition exercise.
- No timers on new cards.
- Treat deck files as untrusted. Sanitise HTML, never run scripts, and check paths inside zip files.
- Changing the data model needs a numbered migration and a backup before it runs: add `packages/core/src/migrations/NNN-name.ts` and list it in `MIGRATIONS` (`packages/core/src/migrate.ts`). Never edit a migration that has shipped. The storage host backs up and restores automatically.
- Don't change `docs/PLAN.md` decisions on your own. Propose the change in the pull request.
- Keep within the performance budgets in `docs/TESTING.md`. Never run SQL or heavy work in the Electron main process.
- Use design tokens only; no raw colours in components.

## Definition of done
- Every acceptance box in the issue is ticked.
- CI is green on Windows, macOS and Linux.
- Docs are updated where behaviour changed: the user guide for anything a user sees, the README feature list for new features.
- Screenshots are attached for UI changes.
