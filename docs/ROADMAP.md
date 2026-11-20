# Roadmap

Priorities come from a review of Quizlet, Anki, Duolingo, Memrise, Brainscape, Kahoot, Wordwall, Wayground, Sporcle/Seterra and medical and certification tools, together with learning-science evidence. That evidence covers the testing effect, spacing, the generation effect, interleaving and timing.

## Done (v0.2)

- **Platform:**
  - Desktop app for Mac, Windows and Linux; local-first, no account.
  - Decks for any subject, with images, audio, video and GIFs.
- **Import and export:**
  - Import: CSV/TSV, paste box, JSON, `.lernpack`, CSV+media zip, Anki `.apkg` (old and new format), live Anki.
  - Export: `.lernpack` and CSV.
- **Study formats:**
  - Multiple choice both ways, typed recall, flip with self-rating.
  - Cloze, fill-the-gap from examples.
  - Multi-select questions with explanations, ordering.
  - True/false, picture quiz, listening, dictation, speaking.
  - Sentence building.
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
  - XP, levels, combos, badges.
  - Forgiving streaks with freezes and repair.
  - Goals and forecasts.
- **Timers:**
  - Off / relaxed / normal / challenge.
  - Timers apply only to known cards (WCAG 2.2.1).

## Next (v0.3)

- [ ] **Image occlusion:** hide labels on a diagram, for medicine and anatomy.
- [ ] **Exam simulator:**
  - timed vs tutor mode;
  - flag and review;
  - score by domain/tag;
  - exam-like question count. Useful for AWS and other certifications.
- [ ] **Anki import with scheduling history:** replay the revlog into FSRS.
- [ ] **Confidence rating** (1–5) on reveal.
- [ ] **Cram mode:** study a deck or tag without touching the schedule.
- [ ] **Starred-only sessions; leech handling:** offer a rewrite or mnemonic after 8 lapses.
- [ ] **Cloze with a word bank** (scaffolded), then typed.
- [ ] **Slow audio replay** for listening and dictation.

## Later (v1)

- [ ] **Hotspot / click-on-image; labelled diagrams.**
- [ ] **STEM:** numeric answers with tolerance and units; LaTeX rendering and answers.
- [ ] **Code cards:** predict the output, Parsons problems (order the lines), fill the missing token.
- [ ] **Timed list recall:** "name all 7 …".
- [ ] **AI with your own API key:**
  - generate cards from notes or PDFs, reviewed before they are added;
  - "explain in your own words" grading;
  - better distractors.
- [ ] **Hands-free audio mode.**
- [ ] **Mastery by tag;** exam-readiness view.
- [ ] **Public deck registry on GitHub** (CC-licensed decks), deep links and QR codes.
- [ ] **Anki `.apkg` export;** Mochi, Brainscape, Kahoot and Blooket importers.
- [ ] **Mobile companion:** a PWA that syncs through a folder you choose (Syncthing, iCloud Drive, Dropbox).

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
