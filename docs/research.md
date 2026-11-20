# Research report: study formats, timers, deck format and roadmap for a local-first, open-source study app

Research date: 20 Nov 2026. Sources are official help centres, product docs, GitHub and research summaries, all fetched this session unless marked otherwise.

**How sure each claim is:**
- **(V)** I checked it this session in an official or primary source.
- **(S)** It comes from a secondary source, such as a review or blog.
- **(K)** It is established knowledge or literature I did not re-fetch. Verify these before relying on them.

---

## 0. Key findings

1. **Prefer recall over recognition, and fade the support.** Quizlet's own research blog says Learn dropped true/false and "none of the above". Those options were too easy to guess and were linked to more abandoned sessions. Learn now starts with multiple choice and moves to typed cued recall (guidance fading) (V). Your app should do the same, per card, based on its FSRS stability.
2. **Timers help fluency but hurt encoding.** A study of high-stakes versus low-stakes quizzing (Applied Cognitive Psychology, 2014, likely Hinze & Rapp (K)) found that only the low-stakes quizzes beat rereading on the final test (V, via abstract). Use timers only on items the learner already knows. Make every timer adjustable or switchable off: WCAG 2.2.1 requires turning it off, or extending it to at least 10 times the default (V).
3. **The formats with the biggest market gaps for "any subject" are:**
   - image occlusion and labelled diagrams (medicine);
   - multi-select scenario questions with explanations, in an exam simulator with tutor and timed modes (AWS and other certifications);
   - ordering and grouping (history, processes);
   - numeric answers with tolerance and LaTeX (physics);
   - code cards (programming).
   Wayground (formerly Quizizz), Kahoot, Wordwall and UWorld/Tutorials Dojo each own pieces of this. No local-first SRS app combines them.
4. **Gamification works, modestly.** Sailer & Homner's 2020 meta-analysis found small positive effects: g = .49 on learning outcomes, .36 on motivation and .25 on behaviour (V). Game fiction and social features mainly moved the behaviour measures. Keep games as wrappers around retrieval, not as economies that gate it.
5. **Deck format.** Use a zip package (`manifest.json` + `notes.jsonl` + content-addressed `media/` + optional `reviews.jsonl`), with an identical unzipped directory form for Git. Make the append-only review log the source of truth and recompute FSRS state from it. That makes sync, merge and import (including Anki's revlog) straightforward.
6. **Anki import is mandatory for adoption.** It is feasible. Modern `.apkg` files contain `collection.anki21b` (zstd-compressed SQLite, schema V18) plus a protobuf `meta`, and a zstd-compressed protobuf media list. Legacy packages contain `collection.anki2` or `.anki21` (schema V11) and a JSON media map (V, Anki source).

---

## 1. Competitor deep dives

### 1.1 Quizlet (current as of late 2026)

**Flashcards**
- Flip cards between term and definition (V).
- Shuffle, star and audio exist across Quizlet (V, in Learn options).
- Swipe-to-sort "track progress" in Flashcards is (K) and not re-verified.

**Learn** (V)
- Builds a personalised path from your session goal and your familiarity with the set.
- Free users get a limited number of rounds per set. Plus gets about 20 rounds a month, Plus Unlimited more (S).
- Write and Spell modes now live inside Learn's Options menu.
- If you miss a written question, you can retype the correct answer.
- Options menu:
  - **Answer with:** term, definition, or a specific language.
  - **Starred terms only.**
  - **Shuffle.**
  - **Audio.**
  - **Question types.**
  - **Grading options** (below).

**Smart grading** (V, help article)
- **Relaxed:** accepts the right general meaning, including synonyms, rephrasing and typos.
  - Needs at least 3 cards in English, French, German or Spanish.
  - It is the default when both sides are in your default language.
- **Moderate:** needs an exact match but tolerates small slips such as accents or missing letters.
- **Strict:** needs an exact match, ignoring only things like capitalisation and punctuation.
  - It is the default when the two sides are in different languages.
  - It is the only option for Chinese, Japanese, maths and chemistry sets.
- **Test only:** a "Require 1 answer only" setting accepts any one of several answers. Answers are separated by a comma, slash or semicolon.

**Test** (V)
- An auto-generated mock test mixing written, multiple-choice and true/false questions.
- Matching questions are (K).
- Free users get one practice test per set.
- Settings include question count and "answer with" (K).

**Practice Tests (AI)** (V)
- Generated from your sets or from pasted or uploaded notes (at least 300 characters).
- Settings: question count, multiple-choice or written, and a time limit.
- Written answers are capped at 200 characters.
- Limited to sciences and humanities.

**Study Guides (AI)** (V)
- Generates guides and flashcards from your notes.
- This is the descendant of "Magic Notes". The rename is (S/K).

**Match** (V)
- A timed race to pair terms with definitions or images.
- A historic 1-second penalty per wrong pair is (K).

**Blast** (V)
- Shoot the asteroid carrying the correct answer before time runs out.
- Can be played individually or in teams.

**Block game** (V)
- Correct answers earn block pieces, which you place on a grid to clear rows and columns (Tetris/Block Blast style).
- The help article does not name it.

**Gravity:** discontinued. Quizlet's help centre suggests Match instead (V).

**Live and Checkpoint**
- **Classic Quizlet Live:** players match terms in teams or individually (V).
- **Checkpoint:** a teacher-run formative check in the Live format (S).
  - Needs at least 2 players.
  - Students get encouraging feedback and a review of what they missed.
  - The teacher gets class results and a breakdown of chosen answers.

**Diagrams:** label an image or map. Requires Plus (V).

**Categories:** a Jeopardy-style teacher game (S).

**Q-Chat:** discontinued according to several third-party articles. I could not fetch an official date.

**AI study experience (August 2025)** (S)
- An upgraded Learn with AI-based difficulty and grading.
- Study Groups.
- "Study Bites", which routes you to the best mode.
- Course and milestone tagging.

**Progress rings:** not verified this session.

**Takeaways**
- Copy the ideas, not the presentation:
  - three-level grading;
  - multiple accepted answers;
  - answer direction per language;
  - starred-only sessions;
  - retyping missed answers;
  - fading from multiple choice to written.
- Quizlet paywalls Learn and Test. A free local app doing both well is a clear wedge.

### 1.2 Anki and its add-ons

**Note types** (V)
- Basic, Basic and reversed, Optional reversed, and Type-in-answer (K: these are standard, but the page I fetched did not detail them).
- **Cloze:**
  - Syntax is `{{c1::text::hint}}`.
  - `{{c1,2,3::x}}` puts one deletion on several cards.
  - Nested clozes have been supported since 2.1.56.
  - Clozes need not start or end on word boundaries.
- **Image Occlusion** (built in since 23.10):
  - Shapes: rectangle, ellipse or polygon.
  - Modes: "Hide All, Guess One" or "Hide One, Guess One".
  - Grouped shapes form a single card.
  - Fields: Header, Back Extra and Comments.

**Scheduler** (V)
- FSRS arrived in 23.10.
- Default desired retention is 90%, and Anki advises staying below 97%.
- The optimiser needs several hundred reviews; re-optimising about monthly is enough.
- "Easy Days" lowers the workload on chosen weekdays.

**Timers** (V)
- "Maximum answer seconds" (default 60) caps the recorded answer time. Timing does not affect scheduling.
- Optional on-screen timer.
- Auto Advance (23.12+) sets seconds to show the question and the answer. This makes a hands-free mode possible.

**Leeches** (V): a card becomes a leech after 8 lapses. Anki tags it and can suspend it, then warns again every half-threshold.

**Siblings** (V): you can bury new, review and interday-learning siblings.

**Text import** (V, 2.1.54+)
- Supports `#separator`, `#html`, `#tags`, `#columns`, `#notetype`, `#deck`, `#notetype column`, `#deck column`, `#tags column` and `#guid column` headers.
- Duplicates are detected by the first field. Updated notes keep their scheduling.

**Add-ons** (V, Awesome Add-ons thread)
- Gamification: Ankimon, Anki Killstreaks (medals), Anki Leaderboard, Pokemanki Gold, Hitmarkers, Life Drain, AnkiCraft.
- Heatmaps: Review Heatmap, New Card Heatmap.
- Timers: Pomodoro timers and Break Timer (a break every 10 cards).
- AI: AnkiBrain, Smart Notes, Anki Terminator.
- AnKing: AnkiHub decks and paid tools such as "UWorld QID to Anki Search".
- Multiple-choice add-ons are listed on a separate wiki.

**CrowdAnki** (V)
- Exports a deck as JSON plus a media folder for GitHub collaboration.
- Supports Git snapshots on open and close.

**AnKing-style workflow** (K, the guide page failed to load)
- One large community deck with hierarchical resource tags, such as `#AK_Step1_v12::Pathoma::Ch1`.
- Students unsuspend cards as they cover lectures or questions, using UWorld-QID tags.
- Shared updates come through AnkiHub, and personal scheduling is kept.

**Takeaways:** support Anki's cloze and occlusion semantics exactly; use stable IDs so deck updates preserve scheduling (the AnkiHub idea); tag-driven unsuspend; and the leech rule.

### 1.3 Language apps

**Duolingo** (V, wiki and blog)
- Exercise types:
  - arrange words; sentence shuffle with distractor words;
  - complete the translation; select the missing word;
  - mark the correct meaning; read and respond;
  - picture matching and picture translation;
  - full translation;
  - speak this sentence;
  - tap the pairs;
  - type what you hear (with a slow "turtle" replay);
  - what do you hear?
- Timed content:
  - **Side Quests:** each star is a timed lesson that you must complete perfectly in time.
  - **Match Madness:** timed pairing, reached from the Leaderboards screen.
- Legendary level: harder lessons with no hints.
- Practice Hub (Super): mistakes, words, all-speaking lessons. Max adds Video Call and Roleplay with AI.

**Memrise** (V)
- Native-speaker videos and an AI conversation partner.
- Community courses left the main app on 31 March 2024. They were kept on a separate site, extended to the end of 2025.
- Lesson: user decks on a centralised platform are fragile. Local-first answers this.

**Clozemaster** (S)
- One blanked word per sentence, answered by typing or by multiple choice, ordered by word frequency.
- Points, leaderboards and a retro arcade style.
- Pro adds listening.
- Review intervals and mastery % were not verified.

**Lingvist** (S)
- Typed recall of a word inside a sentence with its translation.
- Adaptive spacing after a placement test.
- A "mute" flag for words you already know.
- Separate challenges for speaking, reading and writing.

**Drops** (S): picture-word matching by swipe or tap, no typing, and a 5-minute daily cap on the free tier.

**WaniKani** (V)
- 9 SRS stages: Apprentice 1–4, Guru 1–2, Master, Enlightened, Burned.
- Intervals: 4h, 8h, 1d, 2d, 1w, 2w, 1mo, 4mo.
- Wrong-answer drop: ceil(misses / 2) × a penalty factor (2 at stage 5 and above, otherwise 1).
- Requiring both reading and meaning answers is (K).

**Bunpro** (S): typed answers in example sentences with an optional hint, and links back to the grammar lesson after a miss.

### 1.4 Brainscape (V)

- **Confidence-based repetition:** after flipping, you rate 1–5. Lower ratings return sooner.
- **Mastery** is the weighted average of confidence; all 5s means 100%.
- **Study modes:**
  - Progressive (in order) or Random.
  - Study Mix (web): a curated set of cards.
  - Smart Study (mobile): interleaves classes, with frequency set per class.
- **CSV import:** either question/answer columns or labelled columns: Q. Prompt, Q. Body, Q. Clarifier, Q. Footnote, A. Body, A. Clarifier, A. Footnote.
- Export is not documented in that article. A third-party summary says Pro unlocks exports (S).

### 1.5 Knowt (S)

- The free plan includes every study mode on your own sets: Learn, practice tests and spaced repetition.
- Quizlet import via a Chrome extension or pasted text.
- Ads, and limited AI on the free tier.
- Export format: not verified.

### 1.6 Classroom game platforms

**Kahoot** (V)
- Scored question types: Quiz (2–6 options, single or multi-select), True/False, Type Answer (20 characters, not case-sensitive), Puzzle (order 3–4 items), Slider (with a tolerance margin), Pin answer (place a pin in a defined area of an image).
- Unscored: Poll, Word cloud, Brainstorm (AI-grouped ideas, then a vote), Drop pin, Open-ended, Scale, NPS.
- Timers run from 5 seconds to 4 minutes. Points are 0, 1000 or 2000.
- Slider scoring is 20% speed and 80% precision.
- Spreadsheet import (.xlsx), standard Quiz questions only:
  - question up to 120 characters (the template may say 95);
  - answers up to 75 characters;
  - time limit of 5, 10, 20, 30, 60 or 120 s;
  - correct answers given as numbers, e.g. "2,3".

**Blooket** (V)
- 27 modes. Answering questions powers a separate game: Gold Quest (steal gold), Tower Defense 1 and 2, Café, Factory, Crypto Hack, Fishing Frenzy, Racing, Battle Royale, Monster Brawl, and others.
- Solo/homework modes include a plain "Study" mode with no game elements.

**Gimkit** (S)
- In-game cash for correct answers, spent in a shop on upgrades and power-ups.
- Modes include Classic, Team, Trust No One (social deduction), Fishtopia and 2D map modes, and Creative.
- Kits can be imported from Quizlet or spreadsheets. There is an assignment mode.
- The full list of roughly two dozen modes is not verified.

**Wayground (formerly Quizizz)** (V)
- Basic: multiple choice, multi-select with partial credit, true/false, fill in the blank with alternative answers, open-ended (AI or manual grading).
- Media and reading: interactive video, passage with several questions.
- Maths: Math Response (equivalent forms accepted), Graphing.
- Interactive: Match, Hot Text, Reorder, Categorize (up to 20 items into up to 4 groups), drag-and-drop and drop-down cloze.
- Visual: Labeling (up to 10 labels), Hotspot (circle, rectangle or freeform).
- Responses: audio and video answers (AI evaluation for audio), Draw.
- Multi-part questions, scored per part, sequentially or all-or-nothing.

**Wordwall** (V)
- 34 interactive and 20 printable templates.
- Named on the features page: Quiz, Crossword, Maze Chase, Airplane, Whack-a-mole, Match up, Matching pairs, Group sort, Labelled diagram, Rank order, Speed sorting, Spell the word, Type the answer, Unjumble, Anagram, Hangman, Wordsearch, Balloon pop, Flying fruit, Gameshow quiz, Pair or No Pair, Watch and memorize, Win or lose quiz, Random wheel.
- One-click "Switch template" re-renders the same content in another game. This is the key idea for your app.
- A timer option on nearly every template.
- Difficulty settings for arcade templates.
- A "Primary" visual style with a font for early readers.

### 1.7 Other flashcard sites

- **StudyStack** (S): flashcards, crossword, fill-in, quiz, hangman, matching, puzzles, and "Slides" (label maps and diagrams).
- **Cram.com:** "Memorize" and "Cram" modes plus small games (K, not verified).

### 1.8 Mochi, RemNote, Obsidian, Logseq

**Mochi** (V)
- `.mochi` is a zip containing `data.json` (Transit-encoded) or `data.edn`, plus media.
- Top level: `:version 2`, `:decks` (name, id, parent-id), `:cards` (content, deck-id, fields, pos, reviews), `:templates` (mustache content, typed fields).
- Field types: text, boolean, speech, image, translate, dictionary.
- Reviews carry date, due, interval, remembered?, and an optional duration.
- Imports `.apkg` with review history, but strips CSS and JS and converts HTML to Markdown.
- Imports Markdown folders or delimited files, and CSV mapped to template fields.

**RemNote** (V)
- Syntax:
  - `>>`, `<<` and `<>` for basic cards;
  - `::`, `:>` and `:<` for concepts;
  - `;;` for descriptors;
  - `{{cloze}}`;
  - tripled markers for multi-line list answers;
  - `==A)` with `/mcr` and `/mcw` for multiple choice.
- Image occlusion by Ctrl/Cmd-clicking an image.

**Obsidian Spaced Repetition** (V)
- Syntax: `Q::A`, `Q:::A` (reversed), multi-line with `?` or `??`, cloze with `==x==`, `**x**` or `{{x}}`.
- Decks come from `#flashcards/sub` tags.
- FSRS or SM-2, plus cram modes that ignore scheduling.

**Logseq:** `#card` blocks and `{{cloze}}` (K).

### 1.9 Map and quiz games, and mastery models

**Seterra** (now part of GeoGuessr)
- Map quizzes by region, plus anatomy and science quizzes, and printables (V).
- Modes: Pin, Type, Place and a learning mode (K, not verified this session).

**Sporcle** (V)
- Quiz types: Classic (type answers), Clickable, Grid, Map, Multiple Choice, Order, Picture Box, Picture Click, Slideshow.
- The defining mechanic, a global timer with all answers to recall and "give up", is (K).

**Khan Academy** (V)
- Skill levels: Not started, Attempted, Familiar, Proficient, Mastered.
- In exercises: under 70% gives Attempted, 70–99% Familiar, 100% Proficient.
- Mixed quizzes and tests can raise a skill to Mastered or lower it.

### 1.10 Medical and certification prep

**UWorld** (V)
- Tutor mode (explanation after each question) or Timed mode.
- Custom tests built by subject and system.
- My Notebook, and SRS flashcards (ReadyDecks and SmartCards).
- Performance by subject, system and topic, and time per question.
- Peer % for each answer option.
- Self-assessments: four 60-minute blocks of 40 questions.

**Tutorials Dojo (AWS)** (V)
- Modes:
  - Timed Mode;
  - Review Mode (explanation after each question);
  - Section-Based tests by domain;
  - Final Test (65 random questions).
- Explanations with reference links and cheat sheets.
- A domain breakdown that follows the official exam guide.
- Recommends repeating until you consistently score 85% or more.

**Tutor vs timed mode** (S)
- Early prep: about 80% tutor mode. Final weeks: about 80% timed.
- Do not check answers mid-block in timed mode.
- Fresh questions for timed benchmarks, because repeats inflate scores.

**Boards & Beyond:** video lessons plus question bank (K, not fetched).

### 1.11 Open-source projects

- **Quenti** (V): "the open source Quizlet alternative".
  - AGPL-3.0; Next.js, tRPC, Prisma and MySQL.
  - Server-based, needs OAuth. Not local-first.
- **Scholarsome** (V): AGPL-3.0, TypeScript, imports from Quizlet, flashcards in "progressive" mode plus quizzes. Updated in 2026.
- **LibreLingo** (V): AGPL; courses written in YAML. Now archived; forks such as LibreLingoRelive exist.
- **Mnemosyne:** an older open-source Python SRS that collected research data (K).
- **FSRS libraries** (V)
  - ts-fsrs supports v3–v7 (TypeScript).
  - fsrs-rs supports v6–v7 and has an optimiser (Rust).
  - py-fsrs implements v6.
  - FSRS-6 is the mainstream version; v7 is emerging.
  - Other open apps on ts-fsrs or fsrs-rs: Etude (MIT), Origa, and Obsidian plugins such as True Recall and LearnKit.
- **ankipack** (V): a TypeScript library targeting Anki schema V18, verified against Anki 26.08.1.

---

## 2. How competitors do your existing features better

| Your feature | Best-in-class pattern to adopt |
|---|---|
| Multiple choice, both directions | Plausible ("competitive") distractors from the same deck or tag and the same field type and length. Competitive options also improve memory of related, unquizzed facts (Little & Bjork). Always give feedback: Butler & Roediger 2008 found it stops learners absorbing wrong options. Drop true/false and "none of the above" in learning rounds (Quizlet research). Offer an "answer with" choice per language. |
| Typed recall | Quizlet's three grading levels; several accepted answers separated by `/ ; ,`; optional accent and case tolerance; an "I was right" override; retype-on-miss (you have forced copy). Kahoot keeps Type Answer short (20 characters). |
| Cloze | Exact Anki syntax (`c1`, hints, multi-number, nesting). Answer modes: typed, multiple choice (Clozemaster), word bank or drop-down (Wayground). Optional first-letter hint. |
| Match pairs | Image-to-term pairs (Quizlet). A "Matching pairs" memory variant (Wordwall). Penalty time for wrong taps instead of lives. |
| Sentence building | Distractor tiles (Duolingo sentence shuffle). Slow audio replay. |
| Listening and dictation | Turtle (slow) replay (Duolingo); per-card replay limits. |
| Speak aloud | Audio response with AI evaluation (Wayground); shadowing; roleplay (Duolingo Max, Memrise). |
| Category sprint | Generalise to any tag or field: Group sort and Speed sorting (Wordwall), Categorize (up to 4 groups). |
| Word rain | Wordwall's arcade family (Airplane, Whack-a-mole, Balloon pop) has difficulty settings. Quizlet's Gravity, the closest analogue, was retired, which suggests type-before-landing games are niche. Keep it optional. |
| Boss battle / rescue | UWorld-style "incorrect" and "marked" filters; Duolingo mistakes practice. |
| Streaks, XP, badges | Khan-style mastery levels per skill or tag, and WaniKani stage names. Brainscape's mastery % as a deck-level ring. |
| Short rotating blocks | Wordwall "Switch template": one content set rendered in many games. Make every format a renderer over the same note fields. |

---

## 3. Complete catalogue of formats and features

**Legend**

- **Value:** learning value.
  - H = high, M = medium, L = low.
  - Evidence keys:
    - **TE** testing effect: Dunlosky 2013 rates practice testing "high" (V); Roediger & Karpicke 2006; Rowland 2014 meta-analysis (K).
    - **SP** spacing: Dunlosky rates it "high" (V).
    - **GE** generation effect: Bertsch et al. 2007 meta-analysis (K, d about 0.4).
    - **IL** interleaving: Brunmair & Richter 2019 found g = 0.42 overall, 0.67 for paintings, 0.34 for maths, and harm for word lists (g = −0.39) (V).
    - **MC** competitive multiple choice plus feedback (V via retrievalpractice.org).
    - **HC** hypercorrection: Butterfield & Metcalfe 2001 found high-confidence errors are corrected best after feedback (K).
    - **PT** pretesting and errorful generation: Kornell, Hays & Bjork 2009 (K).
    - **DC** dual coding and multimedia: Paivio; Mayer (K).
    - **EI** elaborative interrogation and self-explanation: Dunlosky rates both "moderate" (V).
    - **TAP** transfer-appropriate processing: practise in the exam's format (Morris et al. 1977) (K).
    - **PR** performance pressure reduces the benefit of retrieval (Applied Cognitive Psychology, 2014) (V).
    - **FL** fluency and automaticity: de Jong & Perfetti 2011 (K).
    - **PP** Parsons problems: Ericson et al. 2017 (K).
- **Fun:** 1–3.
- **SRS:** how a format may write to FSRS.
  - **F** writes a full grade (Again/Hard/Good/Easy).
  - **R** recognition grade: a miss writes Again; a hit writes Hard, or Good if it was fast and confident.
  - **P** practice only: logged, no FSRS write.
- **Build:** S, M or L effort for a solo developer.

### 3a. Recall and recognition core

| # | Format | Trains | Value (evidence) | Fun | Products | Card data needed | SRS | Build |
|---|---|---|---|---|---|---|---|---|
| 1 | Flip card with self-grade | free recall | H (TE, SP) | 1 | Anki, Mochi, Quizlet Flashcards | front, back | F | built? / S |
| 2 | Multiple choice, single answer | recognition | M; H with competitive lures + feedback (MC) | 2 | all | prompt, answer, distractor pool | R | built |
| 3 | Multi-select ("choose TWO") | discrimination | M–H; TAP for AWS exams | 2 | Wayground, Kahoot, TD/AWS | stem, choices[], correct[] | R (partial credit, then Hard) | S |
| 4 | True/false (term–definition pairing) | verification | L (guessable; Quizlet removed it from Learn) | 1 | Quizlet Test, Kahoot, Wordwall, OmniSets | pairs | P | S |
| 5 | Typed recall | cued recall | H (TE, GE) | 1 | Quizlet Learn/Write, Anki type-in, Lingvist, Bunpro | answer + alternatives | F | built (upgrade grading) |
| 6 | Cloze, typed | contextual recall | H (TE, GE) | 2 | Anki, Clozemaster, Lingvist, RemNote | marked sentence | F | built |
| 7 | Cloze with word bank or drop-down | scaffolded recall | M (guidance fading) | 2 | Wayground drag/drop, Duolingo select-missing | cloze + distractors | R | S |
| 8 | Letter tiles, anagram, spell | orthography | M | 2 | Wordwall Anagram/Spell, Quizlet Spell | answer string | R | S |
| 9 | Hangman | orthography | L–M | 3 | Wordwall, StudyStack | answer string | P | S |
| 10 | Progressive hints (first letter, then more) | cued recall with support | M–H (keeps retrieval successful) | 1 | Anki `::hint`, Bunpro | answer | F with hint used, capped at Hard | S |
| 11 | Multi-field recall (e.g. reading + meaning) | complete knowledge | H | 1 | WaniKani | ≥2 answer fields | F (worst field counts) | S |
| 12 | List or set recall ("name the 5 …") | free recall of a set | H (TE) | 2 | RemNote list cards, Sporcle | ordered or unordered list | F per item, aggregated | M |
| 13 | Timed list recall (Sporcle-style) | fluency on set recall | M–H (FL; known items only) | 3 | Sporcle Classic | list + aliases | P (or F once a day if untimed retry) | M |
| 14 | Reverse direction / answer-with | bidirectional recall | H (each direction is separate memory) | 1 | Anki reversed, RemNote `<>`, Quizlet answer-with | 2 fields | F (separate card) | S |
| 15 | Pretest (guess before learning) | primes encoding | M–H (PT) | 2 | few (Quizlet Learn diagnostic, Khan course challenge) | any | P (no lapse) | S |
| 16 | Confidence rating, before or after answering | metacognition | M–H (HC, calibration) | 1 | Brainscape 1–5 | none | modifies F (Good vs Easy; confident miss flagged) | S |

### 3b. Structure and relations

| # | Format | Trains | Value | Fun | Products | Data | SRS | Build |
|---|---|---|---|---|---|---|---|---|
| 17 | Match pairs on a timer | association | M | 3 | Quizlet Match, Duolingo tap pairs / Match Madness | pairs | P | built |
| 18 | Memory / concentration (hidden cards) | association + working memory | L–M | 3 | Wordwall Matching pairs | pairs | P | S |
| 19 | Ordering / sequencing | chronology, process steps | M–H (TE on relations) | 2 | Kahoot Puzzle, Wayground Reorder, Wordwall Rank order, Sporcle Order | ordered list, or date/number field | F (exact = Good) | S |
| 20 | Group sort / categorise | concept boundaries | M–H (IL works for similar categories) | 3 | Wayground Categorize, Wordwall Group sort / Speed sorting | category field or tags | R per item | S (generalise your der/die/das sprint) |
| 21 | Odd one out | discrimination | M | 2 | rare (Wordwall "Pair or No Pair" is related) | category field or tags | P | S |
| 22 | Pair or not (rapid yes/no) | speeded recognition | L–M (FL) | 3 | Wordwall, Drops swipe | pairs | P | S |
| 23 | Sentence building with distractor tiles | syntax | M–H (GE) | 2 | Duolingo | sentence + translation | F | built |
| 24 | Full translation, typed | production | H | 1 | Duolingo, Clozemaster | sentence pairs | F (AI or fuzzy grading) | M |
| 25 | Hot text (highlight the span) | locating evidence | M | 2 | Wayground | passage + spans | R | M |
| 26 | Passage / case vignette with sub-questions | applied reasoning | H for exams (TAP) | 1 | Wayground Passage, UWorld | passage + questions | F per sub-question | M |
| 27 | Concept map / "connect the related" | relations | M | 2 | none mainstream | links between notes | P | L |

### 3c. Visual and spatial

| # | Format | Trains | Value | Fun | Products | Data | SRS | Build |
|---|---|---|---|---|---|---|---|---|
| 28 | Image occlusion (hide all / hide one) | spatial recall | H (TE + DC) for anatomy, diagrams | 2 | Anki (built in), RemNote, Brainscape (K) | image + masks (normalised rectangles, ellipses, polygons) | F per mask | M |
| 29 | Labelled diagram (drag labels onto pins) | spatial recognition | M–H | 2 | Wordwall, Wayground Labeling, Quizlet Diagrams, StudyStack Slides | image + label points | R | M |
| 30 | Hotspot / click on image ("click the mitral valve") | spatial recall | H | 3 | Kahoot Pin answer, Wayground Hotspot, Sporcle Picture Click | image + regions | F | M |
| 31 | Map quiz (pin / type / place) | geography | H for its domain | 3 | Seterra, Sporcle Map | GeoJSON or SVG regions + names | F per region | M–L |
| 32 | Picture to word | vocabulary with images | M–H (DC) | 2 | Duolingo, Drops | image + term | F if typed, R if MC | S |
| 33 | Video or GIF prompt | procedures, signs, motion | M | 2 | Wayground interactive video | video + answer | F | S (playback) |

### 3d. STEM and code

| # | Format | Trains | Value | Fun | Products | Data | SRS | Build |
|---|---|---|---|---|---|---|---|---|
| 34 | Numeric answer with tolerance and units | quantitative recall | H | 1 | Kahoot Slider (margin), Wayground Math Response | value, tolerance (absolute or %), unit | F | S |
| 35 | Maths / LaTeX expression, equivalence-checked | formula production | H | 1 | Wayground Math Response | LaTeX answer; CAS check | F | M (KaTeX + math.js/nerdamer) |
| 36 | Formula rendering everywhere | — | enabler | — | Anki MathJax | `$…$` in Markdown | — | S |
| 37 | Code: predict the output | program tracing | H | 2 | none mainstream | code, language, output | F | S (no execution needed) |
| 38 | Code: Parsons problem (order the lines) | program construction | H (PP) | 2 | research tools | code split into lines (+ distractors) | F | S |
| 39 | Code: fill the missing token / spot the bug | syntax and API recall | M–H | 2 | — | code with cloze or bug line | F | S |
| 40 | Graphing (plot a point or line) | function intuition | M | 2 | Wayground Graphing | function spec | R | L |

### 3e. Language and audio

| # | Format | Trains | Value | Fun | Products | Data | SRS | Build |
|---|---|---|---|---|---|---|---|---|
| 41 | Listening: audio to meaning | comprehension | M–H | 2 | Duolingo, Clozemaster Pro | audio + meaning | R | built |
| 42 | Dictation with slow replay | phoneme-to-spelling | H | 1 | Duolingo "type what you hear" | audio + text | F | built (add slow replay) |
| 43 | Speak aloud with ASR or self-check | production / pronunciation | H | 2 | Duolingo, Wayground audio response | text + audio | F | built |
| 44 | Shadowing (listen, repeat, compare) | prosody, fluency | M | 2 | Memrise videos (related) | audio | P | M |
| 45 | AI roleplay / conversation | communicative use | M–H | 3 | Duolingo Max, Memrise; Quizlet's Q-Chat discontinued | deck vocabulary + scenario | P (could mark words "used") | M (BYOK) |
| 46 | Audio-only / hands-free | review while commuting | M | 1 | Anki Auto Advance | audio or TTS | F by voice (or P) | M |

### 3f. Elaborative and AI

| # | Format | Trains | Value | Fun | Products | Data | SRS | Build |
|---|---|---|---|---|---|---|---|---|
| 47 | Explain in your own words, AI-graded | understanding | M–H (EI, GE) | 1 | Wayground open-ended AI, Quizlet Relaxed grading, OmniSets | reference answer / rubric | F (AI rubric to rating, user can override) | M |
| 48 | "Why?" elaborative prompt after a correct answer | integration | M (EI) | 1 | none mainstream | explanation field | P | S |
| 49 | Mnemonic field and AI mnemonic for leeches | encoding of hard items | M | 2 | WaniKani mnemonics | mnemonic field | — | S |
| 50 | AI card generation from notes or PDFs (BYOK) | authoring | enabler | — | Quizlet Study Guides, Knowt, RemNote, AnkiBrain | source docs | — | M |

### 3g. Session types and modes

| # | Feature | Purpose | Value | Fun | Products | SRS | Build |
|---|---|---|---|---|---|---|---|
| 51 | Learn mode (adaptive rounds, MC to typed) | new-item acquisition | H (guidance fading) | 2 | Quizlet Learn, Knowt | F at the first graded exposure | M (likely mostly built) |
| 52 | Test mode (mixed quiz, then report) | self-assessment | H (TE) | 1 | Quizlet Test | F | S |
| 53 | Exam simulator (timed vs tutor, flag, review, domain report, 65-question random final) | certification readiness | H (TAP) | 1 | Tutorials Dojo, UWorld | F only in tutor mode; timed mode is P until review | M |
| 54 | Cram mode (ignore schedule) | pre-exam | M (massed; leave SRS untouched) | 1 | Anki custom study, Obsidian SR | P | S |
| 55 | Starred / flagged / marked items | focus | M | 1 | Quizlet star, UWorld marked, Anki flags | — | S |
| 56 | Mistakes review | relearning | H (successive relearning) | 1 | Duolingo, UWorld "incorrect" | per FSRS | S (largely built) |
| 57 | Leech handling (8 lapses: tag, offer rewrite or mnemonic, suspend) | stop wasted time | H (practical) | — | Anki | — | S |
| 58 | Interleaved mixed review across decks | discrimination | M–H (IL; avoid for brand-new similar words) | 1 | Brainscape Smart Study, Anki order settings | F | S |
| 59 | Mastery levels per tag or skill | progress meaning | motivational | 2 | Khan, WaniKani, Brainscape % | derived | S |
| 60 | Local multiplayer (LAN host, Kahoot-like) | social | behaviour (GM) | 3 | Kahoot, Blooket, Gimkit, Quizlet Live | P | L |
| 61 | Game economy (cash and upgrades) | engagement | L for learning; risk of off-task time | 3 | Gimkit, Blooket | P | M |
| 62 | Crossword / word search | casual review | L (word search especially) | 2 | Wordwall, StudyStack | P | M |

That is 62 entries. Items 1, 2, 5, 6, 17, 23, 41–43 and parts of 51/56 are already built.

---

## 4. Timed-answer mechanics

**How products handle timers**
- **Per-question timers:** Kahoot sets 5 s–4 min per question, and its speed-weighted scoring (Slider is 20% speed) rewards fast guessing (V). Wayground and Wordwall have per-activity timers (V).
- **Whole-round timers:** Quizlet Match is a race (V). Sporcle uses one global countdown (K). Duolingo Side Quests and Match Madness require a perfect run within the time (V).
- **Measuring without forcing:** Anki shows an optional per-card timer, caps recorded time at 60 s, and does not use time in scheduling (V).
- **Exam pacing:** UWorld and Tutorials Dojo time whole blocks to simulate the exam and save explanations for afterwards (V).

**Evidence summary**
- **Hurts encoding:** high-stakes, pressured quizzing removed the advantage of retrieval practice over rereading (PR, V).
  - Time pressure on unfamiliar items pushes learners to guess, so they practise recognition rather than retrieval.
  - Quizlet found that slower formats and harder questions affected engagement and abandonment (V).
- **Helps fluency:** speeded practice on items already known builds automaticity. This matters for speaking and reading speed (de Jong & Perfetti 2011, K) and for exam pacing (S, tutor vs timed).
- **Accessibility:** WCAG 2.2.1 requires that each time limit can be switched off, adjusted to at least 10 times the default, or extended after a warning (V).

**Recommended rules**
1. **Gate timers by memory state.** No timer for new, learning or relearning cards. Allow timers once FSRS stability is at least about 3 days, or after 2 consecutive correct answers.
2. **Adaptive per-item timer.**
   - Limit = clamp(k × the learner's median correct response time for this format and card, floor, ceiling). Start with k = 2.0 and shrink by 10% after each on-time correct answer, down to k = 1.2.
   - Seed from the format's median until the card has data.
   - Add reading-time allowance for long prompts, about 250 ms per word.
3. **Time-outs.**
   - Reveal the answer and require a quick copy (your forced-copy flow).
   - If the card was not yet graded today, give one un-timed retry. Write **Again** only if the untimed retry also fails; otherwise write **Hard**.
   - Never let a pure time-out lower an item below Hard, or speed becomes a source of lapses.
4. **Speed as an "Easy" signal.** A correct answer under about 0.6 × median, with high confidence, may write **Easy**. FSRS in Anki ignores time, so this is your own heuristic: tune it, and make it switchable.
5. **Keep games out of the scheduler.** Arcade games (word rain, match races, sprints) are practice (P) only. The first graded exposure of the day happens in a calm format.
6. **Exam simulator.** Timed mode hides feedback until the block ends. Tutor mode gives feedback immediately. Offer Tutorials Dojo-style "section" and "final" blocks with domain breakdowns. Show average time per question against the exam's pace (AWS professional exams are about 2–3 minutes per question; verify per exam).
7. **Settings.**
   - Global "Timers: off / relaxed (×3) / normal / challenge".
   - Per-mode overrides.
   - "Reduce motion" also slows falling-item games.
   - This satisfies WCAG 2.2.1.

---

## 5. Recommended deck format and import/export

### 5.1 Formats in the wild

| Product | Format | Notes |
|---|---|---|
| Anki `.apkg` / `.colpkg` | Zip containing a SQLite collection | Legacy1: `collection.anki2`; Legacy2: `collection.anki21` (schema V11); Latest: `collection.anki21b` (schema V18, zstd). The `meta` entry is a protobuf `PackageMetadata`. Media are stored as `0`, `1`, … The `media` list is a JSON map in legacy packages and a zstd protobuf `MediaEntries` (name, size, sha1) in Latest; files are zstd-compressed when flagged (V). Notes table: `flds` separated by `\x1f`, space-separated tags, `guid`; cards table; revlog with ease 1–4 and time in ms (K). FSRS memory state is in `cards.data` JSON since 23.10 (K; verify). |
| Anki text | CSV/TSV + `#` headers | See section 1.2 (V). |
| Mochi `.mochi` | Zip with `data.json` (Transit) or `data.edn` + media | Version 2; decks, cards, templates, reviews (V). Side separator `---` and the `@media/` reference prefix are (K). |
| Quizlet | Plain text: term/definition separator plus card separator (tab/comma/custom; newline/semicolon/custom) | Not verified: whether native export is still available. Many third-party exporters exist, which suggests friction. No images in exports (K). |
| Brainscape | CSV or Google Sheet, 2 columns or 7 labelled columns | (V) |
| Kahoot | `.xlsx` template | Quiz questions only; limits as in 1.6 (V). |
| Blooket | CSV template: Question #, Question Text, Answer 1–4, Time Limit (max 300 s), Correct Answer(s) by number | (K, not verified) |
| Gimkit | CSV: Question, Correct Answer, Incorrect 1–3 | (K, not verified) |
| CrowdAnki | JSON file + media directory in Git | (V) |
| RemNote / Obsidian / Logseq | Markdown with inline markers | (V) for RemNote and Obsidian |

### 5.2 Proposed format: "Open Deck Package" (working name, `.odeck`)

**Design goals**
- Human-readable.
- Diff-friendly: JSONL means one note per line.
- Media stored once, by content hash.
- Notes kept separate from generated study items, so one note feeds many formats (the Wordwall "switch template" idea).
- Scheduling stored as an append-only log.
- The same layout works zipped or as a plain Git folder.

**Layout**
```
my-deck.odeck   (zip; JSON deflated, media stored)
├── manifest.json        required
├── notes.jsonl          required, one note per line
├── media.json           media index (hash → original name, mime, alt, licence)
├── media/sha256-<hex>.<ext>
├── reviews.jsonl        optional, append-only review log (personal exports only)
├── cards.jsonl          optional snapshot: FSRS state, flags, suspension (cache; reviews win)
└── README.md            optional, shown on the registry
```

**manifest.json**
```json
{
  "format": "odeck",
  "formatVersion": "1.0.0",
  "minReaderVersion": "1.0.0",
  "id": "urn:uuid:7b1c2a7e-3f0e-4c55-9a3e-2b9f4c1d0e11",
  "contentVersion": "2026.11.20",
  "title": "German A1 Core Vocabulary",
  "description": "1,000 high-frequency words with audio and example sentences.",
  "subjects": ["language"],
  "languages": { "term": "de", "meaning": "en" },
  "license": "CC-BY-SA-4.0",
  "authors": [{ "name": "Example Author", "url": "https://example.org" }],
  "created": "2026-11-01T10:00:00Z",
  "modified": "2026-11-20T08:00:00Z",
  "decks": [
    { "id": "de-a1", "name": "German A1", "parent": null },
    { "id": "de-a1-food", "name": "Food", "parent": "de-a1" }
  ],
  "noteTypes": [
    {
      "id": "vocab",
      "fields": [
        { "key": "term", "type": "text", "lang": "de", "required": true },
        { "key": "meaning", "type": "answers" },
        { "key": "gender", "type": "category", "options": ["der", "die", "das"] },
        { "key": "example", "type": "cloze", "lang": "de" },
        { "key": "image", "type": "image" },
        { "key": "audio", "type": "audio" }
      ],
      "exercises": [
        { "key": "recall-meaning", "kind": "recall", "prompt": "term", "answer": "meaning" },
        { "key": "recall-term", "kind": "recall", "prompt": "meaning", "answer": "term" },
        { "key": "cloze", "kind": "cloze", "source": "example" },
        { "key": "gender", "kind": "categorise", "prompt": "term", "answer": "gender" },
        { "key": "listen", "kind": "listen", "prompt": "audio", "answer": "meaning" }
      ]
    }
  ],
  "x": {}
}
```

**Field types**

| Type | Holds |
|---|---|
| `text` | Markdown (CommonMark + GFM); LaTeX as `$…$` / `$$…$$`; fenced code |
| `answers` | Array of accepted strings |
| `cloze` | Markdown with Anki-compatible `{{c1::x::hint}}` |
| `category` | One of the declared options |
| `number` | `{ value, tolerance, tolerancePct, unit }` |
| `ordered` | Array |
| `choices` | `{ items[], correct[] }` |
| `image`, `audio`, `video` | `{ media, alt, start, end }` |
| `occlusion` | `{ image, masks[], mode }` |
| `hotspot` | `{ image, regions[] }` |
| `code` | `{ lang, source }` |
| `geo` | Region IDs referencing a bundled GeoJSON/SVG |

**notes.jsonl examples (one per line, shown pretty-printed)**
```json
{"id":"01JD5Q8Z3K2V7Y","type":"vocab","deck":"de-a1-food",
 "fields":{"term":"der Apfel","meaning":["apple"],"gender":"der",
  "example":"Ich esse {{c1::einen Apfel::an apple}}.",
  "image":{"media":"sha256-ab12…e9.webp","alt":"A red apple"},
  "audio":{"media":"sha256-cd34…77.opus"}},
 "tags":["noun","a1","food"],"created":"2026-11-01T10:00:00Z","modified":"2026-11-02T09:00:00Z"}

{"id":"01JD5QB1M0XR4T","type":"mcq","deck":"aws-storage",
 "fields":{"stem":"A company needs … Which TWO actions meet the requirement?",
  "choices":{"items":[{"id":"a","text":"…"},{"id":"b","text":"…"},{"id":"c","text":"…"},{"id":"d","text":"…"},{"id":"e","text":"…"}],"correct":["b","d"]},
  "explanation":"S3 Object Lock in compliance mode …","domain":"Design Resilient Architectures",
  "reference":"https://docs.aws.amazon.com/…"},
 "tags":["s3","resilience"]}

{"id":"01JD5QC7H5N2PA","type":"occlusion","deck":"anatomy-heart",
 "fields":{"header":"Heart, anterior view","mode":"hide-all-guess-one",
  "image":{"media":"sha256-9f00…1a.png","alt":"Heart diagram"},
  "masks":[{"id":"m1","shape":"rect","x":0.12,"y":0.30,"w":0.10,"h":0.05,"label":"Left ventricle"},
           {"id":"m2","shape":"polygon","points":[[0.5,0.2],[0.55,0.25],[0.5,0.3]],"label":"Aorta","group":"g1"}]},
 "tags":["cardio"]}
```

**Cards and scheduling**
- A card ID is deterministic: `noteId + "/" + exerciseKey`, plus a mask ID or cloze number where relevant.
- So when a publisher updates a deck, every learner keeps their scheduling.

**reviews.jsonl** (append-only; source of truth for FSRS)
```json
{"card":"01JD5Q8Z3K2V7Y/recall-term","ts":"2026-11-20T08:15:02Z","rating":3,"durationMs":4200,"format":"typed","timed":false,"confidence":4,"device":"d-3f9a"}
```

**cards.jsonl** (optional cache)
```json
{"card":"01JD5Q8Z3K2V7Y/recall-term","fsrs":{"stability":12.4,"difficulty":5.1,"due":"2026-12-02T08:15:02Z","lastReview":"2026-11-20T08:15:02Z","algo":"fsrs-6"},"flags":["starred"],"suspended":false,"leech":false}
```

**Versioning rules**
1. `formatVersion` follows semver.
   - Minor versions only add things, and readers MUST ignore unknown keys.
   - A major version means breaking changes, and the app must ship a migrator.
2. Writers set `minReaderVersion` to the lowest version that can read the file correctly.
3. Vendor or app-specific data goes under `"x"` (manifest) or `"x"` per note, e.g. `x.anki.originalHtml` for lossless round-trip.
4. Publish a JSON Schema per version at a stable URL in the GitHub repo. Validate on import and show friendly errors.
5. Media are named `sha256-<hex>.<ext>`, so files are de-duplicated and their integrity can be checked. `media.json` carries the original filename, alt text and licence attribution.
6. The unzipped directory is a valid deck, for Git and the registry. The zip is just transport.
7. Sync and merge: union review logs by `(card, ts, device)`, then recompute FSRS state by replay with ts-fsrs or fsrs-rs. Notes merge by `modified` (last write wins), and conflicts are kept as `x.conflicts`.

### 5.3 CSV/TSV path for non-technical users

**Rules**
- UTF-8, with a header row. Tab is preferred; comma or semicolon is auto-detected.
- Optional Anki-style headers (`#separator:tab`, `#deck:`, `#tags:`) for compatibility.
- Reserved column names (case-insensitive): `front`/`term`/`question`, `back`/`definition`/`answer`, `alt_answers` (values separated by `|`), `hint`, `example` (cloze allowed), `image`, `audio`, `video` (filename in a sibling `media/` folder, or a URL downloaded only after confirmation), `tags` (space- or `|`-separated), `deck` (`Parent::Child`), `type` (vocab, basic, mcq, order, number, …), `choices` (separated by `|`), `correct` (choice text or 1-based numbers, e.g. `2|4`), `explanation`, `category`, `tolerance`, `id` (for updates).
- Any other column becomes a custom text field.

**Example**
```
term	meaning	alt_answers	gender	example	audio	tags
der Apfel	apple		der	Ich esse {{c1::einen Apfel}}.	apfel.mp3	food a1
die Brücke	bridge		die	Wir gehen über {{c1::die Brücke}}.	bruecke.mp3	city a1
```

**Paste box:** a Quizlet-style box with "between term and definition: Tab / comma / custom" and "between cards: newline / semicolon / custom", plus a live preview.

### 5.4 Import mappings

**Anki `.apkg` / `.colpkg`**

| Anki | Odeck |
|---|---|
| Zip `meta` (protobuf) | Choose a reader: Latest (zstd SQLite V18) or legacy (V11). Without `meta`: `collection.anki21` means Legacy2, otherwise Legacy1. |
| `media` (JSON map or zstd protobuf) | Read entries, decompress files if flagged, hash with SHA-256, write to `media/`. |
| notetypes / `col.models` | Become noteTypes. Field names become keys (slugified). Template kind: Basic gives recall; reversed and optional reversed add the reverse exercise (optional only if the "Add Reverse" field is non-empty); `{{type:Field}}` gives typed recall; cloze kind gives the cloze exercise; Image Occlusion gives an `occlusion` field built from the cloze-like occlusion shapes (normalised left/top/width/height; verify the syntax against current Anki). |
| `notes.flds` (split on `\x1f`) | HTML to Markdown (e.g. Turndown). `<img src>` becomes an image ref; `[sound:x.mp3]` becomes an audio ref; MathJax `\(…\)` / `\[…\]` becomes `$…$` / `$$…$$`. Keep the original HTML in `x.anki.html`. |
| `notes.guid` | Note ID (a stable re-import key). |
| `notes.tags` | Tags; `::` hierarchy becomes `/`. |
| decks (`A::B`) | `decks[]` with parents. Filtered decks are ignored. |
| `cards` (`ord`, `queue = -1`, `flags`) | Card per exercise or cloze number; suspended; any flag or the "marked" tag becomes starred; "leech" tag becomes leech. |
| `revlog` (`id` ms, `ease` 1–4, `time` ms, `type`) | `reviews.jsonl` (rating = ease). Skip manual/reschedule entries (type 4 and above) (K). Recompute FSRS by replay, or import `cards.data` s/d if present. |
| CSS / JS | Dropped (as Mochi does); warn the user. |

Reference implementations: Anki's Rust code for the reading logic; `ankipack` (TypeScript, V18).

**Other sources**

| Source | Mapping |
|---|---|
| Quizlet paste or export | term becomes front/term; definition becomes back/meaning. Detect the separators. No media. Optionally split "a; b" into `alt_answers`. |
| Brainscape CSV | Q. Prompt → instructions; Q. Body → front; Q. Clarifier → hint; Q. Footnote → note; A. Body → back; A. Clarifier → example/extra; A. Footnote → source. |
| Kahoot `.xlsx` | Question → stem; Answer 1–4 → choices; Correct "2,3" → `correct`; Time limit → `x.timerHint`. Type: `mcq`, or multi-select when there is more than one correct answer. |
| Blooket / Gimkit CSV | Same as Kahoot, as columns. Gimkit's correct/incorrect columns become choices plus `correct[0]`. |
| Mochi `.mochi` | Parse Transit JSON (transit-js) or EDN. Deck `parent-id` gives hierarchy. Card `content` split on the side separator gives front/back; template fields map to fields. Reviews: `remembered?` true → 3, false → 1; replay FSRS. Rewrite media references. |
| Obsidian SR / Logseq / RemNote Markdown | `Q::A`, `Q:::A` (both directions), `?` / `??` multi-line, `==x==` / `{{x}}` cloze, `#flashcards/sub` → deck; RemNote `>>` `<<` `<>` `::` `;;`, and `A)` multiple choice. |

**Export**
- Odeck (full fidelity).
- CSV/TSV.
- **Anki `.apkg`:** write the Legacy2 schema-V11 layout, the easiest path to broad import support (genanki-style); include revlog when the user opts in.
- Markdown for Obsidian.

---

## 6. Community, sharing, accessibility, portability

**Sharing without accounts**
- Deck files can be double-clicked to import.
- An `app://import?url=…&sha256=…` deep link, plus QR codes of that link for classrooms.
- Updates use stable note IDs, so re-importing a newer `contentVersion` updates the content and keeps scheduling (AnkiHub-style).
- Offer "subscribe to URL" with manual or periodic checks.

**Public GitHub registry**
- One repository containing `index.json`: id, title, subjects, languages, licence, URL, sha256, size, cardCount, preview image, `contentVersion`.
- Decks are submitted by pull request. CI validates against the JSON Schema and checks licence and media sizes.
- The app fetches only `index.json` (static hosting, no login, no tracking).
- Optional signing with minisign keys.
- Require a CC licence. Forbid copyrighted question banks: UWorld, Tutorials Dojo, and real exam dumps (AWS NDA).

**Mobile companion**
- A PWA or Capacitor app that reads the same `.odeck` folder.
- Sync through any user-chosen folder (Syncthing, iCloud Drive, Dropbox, USB). This works because review logs are append-only and merge as a union.
- A later option is a LAN QR "pair and sync" session.

**Accessibility**
- **Timers:** follow WCAG 2.2.1 (off, ×10, or extend).
- **Screen readers:** ARIA live regions announce right/wrong and the correct answer.
- **Keyboard alternatives** for every drag interaction (pick with Space, move with arrows, drop with Enter), including match, ordering, labelling and hotspot (Tab through regions).
- **Colour:** never use colour alone; add icons, text and patterns. Use colour-blind-safe palettes, high contrast and a dark theme.
- **Reduce motion:** this mode also slows or stops word rain and other falling-item games.
- **Text:** adjustable font, size, letter and line spacing. Offer OpenDyslexic as a preference, but a controlled study found no improvement in reading rate or accuracy with it (Wery & Diliberto 2017, K).
- **Audio:** TTS for any field; captions and alt text are required fields in the deck format.

**Keyboard-first defaults**
- 1–9 to pick choices; Space to flip or reveal; Enter to submit; 1–4 for Again–Easy; `S` to star; `E` to edit; `U` to undo.
- A command palette.

**Portability:** full export at any time; plain files; no proprietary database lock-in; SQLite only as a rebuildable cache.

---

## 7. Features that drive adoption over Anki

1. **Zero-config FSRS.**
   - Default 90% desired retention, shown as a "Relaxed / Balanced / Intense" slider (Anki: 90% default, under 97% advised).
   - Auto-optimise after a few hundred reviews, then monthly.
   - Easy Days. No learning-steps jargon.
2. **Onboarding in 3 minutes.**
   - Pick a subject, then a template, import or generate cards, then do the first 90-second block.
   - Show the forecast early.
3. **Subject templates** (one note type, many exercise renderers):

   | Subject | Note type | Exercises |
   |---|---|---|
   | Language | Vocab | recall both ways, cloze, gender/category sort, listen, speak, dictation |
   | Certification | Scenario MCQ | multi-select, explanation, domain, reference; tutor/timed exam simulator |
   | Medicine | Occlusion + Basic | hotspot, ordered pathways |
   | History | Event | date (number tolerance), ordering, category (era) |
   | Physics/Maths | Formula | LaTeX, numeric with units |
   | Coding | Code | predict output, Parsons, fill token |
   | Geography | Map | pin, type |

4. **AI with your own API key** (OpenAI, Anthropic, Google, or local via Ollama).
   - Generate from a PDF, notes or URL. Show a diff-style review queue before adding.
   - Cards follow the minimum-information principle: atomic, one fact (Wozniak's 20 rules, K).
   - Automatic distractor generation for multiple choice; rubric grading for "explain it"; leech rewrite and mnemonic suggestions.
   - Never send data without an explicit key and a per-action confirmation.
5. **Beautiful, readable defaults** with an original visual identity. Fast startup; offline.
6. **First-class Anki import with scheduling**, and an Anki export, so trying the app carries no risk.
7. **Mastery views by tag** (Khan/WaniKani-style levels) and exam readiness: a domain breakdown with a projected pass probability based on timed-block accuracy.

---

## 8. Prioritised roadmap

### MVP (next build): biggest value for the subjects you named

| Priority | Item | Why | Build |
|---|---|---|---|
| 1 | Open Deck Package v1 + CSV/TSV + paste import | Foundation for everything; portability promise | M |
| 2 | Anki `.apkg` import (both schemas, media, cloze, revlog to FSRS) | Biggest adoption lever | L |
| 3 | Answer-checking engine: accepted alternatives, three tolerance levels, accent and case options, typo distance, "I was right" override | Fixes the main typed-answer frustration; Quizlet charges for its version | S |
| 4 | Competitive distractor generator (same tag or field type, similar length; optional embeddings) | Turns MC from low to high value (MC evidence) | M |
| 5 | Multi-select + scenario MCQ note type + exam simulator (tutor/timed, flag, review, domain report) | AWS and other certifications; matches the real exam format | M |
| 6 | Image occlusion (rect/ellipse/polygon; hide-all / hide-one) | Medicine, anatomy, diagrams; Anki parity | M |
| 7 | Ordering + generalised group sort from tags or fields | Cheap, fun, works for any subject; extends your sprint | S |
| 8 | SRS-write policy + adaptive, gated timers + timer accessibility settings | Protects learning from game pressure; WCAG | S |
| 9 | Confidence tap (1–5) on reveal | Improves Easy/Good accuracy; hypercorrection flag | S |
| 10 | Star/flag, leech handling, cram mode (no SRS write) | Expected basics | S |

### v1

- Labelled diagram and hotspot.
- Numeric with tolerance and units.
- LaTeX with an expression-equivalence check.
- Code cards: predict output, Parsons, fill the token.
- Sporcle-style timed list recall.
- Cloze with word bank or drop-down.
- Odd one out; picture-to-word.
- AI generation and "explain in your own words" grading (bring your own key).
- Hands-free audio mode (auto-advance + TTS + voice grading).
- Mastery levels by tag.
- GitHub deck registry, deep links and QR.
- Mochi, Brainscape, Kahoot and Blooket/Gimkit importers; Anki `.apkg` export.
- PWA mobile companion with folder sync.

### v2

- Map quizzes (GeoJSON packs).
- LAN multiplayer party mode (host on the local network; a Kahoot-style gathering without accounts).
- AI conversation roleplay using deck vocabulary.
- Passage/vignette sets and hot text.
- Shadowing with waveform comparison.
- Optional casual pack: memory pairs, hangman, crossword.
- Graphing questions.
- Collaborative deck editing via Git UI.

---

## 9. Things to avoid

**Trademarks and look-and-feel**
- Do not use competitor product or mode names in the UI or marketing as if they were features: Quizlet, Quizlet Live, Gravity, Blast, Checkpoint, Kahoot, Blooket/"Blooks", Gimkit/KitCollab, Duolingo, Match Madness, Legendary, Side Quest, Seterra, Sporcle.
- Comparative statements such as "imports Quizlet text" are fine.
- Do not copy distinctive trade dress: Duolingo's owl-style mascot, its signature green and bouncy button style; Quizlet's blue card layout; Kahoot's four coloured shapes with triangle/diamond/circle/square answers.
- Generic mechanics (matching, multiple choice, timers, streaks) are not protected. Original art, names and sounds are required.

**Content**
- Do not host or seed copyrighted question banks (UWorld, Tutorials Dojo) or real certification exam questions (exam NDAs).
- The registry should require CC licences and attribution.

**Mechanics that hurt learning**
1. Speed-based points or timers on new items (PR evidence).
2. Heavy true/false and "none of the above" (guessable; Quizlet dropped them).
3. Multiple choice without corrective feedback (learners can absorb the wrong options).
4. Game economies where answering is a toll for the real game (Gimkit/Blooket style). This cuts retrieval volume per minute; keep games as thin wrappers.
5. Letting game repetitions inflate FSRS stability. Write one graded review per card per day.
6. Hearts or lives that block practice after mistakes. Mistakes are when learning happens; your boss battle is fine because it is optional.
7. Streak anxiety and loss-aversion dark patterns. Keep your forgiving freezes and repair; no guilt notifications.
8. Interleaving brand-new, look-alike vocabulary. Word-list interleaving was harmful in the meta-analysis. Block new similar items first, interleave at review.
9. Word search as a "study" format (low retrieval); mark it as casual.
10. Auto-generated AI cards added without review (hallucinations, non-atomic cards).

---

## 10. Gaps and unverified items

- **Quizlet:** whether native export still exists in 2026; the official Q-Chat discontinuation date; Test's exact settings (question limit, matching type, instant feedback); progress rings; the official name of the block game.
- **Exact CSV columns:** Blooket and Gimkit (given from memory).
- **Mechanics not re-checked:** Seterra modes, Sporcle timer and give-up, Clozemaster review intervals and mastery %, Knowt export, Cram.com modes, Logseq syntax.
- **Anki internals:** Image Occlusion field syntax, FSRS state inside `cards.data`, and revlog type codes (K). Confirm against the current Anki source (`rslib`) before implementing.
- **Paywalled research:** I could not open several papers. The Bertsch, Butterfield & Metcalfe, Kornell, de Jong & Perfetti, Ericson and Wery & Diliberto citations come from established literature, not from fetching the papers this session.

---

## 11. Sources

**Quizlet**
- https://help.quizlet.com/hc/en-au/articles/360030841732-Studying-on-Quizlet
- https://help.quizlet.com/hc/articles/360030986971 (Learn options)
- https://help.quizlet.com/hc/articles/360048313652 (grading options)
- https://help.quizlet.com/hc/en-au/articles/25946589648013-Studying-with-Practice-Tests
- https://medium.com/tech-quizlet/selecting-question-formats-to-maximize-the-testing-effect-7917226a2667
- https://www.techlearning.com/how-to/what-is-quizlet-and-how-can-i-teach-with-it
- https://techlovesmyclassroom.blogspot.com/2021/12/quizlet-checkpoint.html
- https://quizgecko.com/es/blog/best-q-chat-alternative (Q-Chat discontinued; page not loadable)
- https://www.heuristi.ca/posts/quizlet-alternatives (pricing, Knowt, Brainscape)

**Anki**
- https://docs.ankiweb.net/editing.html
- https://docs.ankiweb.net/deck-options.html
- https://docs.ankiweb.net/leeches.html
- https://docs.ankiweb.net/importing/text-files.html
- https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm
- https://raw.githubusercontent.com/ankitects/anki/main/rslib/src/import_export/package/meta.rs
- https://raw.githubusercontent.com/ankitects/anki/main/rslib/src/import_export/package/media.rs
- https://github.com/ImGajeed76/ankipack
- https://forums.ankiweb.net/t/awesome-add-ons/54116
- https://github.com/Stvad/CrowdAnki

**FSRS:** https://github.com/open-spaced-repetition/awesome-fsrs

**Mochi**
- https://mochi.cards/docs/import-and-export/mochi-format-reference/
- https://mochi.cards/docs/import-and-export/importing/

**Notes apps**
- https://help.remnote.com/en/articles/6025481-creating-flashcards
- https://github.com/st3v3nmw/obsidian-spaced-repetition

**Brainscape**
- https://brainscape.zendesk.com/hc/en-us/articles/17773783760141-Everything-you-need-to-know-to-study-effectively-in-Brainscape
- https://brainscape.zendesk.com/hc/en-us/articles/30335658039309-Importing-data-into-multiple-fields-on-the-flashcards

**Classroom game platforms**
- https://support.kahoot.com/hc/articles/115002308428 (question types)
- https://support.kahoot.com/hc/articles/115002812547 (spreadsheet import)
- https://help.blooket.com/hc/en-us/articles/31616660563479
- https://designbeep.com/2026/06/09/gimkit/
- https://help.wayground.com/support/solutions/articles/158000411419-question-types-explained
- https://wordwall.net/features
- https://www.commonsense.org/education/reviews/studystack

**Language apps**
- https://duolingo.fandom.com/wiki/Exercise
- https://blog.duolingo.com/ways-to-practice-in-duolingo
- https://lingoly.io/duoling-match-madness/
- https://en.wikipedia.org/wiki/Memrise
- https://memrise.zendesk.com/hc/en-us/articles/29804562432913-Will-Memrise-delete-Community-Courses
- https://www.clozemaster.com/blog/wp-json/wp/v2/posts/7648 (Clozemaster vs Drops)
- https://www.fluentu.com/blog/lingvist-review/
- https://www.tofugu.com/japanese-learning-resources-database/bunpro/
- https://knowledge.wanikani.com/wanikani/srs-stages/

**Map, quiz and mastery**
- https://support.sporcle.com/hc/en-us/articles/33897795822989-Understanding-different-quiz-types-and-formats
- https://seterra.com
- https://support.khanacademy.org/hc/tr/articles/5548760867853

**Medical and certification prep**
- https://Medical.UWorld.com/usmle/features/
- https://residencyadvisor.com/resources/usmle-step1-prep/is-it-better-to-do-timed-or-tutor-mode-for-step-1-question-banks
- https://tutorialsdojo.com/courses/aws-certified-cloud-practitioner-practice-exams/

**Open source**
- https://github.com/quenti-io/quenti
- https://alternativeto.net/software/scholarsome/about/
- https://github.com/LibreLingo/LibreLingo

**Research**
- https://digitalpromise.org/2015/02/07/five-learning-strategies-that-work/ (Dunlosky et al. 2013 ratings)
- https://pubmed.ncbi.nlm.nih.gov/31556629/ (Brunmair & Richter 2019, interleaving)
- https://link.springer.com/article/10.1007/s10648-019-09498-w (Sailer & Homner 2020, gamification)
- https://www.retrievalpractice.org/strategies/2018/multiple-choice (multiple-choice evidence: Little & Bjork; Butler & Roediger)
- https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2017/01/LittleBjorkMC2014.pdf
- https://metatoc.com/papers/29252-retrieval-sometimes-enhances-learning-performance-pressure-reduces-the-benefits-of-retrieval-practice
- https://pubmed.ncbi.nlm.nih.gov/17645161/ (Bertsch et al. 2007, generation effect)
- https://dukespace.lib.duke.edu/items/d6ab09ca-f55c-4efb-9d32-2788bc5838b2 (hypercorrection effect)
- https://www.lrdc.pitt.edu/perfettilab/pubpdfs/de%20Jong%20Language%20Learning.pdf (de Jong & Perfetti, fluency training)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5629233 (Wery & Diliberto 2017, OpenDyslexic)

**Accessibility:** https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html

---

Memory note for the main session: the project memory says the user is preparing for a company-mandated cloud/AI certification (AWS AIP-C01) and learning German, Japanese and Korean. That is why this report weights the AWS-style multi-select exam simulator and the language formats. I did not use any other memory details, and nothing in memory directed extra actions.