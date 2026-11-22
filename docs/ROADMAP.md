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

## Next (1.x)

Each item is a GitHub issue; finished ones ship in the next minor release.

- [ ] **Translations through Weblate** (#51).

## Later

- [x] **Confidence rating** (1–5) on reveal (#205).
- [ ] **Leech handling:** offer a rewrite or mnemonic after 8 lapses.
- [ ] **Cloze with a word bank** (scaffolded), then typed.
- [ ] **Slow audio replay** for listening and dictation.
- [ ] **Hotspot / click-on-image; labelled diagrams.**
- [ ] **Parsons problems** (order the lines), timed list recall ("name all 7 …").
- [ ] **Hands-free audio mode;** mastery by tag; exam-readiness view.
- [ ] **Mochi, Brainscape, Kahoot and Blooket importers;** deep links and QR codes.
- [ ] **2.0:** sync and a phone app.

## Future: from learning-science research (not scheduled)

These come from a review of the research on remembering, understanding and staying motivated (November 2026). The evidence, the expected impact and the effort for each one are in [Future features from learning science](LEARNING-SCIENCE-IDEAS.md). None of them is started. Each becomes an issue when someone picks it up.

**Tier 1: strong evidence, small to medium effort**

- [ ] **Question variants per card:** recall, apply and analyse prompts that rotate, with one grade per day.
- [ ] **"Explain it" cards:** explain first, then tick the key points you covered. Why and how cards never use a plain flip.
- [x] **Learn from your own mix-ups:** confused cards become each other's wrong choices and sit close together in a session, with an offer of a compare card (#200).
- [ ] **Relearn until right:** a missed card returns until you recall it once, and a new card needs 2–3 spaced recalls.
- [ ] **Misconception feedback** on wrong multiple-choice answers.
- [ ] **Guess first** before a new topic (practice only, no timer).
- [ ] **If-then study plan,** with the reminder in your own words.
- [x] **Calibration:** confidence against real recall, a "will you know this tomorrow?" check, and confident misses re-checked (#205).

**Tier 2: good evidence, more effort or fewer subjects**

- [ ] **Example ladder:** worked examples that fade step by step.
- [ ] **Prerequisite links:** learn the basics first, without locking anything.
- [ ] **Teach-back:** explain a topic aloud, then check yourself against its key points.
- [ ] **Case chains:** one scenario with linked questions.
- [ ] **Translate between representations,** such as graph and equation.
- [ ] **Discrimination rounds** for look-alike categories; new vocabulary stays grouped by theme.
- [x] **Card-quality checker** and key-term highlight (#212).
- [ ] **Pattern feedback** at the end of a session.
- [ ] **Weekly goals** and a progress card you can print or share.
- [ ] **"Learn how to learn":** see spacing work on yourself.
- [x] **Calm mode,** rewards that say what they are for, and one round swap per session (#216).
- [ ] **Sleep bridge:** learn in the evening, check in the morning.

**Tier 3: weaker evidence, niche or large**

- [ ] Try first for maths and science; concept map from memory; sketch pad; fading mnemonics; "say it aloud" on a few cards; cover related card families; study together on one computer; "act it out" cards; an optional quiet minute.

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
