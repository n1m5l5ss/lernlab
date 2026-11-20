# LernLab — Product Plan (v1)

Nov 20, 2026 · Draft for review

> This file is the repo copy of the product plan. The working draft lives in a Claude doc. When they differ, the newer change wins: update this file in the same pull request as any decision change.

## Summary and decisions

LernLab will be a free, open-source desktop flashcard app for any subject. It makes spaced repetition feel like a game, works offline with no account, and installs like any normal app.

This plan is the single source of truth: it is reviewed first, then built in this repo by Claude Code, one ticket at a time. The v0.2 prototype in this repo already works. It is the reference for the engine, not the final design.

| Decision | Choice | Why |
| --- | --- | --- |
| Platforms | Windows, macOS and Linux first; phone in release 2.0 | Get one release right before splitting the effort |
| Tech | Electron + React + TypeScript | One language throughout; readable for the owner; proven by apps like VS Code and Obsidian |
| Interface language | English at launch, with every piece of text translatable from day one | Adding a language later is a translation file, not a code change |
| Accounts | None; everything stays on the user's computer | Privacy, zero running cost, works offline |
| Name | Not decided; see Name options | "LernLab" reads as German for a global product |
| Prototype code | Keep the engine (scheduling, grading, importers); redesign the screens | The engine is tested; the UI was never designed |
| Repo | `github.com/n1m5l5ss/lernlab`, public | Decided Nov 20, 2026 |
| Branches | `main` (released) + `dev` (integration); `feature/*` and `fix/*` from `dev`; beta releases replace a staging branch | Decided Nov 20, 2026; see `docs/RELEASING.md` |
| Versions and changelog | SemVer, Conventional Commit PR titles, release-please writes `CHANGELOG.md`; in-app "What's new" after each update | Decided Nov 20, 2026 |
| Deck package | Zip with `manifest.json`, `cards.csv` (main; `cards.jsonl` also read) and `media/images`, `media/audio`, `media/video`; file ending decided with the name | Decided Nov 20, 2026; see `docs/FORMAT.md` |
| Look | Warm neutral surfaces, one blue accent, Atkinson Hyperlegible Next, green/vermillion feedback with icon + word, light and dark | Based on design research; mockups awaiting approval (#1) |
| Quality | Test-first; performance budgets (P50/P95) checked in CI; screenshot tests so a UI change can't silently break other parts | See `docs/TESTING.md` |
| Database process | SQLite runs in a separate background process, never in the main process | See `docs/ARCHITECTURE.md` |

Still open: approval of the mockups, code signing and the final name. Each is listed under Open questions.

## Vision, users and principles

Anyone, in any country, can turn any material into a short daily session that feels like a game and moves it into long-term memory. It is free, works offline and needs no account.

| User | What they need | Example |
| --- | --- | --- |
| Language learner | Vocabulary, listening, speaking, typing in another script | German for Goethe B1 |
| Certification candidate | Exam-style multi-select questions, timed mock exams, scores by topic | AWS Cloud Practitioner |
| School or university student | Definitions, diagrams, formulas, quick revision before a test | Biology, physics |
| Medical student | Thousands of cards, images, labelling parts of a diagram | Anatomy, pharmacology |
| Teacher | Build a deck once and share the file with a class | A chapter's key terms |
| Anki user who gave up | Bring existing decks and keep going with a less boring session | Shared Anki decks |
| Learner who struggles to focus | Short blocks, constant variety, no guilt for missed days | Anyone with ADHD |

The principles that decide every feature:

1. **Recall over recognition.** Only a real attempt to remember moves the schedule. Games keep you engaged, but they never mark a card as known.
2. **Short and varied.** Blocks last 60 to 90 seconds, the format changes every block, and sessions are 5, 10 or 20 minutes.
3. **Forgiving motivation.** Streak freezes and no guilt messages. Nothing ever blocks you from studying, like running out of "lives".
4. **Local and private.** No account, no tracking. All data sits in one folder the user owns.
5. **Open formats.** Decks go in and out freely. Users are never locked in.
6. **Translatable and accessible from day one.** Never added afterwards.
7. **One obvious action.** The home screen leads with a single Start button.

## Feature list

The first public release, 1.0, has 29 features. The prototype already has 12 of them working and 10 partly working. Release 1.x adds features for specific subjects. Release 2.0 adds sync and a phone app.

| Area | Feature | Release | Prototype |
| --- | --- | --- | --- |
| Study | Smart session: 60–90 s blocks that rotate formats, easy start, boss fight at the end | 1.0 | Done |
| Study | Session length 5, 10 or 20 min; one deck, several decks, or everything due | 1.0 | Partial: one deck only |
| Study | Formats: multiple choice, typed answer, cloze, flip and rate yourself, match pairs, picture quiz, listening, dictation, speaking, ordering, multi-select | 1.0 | Done |
| Study | Arcade rounds: category sprint, word rain, Blitz (timed), boss fight | 1.0 | Done |
| Study | Rescue round when accuracy drops; action round when attention drifts | 1.0 | Done |
| Study | Answer checking that forgives typos, accents and case, accepts alternatives, and has an "I was right" button | 1.0 | Done |
| Study | Practice mode that doesn't touch the schedule (cram before a test) | 1.0 | New |
| Study | Study by tag, starred cards only, or hardest cards | 1.0 | New |
| Study | Exam simulator: timed or tutor mode, flag and review, score by topic | 1.x | New |
| Study | Image occlusion: hide labels on a diagram and recall them | 1.x | New |
| Study | Math (LaTeX) display and numeric answers with tolerance | 1.x | New |
| Study | Code cards: predict the output, put lines in order, fill the missing token | 1.x | New |
| Study | Hands-free audio mode (listen and answer out loud) | 2.0 | New |
| Cards | Decks: create, edit, delete, sub-decks, deck goal and exam date | 1.0 | Partial: no sub-decks |
| Cards | Card editor: basic, cloze, multiple choice, ordering; rich text; image, GIF, audio, video | 1.0 | Done |
| Cards | Card browser: search, filter, bulk tag, move, suspend, delete | 1.0 | Done |
| Cards | Duplicate warning while adding or importing | 1.0 | Done |
| Cards | Read cards aloud with the computer's built-in voices when there is no audio file | 1.0 | Partial |
| Cards | Record your own audio on a card | 1.x | New |
| Import | CSV/TSV, pasted lists (Quizlet export), JSON, deck file with media, Anki .apkg | 1.0 | Done |
| Import | Import from a running Anki | 1.0 | Done |
| Import | Keep Anki review history so cards don't start from zero | 1.x | New |
| Export | Deck file with media, CSV | 1.0 | Done |
| Export | Anki .apkg | 1.x | New |
| Share | Deck gallery: community decks hosted on GitHub, one-click install | 1.x | New |
| Progress | Today's summary, streak with freezes, XP, levels, badges | 1.0 | Done |
| Progress | Per-deck progress: learned, remaining, speed, forecast to goal | 1.0 | Done |
| Progress | Calendar heatmap, memory retention, hardest cards | 1.0 | Partial |
| App | First-run welcome with a sample deck and a 2-minute tour | 1.0 | Partial |
| App | Settings: new cards per day, timers, target retention, sound, light/dark theme, text size | 1.0 | Partial: no theme |
| App | Interface in English, translation-ready (all text in language files) | 1.0 | New |
| App | Accessibility: keyboard-only use, screen readers, contrast, reduced motion | 1.0 | Partial |
| App | Optional daily reminder (system notification) | 1.0 | New |
| App | Automatic updates | 1.0 | New |
| App | Automatic daily backup and one-click restore | 1.0 | New |
| App | Choose the data folder (lets people sync with Dropbox or iCloud themselves) | 1.0 | Done |
| App | Installers: Windows .exe, Mac .dmg, Linux .AppImage and .deb | 1.0 | Partial: only Linux tested |
| App | "Delete all my data" and full export | 1.0 | New |
| AI | Generate cards from notes or a PDF with your own AI key (cards reviewed before adding) | 1.x | New |
| Later | Sync between devices; phone app | 2.0 | New |

## Screens and UX

The app has 8 screens behind one sidebar. Mockups of 6 screens in light and dark, plus the style sheet, are in `docs/design/` and await approval (issue #1). No screen gets rebuilt until they are approved.

| Screen | Purpose | What's on it |
| --- | --- | --- |
| Welcome (first run only) | Get a new user studying in under 2 minutes | Pick a subject or "I have my own cards"; try a 2-minute sample session; import a file |
| Home | One obvious next step | Big Start button with today's due count; session length; deck picker; streak, level, goal progress |
| Study session | The game | Full screen; progress bar for the block; one exercise at a time; instant feedback; combo and XP; Esc to leave |
| Session summary | Close the loop | Accuracy, cards learned, XP, streak, badges; "one more round" or "done" |
| Decks | Manage what you study | Deck cards with counts; create; import; export; goal and exam date per deck |
| Cards | Edit content | Search and filter table; card editor with live preview; media drop zone; bulk actions |
| Progress | Show the journey | Learned vs remaining, pace, forecast to goal, heatmap, hardest cards |
| Settings | Adjust | Language, theme, text size, timers, new cards per day, reminders, data folder, backup, about |

UX rules:

1. **Keyboard first.** Every exercise can be answered with 1–4, Enter and Space. The mouse is optional.
2. **Under 1 second.** Feedback after an answer appears in under a second, with sound that can be muted.
3. **No dead ends.** If the microphone, audio or a file fails, the exercise still offers a way forward.
4. **Empty states teach.** An empty deck shows how to add or import cards, with an example file.
5. **Calm by default.** Animations are short and can be reduced. Nothing flashes more than 3 times a second.

A session runs in this order:

1. Warm-up round with easy known cards.
2. Due reviews as typed or spoken recall.
3. New cards: meet, recognise, then recall in the same session.
4. Arcade rounds in between.
5. Boss fight on the cards missed today.
6. Summary.

## Learning engine

The engine from the prototype stays as it is. It is tested (39 automated tests) and based on the research in `docs/research.md`. The game sits on top and never decides what you "know".

| Part | Rule |
| --- | --- |
| Scheduler | FSRS, the algorithm modern Anki uses. Default target is 90% recall; the user can change it in Settings |
| One grade per day | Only a card's first real recall attempt each day changes its schedule |
| Grading | Wrong = Again. Hint, small typo or wrong article = Hard. Right = Good. Fast and correct on a well-known card = Easy |
| What counts as recall | Typed, cloze, dictation, speaking, boss fight, flip with self-rating, multiple choice on question cards, ordering |
| What never counts | Picture quiz, match pairs, true/false, sprints, word rain, Blitz. These are practice only |
| Mastery ladder | 0 seen, 1 recognised, 2 matched, 3 recalled, 4 used in context, 5 spoken. "Known" means level 3 or higher |
| Question direction | Language decks: meaning, then word. Other subjects: whichever side is shorter is the answer; when both sides are long, flip and rate yourself |
| New cards per day | Default 10 per deck, adjustable from 0 to 100 |
| Timers | Never on new cards. Only on known cards, in Blitz and optional modes. Can be set to Off, Relaxed, Normal or Challenge |
| XP and levels | Recall pays more than arcade games. Arcade rounds pay a flat rate so they can't be farmed. Level n needs 100 × n^1.5 XP |
| Streak | The day starts at 4 am local time. 2 freezes to start, one earned every 7 days, 3 at most. A broken streak can be repaired with 2 sessions within 2 days |
| Rescue | Accuracy under 60% in a block brings an easier round with already-known cards |
| Attention | Idle time, switching away from the window, or slow answers bring a 30-second action round |

## Deck file formats

This is a proposal awaiting approval. It has two formats for everyday use, plus importers for what people already have. A plain CSV covers most people. A `.lernpack` file carries everything, including media.

| Format | For whom | Media | Read | Write |
| --- | --- | --- | --- | --- |
| CSV (spreadsheet) | Anyone with Excel or Google Sheets, teachers, Quizlet exports | Only when zipped with the files | Yes | Yes |
| `.lernpack` (proposed native format) | Sharing complete decks, scripts, AI-generated decks | Images, GIF, audio, video | Yes | Yes |
| Pasted text | Copying a list from a web page or a chat | No | Yes | No |
| Anki `.apkg` | Anki users and shared Anki decks | Yes | Yes | 1.x |
| JSON | Programmers | Links only | Yes | No |

**Why not use Anki's format as our main one?** An `.apkg` is a whole database with note types and HTML templates. It is hard to write by hand or with a script, and it changes between Anki versions. We read it, but we don't build on it.

**CSV template.** Only the first column is required. Column names are matched loosely, so "term" or "question" also work for front. The app will offer this as a downloadable template.

```csv
front,back,example,category,tags,image,audio,type,choices,correct
Amazon S3,Object storage for any amount of data,Store backups in S3,Storage,aws storage,s3.png,,,,
Which two services are serverless?,,,Compute,aws,,,mcq,EC2|Lambda|Fargate|RDS,2|3
der Hund,dog,Der Hund bellt.,der,german a1,,hund.mp3,,,
```

**`.lernpack`.** A zip file holding:

1. `manifest.json`: deck name, language (or none for non-language subjects), description, goal and format version.
2. `cards.jsonl`: one card per line in JSON, with the same field names as the CSV.
3. `media/`: the files the cards point to.

Why this shape: it opens with any zip tool, scripts and AI tools can generate it easily, and changes show up line by line on GitHub. The full field list is in `docs/FORMAT.md`.

**Rules for every import:**

- Importing the same deck again updates cards instead of duplicating them, and keeps progress.
- Text formatting is limited to a safe list (bold, italic, lists, code). Everything else is removed, because shared files can't be trusted.
- Text is UTF-8, so Telugu, Japanese and every other script works.

## Data, privacy and backup

Everything a user creates or learns lives in one folder on their own computer. Nothing is sent anywhere: no account, no server, no analytics. The user needs nothing pre-installed, because the database engine ships inside the app.

| System | Default data folder |
| --- | --- |
| Windows | `%APPDATA%\LernLab\data` (for example `C:\Users\Ana\AppData\Roaming\LernLab\data`) |
| macOS | `~/Library/Application Support/LernLab/data` |
| Linux | `~/.config/LernLab/data` |

What is inside:

- `lernlab.db`: one SQLite database file holding decks, cards, every answer ever given, schedules, streak, XP, badges and settings.
- `media/`: images, audio and video used by cards.
- `backups/`: one automatic backup a day (the last 7 are kept), plus one before every app update.
- `progress/`: a small daily summary in plain JSON, readable by other tools or an AI tutor.

What the user can do:

- Move the folder anywhere from Settings. Putting it in Dropbox, OneDrive or iCloud Drive gives simple sync without us running a server.
- Export everything as one zip, and restore from it.
- See the statistics behind "how am I improving" on the Progress screen. Those numbers are computed from the stored answers, so they can always be recalculated.
- Delete all data from Settings, with a confirmation.

The app connects to the internet in exactly three cases, all listed in Settings:

1. Checking for updates on GitHub (can be turned off).
2. Loading a deck from the gallery, when the user asks.
3. Using an AI key the user adds (1.x).

Uninstalling the app leaves the data folder in place, so a reinstall picks up where the user left off.

## Installing and updating

A user downloads one file for their system from the website or GitHub Releases, double-clicks it, and the app is installed. Node.js, SQLite and everything else are inside the installer (about 100 MB). GitHub Actions builds all the installers automatically on real Windows, Mac and Linux machines whenever a new version is tagged.

| System | File | How the user installs | Updates |
| --- | --- | --- | --- |
| Windows 10 and 11 | `LernLab-Setup-1.0.0.exe` | Double-click; installs per user, no admin rights; Start-menu shortcut | Automatic, in the background |
| macOS (Apple Silicon and Intel) | `LernLab-1.0.0-arm64.dmg` / `-x64.dmg` | Open the dmg, drag to Applications | Automatic (needs a signed app) |
| Linux | `LernLab-1.0.0.AppImage` and `.deb` | AppImage: make it executable and run. Debian/Ubuntu: open the .deb | AppImage updates itself; .deb through a new download |
| Later | winget, Homebrew, Flathub | One command or one click in the store | Through the store |

**Code signing.** Without it, Windows and Mac show "unknown developer" warnings, and Mac auto-update doesn't work.

| System | Option | Cost |
| --- | --- | --- |
| Windows | SignPath Foundation: free certificates for open-source projects, issued in SignPath's name ([signpath.org](https://signpath.org/)) | Free; approval needed |
| Windows | Microsoft Trusted (now Artifact) Signing, the cheapest paid route ([InfoQ](https://www.infoq.com/news/2024/05/microsoft-trusted-signing)) | About $9.99 a month |
| macOS | Apple Developer Program, required for signing and notarisation | $99 a year |
| Linux | Not required | Free |

Recommendation: launch 1.0 with Windows signed through SignPath. On the Mac, either pay Apple's $99 or ship unsigned with clear "right-click → Open" instructions. This decision is open (see Open questions).

## Interface languages and accessibility

Release 1.0 ships in English, but no visible word is written in the code itself. Every label, message and teacher line comes from a language file. Adding Telugu or Spanish later is a translation job, not a code change.

- **Language files.** All text lives in `locales/en.json`, managed with i18next. Plurals and gender are handled by the library, never by gluing words together.
- **Dates and numbers.** They follow the user's region automatically (`Intl`).
- **Right-to-left.** Layouts work for Arabic, Hebrew and Urdu. CSS uses logical properties (start/end, not left/right).
- **Fonts.** The app uses system fonts, so Telugu, Devanagari, Japanese, Korean and Chinese display without bundling large font files.
- **Typing in another script.** Answer boxes work with the system keyboard for Japanese, Korean, Telugu and others, including IME composition (kana to kanji).
- **Card language is separate.** A German deck reads its cards aloud in German whatever the interface language is.
- **Volunteer translators.** They add languages through Weblate without touching code. A language ships when it is at least 90% translated.

Accessibility target: WCAG 2.2 level AA, checked before 1.0.

- Everything works without a mouse, with a visible focus outline.
- Every exercise announces the question, the choices and the result to screen readers.
- Contrast is at least 4.5:1. Colour is never the only signal: right and wrong also use an icon and a word.
- Timers can be turned off or slowed (WCAG 2.2.1).
- Reduced-motion and no-sound settings.
- Text scales to 200% without breaking layouts, and there is an optional font that is easier to read for people with dyslexia.

## Architecture and tech

The app is one TypeScript codebase in three packages. The learning engine has no screen code, so the phone app in 2.0 can reuse it unchanged.

One change from the prototype: the screens talk to the engine through Electron's secure bridge (contextBridge plus typed IPC), not through a local web server. That way no other program on the computer can reach the data.

How the parts connect:

- **Screens (React):** Home, session, decks, cards, progress, settings. All words come from language files. ⇣ typed IPC calls, no network port
- **Electron main process:** window, menu, shortcuts, opening deck files, auto-update, daily backups, reminders. ⇣ runs
- **Core engine (`packages/core`, pure TypeScript):** FSRS scheduler, grading, session planner, XP and streaks, importers and exporters. It has no screen code and is tested on its own. ⇣ reads and writes
- **Data folder:** `lernlab.db` (SQLite, built into the app), `media/`, `backups/`, `progress/`.
- **Optional online services** (only when the user allows): GitHub Releases for updates, the deck gallery, a running Anki for import, and an AI provider with the user's own key (1.x).
- **Phone app (2.0):** reuses the core engine.

| Layer | Choice | Notes |
| --- | --- | --- |
| Repo layout | `packages/core`, `apps/desktop`, later `apps/mobile` | One repo, one `npm install` (npm workspaces) |
| Language | TypeScript everywhere | Strict mode |
| Desktop shell | Electron (current stable) + electron-builder | Builds the installers and handles auto-update |
| Screens | React + Vite | Component library to be chosen with the mockups |
| Database | SQLite through Node's built-in `node:sqlite` | Nothing native to compile; numbered migrations. Core talks to storage through an interface so a phone or Tauri version can swap it |
| Scheduler | ts-fsrs | Same algorithm as Anki |
| Translation | i18next | English file shipped; Weblate for volunteers |
| Tests | Unit tests for core; Playwright tests that click through the real desktop app | Must pass before merging |
| Builds | GitHub Actions on Windows, macOS and Linux | Every pull request is tested; every version tag builds installers |

## Open-source project setup

The GitHub repo is the project's office. Tickets are GitHub Issues, tracked on a GitHub Projects board that works like Jira. The same board drives both Claude Code and outside contributors.

| Piece | What it is | Why |
| --- | --- | --- |
| `README.md` | What it is, screenshots, download links, quick start | First thing visitors see |
| `LICENSE` | MIT for code; shared decks under Creative Commons | Simple, allows reuse; needed for free Windows signing |
| `CONTRIBUTING.md` | How to set up, test and open a pull request | Lets strangers help |
| `CODE_OF_CONDUCT.md` | Contributor Covenant | Standard community rules |
| `SECURITY.md` | How to report a security problem privately | Shared deck files are a possible attack route |
| `CLAUDE.md` | Standing instructions for Claude Code | Same rules every session |
| `docs/` | This plan, the format spec, architecture, design mockups, research | Long-term memory of the project |
| Issue templates | Bug report, feature request, deck submission, translation | Every report arrives with the same details |
| Pull request template | What changed, how it was tested, screenshots | Faster review |
| Labels | `epic`, `feature`, `bug`, `i18n`, `a11y`, `good first issue`, `help wanted` | Filter the board |
| Milestones | `1.0`, `1.x`, `2.0` | One milestone per release |
| Projects board | Columns: Backlog → Ready → In progress → In review → Done. Fields: Priority, Size, Epic, Release | The Jira view |
| Discussions | Ideas and questions | Keeps Issues for real work |
| Website | GitHub Pages landing page with download buttons per system | Non-technical users never see the code |
| Releases | Semantic versions (1.2.3) with a changelog per release | Users know what changed |

**How a ticket is written.** It has a title that starts with a verb, a user story, acceptance criteria as tick boxes, and notes. It is done only when all the boxes are ticked, the tests pass, and the change works on all three systems.

## Roadmap

Release 1.0 needs four phases, and each one ends with a gate the owner signs off. There are no dates yet.

| Phase | Contents | Tickets | Gate to leave the phase |
| --- | --- | --- | --- |
| 0 Plan and design | This plan, screen mockups, name, repo, tickets, board | T01–T04 | Owner approves the plan and the mockups |
| 1 Foundation | Monorepo, engine moved into core, secure bridge, migrations, CI, translation system, app shell | T05–T11 | Prototype features run in the new app; CI is green on Windows, Mac and Linux |
| 2 Build the 1.0 features | Study screens, decks, cards, import and export, progress, settings, backups, reminders | T12–T34 | The whole study loop works end to end on all 3 systems |
| 3 Polish and launch | Accessibility, installers, auto-update, signing, end-to-end tests, website, guides | T35–T42 | Beta testers use it daily for a week without blocking bugs → **1.0 public** |
| 4 Release 1.x | Exam simulator, image occlusion, LaTeX, code cards, Anki history and export, deck gallery, AI cards | T43–T52 | Each feature ships when ready |
| 5 Release 2.0 | Sync between devices; phone app reusing the core | Later | — |

## Ticket backlog

The backlog has 13 epics and 52 tickets: 42 for release 1.0 and 10 for 1.x. Each one is a GitHub Issue with full acceptance criteria. Sizes: S is under half a day, M is about a day, L is several days.

| ID | Ticket | Epic | Release | Size |
| --- | --- | --- | --- | --- |
| T01 | Mockups for Welcome, Home, Session, Summary, Decks; approved by owner | E0 Design | 1.0 | M |
| T02 | Visual style: colours, type, spacing, icons, sounds, light and dark | E0 Design | 1.0 | M |
| T03 | Pick the product name; check GitHub, domain and trademark | E0 Design | 1.0 | S |
| T04 | Create the repo with docs, license, templates, labels, milestones, board | E1 Foundation | 1.0 | S |
| T05 | Set up the monorepo: `packages/core`, `apps/desktop`; strict TypeScript; lint and format | E1 Foundation | 1.0 | M |
| T06 | Move the prototype engine into `packages/core` with its tests | E1 Foundation | 1.0 | M |
| T07 | Replace the local web server with a typed, secure Electron bridge | E1 Foundation | 1.0 | M |
| T08 | Database migrations with version numbers and a backup before each one | E1 Foundation | 1.0 | S |
| T09 | CI: tests and type checks on Windows, Mac and Linux for every pull request | E1 Foundation | 1.0 | S |
| T10 | Translation system: i18next, `en.json`, a check that fails if text is hard-coded | E7 Languages & a11y | 1.0 | M |
| T11 | App shell: sidebar, routing, theme, keyboard focus handling | E6 App | 1.0 | M |
| T12 | Home screen per mockup | E2 Study | 1.0 | M |
| T13 | Session runner per mockup: blocks, feedback, combo, progress bar, Esc | E2 Study | 1.0 | L |
| T14 | Recall exercises restyled: typed, cloze, flip, multiple choice, multi-select, ordering | E2 Study | 1.0 | L |
| T15 | Audio exercises: listening, dictation, speaking, with fallbacks when the mic fails | E2 Study | 1.0 | M |
| T16 | Arcade rounds restyled: sprint, match, word rain, Blitz, boss | E2 Study | 1.0 | L |
| T17 | Session across several decks, a tag, starred cards, or hardest cards | E2 Study | 1.0 | M |
| T18 | Practice mode that never touches the schedule | E2 Study | 1.0 | S |
| T19 | Session summary screen | E2 Study | 1.0 | S |
| T20 | Decks screen: create, edit, delete with confirm, sub-decks, goal and exam date | E4 Cards | 1.0 | M |
| T21 | Card browser: search, filters, bulk tag, move, suspend, delete | E4 Cards | 1.0 | M |
| T22 | Card editor with live preview, media drop, duplicate warning | E4 Cards | 1.0 | M |
| T23 | Read aloud with the computer's voices, chosen by card language | E4 Cards | 1.0 | S |
| T24 | Import screen: drag a file, paste text, preview the first 10 cards, map columns | E3 Import | 1.0 | M |
| T25 | Import CSV/TSV, zip with media, JSON, `.lernpack`, `.apkg` with a clear error report | E3 Import | 1.0 | M |
| T26 | Import from a running Anki | E3 Import | 1.0 | S |
| T27 | Export `.lernpack` and CSV; downloadable CSV template | E3 Import | 1.0 | S |
| T28 | Final `.lernpack` version 1 spec, published in `docs/FORMAT.md` | E3 Import | 1.0 | S |
| T29 | Progress screen: learned vs remaining, pace, forecast, heatmap, hardest cards | E5 Progress | 1.0 | M |
| T30 | XP, levels, badges, streak freezes and repair, restyled | E5 Progress | 1.0 | S |
| T31 | First-run welcome: choose a subject, sample deck, 2-minute tour | E6 App | 1.0 | M |
| T32 | Settings screen with every option in one place | E6 App | 1.0 | M |
| T33 | Automatic daily backups and restore; full export; delete all data | E6 App | 1.0 | M |
| T34 | Optional daily reminder notification | E6 App | 1.0 | S |
| T35 | Accessibility pass: keyboard, screen reader labels, contrast, reduced motion, 200% text | E7 Languages & a11y | 1.0 | L |
| T36 | Right-to-left layout check with a test language file | E7 Languages & a11y | 1.0 | S |
| T37 | Installers for Windows, Mac and Linux built by GitHub Actions on version tags | E8 Release | 1.0 | M |
| T38 | Auto-update from GitHub Releases | E8 Release | 1.0 | M |
| T39 | Code signing: SignPath for Windows; Apple decision | E8 Release | 1.0 | M |
| T40 | End-to-end tests that click through the real app | E8 Release | 1.0 | M |
| T41 | Landing page with download buttons, screenshots, short video | E9 Community | 1.0 | M |
| T42 | README, CONTRIBUTING, user guide, 3 example decks | E9 Community | 1.0 | S |
| T43 | Exam simulator: timed or tutor mode, flag and review, score by topic | E10 Subjects | 1.x | L |
| T44 | Image occlusion editor and exercise | E10 Subjects | 1.x | L |
| T45 | LaTeX rendering and numeric answers with tolerance and units | E10 Subjects | 1.x | M |
| T46 | Code cards: predict output, order lines, fill the token | E10 Subjects | 1.x | M |
| T47 | Record your own audio on a card | E4 Cards | 1.x | S |
| T48 | Import Anki review history into the scheduler | E11 Sharing | 1.x | M |
| T49 | Export to Anki `.apkg` | E11 Sharing | 1.x | M |
| T50 | Deck gallery from a GitHub repo, one-click install | E11 Sharing | 1.x | L |
| T51 | Weblate set up; first volunteer languages | E7 Languages & a11y | 1.x | S |
| T52 | Generate cards from notes or PDF with the user's own AI key | E12 AI | 1.x | L |

## Name options

None of these names has been checked yet. Ticket T03 checks the GitHub name, domain and trademarks.

| Name | Meaning | Feel |
| --- | --- | --- |
| LernLab | German "learn" + lab | Current name; sounds German |
| Smriti | Sanskrit/Telugu "memory" | Personal, Indian roots, easy to say |
| Recall Arcade | What it does + games | Playful, very clear |
| Kioku | Japanese "memory" | Short; may already be used by apps |
| Deckhand | Helps you with decks | Friendly, English-only pun |
| Retain | The goal of studying | Plain, global, likely crowded |

## Open questions

- [x] Deck format: zip with `cards.csv` (main) + media folders, decided Nov 20, 2026
- [x] Branches: `main` + `dev`, decided Nov 20, 2026
- [ ] Approve the mockups (issue #1)
- [ ] Product name?
- [ ] Mac signing: pay $99 a year for Apple, or ship unsigned for 1.0?
- [ ] License: MIT for code, Creative Commons for shared decks?
- [x] Repo owner: personal account (`n1m5l5ss`), decided Nov 20, 2026
- [ ] Reuse the prototype engine (recommended) or start fresh?
- [ ] Lowest system versions: Windows 10, macOS 12, Ubuntu 22.04?
- [ ] Anything missing from the feature list?
