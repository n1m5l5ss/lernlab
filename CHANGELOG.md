# Changelog

All notable changes to LernLab are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). New entries are added automatically by release-please from pull-request titles. See [docs/RELEASING.md](docs/RELEASING.md).

## [0.3.0](https://github.com/n1m5l5ss/lernlab/compare/v0.2.0...v0.3.0) (2026-11-20)


### Added

* add a language setting and prepare the app for translations ([2812206](https://github.com/n1m5l5ss/lernlab/commit/281220616f1618151f7260a4ecd60e53444ebfad))
* add the translation system and a language picker ([044e930](https://github.com/n1m5l5ss/lernlab/commit/044e930d1a28fa53a5c702e21e9105e09aa3980d)), closes [#10](https://github.com/n1m5l5ss/lernlab/issues/10)
* back up your data before every update and restore it if the update fails ([dc1e7d1](https://github.com/n1m5l5ss/lernlab/commit/dc1e7d19164b052d91489d8b7d824a9637966fb9))
* back up your data before every update and restore it if the update fails ([24f9513](https://github.com/n1m5l5ss/lernlab/commit/24f9513baf3c36b4b84dc6e68afb9fc3e2b59e8e)), closes [#8](https://github.com/n1m5l5ss/lernlab/issues/8)
* publish beta builds from dev with one click ([229231e](https://github.com/n1m5l5ss/lernlab/commit/229231e9b21329af34e4a68cd368d01a954d465b)), closes [#53](https://github.com/n1m5l5ss/lernlab/issues/53)
* show error messages in the chosen language ([57603b8](https://github.com/n1m5l5ss/lernlab/commit/57603b843dd16edb1e58296128dfa99c48ccb9ff))
* show error messages in the chosen language ([c34c7cf](https://github.com/n1m5l5ss/lernlab/commit/c34c7cf3fad95bde738bde5635a8c874c0860549))
* show exercises and games in the chosen language ([21f83b5](https://github.com/n1m5l5ss/lernlab/commit/21f83b5af45e59feed4cf056f3fcaddb49d1146c))
* show exercises and games in the chosen language ([c91d6bc](https://github.com/n1m5l5ss/lernlab/commit/c91d6bcae6f38e77e46c6fba49cb542c45a5cb61)), closes [#10](https://github.com/n1m5l5ss/lernlab/issues/10)
* show Progress, Stats and session summary in the chosen language ([1bbddc7](https://github.com/n1m5l5ss/lernlab/commit/1bbddc7e20236ec36719e9dda464482ddc8d3d0b)), closes [#10](https://github.com/n1m5l5ss/lernlab/issues/10)
* show Progress, Stats and the session summary in the chosen language ([7900e6a](https://github.com/n1m5l5ss/lernlab/commit/7900e6a5beee0527783d39f9854e9a9fddd9261c))
* show Study, Decks and Cards text in the chosen language ([dc0e488](https://github.com/n1m5l5ss/lernlab/commit/dc0e488fa38c17cf3ca731aee30673a9e0d67f4a)), closes [#10](https://github.com/n1m5l5ss/lernlab/issues/10)
* show the study session, teacher lines and badges in the chosen language ([5994019](https://github.com/n1m5l5ss/lernlab/commit/5994019ec3703af0dc1f27101d5bd82092233a70))
* show the study session, teacher lines and badges in the chosen language ([cd732eb](https://github.com/n1m5l5ss/lernlab/commit/cd732ebc227c75d1a43f6f30fc757617a333839e)), closes [#10](https://github.com/n1m5l5ss/lernlab/issues/10)
* show the Study, Decks and Cards screens in the chosen language ([a25405b](https://github.com/n1m5l5ss/lernlab/commit/a25405b64a0013478e3fe5b738147c36c0d98d3a))
* talk to the app through a secure bridge instead of a local web server ([c7c1c29](https://github.com/n1m5l5ss/lernlab/commit/c7c1c29f3d5ac5b6e8fc7f923e9e24b38f9e62fb)), closes [#7](https://github.com/n1m5l5ss/lernlab/issues/7)
* update the app automatically, with an option for beta updates ([daa89c1](https://github.com/n1m5l5ss/lernlab/commit/daa89c19bc24c71a10f51723ea28c9b510d53b4e))
* update the app automatically, with an option for beta updates ([534f378](https://github.com/n1m5l5ss/lernlab/commit/534f37819169755d56aa6efeda025e6acf4e6254))


### Fixed

* attach installers to every release ([cd8e269](https://github.com/n1m5l5ss/lernlab/commit/cd8e2699b75ba8050880d5f8040d76d4c372075c))
* attach installers to the release that release-please creates ([e717718](https://github.com/n1m5l5ss/lernlab/commit/e717718a850b0ce9b3c97679f213ceb614855d28)), closes [#53](https://github.com/n1m5l5ss/lernlab/issues/53)
* let tests clean up temp folders on Windows ([c4d9e3e](https://github.com/n1m5l5ss/lernlab/commit/c4d9e3e764e795a3b341a58ec1c58a7e5b8f9e55))
* make the test command work on Windows ([06c9754](https://github.com/n1m5l5ss/lernlab/commit/06c9754dbf64abc7f34e19993e704c863040aa0a))

## [0.2.0] - 2026-11-20

Prototype release (not yet published as installers).

### Added
- Decks for any subject: languages, certifications and sciences, with images, GIFs, audio and video.
- Card types: basic, cloze, single and multi-select questions with explanations, ordering.
- Import: CSV/TSV, pasted lists, JSON, LernLab deck packages, Anki `.apkg` (old and new format), live Anki.
- Export: deck package and CSV.
- Desktop app shell (Electron) with file associations and a data-folder picker.
- Game rounds: Blitz, true/false, picture quiz, category sprint, match pairs, word rain, boss fight.
- Timer settings (off, relaxed, normal, challenge); no timers on new cards.
- Product plan, research, architecture, testing and release docs.

## [0.1.0] - 2026-11-19

### Added
- First German-only web prototype: gamified sessions, FSRS scheduling, streaks, XP and progress page.
