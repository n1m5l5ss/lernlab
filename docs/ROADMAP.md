# Roadmap

Priorities come from a review of Quizlet, Anki, Duolingo, Memrise, Brainscape, Kahoot, Wordwall, Wayground, Sporcle/Seterra and medical and certification tools, together with learning-science evidence. That evidence covers the testing effect, spacing, the generation effect, interleaving and timing.

## Done (1.0, November 2026)

- **Platform:**
  - Desktop app for Mac, Windows and Linux; local-first, no account.
  - Installers for every system, a website with download buttons, and automatic updates on Windows and Linux.
  - Daily backups, restore with a preview, export everything, delete all data.
  - Works by keyboard and with screen readers (WCAG 2.2 AA), light and dark themes, right-to-left layout.
- **Import and export:**
  - Import: CSV/TSV, paste box, JSON, `.lernpack`, CSV+media zip, Anki `.apkg` (old and new format), live Anki, with a preview and column mapping.
  - Export: `.lernpack` and CSV that import back the same.
- **Study formats:**
  - Multiple choice both ways, typed recall, flip with self-rating.
  - Cloze, fill-the-gap from examples.
  - Multi-select questions with explanations, ordering.
  - True/false, picture quiz, listening, dictation, speaking.
  - Sentence building.
  - Study several decks, a tag, starred cards or your hardest cards; a practice mode that never changes the schedule.
- **Games and rounds:**
  - Category sprint, match pairs, word rain, Blitz (timed), boss fight.
  - Rescue rounds and attention-triggered action rounds.
- **Answer checking:**
  - Typo, accent and case tolerance.
  - Alternative answers.
  - Forced copy after a miss.
  - An "I was right" override.
- **Motivation and progress:**
  - FSRS scheduling, mastery ladder.
  - XP, levels, combos, badges, with celebrations.
  - Forgiving streaks with freezes and repair.
  - A Progress screen: learned vs remaining, pace, forecast, study days, retention, hardest cards.
- **Timers:**
  - Off / relaxed / normal / challenge.
  - Timers apply only to known cards (WCAG 2.2.1).

## Done (1.1, November 2026)

- **Anki import with scheduling history:** replay the review log into FSRS (#48).
- **Exam simulator:** timed and tutor modes, flag and review, score by tag (#43). Tutor answers count toward the schedule; timed answers are practice.
- **Image occlusion:** hide labels on a diagram, for medicine and anatomy (#44).
- **Math cards:** LaTeX rendering and answers (#45).
- **Code cards:** syntax highlighting, predict the output (#46).
- **Record your own audio** on a card (#47).
- **Anki `.apkg` export** (#49).
- **Deck gallery:** browse and install community decks (#50).
- **Connect your own AI assistant (MCP):** an assistant that can connect to local MCP servers (such as Claude Desktop, the ChatGPT desktop app or Hermes Agent) reads your decks, stats, hard cards and mock exams, quizzes you in the chat without changing your schedule, and proposes new decks and cards, fixes, merges, tidy-ups, goals, an exam study plan or an export. Each proposal waits for you to edit, accept or decline it; nothing is deleted. Off by default, and LernLab itself stays offline (#148).
- **STEM:** numeric answers with tolerance and units (with #45).

## Done (1.1.1, November 2026)

- **Safer restore:** a backup or data zip is checked before it replaces anything, and one that holds something LernLab never makes itself is refused (#186).
- **Home is up to date after a session:** today's study day and progress show right away (#187).
- **Faster big imports:** a 10,000-card deck imports about a quarter faster, with far fewer disk writes (#140).
- **Updated libraries:** the FSRS scheduler (ts-fsrs 6, same schedules; only the small random spread of due dates can land on another day), translations (react-i18next 18) and the build actions.

## Done (1.2, November 2026)

Features from the review of learning-science research (see [learning-science ideas](LEARNING-SCIENCE-IDEAS.md)). Known gaps are named with each item.

- **Understanding, not only recall:**
  - **Question variants per card:** recall, apply and analyse questions that take turns, with one schedule and one grade per day; in the editor, CSV, reviews, mock exams and on Progress (#198).
  - **"Explain it" cards:** explain first, typed or spoken, then tick the key points you covered. Cards tagged `why` or `how` are never just flipped (#199).
  - **Misconception feedback:** a correction for each wrong choice of a multiple-choice card, and myth cards that ask "True or myth?" (#202).
  - **Example ladder:** worked examples that fade step by step (#206). Sibling problems with new numbers are not built.
  - **Case chains:** one case with linked questions, asked together in a mock exam (#209).
  - **Translate between representations:** cards asked in both directions, and small function graphs drawn from a formula (#210).
  - **Try first** for maths and science: a problem to try before a new unit's lesson, then its worked solution (#218).
  - **Teach it back:** explain a topic, typed or recorded, then check yourself against its key points (#208). The assistant as a curious student is not built.
  - **Concept map from memory:** link a topic's terms from memory, then compare with the author's map (#219). Placing the terms by hand is not built: the picture is laid out automatically.
- **Remembering:**
  - **Relearn until right:** a missed card returns in the session until you recall it once, and a new card until you have recalled it twice (#201).
  - **Learn from your own mix-ups:** confused cards become each other's wrong choices and are asked next to each other, with an offer of a compare card (#200).
  - **Discrimination rounds:** "Which one is this?" for look-alike categories; new vocabulary stays grouped by theme (#211).
  - **Guess first** before a new topic (practice only, no timer) (#203).
  - **Prerequisite links:** learn the basics first, without locking anything (#207).
  - **Related card families:** when some cards of a small group are reviewed, the rest get a quick question within a day or two (#223).
  - **Sleep bridge:** an optional evening and morning rhythm (#217).
  - **Fading mnemonics:** shown only after a miss or a hint, hidden again after 2 correct answers in a row (#221).
  - **Sketch pad:** draw a new card's meaning; the sketch is kept as your own picture cue and shows with the answer (#220).
  - **"Say it aloud"** on a few starred or recently missed flip cards (#222), **"act it out"** on a few action cards (#225), and an optional **quiet minute** after new cards, off by default because the evidence is mixed (#226).
- **Better cards:** a card-quality checker in the editor and the import preview, and key-term highlights (#212).
- **Knowing how you study:**
  - **Confidence rating** (1–5) and **calibration:** confidence against real recall on Progress, a "Will you know these tomorrow?" check, and confident misses re-checked (#205).
  - **Pattern feedback** at the end of a session, with one next step (#213).
  - **If-then study plan,** with the reminder in your own words (#204).
  - **Weekly goals** and a progress card you can print or save (#214). The buddy file is not built.
  - **Calm mode,** rewards that say what they are for, and one round swap per session (#216).
  - **Study together on one computer:** add a second person by name; the two take turns on a deck, and each answer counts only toward that person's own schedule (#224). The second person studies in Study together only: their own Home, Progress screen and settings are not built, and export, import and manual backups cover only your own data.
  - **"Learn how to learn":** your own recall after time away on Progress, a short explainer of the methods and a sample deck about studying (#215). The 10-minute cram-versus-space experiment is not built.
- **AI assistant:** it can suggest question variants, corrections, key points, prerequisites, a mnemonic and key terms for cards you already have; each suggestion waits for you in AI requests.

## Next (1.x)

Each item is a GitHub issue; finished ones ship in the next minor release.

- [ ] **Translations through Weblate** (#51).

## Later

- [ ] **Leech handling:** offer a rewrite or mnemonic after 8 lapses.
- [ ] **Cloze with a word bank** (scaffolded), then typed.
- [ ] **Slow audio replay** for listening and dictation.
- [ ] **Hotspot / click-on-image; labelled diagrams.**
- [ ] **Parsons problems** (order the lines), timed list recall ("name all 7 …").
- [ ] **Hands-free audio mode;** mastery by tag; exam-readiness view.
- [ ] **Mochi, Brainscape, Kahoot and Blooket importers;** deep links and QR codes.
- [ ] **2.0:** sync and a phone app.

## Future: from learning-science research (not scheduled)

These come from a review of the research on remembering, understanding and staying motivated (November 2026). The evidence, the expected impact and the effort for each one are in [Future features from learning science](LEARNING-SCIENCE-IDEAS.md). All 29 items on that list shipped in 1.2 (see above). What is still open are parts of them:

- [ ] **Sibling problems** with new numbers for worked examples (#206).
- [ ] **The assistant as a curious student** for teach-back (#208).
- [ ] **A buddy file** to compare weekly progress with a friend (#214).
- [ ] **A 10-minute experiment** in practice mode: cram half of 20 made-up items, space the other half, and see the next day which half you kept (#215).
- [ ] **Placing concept-map terms by hand** on a canvas (#219).
- [ ] **A second person's own Home, Progress and settings,** and their progress in "Export everything" and manual backups (#224).

## Avoid

These either hurt learning or create legal risk:

- Timers or speed points on new cards.
- True/false as a learning format; it is practice only.
- Multiple choice without feedback.
- Game economies that gate practice.
- Hearts or lives that block practice. The boss fight is optional.
- Guilt notifications.
- Copying other products' names, mascots or look.
- Hosting copyrighted question banks or real exam questions.
- Mixing brand-new vocabulary from the start, retry-until-right multiple choice, drilling one card many times in a session, leaderboards, and decorative pictures on cards (see [learning-science ideas](LEARNING-SCIENCE-IDEAS.md#what-not-to-build)).
