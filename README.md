# LernLab

**Free, open-source flashcards that feel like a game, for any subject.**

> **Status:** Working prototype (v0.2). We are planning version 1.0 now: see [docs/PLAN.md](docs/PLAN.md) and the [issues](https://github.com/n1m5l5ss/lernlab/issues). There are no installers to download yet.

Languages, AWS, medicine, physics, law, history: if you can put it on a card, LernLab turns it into short, varied rounds with spaced repetition underneath.

- **Local and private:** no account, no cloud. Your decks and progress stay on your computer.
- **Runs on Mac, Windows and Linux.**
- **Opens your existing decks:** imports Anki `.apkg` packages, Quizlet-style CSV, pasted lists and live Anki.

## Why not just Anki?

Anki has the best scheduler there is, but reviewing in it means flipping one card after another. LernLab keeps the scheduler (FSRS, the same algorithm modern Anki uses) and changes the session.

- **Varied formats:** each session is a run of 60–90-second blocks, and the format changes from block to block:
  - multiple choice, typed recall, cloze;
  - sorting sprints, match pairs, word rain;
  - picture quizzes, listening, dictation, speaking;
  - exam-style multi-select questions, ordering;
  - a timed Blitz, and a boss fight over everything you missed.
- **Honest grading:**
  - you type or say the answer, and LernLab grades it;
  - it tolerates typos and accents;
  - there is an "I was right" button for when it's too strict.
- **Keeps you going:**
  - XP, levels, combos and badges;
  - a streak with freezes (one missed day doesn't wipe you out);
  - rescue rounds when you're struggling;
  - a quick action round when your attention drifts.
- **Learning science, not slot machines:**
  - new cards are never timed;
  - recognition games never count as "knowing" a card;
  - only your first real recall each day moves the schedule.

## Install

Download the installer for your system from **Releases**:

| System | File | Note |
|---|---|---|
| macOS (Apple Silicon / Intel) | `LernLab-x.y.z-arm64.dmg` / `-x64.dmg` | Unsigned for now: right-click the app → **Open** the first time |
| Windows | `LernLab Setup x.y.z.exe` | SmartScreen may warn: **More info → Run anyway** |
| Linux | `LernLab-x.y.z.AppImage` or `.deb` | `chmod +x` the AppImage and run it |

### Run from source

Requires Node.js 22.13 or newer.

```bash
git clone https://github.com/n1m5l5ss/lernlab.git
cd lernlab
npm install
npm run desktop      # builds and opens the desktop app
# or
npm start            # web version at http://localhost:5179
```

### Build installers yourself

```bash
npm run dist:mac     # → release/*.dmg   (run on a Mac)
npm run dist:win     # → release/*.exe   (run on Windows)
npm run dist:linux   # → release/*.AppImage, *.deb
```

Pushing a tag such as `v0.2.0` makes GitHub Actions build all three and attach them to a draft release (`.github/workflows/release.yml`).

## Getting cards in

Go to **Decks → Import**:

- **Drop a file:**
  - `.lernpack` (LernLab's own format, with media);
  - Anki `.apkg`;
  - CSV/TSV/TXT;
  - JSON;
  - a `.zip` containing a CSV plus its images and audio.
- **Paste a list:** `term, definition` per line, with any separator (Quizlet export works).
- **Live Anki:** with Anki open and the AnkiConnect add-on installed, pick decks and import.

You can also create and edit cards in **Cards**. A card can be:

- a basic card;
- a cloze (`{{c1::answer}}`);
- a multiple- or multi-select question with an explanation;
- an ordering card.

Any card can have an image, a GIF, audio or video.

The `examples/` folder has sample decks (AWS, biology, German). The full format spec is in [docs/FORMAT.md](docs/FORMAT.md).

### The `.lernpack` format

A zip containing `manifest.json`, a `cards.jsonl` file with one JSON card per line, and a `media/` folder. It is plain JSON, so it is easy to generate with a script or an AI, easy to diff, and media travel with the deck. Export any deck from **Decks → Export**.

## Your data

Everything lives in one folder (`data/` inside the app-data location below): a SQLite database plus your media.

| System | Default location |
|---|---|
| macOS | `~/Library/Application Support/LernLab/` |
| Windows | `%APPDATA%\LernLab\` |
| Linux | `~/.config/LernLab/` |

To move it, use **File → Use a different data folder…**, for example a Dropbox or Syncthing folder. To back up, copy the folder. Each day's summary is also written as JSON to `progress/`.

## Keyboard

- `1`–`4` choose an answer.
- `Enter` checks or continues.
- `Space` flips a card or replays audio.
- `Esc` leaves a session.
- `Ctrl/Cmd+Shift+L` starts a session from anywhere (desktop app).

## Docs

- [Deck formats](docs/FORMAT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)

## Contributing

```bash
npm test && npm run typecheck
```

Issues and pull requests are welcome, especially new importers, card types, translations of the interface, and shared decks for `examples/`. Shared decks must be your own work or openly licensed. No copyrighted exam questions, please.

## License

MIT for the code. The example decks are CC0.
