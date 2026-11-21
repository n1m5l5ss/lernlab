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

## Next (1.x)

Each item is a GitHub issue; finished ones ship in the next minor release.

- [x] **Anki import with scheduling history:** replay the review log into FSRS (#48).
- [x] **Exam simulator:** timed and tutor modes, flag and review, score by tag (#43). Tutor answers count toward the schedule; timed answers are practice.
- [x] **Image occlusion:** hide labels on a diagram, for medicine and anatomy (#44).
- [x] **Math cards:** LaTeX rendering and answers (#45).
- [x] **Code cards:** syntax highlighting, predict the output (#46).
- [x] **Record your own audio** on a card (#47).
- [x] **Anki `.apkg` export** (#49).
- [x] **Deck gallery:** browse and install community decks (#50).
- [ ] **Translations through Weblate** (#51).
- [x] **Connect your own AI assistant (MCP):** an assistant that can connect to local MCP servers (such as Claude Desktop, the ChatGPT desktop app or Hermes Agent) reads your decks, stats, hard cards and mock exams, quizzes you in the chat without changing your schedule, and proposes new decks and cards, fixes, merges, tidy-ups, goals, an exam study plan or an export. Each proposal waits for you to edit, accept or decline it; nothing is deleted. Off by default, and LernLab itself stays offline (#148).

## Later

- [ ] **Confidence rating** (1–5) on reveal.
- [ ] **Leech handling:** offer a rewrite or mnemonic after 8 lapses.
- [ ] **Cloze with a word bank** (scaffolded), then typed.
- [ ] **Slow audio replay** for listening and dictation.
- [ ] **Hotspot / click-on-image; labelled diagrams.**
- [x] **STEM:** numeric answers with tolerance and units (with #45).
- [ ] **Parsons problems** (order the lines), timed list recall ("name all 7 …").
- [ ] **Hands-free audio mode;** mastery by tag; exam-readiness view.
- [ ] **Mochi, Brainscape, Kahoot and Blooket importers;** deep links and QR codes.
- [ ] **2.0:** sync and a phone app.

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
