# CLAUDE.md — instructions for Claude Code

## What this is
LernLab is a free, open-source desktop flashcard app for any subject. It makes spaced repetition feel like a game. It runs locally, with no account and no server, on Windows, macOS and Linux (Electron + React + TypeScript).

**Read `docs/PLAN.md` before starting any ticket.** It is the source of truth for features, UX, data, formats and architecture. Research is in `docs/research.md`; the deck format is in `docs/FORMAT.md`.

## Principles (never break these)
1. **Recall over recognition.** Only real recall attempts change the FSRS schedule, once per card per day. Games never mark a card as known.
2. **Short and varied.** Blocks of 60–90 s, rotating formats. Sessions are 5, 10 or 20 min.
3. **Forgiving.** Streak freezes, no guilt messages, nothing that blocks studying.
4. **Local and private.** No telemetry. The app may go online in only three cases: update checks, the deck gallery when the user asks, and the user's own AI key.
5. **Open formats.** CSV and `.lernpack` in and out.
6. **Translatable and accessible.** No visible string in code; all text comes from `locales/*.json` through i18next. WCAG 2.2 AA.
7. **One obvious action.** The home screen leads with a single Start button.

## Current state
The repo holds the **v0.2 prototype**, which is a working reference. Its layout:
- `shared/`: answer checking, grading, XP and streaks, card logic. Pure TypeScript.
- `server/`: SQLite (`node:sqlite`), FSRS, session planner, importers and exporters, Hono HTTP API.
- `src/`: React screens.
- `electron/`: desktop shell.

Tickets in the Foundation epic (#5–#11) restructure it into `packages/core` and `apps/desktop`, and replace the HTTP API with typed IPC. **Don't redesign screens until the mockups in `docs/design/` are approved (issue #1).**

## Commands
```bash
npm install
npm test              # unit + integration tests (node:test via tsx)
npm run typecheck
npm start             # web version at http://localhost:5179
npm run desktop       # Electron app
npm run dist:linux    # installers → release/ (dist:mac on a Mac, dist:win on Windows)
```
Node 22.13+ is required (`node:sqlite`).

## How to work a ticket
1. Read the issue and its acceptance criteria. If something is unclear or conflicts with `docs/PLAN.md`, ask in the issue before coding.
2. Create a branch named `t<NN>-short-name`. One ticket per branch and per pull request.
3. Write the tests together with the code. Every feature and bug fix has a test.
4. Run `npm test && npm run typecheck` before pushing.
5. Open a pull request that says `Closes #<issue>` and lists:
   - what changed;
   - how it was tested;
   - screenshots of any screen change.
6. Keep pull requests small. Split them if they grow past about 400 changed lines, tests excluded.

## Rules
- Ask in the issue before adding a new dependency. Prefer the platform: `node:sqlite`, `Intl`, Web Speech.
- No user-visible text outside the language files (enforced once #10 lands).
- Never mark a card as known from a game or recognition exercise.
- No timers on new cards.
- Treat deck files as untrusted. Sanitise HTML, never run scripts, and check paths inside zip files.
- Changing the data model needs a numbered migration and a backup before it runs.
- Don't change `docs/PLAN.md` decisions on your own. Propose the change in the pull request.

## Definition of done
- Every acceptance box in the issue is ticked.
- CI is green on Windows, macOS and Linux.
- Docs are updated where behaviour changed.
- Screenshots are attached for UI changes.
