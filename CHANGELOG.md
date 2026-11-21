# Changelog

All notable changes to LernLab are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses [Semantic Versioning](https://semver.org/). New entries are added automatically by release-please from pull-request titles. See [docs/RELEASING.md](docs/RELEASING.md).

## [1.1.0](https://github.com/n1m5l5ss/lernlab/compare/v1.0.0...v1.1.0) (2026-11-21)


### Added

* add a mock exam simulator with tutor and timed modes ([#149](https://github.com/n1m5l5ss/lernlab/issues/149)) ([58ca9d9](https://github.com/n1m5l5ss/lernlab/commit/58ca9d9c1ee5f7749d2fa8d5ae89cb792abbc8e6))
* add code cards to predict the output, fill in a token or put lines in order ([#152](https://github.com/n1m5l5ss/lernlab/issues/152)) ([82317ee](https://github.com/n1m5l5ss/lernlab/commit/82317ee6853651686ea80c8e8e58b27fe455926f))
* browse and install community decks from the deck gallery ([#153](https://github.com/n1m5l5ss/lernlab/issues/153)) ([2a5eede](https://github.com/n1m5l5ss/lernlab/commit/2a5eedecae582fda730b9a56c51d465a0303381e))
* connect your own AI assistant to LernLab (read only, off by default) ([#157](https://github.com/n1m5l5ss/lernlab/issues/157)) ([e913bc9](https://github.com/n1m5l5ss/lernlab/commit/e913bc989978a877c527498e4db048e898e2028c))
* export a deck for Anki as an .apkg ([#150](https://github.com/n1m5l5ss/lernlab/issues/150)) ([66cbc25](https://github.com/n1m5l5ss/lernlab/commit/66cbc25a3eddceaca607272193f2b2faf9badae5)), closes [#49](https://github.com/n1m5l5ss/lernlab/issues/49)
* hide parts of a picture with image occlusion cards ([#156](https://github.com/n1m5l5ss/lernlab/issues/156)) ([80e7b38](https://github.com/n1m5l5ss/lernlab/commit/80e7b3888960207877b90afcf9183a83bc3f721a)), closes [#44](https://github.com/n1m5l5ss/lernlab/issues/44)
* keep your Anki progress when importing an Anki package ([#145](https://github.com/n1m5l5ss/lernlab/issues/145)) ([fd4f586](https://github.com/n1m5l5ss/lernlab/commit/fd4f586de05f084a0213556d98ac45747b47cfcb)), closes [#48](https://github.com/n1m5l5ss/lernlab/issues/48)
* let your AI assistant propose fixes, merges and tidy-ups for your cards ([#161](https://github.com/n1m5l5ss/lernlab/issues/161)) ([942700c](https://github.com/n1m5l5ss/lernlab/commit/942700ce3aec23054ad31dc0abda05e8ee81931d))
* let your AI assistant propose goals, an exam study plan and deck exports ([#169](https://github.com/n1m5l5ss/lernlab/issues/169)) ([5a648ac](https://github.com/n1m5l5ss/lernlab/commit/5a648ac32d04f54945900a4ecc3b724db0d1470d))
* record your own audio on a card ([#146](https://github.com/n1m5l5ss/lernlab/issues/146)) ([ac73588](https://github.com/n1m5l5ss/lernlab/commit/ac73588489e7d3db15ca3bc861aac3d9e817d576)), closes [#47](https://github.com/n1m5l5ss/lernlab/issues/47)
* review decks and cards your AI assistant proposes before they are added ([#160](https://github.com/n1m5l5ss/lernlab/issues/160)) ([8e6f490](https://github.com/n1m5l5ss/lernlab/commit/8e6f490c393c055962bb497225956afc51ded09f))
* show math on cards and check number answers with a tolerance and units ([#151](https://github.com/n1m5l5ss/lernlab/issues/151)) ([d9fae63](https://github.com/n1m5l5ss/lernlab/commit/d9fae6349a58d32b4b3add9a8013c7bbe339c3f9))


### Fixed

* ask before loading pictures and sounds from the internet in shared decks ([#180](https://github.com/n1m5l5ss/lernlab/issues/180)) ([8c42d03](https://github.com/n1m5l5ss/lernlab/commit/8c42d03002c7c26f0944f1b3fa62a0fa0832bcc4)), closes [#177](https://github.com/n1m5l5ss/lernlab/issues/177)
* block scripts from deck files and lock down the packaged app ([#162](https://github.com/n1m5l5ss/lernlab/issues/162)) ([de317c2](https://github.com/n1m5l5ss/lernlab/commit/de317c26f6a309ccccd41cc0b500a453163c7b6c)), closes [#158](https://github.com/n1m5l5ss/lernlab/issues/158)
* build the installers right after every release ([#144](https://github.com/n1m5l5ss/lernlab/issues/144)) ([1e2cf2c](https://github.com/n1m5l5ss/lernlab/commit/1e2cf2c9e6ee7739844a1d286bf202fedc20b90c))
* escape code and typed answers in Anki exports ([#155](https://github.com/n1m5l5ss/lernlab/issues/155)) ([932f0b3](https://github.com/n1m5l5ss/lernlab/commit/932f0b384eda4a889a04a1470f043b57fe4d2c46))
* harden the AI assistant connection against untrusted deck text ([#171](https://github.com/n1m5l5ss/lernlab/issues/171)) ([9b8e03e](https://github.com/n1m5l5ss/lernlab/commit/9b8e03e6ee1d2df01f0f1a8286cc4392d556ca6c))
* stop hostile deck files and other websites from freezing or changing LernLab ([#175](https://github.com/n1m5l5ss/lernlab/issues/175)) ([f673954](https://github.com/n1m5l5ss/lernlab/commit/f673954d56f0abb1fc8af51c5b61517750041dcc))

## [1.0.0](https://github.com/n1m5l5ss/lernlab/compare/v0.3.0...v1.0.0) (2026-11-21)


### release

* 1.0.0 ([#141](https://github.com/n1m5l5ss/lernlab/issues/141)) ([9104b1a](https://github.com/n1m5l5ss/lernlab/commit/9104b1a8eae7fe84b3a3e61c8f0a4b94c20fa068))


### Added

* add a practice mode that never changes your review schedule ([#97](https://github.com/n1m5l5ss/lernlab/issues/97)) ([e2ed742](https://github.com/n1m5l5ss/lernlab/commit/e2ed742d3ac8b9645458141e767b3b6a076f9ac8)), closes [#18](https://github.com/n1m5l5ss/lernlab/issues/18)
* add a website with download buttons for each system ([#126](https://github.com/n1m5l5ss/lernlab/issues/126)) ([4cf4ce3](https://github.com/n1m5l5ss/lernlab/commit/4cf4ce349abe7820f40b6cb657ccad884d320775)), closes [#41](https://github.com/n1m5l5ss/lernlab/issues/41)
* add an optional daily reminder and open-at-login ([#110](https://github.com/n1m5l5ss/lernlab/issues/110)) ([0c0dcc4](https://github.com/n1m5l5ss/lernlab/commit/0c0dcc434e1a6882d884766be850edd92d70b35c))
* add listening, dictation and speaking exercises ([#94](https://github.com/n1m5l5ss/lernlab/issues/94)) ([e0028fa](https://github.com/n1m5l5ss/lernlab/commit/e0028fa9ea6a8cdc3d8908bb8f781ab747d4f03c)), closes [#15](https://github.com/n1m5l5ss/lernlab/issues/15)
* add the sidebar with keyboard focus handling and a remembered window size ([#90](https://github.com/n1m5l5ss/lernlab/issues/90)) ([4492366](https://github.com/n1m5l5ss/lernlab/commit/449236695224bb5f081038db7ce00e494f61d4ca))
* bring decks over from a running Anki in one click ([#116](https://github.com/n1m5l5ss/lernlab/issues/116)) ([1d3d7cd](https://github.com/n1m5l5ss/lernlab/commit/1d3d7cd3c716fe44975f8bd1e086e47ded83a191)), closes [#26](https://github.com/n1m5l5ss/lernlab/issues/26)
* browse every card with filters, multi-select and bulk changes ([#101](https://github.com/n1m5l5ss/lernlab/issues/101)) ([8a4af43](https://github.com/n1m5l5ss/lernlab/commit/8a4af43039f1fdd77b10b5f3dc2742c5ba26affd))
* build and smoke-test installers for Windows, macOS and Linux on version tags ([#118](https://github.com/n1m5l5ss/lernlab/issues/118)) ([90be01f](https://github.com/n1m5l5ss/lernlab/commit/90be01fa2d939c4edece2f154f5fd33eebcb6d50))
* bundle the app fonts and make text size and reduced motion part of the design tokens ([#127](https://github.com/n1m5l5ss/lernlab/issues/127)) ([ffe7689](https://github.com/n1m5l5ss/lernlab/commit/ffe768941decb9c0f5e2cf0d328f97c61c04a27f))
* celebrate level-ups and new badges, and explain streak freezes and repair ([#108](https://github.com/n1m5l5ss/lernlab/issues/108)) ([e0740fb](https://github.com/n1m5l5ss/lernlab/commit/e0740fb1ec9a2ec265acdc9d24d200a6e874777c))
* describe card images for screen readers ([#123](https://github.com/n1m5l5ss/lernlab/issues/123)) ([aa4ca89](https://github.com/n1m5l5ss/lernlab/commit/aa4ca897f8dd7f1adeffdbf701886999791a7855)), closes [#35](https://github.com/n1m5l5ss/lernlab/issues/35)
* export decks that import back the same, and download a CSV template ([#113](https://github.com/n1m5l5ss/lernlab/issues/113)) ([2d99cae](https://github.com/n1m5l5ss/lernlab/commit/2d99cae4a52bf925e04a1d0d5b14391ebf3e1438))
* export decks with a spreadsheet-ready cards.csv and media sorted into folders ([#119](https://github.com/n1m5l5ss/lernlab/issues/119)) ([9f87153](https://github.com/n1m5l5ss/lernlab/commit/9f871539a9907310531ea026dbb80ef5477d15e5))
* find cards across decks and change many at once ([#100](https://github.com/n1m5l5ss/lernlab/issues/100)) ([a36553e](https://github.com/n1m5l5ss/lernlab/commit/a36553ee3c62e979b9072e5b2e54c5e2959b953a))
* give level-ups their own sound and keep sound effects soft and off by default ([#135](https://github.com/n1m5l5ss/lernlab/issues/135)) ([f309307](https://github.com/n1m5l5ss/lernlab/commit/f309307fb5385c5c129663be0635842a0104b89a))
* import any reasonable deck file safely and report what happened ([#115](https://github.com/n1m5l5ss/lernlab/issues/115)) ([7258a63](https://github.com/n1m5l5ss/lernlab/commit/7258a63c5555a6335473582fa5c6cb9d8dfb88f3)), closes [#25](https://github.com/n1m5l5ss/lernlab/issues/25)
* keep a daily backup, restore one with a preview, export everything as a zip and delete all data ([#109](https://github.com/n1m5l5ss/lernlab/issues/109)) ([d9c4bdb](https://github.com/n1m5l5ss/lernlab/commit/d9c4bdbbc93ff8cd77267024ed3ebc1b0c6c0e13))
* keep the window responsive and reconnect on its own if the data process crashes ([#125](https://github.com/n1m5l5ss/lernlab/issues/125)) ([20046e8](https://github.com/n1m5l5ss/lernlab/commit/20046e8f064487ec3c72d080199f0a8c9870cdb9)), closes [#56](https://github.com/n1m5l5ss/lernlab/issues/56)
* lay the app out right to left for Arabic, Hebrew and Urdu ([#121](https://github.com/n1m5l5ss/lernlab/issues/121)) ([831616e](https://github.com/n1m5l5ss/lernlab/commit/831616e9416052a8a33898f608baf6b0e0035282)), closes [#36](https://github.com/n1m5l5ss/lernlab/issues/36)
* preview cards and map columns before importing ([#112](https://github.com/n1m5l5ss/lernlab/issues/112)) ([8416987](https://github.com/n1m5l5ss/lernlab/commit/841698729c652eea51d4376bec19c965bd24f026))
* preview cards as you write them, drop media in, and get warned about duplicates ([#105](https://github.com/n1m5l5ss/lernlab/issues/105)) ([45f1071](https://github.com/n1m5l5ss/lernlab/commit/45f10715f6577f7879f4ce5ce7a63cf8109456d8))
* put every option in one Settings screen, with text size and reduced motion ([#102](https://github.com/n1m5l5ss/lernlab/issues/102)) ([775abb2](https://github.com/n1m5l5ss/lernlab/commit/775abb292659d94a1fc12405011fb1fac1d5c513))
* read cards aloud in a voice and speed you choose for each deck ([#106](https://github.com/n1m5l5ss/lernlab/issues/106)) ([a85f3b7](https://github.com/n1m5l5ss/lernlab/commit/a85f3b7d7c7dd615026e4c161b38074d5f407735)), closes [#23](https://github.com/n1m5l5ss/lernlab/issues/23)
* rebuild the Decks screen with sub-decks, exam dates and safe delete ([#99](https://github.com/n1m5l5ss/lernlab/issues/99)) ([52661ab](https://github.com/n1m5l5ss/lernlab/commit/52661ab88d3b827c03c2fd8f83d4c9ecc213bcd0)), closes [#20](https://github.com/n1m5l5ss/lernlab/issues/20)
* rebuild the Home screen from the mockup ([#91](https://github.com/n1m5l5ss/lernlab/issues/91)) ([a51f4bf](https://github.com/n1m5l5ss/lernlab/commit/a51f4bf30bfe888fe70fba7ff3db58ba635115ec)), closes [#12](https://github.com/n1m5l5ss/lernlab/issues/12)
* rebuild the study session frame from the mockup ([#92](https://github.com/n1m5l5ss/lernlab/issues/92)) ([68b3c90](https://github.com/n1m5l5ss/lernlab/commit/68b3c90e96d4e59de1bb754e8195480e8287c7b9)), closes [#13](https://github.com/n1m5l5ss/lernlab/issues/13)
* restyle the arcade rounds and let their clocks follow the timer setting ([c291def](https://github.com/n1m5l5ss/lernlab/commit/c291defe4f2ff15644cac5e5bce22190db540aa1))
* restyle the arcade rounds and let their clocks follow the timer setting ([5bf39ed](https://github.com/n1m5l5ss/lernlab/commit/5bf39ed0b720e411b477f71f01f75a6136ea436a)), closes [#16](https://github.com/n1m5l5ss/lernlab/issues/16)
* restyle the recall exercises from the mockup ([#93](https://github.com/n1m5l5ss/lernlab/issues/93)) ([ecdc865](https://github.com/n1m5l5ss/lernlab/commit/ecdc865703e32686a557cb6dbb6f6c0ed9597390)), closes [#14](https://github.com/n1m5l5ss/lernlab/issues/14)
* share one set of buttons, cards, fields and feedback across screens ([#128](https://github.com/n1m5l5ss/lernlab/issues/128)) ([aabfeb8](https://github.com/n1m5l5ss/lernlab/commit/aabfeb8c9a80e06969d9936059c9ea444f8b2a37))
* show a session summary with what you recalled and what comes back tomorrow ([#98](https://github.com/n1m5l5ss/lernlab/issues/98)) ([fcfc96c](https://github.com/n1m5l5ss/lernlab/commit/fcfc96c590cd0fefa5ef96d57c92be7f501e3049)), closes [#19](https://github.com/n1m5l5ss/lernlab/issues/19)
* show how to open LernLab on Windows the first time ([#136](https://github.com/n1m5l5ss/lernlab/issues/136)) ([e7ba487](https://github.com/n1m5l5ss/lernlab/commit/e7ba487f68f91886d3a237d72791a8b4822e044c))
* show learned vs remaining, pace, forecast, study days, retention and hardest cards on the Progress screen ([#103](https://github.com/n1m5l5ss/lernlab/issues/103)) ([ffae4fd](https://github.com/n1m5l5ss/lernlab/commit/ffae4fdb02227a280322110d67c69e818537557f)), closes [#29](https://github.com/n1m5l5ss/lernlab/issues/29)
* show what's new after an update ([#117](https://github.com/n1m5l5ss/lernlab/issues/117)) ([1c98d5f](https://github.com/n1m5l5ss/lernlab/commit/1c98d5f87cb8cd25ecda07be494182370f4d208e))
* sign Windows installers through SignPath and guide Mac users through the first open ([#129](https://github.com/n1m5l5ss/lernlab/issues/129)) ([5deb45c](https://github.com/n1m5l5ss/lernlab/commit/5deb45c936cf5930646eb0d048d5a9c4c7460e59))
* study several decks, a tag, starred cards or your hardest cards ([#96](https://github.com/n1m5l5ss/lernlab/issues/96)) ([315d85b](https://github.com/n1m5l5ss/lernlab/commit/315d85b2ea0ceb483027b51b9f98504f0415bf1a)), closes [#17](https://github.com/n1m5l5ss/lernlab/issues/17)
* use the approved colours with light, dark and system themes ([#89](https://github.com/n1m5l5ss/lernlab/issues/89)) ([17967e8](https://github.com/n1m5l5ss/lernlab/commit/17967e85a57d399e7dccf331edd80d39b173caf5))
* welcome new users with a choice, a sample deck and a 2-minute sample session ([#107](https://github.com/n1m5l5ss/lernlab/issues/107)) ([309638b](https://github.com/n1m5l5ss/lernlab/commit/309638bd76a9c84b5a2cb6f37cb50eac793c202b))


### Fixed

* block two ways a shared deck could sneak HTML past the safe list ([#104](https://github.com/n1m5l5ss/lernlab/issues/104)) ([c053e3c](https://github.com/n1m5l5ss/lernlab/commit/c053e3cd88c364c255e284da767da44a12c4cf0f))
* build the installers after a release even when the check dispatch fails ([#87](https://github.com/n1m5l5ss/lernlab/issues/87)) ([aeff86c](https://github.com/n1m5l5ss/lernlab/commit/aeff86c1a7570039d621f838713e092a7d3a1628))
* count only study time in the long-task budget and log where long tasks happen ([#139](https://github.com/n1m5l5ss/lernlab/issues/139)) ([f2b7138](https://github.com/n1m5l5ss/lernlab/commit/f2b71380014ec5f1d37fe208d8741b18e61c3885)), closes [#137](https://github.com/n1m5l5ss/lernlab/issues/137)
* delete all my data now removes backups too, after a clear warning ([#111](https://github.com/n1m5l5ss/lernlab/issues/111)) ([fa658ee](https://github.com/n1m5l5ss/lernlab/commit/fa658ee48ce697414f26bfefceeecc0b70d707a2))
* let Windows find its update file on GitHub ([#88](https://github.com/n1m5l5ss/lernlab/issues/88)) ([c4c4b40](https://github.com/n1m5l5ss/lernlab/commit/c4c4b409d3f78350b6bd6d8d7439c4213d4ada2b))
* make every screen work by keyboard, readable in both themes and clear to screen readers ([#122](https://github.com/n1m5l5ss/lernlab/issues/122)) ([804a73b](https://github.com/n1m5l5ss/lernlab/commit/804a73bee93b1b966a645cc564bf58429acfb725))


### Performance

* open the deck list instantly even with 100,000 cards ([#133](https://github.com/n1m5l5ss/lernlab/issues/133)) ([68fa1d8](https://github.com/n1m5l5ss/lernlab/commit/68fa1d818bfc6e0a7d1f0c00c68365545ac80942))

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
