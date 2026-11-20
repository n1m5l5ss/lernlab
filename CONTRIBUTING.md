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
1. Make one branch per issue, named like `t12-home-screen`.
2. Add tests for what you change.
3. Run `npm test && npm run typecheck` before you push.
4. In the pull request description:
   - Write `Closes #<issue>`.
   - Say what changed and how you tested it.
   - Add screenshots for screen changes.
5. Keep it small and focused.

Read [docs/PLAN.md](docs/PLAN.md) for the product plan and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the code fits together.

By contributing, you agree that your code is licensed under MIT.
