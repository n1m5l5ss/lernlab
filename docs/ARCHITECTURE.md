# Architecture (target for 1.0)

This is the low-level design that the Foundation tickets (#5–#11) build. Research and sources are in `docs/research.md` and the design research report (Part C). Some of it describes the current prototype; that is marked **Prototype today**.

## 1. Process model

The app runs as four separate parts. Only the data process touches the database, so the window never freezes while SQL runs.

```
┌────────────────────────── Electron app ───────────────────────────┐
│                                                                    │
│  Renderer (React, sandboxed)          Main process (thin)          │
│  · screens, session state machine     · app lifecycle, windows     │
│  · TanStack Query cache               · menu, shortcuts, deep links│
│  · no Node, no fs, no SQL             · auto-update, notifications │
│        │  window.lernlab.* (typed)    · routes IPC, nothing heavy  │
│        ▼                                        │                  │
│  Preload (contextBridge)  ──── IPC ────────────►│                  │
│  · validates with zod                            │ MessagePort      │
│                                                  ▼                  │
│                              Data process (utilityProcess)         │
│                              · node:sqlite DatabaseSync            │
│                              · migrations, backups, import/export  │
│                              · FSRS scheduling, session planning   │
│                              · uses packages/core + storage-sqlite │
└────────────────────────────────────────────────────────────────────┘
```

| Part | Owns | Must never |
|---|---|---|
| Main | Windows, menus, updater, file associations, IPC routing, starting and restarting the data process | Run SQL, parse files, do anything over ~5 ms |
| Preload | A minimal typed `window.lernlab` API via `contextBridge` | Expose `ipcRenderer` or Node APIs |
| Renderer | UI only, at `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` | Touch files, network or the database directly |
| Data process | The only database connection, all domain work, imports and backups | Know about windows or React |

**Why a separate data process?** `node:sqlite` is synchronous. In the main process, a slow query or a 10,000-card import would freeze the whole app. **Today (#7):** this is in place. `apps/desktop/backend/process.ts` is the data process; main only routes requests (`electron/main.ts`). Requests are checked by small hand-written validators in `backend/validate.ts` rather than zod (no new dependency yet), in the data process only. The web dev mode (`npm start`) runs the same handler table over HTTP on localhost; the desktop app never starts that server, and a test checks its bundles contain no server code.

## 2. Packages

```
apps/desktop/src/
  main/          lifecycle, windows, menu, updater, ipc router
  preload/       contextBridge API (generated from the contract)
  data/          utilityProcess entry: opens DB, handles requests
  renderer/      React app: routes/, features/, components/
packages/
  core/          pure TypeScript domain — no Node, DOM or Electron imports
  shared/        IPC contract (zod schemas + types), error types
  storage-sqlite/ repositories implemented on node:sqlite
  ui/            design-system components + stories
locales/         en.json (all user-visible text)
e2e/             Playwright tests of the packaged app
bench/           performance benchmarks + fixture generators
docs/adr/        architecture decision records
```

**Prototype today:** the engine is in `packages/core` (#6). It reaches storage through one SQL-level `Host` port (a synchronous SQLite connection, a media store, ids), implemented by `packages/storage-sqlite` on `node:sqlite`. The finer repository ports in §3 come later. The request handlers, AnkiConnect client and screens are in `apps/desktop/`.

**Import rules, enforced by `dependency-cruiser` in CI:**

| Package | May import |
|---|---|
| `core` | nothing internal |
| `shared` | `core` types only |
| `storage-sqlite` | `core`, `shared` |
| `data` | `core`, `storage-sqlite`, `shared` |
| `main` | `shared` |
| `renderer` | `shared`, `ui` |
| `ui` | nothing internal; design tokens only |

## 3. Domain core (`packages/core`)

- **Entities:** `Deck`, `Card` (front, back, fields, media refs, tags), `CardState` (FSRS due, stability, difficulty, reps, lapses), `ReviewLog`, `Attempt`, `SessionPlan`, `Block`, `Exercise`.
- **Services:**
  - `Scheduler`: a wrapper over ts-fsrs enforcing one grade per card per day.
  - `Grader`: answer checking with typo, accent and article tolerance.
  - `SessionPlanner`: plans blocks and rotates formats.
  - `Progress`: XP, levels, weekly consistency, forecasts.
  - `Importers` and `Exporters`: pure parsers that take bytes and return cards.
- **Ports (interfaces):** `CardRepository`, `ReviewRepository`, `DeckRepository`, `SettingsRepository`, `MediaStore`, `UnitOfWork`, `Clock`, `Random`.
- **Determinism:** all time and randomness come through `Clock` and `Random`, so every test is repeatable.
- **The session state machine** (block → exercise → feedback → next, plus rescue and attention rounds) lives in core as a pure reducer. The renderer only displays it.

## 4. IPC contract (`packages/shared/contract.ts`)

- Each channel has a name, a zod request schema and a zod response schema, for example `deck.list`, `session.plan`, `attempt.record`, `import.start`, `import.progress`, `media.url`.
- Requests are validated in preload, and again in the data process. The renderer is treated as untrusted.
- Responses are `Result<T, AppError>`; nothing throws across IPC. `AppError` has a code, a message key into the language file, and optional details.
- Long jobs (import, export, backup) return a job id and stream progress events, and can be cancelled.
- Media is served through a custom protocol `lernlab-media://<sha256>`, scoped to the media folder. `file://` is never used.

## 5. Storage

- **Pragmas:** `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON`, `busy_timeout=5000`, `temp_store=MEMORY`, `cache_size=-20000`. Run `PRAGMA optimize` on close.
- **Indexes:** `cards(deck_id, due)` for the due queue, `cards(note_id)`, `review_logs(card_id, reviewed_at)`, `attempts(day, card_id)`.
- **FSRS state** is stored in columns, not JSON, so it can be sorted and filtered.
- **Statements:** prepared statements are cached per process, and SQL is never built from strings.
- **Imports** run in transactions of 1,000–5,000 rows, followed by `ANALYZE`.
- **Migrations:** numbered SQL files tracked in `PRAGMA user_version`. Each runs forward-only in a transaction.
- **Backups:**
  - **Triggers:** before migrating, before every import, and once a day. The command is `VACUUM INTO 'backups/lernlab-YYYYMMDD-vN.db'`.
  - **Retention:** keep 7 daily and 4 weekly copies.
  - **Health check:** `PRAGMA quick_check` runs at startup, in the background.
- **Media store:** files are content-addressed (`media/<sha256>.<ext>`), so the same image used in two decks is stored once.

## 6. Renderer

- React and TypeScript. Routes are lazy-loaded; only Home and the study screen load at start.
- TanStack Query holds data from IPC (caching and invalidation).
- Zustand holds tiny UI state. The session state comes from core's reducer.
- Styles come from design tokens only (`packages/ui/tokens`). CSS Modules scope every component. A lint rule bans raw hex colours outside the tokens.
- All visible text comes from `t('key')` via i18next.
- Every card field gets its `lang` attribute.
- Accessibility is built in from the start: an `aria-live` region announces feedback, focus is managed per screen, and everything works from the keyboard.

## 7. Startup path (target: study-ready in ≤ 2 s at P95)

1. Main: `app.whenReady()`. Set a minimal menu (`Menu.setApplicationMenu`). Create the `BrowserWindow` with `show: false` and a `backgroundColor` matching the theme.
2. In parallel: spawn the data process (open the DB, check migrations) and load the renderer bundle, with V8 code caching on.
3. The renderer paints the app shell, then asks for `home.summary`.
4. Show the window on `ready-to-show`, so there is no white flash.
5. Deferred work: the update check (after 30 s), backups, `PRAGMA optimize`.

## 8. Errors, logging and crash safety

- `electron-log` writes rotating files in `userData/logs`. Card content is never logged at info level.
- Every process has an `uncaughtException` handler. The renderer has an error boundary with "Reload view".
- If the data process crashes, main restarts it with backoff and the renderer shows "Reconnecting…".
- Crash reports stay local. A user can choose to attach one to a GitHub issue.

## 9. Security

- Deck files are untrusted. Zip extraction:
  - counts bytes while streaming;
  - rejects `..`, absolute paths, symlinks and nested archives;
  - caps the number of entries, the total size and the compression ratio;
  - checks media types by magic bytes.
- Card HTML is sanitised (DOMPurify allow-list), and a strict Content-Security-Policy applies.
- There are only three network destinations: GitHub Releases, the deck gallery and the user's own AI provider.
- Fork pull requests run without secrets. Signing keys live only in the protected `release` environment.

## 10. Decisions log

Short ADRs go in `docs/adr/NNNN-title.md`. Recorded so far:
- **0001:** Electron over Tauri. One language; the owner can read it.
- **0002:** node:sqlite in a utilityProcess, behind repositories, so the driver can be swapped.
- **0003:** CSV is the main card file in deck packages; JSONL is also accepted.
- **0004:** Branching is `main` + `dev` (see `docs/RELEASING.md`).
