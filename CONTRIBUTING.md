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
npm run desktop
```

## Pull requests
1. Branch from `dev`, one branch per issue: `feature/12-home-screen` or `fix/80-streak-reset`.
2. Add tests for what you change.
3. Run `npm test && npm run typecheck` before you push.
4. Open the pull request into `dev`. Its title follows Conventional Commits (`feat: …`, `fix: …`) because it becomes the changelog line. In the description:
   - Write `Closes #<issue>`.
   - Say what changed and how you tested it.
   - Add screenshots for screen changes.
5. Keep it small and focused.

Read [docs/PLAN.md](docs/PLAN.md) for the product plan, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code fits together, [docs/TESTING.md](docs/TESTING.md) for tests and performance budgets, and [docs/RELEASING.md](docs/RELEASING.md) for branches and releases.

By contributing, you agree that your code is licensed under MIT.
