# Architecture

One TypeScript codebase. The same engine runs in the desktop app (Electron) and as a local web server for development.

```
┌──────────────────────── Desktop app (Electron) ────────────────────────┐
│  electron/main.ts                                                      │
│   • picks the data folder (OS app-data, or one you choose)             │
│   • starts the local server on 127.0.0.1:<random port>                 │
│   • window, menu, global shortcut Ctrl/Cmd+Shift+L → start a session   │
│   • opens .lernpack / .apkg files → import                             │
│                                                                        │
│  ┌──────────── server/ (Node) ────────────┐   ┌──── src/ (React) ────┐ │
│  │ app.ts       HTTP API (Hono)           │◀─▶│ Study / Decks / Cards│ │
│  │ library.ts   decks, cards, media       │   │ Progress / Stats     │ │
│  │ importer.ts  CSV, JSON, .lernpack,     │   │ Session runner       │ │
│  │              .apkg, AnkiConnect        │   │ modes/: exercises,   │ │
│  │ session.ts   session planner           │   │ arcade games         │ │
│  │ exercises.ts card → exercise builders  │   └──────────────────────┘ │
│  │ learn.ts     FSRS scheduling, mastery  │                            │
│  │ progress.ts  streaks, goals, stats     │   shared/: answer checking,│
│  │ db.ts        node:sqlite (built in)    │   grading, XP/streak rules,│
│  └────────────────────────────────────────┘   card logic, teacher text │
└────────────────────────────────────────────────────────────────────────┘
```

## Data

- **SQLite via `node:sqlite`.** It is built into Node 22.13+ and Electron 45, so there are no native modules to compile on any platform.
- **Tables:**
  - `decks`, `items` (cards)
  - `srs` (FSRS state per card, plus the previous state for "I was right")
  - `item_state` (mastery ladder, counters)
  - `attempts` (every answer)
  - `days`, `sessions`
  - `meta` (settings, streak, achievements, active deck)
- **Media** files live in `data/media/`.

## Learning engine

- **Scheduler:** FSRS (`ts-fsrs`), at 90% target retention by default.
- **One grade per card per day.** It comes from the card's first recall attempt that day:
  - wrong → Again;
  - hint, typo or article slip → Hard;
  - right → Good;
  - fast and already known → Easy.
- **Recognition and arcade rounds never change the schedule.** These are multiple choice, matching, true/false, Blitz, sprint and word rain.
- **Mastery ladder per card:**
  - 0 seen
  - 1 recognised
  - 2 matched
  - 3 recalled
  - 4 in context
  - 5 spoken

  "Known" means level 3 or higher.
- **Session planner** (`server/session.ts`): builds 60–90-second blocks and never runs the same format twice in a row. It starts with an easy warm-up and ends with a boss fight over the cards you missed.
  - New cards are met, recognised, then recalled within the same session.
  - Timed rounds use only cards you already know.
- **Client runtime** (`src/Session.tsx`):
  - A missed card comes back 3 exercises later.
  - A 60% accuracy floor triggers a rescue round.
  - An idle or attention-drop detector inserts a short action round.
  - Answers are checked instantly in the browser with `shared/text.ts`, and attempts are posted in the background.

## Card logic for any subject (`shared/cards.ts`)

The question and the answer are chosen per card:

| Deck / card | Question → answer |
|---|---|
| Language deck | meaning → word (nouns need the article) |
| Other subject, back is short | front → type the back |
| Other subject, front is short | back → type the front |
| Both sides long | flip and rate yourself |
| `mcq` card | single or multi-select question with explanation |
| `order` card | put the steps in order |
| `cloze` card | fill the `{{c1::…}}` gap |

## Security

- Deck HTML is sanitised to a small allow-list before display (`sanitizeHtml`).
- The Electron renderer runs with `contextIsolation`, `sandbox` and no Node integration.
- The server listens only on `127.0.0.1`. The only permission granted is the microphone.

## Tests

```bash
npm test          # shared rules, full learning loop, all import formats (incl. generated .apkg), override, multi-select
npm run typecheck
```

`test/mock-anki.ts` is a fake AnkiConnect for development without Anki.
