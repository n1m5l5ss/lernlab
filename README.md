# LernLab

A gamified, never-boring vocabulary and grammar trainer for learning German fast (Japanese and Korean later). It imports your Anki deck once, then turns every note into a dozen kinds of quick game rounds, while a real spaced-repetition scheduler (FSRS) decides what comes back and when.

Built for learners who get bored by flipping flashcards: formats change every 60–90 seconds, every answer gets instant feedback, and the app plays a teacher who sets the plan, makes you answer before revealing anything, and makes you repeat corrections.

## Start

**Easiest:** double-click **`Start LernLab.command`** in Finder. The first run installs everything (about a minute), then your browser opens straight into a session.

**From Terminal:**

```bash
npm install
npm start          # builds, then serves http://localhost:5179
```

Needs **Node.js 22.13 or newer**. There's no separate database to install: LernLab uses Node's built-in SQLite and stores everything in `data/`.

**First start:** keep Anki open (with the AnkiConnect add-on). LernLab imports the `Lang::German` deck (all sub-decks, sentences and audio) automatically. After that it works without Anki. To pull in new cards later, go to **Einstellungen → Refresh words from Anki**; your progress is kept. You can also run `npm run import "Lang::German"`.

`http://localhost:5179/#start` skips the home screen and starts a session immediately. Bookmark it, or put it in a calendar reminder.

## What a session looks like (Standard, about 12 minutes)

| Block | What happens | Writes a spaced-repetition grade? |
|---|---|---|
| Aufwärmen | 3 near-certain wins to get going | no |
| Artikel-Sprint | der/die/das on the clock (unknown nouns become "guess first") | article only |
| Wiederholen | type the German for due words, with the article | **yes** |
| Neue Wörter | guess the article → meet the word with audio → recognise it | no |
| Paare finden | timed matching | no |
| Grammatik | one rule in under a minute, then fill-the-gap and sentence building | **yes** |
| Hören | hear a sentence, pick its meaning | no |
| Lückentext | type the missing word in a sentence | **yes** |
| Sprechen | say it out loud (speech recognition, or self-check) | **yes** |
| Abrufen | today's new words from memory | **yes** |
| Wortregen | arcade: type words before they land (every other day) | no |
| Endgegner | boss fight with today's mistakes and your hardest words, 3 lives | **yes** |

Rules the app follows (from the learning-science research):

- **One grade per word per day**, from the first real recall attempt: wrong → Again; a hint, typo, umlaut or article slip → Hard; right → Good; fast and already-known → Easy. Recognition games never move the schedule.
- **Correction protocol:** a wrong answer gets one retry. If it's still wrong, the answer is shown and you must type it out. The word then comes back 3 exercises later and again in the boss fight.
- **Attention:** after 20 seconds idle the teacher nudges you. After a long tab switch, or several slow answers in a row, a 25-second action round is inserted. If accuracy in a block drops under 60%, a quick rescue round follows.
- **Rewards are information:** XP, levels, combos, badges, and a forgiving streak (2 freezes, earn one per 7 days, repair a broken streak with 2 sessions in 2 days). "Study days this month" never resets. Arcade rounds pay a flat rate, so speed-tapping can't out-earn real recall.
- **Mastery ladder** per word: 0 seen → 1 recognised → 2 matched → 3 recalled → 4 in context → 5 spoken. "Words you can produce" counts level 3 and up.

Keyboard: `Enter` submit/continue · `1–4` choose · `Tab` hint · `Space` replay audio / start microphone · `Esc` quit.

## For the AI tutor and Notion

- `GET http://localhost:5179/api/summary/today` returns minutes, sessions, XP, streak, accuracy by format, 7-day retention, words producible, Goethe B1 coverage and today's errors.
- The same JSON is written to `data/progress/YYYY-MM-DD.json` after every session.

## Optional: start automatically at login

```bash
./scripts/autostart.sh install     # runs LernLab in the background at login
./scripts/autostart.sh uninstall
```

## Develop

```bash
npm run dev        # API + hot-reloading UI on one port (5179)
npm test           # answer checking, grading, streaks, full learning loop against a fake Anki
npm run typecheck
```

- One TypeScript codebase, one process: React (Vite) UI, Hono API and Node's SQLite.
- Scheduling uses ts-fsrs.
- `test/mock-anki.ts` is a fake AnkiConnect with sample notes, so you can work without Anki: `PORT=8765 npx tsx test/mock-anki.ts`.

```
server/   API, importer, FSRS + mastery, session planner, progress/streaks
shared/   answer checking, grading, XP/levels/streak rules, teacher lines (used by both sides)
src/      game UI: session runner, exercise modes, arcade modes, stats
test/     fake AnkiConnect + sample notes
```

## Notes

- Your words, audio and progress stay on your machine in `data/` (git-ignored). Don't commit decks or audio you don't have the rights to share.
- Speech recognition works in Chrome, Edge and Safari (audio is processed by the browser vendor). If there's no microphone, the speaking round falls back to "say it aloud, then check yourself".
- License: MIT.
