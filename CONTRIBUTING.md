# Contributing to LernLab

Thanks for helping! LernLab is a free, local-first flashcard app for any subject.

## Ways to help
- **Report a bug or suggest a feature** using the issue templates.
- **Share a deck** through the "Deck submission" template. Decks must be your own work or openly licensed. No copyrighted exam questions.
- **Translate the interface.** Use the "Translation" template. A translation platform is coming in 1.x.
- **Write code.** Pick an issue labelled `good first issue` or `help wanted`.

## Set up
```bash
git clone https://github.com/n1m5l5ss/lernlab.git
cd lernlab
npm install        # Node 22.13 or newer
npm test
npm run desktop    # the desktop app
npm start          # or the same app in your browser, at http://localhost:5179
```

The repo is an npm workspace. Run every command from the repo root.

| Folder | What's in it |
|---|---|
| `packages/core` | The engine: answer checking, scheduling, sessions, importers and exporters. Pure TypeScript, tested with `node:test` |
| `packages/storage-sqlite` | Saves data on your computer with `node:sqlite`, plus backups |
| `apps/desktop` | The app: Electron main process, the data process, and the React screens in `src/` |
| `locales/` | Every piece of text the app shows. `en.json` is the source |
| `examples/` | Example decks (CC0) |
| `docs/` | Plan, architecture, testing, releasing, deck format and the [user guide](docs/USER-GUIDE.md) |

## Rules that keep LernLab LernLab
- **Test first.** Write the failing test, make it pass, then tidy up.
- **No text in code.** Put every visible string in `locales/en.json` and show it with `t('key')`. A test fails on hard-coded text.
- **Design tokens only.** Use the CSS variables from `docs/design/tokens.json`, never raw colours.
- **Games never mark a card as known.** Only real recall changes the schedule.
- **No new dependencies** without asking in the issue first.
- **Changing the data model** needs a numbered migration in `packages/core/src/migrations/`.

[CLAUDE.md](CLAUDE.md) has the full list.

## Share an example deck
1. Make a folder in `examples/decks/<name>/` with a `manifest.json` and a `cards.csv`. Copy one of the folders already there. Give every card an `id`.
2. Add the folder to the list in `scripts/build-example-lernpack.ts` and in `packages/core/test/example-decks.test.ts`.
3. Run `npx tsx scripts/build-example-lernpack.ts` to build `examples/<name>.lernpack`.
4. Add the deck to the table in `examples/README.md`.

Decks in `examples/` are CC0. Write the cards yourself, check the facts, and keep any pictures or sounds small and your own.

## Pull requests
1. Branch from `dev`, one branch per issue: `feature/12-home-screen` or `fix/80-streak-reset`.
2. Add tests for what you change.
3. Run `npm run format`, then `npm test && npm run typecheck && npm run lint` from the repo root before you push.
4. Open the pull request into `dev`. Its title follows Conventional Commits (`feat: …`, `fix: …`) because it becomes the changelog line. In the description:
   - Write `Closes #<issue>`.
   - Say what changed and how you tested it.
   - Add screenshots for screen changes.
5. Keep it small and focused: about 400 changed lines at most, tests not counted.
6. If you change how the app behaves, update the docs too, including the [user guide](docs/USER-GUIDE.md).

Read [docs/PLAN.md](docs/PLAN.md) for the product plan, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code fits together, [docs/TESTING.md](docs/TESTING.md) for tests and performance budgets, and [docs/RELEASING.md](docs/RELEASING.md) for branches and releases.

By contributing, you agree that your code is licensed under MIT.
