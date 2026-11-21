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

**AI assistants (#148):** an optional fifth part, the MCP process, runs only when an AI app starts `LernLab --mcp`; it reads the database read-only and never writes it (§11).

**Why a separate data process?** `node:sqlite` is synchronous. In the main process, a slow query or a 10,000-card import would freeze the whole app. **Today (#7):** this is in place. `apps/desktop/backend/process.ts` is the data process; main only routes requests (`electron/main.ts`). Requests are checked by small hand-written validators in `backend/validate.ts` rather than zod (no new dependency yet), in the data process only. **Today (#56):** main hands the data process one end of a `MessageChannelMain` at start; requests and replies go over that port as typed messages (`backend/data-protocol.ts`), checked on arrival on both sides. Requests made while the data process starts or restarts wait for its `ready` message. After a crash main restarts it with backoff (0.5 s to 8 s, five tries, `electron/data-restart.ts`) and the window shows "Reconnecting…" (`src/DataStatus.tsx`); a request that was running when it crashed returns `data_process_exit` rather than being sent twice. The web dev mode (`npm start`) runs the same handler table over HTTP on localhost; the desktop app never starts that server, and a test checks its bundles contain no server code.

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

**Today (#56):** instead of dependency-cruiser (no new dependency), `apps/desktop/electron/no-sql.test.ts` walks the import graph of every main-process file with esbuild and fails if it reaches `node:sqlite`, `packages/storage-sqlite` or core's database modules (`db`, `host`, `migrate`, `migrations/`). Pure helpers main needs live in modules without database code (for example `@lernlab/core/releasenotes`).

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
- **Today (#56):** `openDb` sets all the pragmas above; `PRAGMA optimize` runs hourly in the data process and when the database is closed. The prototype schema has no `cards`, `notes` or `review_logs` tables yet: cards are `items` (with `items(deck_id)`), their schedule is `srs`, and answers are `attempts`. Migration `003-study-indexes` adds `srs(due)` for the due queue and `attempts(day, item_id)` (replacing `attempts(day)`). Migration `004-deck-stats-indexes` (#130) adds `items(deck_id, suspended, kind)` (replacing `items(deck_id)`), `srs(introduced_day)`, `items(ord)`, `items(tags)` and a partial index on starred cards, for the deck list and stats. `appState` counts every deck in one grouped query (`deckStats`) and keeps the counts per connection until the data changes (`whileUnchanged` in `db.ts`: `total_changes()` for this connection's writes, `data_version` for other connections' commits).
- **FSRS state** is stored in columns, not JSON, so it can be sorted and filtered.
- **Statements:** prepared statements are cached per process, and SQL is never built from strings.
- **Imports** run in transactions of 1,000–5,000 rows, followed by `ANALYZE`.
- **Migrations:** numbered files `packages/core/src/migrations/NNN-name.ts`, tracked in a `schema_version` table (#8). Each runs forward-only in its own transaction. Before any pending migration runs on an existing database, a `VACUUM INTO` backup is written to `backups/`; if a migration fails, the backup is put back and the app explains what happened and quits. `001-v02-schema` brings v0.1 and v0.2 prototype databases up to date.
- **Backups:**
  - **Triggers:** before migrating, before an app update, before deleting a deck or cards, before a restore, an "import everything", when the user clicks "Back up now", and once a day (the data process checks 10 s after start and then every hour). The command is `VACUUM INTO 'backups/lernlab-YYYYMMDD[-HHMMSS][-label]-vN.db'`; the label says why (`daily`, `before-update`, `before-delete`, `before-restore`, `before-import`). Code: `packages/storage-sqlite/src/backups.ts`.
  - **Retention:** only `daily` copies are pruned, to the newest 7. Every other backup is kept until the user removes it.
  - **Restore:** Settings lists each backup with its date and its deck, card and answer counts, read from the file read-only. Restoring backs up the current database, closes it, copies the backup in and reopens it (running migrations if the backup is older; a backup from a newer version is refused).
  - **Export everything:** one zip with `manifest.json`, `lernlab.db` (a `VACUUM INTO` snapshot), `media/` and `progress/`. Importing it treats the zip as untrusted: only those paths with plain file names are accepted, the unpacked size is capped, and the database must be a LernLab database this version can open. The current data is backed up first.
  - **Delete all my data:** the screen warns that everything, backups included, is deleted permanently and cannot be undone, and the user types a confirmation word. Then the database, `media/`, `progress/` and `backups/` are removed and an empty database is created. No backup is kept; "Export everything" is the way to keep a copy first.
  - **Health check:** `PRAGMA quick_check` runs at startup, in the background.
- **Media store:** files are content-addressed (`media/<sha256>.<ext>`), so the same image used in two decks is stored once.

## 6. Renderer

- React and TypeScript. Routes are lazy-loaded; only Home and the study screen load at start.
- TanStack Query holds data from IPC (caching and invalidation).
- Zustand holds tiny UI state. The session state comes from core's reducer.
- Styles come from design tokens only (`packages/ui/tokens`). CSS Modules scope every component. A lint rule bans raw hex colours outside the tokens.
- **Today (#11):** `packages/ui/tokens.css` is generated from `docs/design/tokens.json` (`npm run tokens -w @lernlab/ui`; a test fails when it is stale). The theme is a setting (system, light, dark); the renderer sets `data-theme` on `<html>` and main mirrors it in `nativeTheme` and `config.json`, so the window opens in the right colours. `src/Shell.tsx` is the sidebar frame; screens are hash routes (`#/decks`, `src/routes.ts`) and focus moves to each screen's heading. Main saves the window's size and position in `config.json` and never reopens it off-screen (`electron/window-state.ts`). Session and summary fill the window, without the sidebar.
- **Fonts and display settings (#59):** `packages/ui/fonts.css` loads the bundled woff2 fonts in `packages/ui/fonts/` (Atkinson Hyperlegible Next; Noto Sans Telugu, Devanagari, Arabic; each with its OFL licence). Vite copies them into `dist/assets/` with relative URLs, so they load from `file://` in Electron and over HTTP in web dev mode; nothing is fetched online. The Text size and Reduced motion settings set `data-text-size` and `data-motion` on `<html>` (`src/display.ts`); `tokens.css` turns them into `--text-scale` (every `--text-*` token scales) and the reduced `--motion-*` values. Inline font sizes use `textPx()` so they scale too.
- All visible text comes from `t('key')` via i18next.
- **Right to left (#36):** `setLanguage` sets `<html dir>` from the language (`src/direction.ts`), so Arabic, Hebrew and Urdu flip the layout. CSS uses logical properties (`margin-inline-start`, `inset-inline`, `text-align: start`); `src/rtl.test.ts` fails on new `left`/`right` CSS or inline styles (mark a deliberate one `rtl-ignore`). Icons that point the way text runs get `className="icon-dir"`. Settings → Language → "Pseudo right-to-left" (`ar-XB`, generated from `en.json`) checks every screen without a real translation.
- Every card field gets its `lang` attribute.
- Accessibility is built in from the start: an `aria-live` region announces feedback, focus is managed per screen, and everything works from the keyboard.

## 7. Startup path (target: study-ready in ≤ 2 s at P95)

1. Main: `app.whenReady()`. Set a minimal menu (`Menu.setApplicationMenu`). Create the `BrowserWindow` with `show: false` and a `backgroundColor` matching the theme.
2. In parallel: spawn the data process (open the DB, check migrations) and load the renderer bundle, with V8 code caching on.
3. The renderer paints the app shell, then asks for `home.summary`.
4. Show the window on `ready-to-show`, so there is no white flash.
5. Deferred work: the update check (after 30 s), backups, `PRAGMA optimize`.
6. **Daily reminder (#34), off by default.** Main looks at the clock once a minute (`@lernlab/core/reminder`: local "HH:MM", once per date, DST-safe, an hour of grace) and only then asks the data process (`reminder.status`) whether you already studied today; it never opens the database. The notification's words come from `locales/en.json`; clicking it starts a session (`#start`). "Open at login" starts the window minimised: a Windows Run entry with `--hidden`, a macOS login item (`wasOpenedAtLogin` keeps the window hidden) or a Linux `~/.config/autostart/lernlab.desktop` (`electron/reminders.ts`). Reminders only arrive while LernLab is running.

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
- There are only three network destinations: GitHub Releases, the deck gallery and, only when the user turns it on, the AI assistant the user connects over MCP (§11). LernLab itself never contacts an AI company; the assistant does, with what it reads.
- **Today (#50):** the deck gallery downloads run in the data process (`backend/gallery.ts`), only after the user opens the gallery, with timeouts and size caps; a deck file must match the SHA-256 in the index before the normal untrusted-file importer reads it (`docs/GALLERY.md`).
- Fork pull requests run without secrets. Signing keys live only in the protected `release` environment.

## 10. Decisions log

Short ADRs go in `docs/adr/NNNN-title.md`. Recorded so far:
- **0001:** Electron over Tauri. One language; the owner can read it.
- **0002:** node:sqlite in a utilityProcess, behind repositories, so the driver can be swapped.
- **0003:** CSV is the main card file in deck packages; JSONL is also accepted.
- **0004:** Branching is `main` + `dev` (see `docs/RELEASING.md`).

## 11. AI assistants over MCP (#148)

LernLab has no AI of its own. A user can connect an AI assistant they already use (Claude Desktop, or any app that supports the Model Context Protocol) to read their data and propose changes. It is **off by default** (Settings → AI assistant).

```
 AI app (MCP client) ──stdio──► LernLab --mcp ──MessagePort──► MCP process (utilityProcess)
                                (main: relay only,              · opens lernlab.db READ-ONLY, per call
                                 no window, no lock)             · refuses every tool while the switch is off
                                                                 · writes nothing to the database
                                                                 · proposals → <data>/ai-requests/*.json
```

- **Transport: stdio only.** The assistant starts the app binary with `--mcp` (`LernLab.exe --mcp`, `/Applications/LernLab.app/Contents/MacOS/LernLab --mcp`, the AppImage or `/opt/LernLab/lernlab --mcp`). Nothing listens on a port, a socket or a named pipe, so no other program or computer can reach it. In `--mcp` mode main opens no window and takes no single-instance lock (so it runs next to an open LernLab); it only passes stdin to the MCP process and its framed replies to stdout (`electron/mcp-relay.ts`, messages in `backend/mcp-protocol.ts`), because a utilityProcess has no stdin. From source, `backend/mcp-stdio.ts` serves the same tools on stdio (web dev mode, tests).
- **Why read-only and not through the running app.** Routing calls to the running data process would need a listener (a socket or named pipe plus a token file) and would only work while the window is open. Instead the MCP process opens the database itself, **read-only** (`openAppDbReadonly` in storage-sqlite): SQLite refuses every write on that connection, WAL lets it read while the app writes, and it never runs migrations (a database from another version is refused with a message to open or update LernLab). It opens a fresh connection for each tool call, so it always sees the current data and the current switch, and it survives a restore or "Delete all my data". The data process stays the only process that **writes** the database. `PRAGMA busy_timeout` covers the moment a checkpoint runs.
- **The switch.** `settings.aiAssistant` (default false) is read from the database on every call; while it is off every tool returns `assistant_off` and nothing is read. Listing the tools still works, so the assistant can tell the user what to turn on.
- **Tools** (`backend/mcp.ts`, queries in `@lernlab/core/assistant`): overview (streak, daily goal, languages, settings), decks, due and new counts, card search, full card details (tags, star, media, FSRS due date and recall probability, the exact wrong answers), stats for any period (today, a day, week, month, year, all time), session history, weak cards, and cards for a quiz in the chat. A chat quiz records nothing, so it never changes the schedule. Inputs are checked with the validators of the window's requests (`backend/validate.ts`), lists are capped (`LIST_MAX`) and card text is returned as plain text. There is no tool that deletes anything.
- **Changes are requests, not writes.** A proposing tool (`propose_new_deck`, `propose_cards`, `propose_card_fix`, `propose_merge`, `propose_organise`) checks its input and writes one JSON file to `<data>/ai-requests/` (`storage-sqlite/airequests.ts`: random id, written to a temporary file then renamed, at most 100 waiting, 2 MB each). The window lists them under **AI requests** (`aiRequests.list`); when the user accepts one, possibly edited, the data process checks it again with the same validators (`backend/ai-requests.ts`) and applies it (`@lernlab/core/airequests`), then removes the file. Card text goes through `upsertCards` like any import (sanitised), and new cards start new. A fix saves the card through `upsertCards` with its own id, so its progress stays; a merge fixes the kept card and suspends and tags the others `merged`; organising reuses the card browser's bulk actions (`bulkCards`) except delete, which is refused. The list also returns the touched cards as they are now (`cardSnapshots`, at most 200 per request) so the user can compare. Files in that folder are treated as untrusted: anything that is not a valid request is ignored, and ids are plain UUIDs so they cannot name another file. "Delete all my data" removes the folder too.
- **Dependency:** the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`, MIT, pinned), bundled into `dist-electron/mcp.cjs`. Only its stdio server is bundled; `electron/no-server.test.ts` checks no HTTP transport ends up in any bundle.
- **Not verified yet:** the packaged app's stdio on Windows (Electron is a GUI-subsystem program there) and macOS Gatekeeper prompts when an assistant starts the app; the unpackaged app was checked on Linux with a real MCP client.
