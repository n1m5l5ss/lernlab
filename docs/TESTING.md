# Testing and performance

LernLab is built test-first. For every ticket, write the failing test first, then the code, then refactor. A pull request can't merge unless every check below is green.

## The test layers

| Layer | Tool | What it covers | Target |
|---|---|---|---|
| Unit | Vitest | `packages/core`: grading, scheduling, session planner, XP, importers | ≥ 90% lines, ≥ 85% branches in core |
| Property-based | fast-check | Scheduler and grader invariants over thousands of random inputs | All invariants hold |
| Repository contract | Vitest | The same suite against the in-memory and SQLite repositories | Both pass |
| Component | React Testing Library | Each UI component, queried by role and label as a user would | Every component |
| Visual | Storybook stories + Playwright `toHaveScreenshot` | Every component and screen: light/dark, hover/focus/disabled, left-to-right/right-to-left, long Telugu/CJK text | Pixel diff within threshold |
| Accessibility | `@axe-core/playwright` | Every story and screen | No serious or critical issues |
| End-to-end | Playwright `_electron` on the packaged app | First run → import → full session → summary → progress | Passes on Windows, macOS, Linux |
| Performance | Vitest bench, Playwright traces | Budgets below | No regression past threshold |

## Scheduler invariants (property tests)

- The next due date is always later than the review time.
- Stability is greater than 0, and difficulty stays within ts-fsrs bounds.
- For the same state: interval(Again) ≤ interval(Hard) ≤ interval(Good) ≤ interval(Easy).
- The same inputs and the same clock always give the same result.
- Replaying a card's review log reproduces its stored state.
- Up to 200 random reviews over random gaps never produce NaN or Infinity.
- Games and recognition exercises never change FSRS state.
- Only one grade per card per day.

## "A new button must not break other buttons"

1. **Isolation by construction.** Components use scoped styles (CSS Modules), take their colours only from tokens, and use no global selectors.
2. **A story for every variant.** Each new component or variant adds stories for every theme and state.
3. **Visual regression.** Every story and screen is screenshotted and compared with the approved baseline.
   - Baselines are made only in a pinned Linux Docker image, because fonts render differently on each OS.
   - Changing a baseline needs a pull request with the `visual-change` label and the before/after images.
4. **Token contrast test.** A unit test computes the contrast of every text and background token pair. It fails below 4.5:1 for text, or 3:1 for icons and borders.

## Performance budgets

Users judge a desktop app by how fast it reacts to them, not by server throughput. A 300 ms stutter between cards breaks concentration.

Reference machine: a 4-core laptop with an SSD and 8 GB of RAM. Budgets are calibrated in the first two weeks, then locked.

| Metric | P50 | P95 |
|---|---|---|
| Cold start → Home interactive | ≤ 1.2 s | ≤ 2.0 s |
| Warm start | ≤ 0.6 s | ≤ 1.0 s |
| Key press (check / continue) → next frame painted | ≤ 50 ms | ≤ 100 ms |
| Long tasks (> 50 ms) during a study block | 0 | ≤ 1 per block |
| Next-card query, 100,000-card deck | ≤ 5 ms | ≤ 15 ms |
| Save a review (card update + log, one transaction) | ≤ 3 ms | ≤ 10 ms |
| Deck list / stats, 100,000 cards | ≤ 50 ms | ≤ 150 ms |
| Import 10,000 cards (no media) | ≤ 2 s | ≤ 4 s |
| Import 100,000 cards (with progress, cancellable) | ≤ 15 s | ≤ 25 s |
| Memory after a session (all processes) | ≤ 300 MB | ≤ 400 MB |
| Installer size | ≤ 110 MB | — |

### How the checks run

- **Database and core benchmarks:** `vitest bench` against seeded fixture databases (10k and 100k cards, from `bench/fixtures`).
  - CI runs the PR branch and `dev` in the same job on the same runner, interleaved, at least 5 times each, and compares medians.
  - It fails on a regression of more than 15% (database) or 25% (startup).
  - Results are posted as a table comment on the pull request.
- **Startup:** `performance.mark` at `app.ready`, `ready-to-show`, first render and Home interactive. The packaged app is launched 10 times; CI records the median and P95 and keeps the traces as artifacts.
- **Interaction latency:** a Playwright script plays a 50-card session and reads `PerformanceObserver` event and long-task entries through a test hook.
- **Where it runs:** pull requests on Linux; nightly on all three systems.

### How it is built (#54)

Everything lives in `bench/` (an npm workspace) and `.github/workflows/perf.yml`:

- `bench/fixtures.ts` builds the 10k and 100k fixture databases through the real importer: 10 decks, about 60% of the cards studied (due dates ±60 days, three logged attempts each), a year of study days. They are generated into `bench/fixtures/generated/` (gitignored) and rebuilt when the schema or the generator changes.
- `bench/db.bench.ts` (`npm run bench`, vitest bench) calls the real core functions on the real `node:sqlite` host: due queue (`dueItemIds`), save a review (`recordAttempt`), deck list and stats (`appState`, what `state.get` returns) at 10k and 100k cards, and importing 10k cards (100k with `BENCH_FULL=1`).
- `bench/startup.ts` (`npm run bench:startup`, needs `npm run build:electron`, and `xvfb-run -a` on Linux without a screen) launches the built app 10 times and plays sessions until 50 cards are answered. With `LERNLAB_PERF=1` the main process keeps its marks (`app-ready`, `ready-to-show`; `electron/perf.ts`) in a global that Playwright reads; the window sets User Timing marks (`first-render`, `home-interactive`; `src/perf.ts`). Without that variable the main process records nothing. Key press or click → next frame is measured in the window (the event's time to a task queued from the next `requestAnimationFrame`), long tasks with a `longtask` `PerformanceObserver`.
- `bench/compare.ts` (pull requests) copies this branch's benchmark code into the `dev` checkout, runs both 5 times interleaved, takes each run's median and then the median of the runs. Changes smaller than 0.05 ms (database) or 30 ms (startup) never fail, so timer noise on a 70 µs query can't block a pull request. Key-press latency is shown in the table but not gated.
- `bench/budgets.ts` (`npm run bench:budgets`, nightly) checks P50 and P95 against the table above and fails when one is over.

### Calibration

**Provisional.** The budgets above were not yet measured on the reference machine. The numbers below come from a 4-core Linux container (Node 22, under `xvfb-run`) on 2026-11-21 and are the locked baseline until the reference machine run replaces them.

| Metric | P50 | P95 |
|---|---|---|
| Start → Home on screen (warm, 10 launches) | 390 ms | 421 ms |
| Key press → next frame (460 inputs) | 13 ms | 15 ms |
| Long tasks per block | 0 | 0 |
| Due queue, 100k | 0.07 ms | 0.10 ms |
| Save a review, 100k | 0.31 ms | 0.50 ms |
| Deck list / stats (`state.get`), 100k | **955 ms** | **1,129 ms** |
| Import 10k (no media) | 402 ms | 508 ms |
| Import 100k (no media) | 4.8 s | 4.9 s |

Deck list / stats is far over its budget at 100k cards (72 ms at 10k): `appState` runs the due and new-card queries once per deck, and `deckCounts` alone takes about 230 ms. The nightly run stays red on it until that is fixed.

## Commands

```bash
npm test               # unit + property + component tests
npm run test:visual    # screenshot comparison (in Docker)
npm run test:e2e       # packaged app, Playwright
npm run bench          # performance benchmarks
npm run test:all       # everything CI runs
```

## End-to-end tests today

`npm run test:e2e` builds the app, then Playwright's `_electron` starts it and clicks through it like a user (`apps/desktop/e2e/*.e2e.ts`, run by `node:test`; `npm test` never starts them):

- **Study loop:** first start → welcome → sample deck → a full 5-minute session → summary → progress, then a restart that opens Home and keeps the streak.
- **Looking after cards:** import a CSV, find and edit a card, switch to the dark theme, back up, then a restart that keeps all of it.
- **Accessibility:** axe (`@axe-core/playwright`, WCAG 2.0–2.2 A and AA) checks every main screen in the light and the dark theme. A serious or critical violation fails the test. A rule may be switched off only in `AXE_DISABLED` in `apps/desktop/e2e/app.ts`, with the reason.

Each test uses a fresh, throw-away profile (`--user-data-dir`). Screenshots go to `apps/desktop/e2e-results/`, which CI keeps as an artifact. CI runs the tests on Windows, macOS and Linux (under `xvfb-run`) against the app it has just built, not the installer: the installers are smoke-tested in `release.yml`. To test a packaged build, set `LERNLAB_E2E_APP` to its executable.
