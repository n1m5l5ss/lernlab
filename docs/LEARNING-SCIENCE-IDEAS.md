# Future features from learning science

*Research done on November 21, 2026, against LernLab 1.1.1. Nothing here was built when it was written. Since then most of the list has shipped: the [roadmap](ROADMAP.md) says which items are done, with their issue numbers, and which parts are still open.*

This document lists features LernLab could add, based on peer-reviewed research on how people **remember**, **understand** and **keep studying**. It leaves out everything LernLab already has (see the [roadmap](ROADMAP.md) "Done" sections) and everything already planned under "Later". Planned items that the new research supports are listed briefly at the end.

Every idea follows LernLab's rules:

- it works offline, with no account and no paid service;
- any AI help goes only through the optional [MCP assistant](AI-ASSISTANTS.md), and the feature still works without it;
- only real recall attempts move the FSRS schedule, once per card per day, and games and practice never mark a card as known;
- no timers on new cards, and no guilt.

## The main finding

LernLab is already strong on **remembering**. It has spacing (FSRS), retrieval practice, varied formats, feedback, forgiving streaks and no timers on new cards. The biggest gap is **understanding and transfer**, meaning the ability to use knowledge in new situations.

- Retrieval practice does transfer to new questions: d = 0.40 across 122 experiments [Pan & Rickard 2018]. Transfer is strongest when the practice looks like the target task and when feedback explains *why*.
- Fact-only quizzes did **not** improve scores on higher-order questions, but mixed fact and application quizzes improved both kinds [Agarwal 2019].
- Reading a model answer to a "why" card and pressing *Good* invites the *illusion of explanatory depth*. People believe they understand a mechanism until they try to explain it [Rozenblit & Keil 2002].

So atomic flashcards are necessary but not enough. The top ideas below add **explaining, comparing, applying and solving** to the cards and sessions LernLab already has, and use retrieval for those too.

## Priority list

Priority weighs evidence strength × expected impact ÷ effort. Effort is for one developer: **S** is up to a few days, **M** up to two weeks, **L** more. Areas: **U** understanding, **M** memory, **S** self-regulation and motivation.

### Tier 1: strong evidence, small to medium effort

| # | Feature | Area | Evidence (best estimate) | Effort |
|---|---|---|---|---|
| 1 | Question variants per card (recall, apply, analyse) | U, M | Transfer d = 0.40; mixed formats g = 0.80 | M |
| 2 | "Explain it" cards checked against key points | U | Self-explanation g = 0.55 | M |
| 3 | Learn from your own mix-ups | M, U | Comparison d = 0.50; competitive lures | S–M |
| 4 | Missed cards come back until right; new cards need 2–3 spaced recalls | M | Successive relearning, classroom replications | S |
| 5 | Misconception feedback on wrong choices | U | Refutation g = 0.41 (0.28 after bias correction) | S |
| 6 | Guess first before a new topic | M | Prequestions g = 0.54 on the asked items | S |
| 7 | If-then study plan, with the reminder in your own words | S | Implementation intentions d = 0.65 | S |
| 8 | Calibration: confidence vs real recall, and confident misses re-checked | S, M | Delayed-JOL effect; hypercorrection | S |

### Tier 2: good evidence, more effort or fewer subjects

| # | Feature | Area | Evidence | Effort |
|---|---|---|---|---|
| 9 | Example ladder (faded worked examples) | U | Worked examples g = 0.48 | M–L |
| 10 | Prerequisite links: learn the basics first | U | Mastery learning ES = 0.52 | M |
| 11 | Teach-back | U | Teaching g = 0.35 to 0.56 | S–M |
| 12 | Case chains (one scenario, linked questions) | U | Problem-based learning helps skills; practise in the exam's format | M |
| 13 | Translate between representations | U | Multiple representations help when learners translate | M |
| 14 | Discrimination rounds for look-alike categories | M, U | Interleaving g = 0.42 (paintings 0.67), but −0.39 for word lists | S |
| 15 | Card-quality checker and key-term highlight | U | Multimedia principles, median d about 0.7–0.86 in lab studies | S–M |
| 16 | Pattern feedback at the end of a session | S | High-information feedback d = 0.99 | S–M |
| 17 | Weekly goals and a progress card you can share | S | Monitoring progress helps more when it is recorded or shared | S–M |
| 18 | "Learn how to learn": see spacing work on yourself | S | Only personal experience changed beliefs | S–M |
| 19 | Calm mode and rewards that say what they are for | S | Expected rewards lower intrinsic motivation, d ≈ −0.4 | S |
| 20 | Sleep bridge: learn in the evening, check in the morning | M | Sleep group relearned in half the trials | S |

### Tier 3: weaker evidence, niche, or large

| # | Feature | Area | Evidence | Effort |
|---|---|---|---|---|
| 21 | Try first for maths and science problems | U | Productive failure g = 0.36 | S–M |
| 22 | Concept map from memory | U | Building maps g = 0.72, but plain retrieval beat it | L |
| 23 | Sketch pad on cards | M | Drawing effect, mostly one lab | M |
| 24 | Fading mnemonics | M | Keyword mnemonics rated low utility; scaffold only | S |
| 25 | "Say it aloud" on a few cards | M | Production effect works only for a minority of items | S |
| 26 | Cover the whole family of related cards | M | Retrieval-induced forgetting, low risk | S |
| 27 | Study together on one computer | S | Teaching and accountability; needs local profiles | M–L |
| 28 | "Act it out" for action cards | M | Enactment g = 0.79 between subjects, niche | S |
| 29 | Optional quiet minute after new cards | M | Wakeful rest: replication failed, meta d = 0.38 | S |

## The features in detail

### 1. Question variants per card (recall, apply, analyse)

**What:** One card can hold several prompts that share an answer or a concept, for example:

- a definition;
- a scenario ("A patient has X. Which mechanism?");
- a prediction ("What happens if X doubles?");
- the same fact asked in different words.

Sessions rotate the prompts, so learners can't memorise the wording. FSRS still sees **one card** and one grade per day. Mock exams and Progress show a **level** tag on each prompt (recall, apply or analyse). Progress can suggest, never nag: "Most of your practice in this deck is recall. Try the apply questions."

**Evidence:**
- Testing transfers to application and inference questions, d = 0.40, most when the practice matches the test [Pan & Rickard 2018].
- Mixed fact and higher-order quizzes improved both kinds of question; fact-only quizzes did not [Agarwal 2019].
- Repeated testing beat repeated study even on new inference questions [Butler 2010].
- Mixed-format practice tests gave the largest effect, g = 0.80 [Adesope et al. 2017].
- Varied retrieval cues help [Imundo et al. 2020].

**Impact:** High. Understanding gets equal weight while cards stay atomic.

**Fit:** Offline. The MCP assistant could *propose* apply and analyse variants for a card, which the user accepts in AI requests.

**Effort:** M. A data-model migration, the editor, CSV and `.lernpack` columns (an additive field, as `image_alt` was), and planner rotation.

### 2. "Explain it" cards checked against key points

**What:** A card type for "why" and "how" questions. The author writes a model explanation as **2–5 key points**. The learner types or says an explanation, then ticks which key points they covered:

- all points: Good;
- some points: Hard;
- none: Again.

Without every point ticked, the grade is capped at Good, so it is never Easy. Cards tagged `why` or `how` never offer a plain flip: you explain first, then see the answer. An optional before-and-after "How well do you understand this? (1–7)" shows the learner their own gap.

**Evidence:**
- Self-explanation, g = 0.55 across 64 studies [Bisra et al. 2018; Chi et al. 1994].
- Elaborative interrogation ("why is this true?") helps when learners generate the answer [Pressley et al. 1987]. Dunlosky et al. (2013) rate both techniques as *moderate*.
- Trying to explain lowers inflated ratings of understanding [Rozenblit & Keil 2002; Fernbach et al. 2013].
- Learners judge free answers poorly; checking against specific key points is the known fix (Rawson & Dunlosky's idea-unit work, *not fully verified*).

**Impact:** High for science, medicine, law, history and code.

**Fit:** Self-graded offline. The MCP assistant can comment on an explanation if the user asks it to, but it never sets the grade. This replaces the old "explain in your own words, AI-graded" idea in `research.md`.

**Effort:** M.

**Caution:** Don't add self-explanation prompts to every step of a maths worked example. In that setting they made results worse [Barbieri et al. 2023].

### 3. Learn from your own mix-ups

**What:** LernLab already notices when a typed answer matches *another* card, or when the same wrong choice keeps getting picked. It would use those **confusion pairs** three ways:

1. Each card in the pair becomes the preferred wrong choice in the other's multiple-choice questions. Today's wrong choices are picked by kind, category, tags and length.
2. The two cards are placed close together in a session.
3. After repeated mix-ups, LernLab offers a **twin card**: both items side by side, with "What do they share? What is the one key difference?" The answer is checked against the author's or learner's list. The MCP assistant can draft one.

**Evidence:**
- Comparing two cases transfers much better than studying them separately: d = 0.50 [Alfieri et al. 2013; Gentner et al. 2003].
- Wrong choices that are plausible make multiple choice almost as good as recall, and they also teach the wrong choices themselves [Little et al. 2012].
- Feedback removes the risk of learning the wrong choices as true [Butler & Roediger 2008].
- Mixing helps most for things that look alike [Brunmair & Richter 2019].

**Impact:** High. It uses data LernLab already has.

**Effort:** S for the wrong choices and ordering; M for twin cards.

### 4. Missed cards come back until right; new cards need 2–3 spaced recalls

**What:** Two changes to *successive relearning*, which means practising until correct within a session and repeating that over several sessions:

- **Missed cards:** today a missed card comes back once, 3 exercises later (`RETRY_GAP`). Instead, it would come back after 4–6 other exercises **until it is recalled once**, then leave the queue.
- **New cards:** a new card counts as introduced only after 2–3 correct recalls spread across the session.

Once a card has met its criterion, it isn't shown again that session, so no drilling. Only the first attempt of the day changes FSRS, as now.

**Evidence:**
- In classrooms, successive relearning raised exam scores by about 10 points [Rawson et al. 2013; Janes et al. 2020].
- About 80% recall a week after three weekly sessions [Rawson et al. 2018, via Higham et al. 2023].
- Later sessions take a third of the time [Dunlosky, Greve & Badali 2023].
- Extra correct recalls in one session add little [Rohrer et al. 2005; Karpicke & Roediger 2008].

**Impact:** Medium to high, at very low cost.

**Effort:** S. A planner and session-runner change, plus tests.

### 5. Misconception feedback on wrong choices

**What:** The author can attach a short correction to any wrong choice of a multiple-choice question: "Many people think X. In fact Y, because Z." Picking that choice shows the correction instead of a plain "wrong". An optional **misconception card** states the myth, asks you to reject it, then asks why.

**Evidence:** Refutation texts help, g = 0.41 across 44 comparisons [Schroeder & Kucera 2022]. After correcting for publication bias the estimate is 0.28, so expect a modest effect.

**Impact:** Medium, and cheap.

**Fit:** Offline. The MCP assistant can propose corrections.

**Effort:** S. One field per wrong choice.

### 6. Guess first before a new topic

**What:** When you start a new tag or chapter, a short optional round shows 5–8 of its questions *before* you meet the cards. You guess, then see the answer. It has no timer and is practice only. It says clearly that wrong guesses are expected and useful. It is offered only where a guess is possible, such as concepts, facts and maths, not arbitrary pairs like foreign words.

**Evidence:**
- Prequestions help on the questions asked, g = 0.54. They barely help on other material, g = 0.04 [St. Hilaire et al. 2023].
- Failed attempts help when feedback follows [Kornell, Hays & Bjork 2009; Pan & Carpenter 2023].

**Impact:** Medium. **Effort:** S.

### 7. If-then study plan, with the reminder in your own words

**What:** During setup and in Settings, you can write a plan in the form "After I *finish dinner*, I'll study for *5 minutes*". You can also write an optional backup plan: "If I'm tired, I'll do one 5-minute session". The daily reminder then shows **your sentence**. LernLab can suggest the hour you usually study, from local data only. Next to the streak, an optional note explains that habits take weeks to form and **one missed day barely matters**.

**Evidence:**
- If-then plans improve goal attainment, d = 0.65 across 94 studies [Gollwitzer & Sheeran 2006].
- Habits took a median of 66 days to form, and missing one day "did not materially affect" it [Lally et al. 2010].

**Impact:** Medium to high, because it keeps people studying. **Effort:** S.

### 8. Calibration: confidence vs real recall, and confident misses re-checked

This builds on the planned 1–5 confidence rating.

**What:**
- **Calibration chart on Progress:** "Cards you rated 5 were right 93% of the time next review; cards you rated 4, 61%."
- **Tomorrow check:** at the end of a session, today's new cards show the question only, and you answer "Will you know this tomorrow?" (yes / unsure / no). Next session shows how accurate you were, and the "unsure" cards come first in the warm-up.
- **Confident misses:** a miss rated 4–5 is flagged as a surprise, comes back once later in the session as practice, and gets a kind line: "Confident mistakes are the easiest to fix."

None of this changes FSRS.

**Evidence:**
- Judgements made after a delay, from the question alone, predict recall far better than immediate ones [Nelson & Dunlosky 1991; Rhodes & Tauber 2011].
- Overconfidence makes people stop studying too early [Dunlosky & Rawson 2012].
- High-confidence errors are corrected best after feedback [Butterfield & Metcalfe 2001]. They can come back if the correction fades, hence the re-check [Butler, Fazio & Marsh 2011].

**Impact:** Medium. **Effort:** S once the confidence rating exists.

### 9. Example ladder (faded worked examples)

**What:** A card type for maths, physics, chemistry, code and accounting. The author writes one solved problem in steps. LernLab turns it into a ladder:

1. study the full example;
2. fill in the last step;
3. fill in the last two steps;
4. continue until you solve the whole problem.

Each step is checked with the existing typed, numeric and LaTeX checks. The card's mastery level picks the rung. Optional sibling problems with new numbers stop learners recalling one answer. Only whole-problem attempts change FSRS; the other rungs are practice.

**Evidence:**
- Worked examples help in maths, g = 0.48 across 55 studies [Barbieri et al. 2023].
- Fading the steps eases the move to solving alone [Renkl & Atkinson 2003].
- The benefit fades for experts, so performance drives the fading [Kalyuga et al. 2003].

**Impact:** High for STEM. **Effort:** M–L.

### 10. Prerequisite links: learn the basics first

**What:** A card or tag can say that it `requires` another. New cards are *ordered* after their prerequisites reach "recalled". This is a soft ordering: nothing is ever locked, and you can always skip. When a card keeps lapsing, LernLab checks whether its prerequisites are weak and reviews those first. Authors can mark **key-term** cards that are introduced before the cards that use them (*pre-training*).

**Evidence:**
- Mastery learning, ES = 0.52 across 108 evaluations [Kulik et al. 1990]. The famous "2 sigma" result is not reproduced at that size.
- Pre-training on key terms, median d = 0.78 in lab studies [Mayer 2023].

**Impact:** Medium to high for structured subjects. **Effort:** M, including an additive field in `.lernpack` and CSV.

### 11. Teach-back

**What:** For a tag you have mastered, LernLab offers: "Explain this to a beginner in 60 seconds." You record your voice, which already works, or type. Then you play it back next to the tag's key points and tick the ones you missed. Missed points become cards for today. With the MCP plugin on, the assistant can play a curious student and ask follow-up questions in the chat. It never changes the schedule.

**Evidence:** Preparing to teach, g = 0.35; teaching after preparing, g = 0.56; interactive teaching works best [Kobayashi 2019; Fiorella & Mayer 2016]. "Feynman technique" is a popular name for this, but no study tests it under that name.

**Impact:** Medium. **Effort:** S–M.

### 12. Case chains (one scenario, linked questions)

**What:** A short case, such as a patient, a legal fact pattern, an AWS architecture or a historical situation, followed by 2–4 linked questions (diagnose, explain, decide). Each question has a model answer and is its own reviewable item. Mock exams can draw whole case chains.

**Evidence:**
- Problem-based learning has a robust positive effect on skills [Dochy et al. 2003].
- Practising in the exam's format helps, as in transfer-appropriate processing (see `research.md`).

**Impact:** High for medicine, law and certification exams. **Effort:** M.

### 13. Translate between representations

**What:** Cards that ask you to move between forms of the same idea:

- graph to equation;
- formula to the matching diagram;
- example to the concept's name;
- word to a picture of it.

They are checked offline as multiple choice, matching or numeric answers. A card can link its representations together.

**Evidence:** Several representations help only when learners practise translating between them; otherwise they add load [Ainsworth 2006].

**Impact:** Medium for STEM. **Effort:** M.

### 14. Discrimination rounds for look-alike categories

**What:** For decks whose tags are *categories*, such as art styles, bird species, diagnoses or maths problem types, a practice round shows an item and asks "Which one is this?", mixing the most confusable tags. For **vocabulary**, the planner does the opposite: new words come in themed groups and are mixed only later, in review.

**Evidence:** Interleaving helps for similar categories, g = 0.42 overall and 0.67 for paintings. It **hurts** for word lists, g = −0.39 [Brunmair & Richter 2019].

**Impact:** Medium. **Effort:** S. The category sprint already does part of this.

### 15. Card-quality checker and key-term highlight

**What:** Local rules in the card editor and in the import preview:

- an answer longer than about 40 words: "Split into two cards?" (segmenting);
- an image marked as decorative: "Does it help the answer?" (coherence);
- an abstract card with no picture: "A diagram could help" (dual coding).

Authors can mark the key part of an answer, such as `==term==`, and it is highlighted when the answer shows (signalling). Showing the same text as the audio is **not** flagged in language decks, where it helps.

**Evidence:**
- Mayer's principles, median d in lab studies: coherence 0.86, signalling 0.70, segmenting 0.67 [Mayer 2023]. Expect less outside the lab.
- Interesting but irrelevant extras hurt learning [Sundararajan & Adesope 2020].
- Words plus a relevant picture help [Clark & Paivio 1991].

**Impact:** Medium. Better cards help every other feature. **Effort:** S–M.

### 16. Pattern feedback at the end of a session

**What:** The summary says *how* you studied, not only your score. For example:

- "3 misses were mix-ups between two similar cards";
- "Most lapses are cards with no example";
- "You used hints on 40% of Geography."

Each line links to a fix: a twin card, adding an example, or practising those cards. The wording praises effort and strategy ("Nice recall after 9 days"), never ability.

**Evidence:**
- Feedback works overall, d = 0.48. High-information feedback reaches d = 0.99, and feedback about the person helps least [Wisniewski et al. 2020; Hattie & Timperley 2007].

**Impact:** Medium. **Effort:** S–M.

### 17. Weekly goals and a progress card you can share

**What:**
- **Weekly goals:** the exam date and goal turn into a small goal for this week, for example "120 new cards, 5 sessions". It adjusts itself, without blame.
- **Progress card:** a printable or exportable summary as PNG or PDF, made locally, that you can show a teacher, parent or friend.
- **Optional buddy file:** a small file a friend imports to see your weekly progress next to theirs. No server is involved.

**Evidence:**
- Monitoring progress raises goal attainment, more so when progress is **recorded or reported to others** [Harkin et al. 2016].
- Specific goals beat "do your best" [Locke & Latham 2002].

**Impact:** Medium. **Effort:** S for goals and the progress card, M for the buddy file.

### 18. "Learn how to learn": see spacing work on yourself

**What:**
- **A 10-minute experiment in practice mode:** 20 made-up items, half crammed and half spaced. You predict which half you'll remember, LernLab tests both the next day, and shows the result.
- **A gallery deck about studying:** spacing, recall, mixing and the "feels easy" trap, studied with LernLab itself.
- **A card on Progress with your own numbers:** your retention on cards reviewed when due versus crammed cards.

**Evidence:**
- Most people believe cramming works better even when spacing beat it for them [Kornell & Bjork 2008; Kornell 2009].
- Explaining didn't change those beliefs; personal experience did [Yan, Bjork & Bjork 2016].
- Strategy training helps, though the evidence is weaker [Biwer et al. 2022].

**Impact:** Medium, because it helps people trust spacing. **Effort:** S–M, mostly content.

### 19. Calm mode and rewards that say what they are for

**What:**
- **Calm mode** in Settings hides XP, levels, combos and celebrations, and keeps the progress information.
- **Rewards name the reason:** "+40: 3 hard cards recalled after a slip", not just "+40 XP". Surprise badges are fine.
- **Choice:** once per session, you can swap a block for another format.
- **No global leaderboards.**

**Evidence:**
- Gamification helps learning on average, g ≈ 0.5, but leaderboards caused anxiety and jealousy [Sailer & Homner 2020; Bai et al. 2020].
- Expected tangible rewards lower intrinsic motivation (d ≈ −0.4), while informative positive feedback raises it [Deci, Koestner & Ryan 1999].
- In one class, mandatory badges and a leaderboard lowered motivation and exam scores [Hanus & Fox 2015].

**Impact:** Medium, for people who dislike game elements. **Effort:** S.

### 20. Sleep bridge: learn in the evening, check in the morning

**What:** An optional study rhythm. New cards are suggested in an evening session, and the reminder offers a short morning check of last night's new and missed cards. The morning is a new study day, so its grade is a normal FSRS review. Near an exam date, a gentle tip says that sleep is part of studying.

**Evidence:**
- People who slept between learning and relearning needed about half the trials, and remembered more a week and 6 months later [Mazza et al. 2016].
- Sleep helps memory for word pairs, and time awake hurts it [Payne et al. 2012; Gais, Lucas & Born 2006].

**Impact:** Medium. **Effort:** S.

### Tier 3 in brief

- **21. Try first for maths and science.** At the start of a new unit, try a problem *before* the teaching cards, with no grade and no timer, then compare with the worked solution. Productive failure gives g = 0.36, but it reverses for young children and general skills [Sinha & Kapur 2021]. Offer it only in decks marked maths or science.
- **22. Concept map from memory.** Place a tag's terms on a canvas and draw labelled links from memory, then compare with the author's map. Building maps gives g = 0.72 versus 0.43 for studying them [Schroeder et al. 2018], but plain retrieval practice beat concept mapping [Karpicke & Blunt 2011]. Large effort.
- **23. Sketch pad on cards.** Draw the meaning when you first meet a card; the sketch becomes a picture cue you made yourself. The drawing effect is real but comes mostly from one lab [Wammes et al. 2016; Fernandes et al. 2018].
- **24. Fading mnemonics.** Show your mnemonic only after a miss or a hint, and stop showing it after 2 correct answers in a row. Keyword mnemonics are rated low utility and fade over time [Dunlosky et al. 2013; Wang et al. 1992], so use them as support, not the main method.
- **25. "Say it aloud" on a few cards.** Ask for the answer out loud on starred or recently missed flip cards. It helps only when a *minority* of items are spoken, so it is not a mode for every card [MacLeod & Bodner 2017].
- **26. Cover the whole family of related cards.** When a session practises some cards from a tight group (same tag and prompt pattern), include the rest within a day or two. This limits retrieval-induced forgetting [Murayama et al. 2014]. Low risk today.
- **27. Study together on one computer.** Two local profiles take turns, and each recall counts only for its own profile. This needs local profiles, which LernLab doesn't have.
- **28. "Act it out" for action cards.** A prompt for verbs and procedures. Enactment gives g = 0.79 between subjects, mostly with action phrases [Roberts, MacLeod & Fernandes 2022].
- **29. Optional quiet minute after new cards.** One minute of eyes-closed rest. A preregistered replication found nothing (d = 0.09), though the meta-analysis says d = 0.38 [Humiston et al. 2019]. If built, label it "may help".

## Already planned: new supporting evidence

- **Confidence rating (1–5):** makes features 8 and 3 possible [Butterfield & Metcalfe 2001].
- **Leech handling with a mnemonic:** use the mnemonic as support and fade it (feature 24).
- **Cloze with a word bank, then typed:** recall beats recognition, g = 0.61 versus 0.29 as the first test [Rowland 2014].
- **Parsons problems and code ordering:** they fit the example ladder (feature 9).
- **Exam-readiness view:** add the recall, apply and analyse balance from feature 1, and the sleep tip from feature 20.

## What not to build

| Idea | Why not |
|---|---|
| Mixing new vocabulary from the start | Interleaving word lists hurt, g = −0.39 [Brunmair & Richter 2019] |
| Multiple choice where you retry until right | No gain [Butler, Karpicke & Roediger 2007] |
| Drilling a card many times in one session | Benefit gone within weeks [Rohrer et al. 2005] |
| Tweaking FSRS toward expanding gaps | Expanding vs equal gaps: g = 0.03 [Latimier et al. 2021]. The size of the gap matters, and FSRS handles that |
| Growth-mindset lessons | d = 0.08 [Sisk et al. 2018]; at most, growth-minded wording |
| Writing about worries before an exam | Failed replications [Myers, Davis & Chan 2021] |
| Leaderboards or mandatory badges | Anxiety and lower motivation [Hanus & Fox 2015; Bai et al. 2020] |
| Decorative pictures or mascots on cards | Irrelevant extras hurt learning [Sundararajan & Adesope 2020] |
| Studying concept maps or summaries without testing | Retrieval beat concept maps; summarising is low utility without training [Karpicke & Blunt 2011; Dunlosky et al. 2013] |
| Saying every answer aloud | The production effect needs contrast [MacLeod & Bodner 2017] |
| Claiming breaks or exercise improve recall | Micro-breaks had no reliable effect on cognitive tasks; exercise before study d = 0.23 with publication bias [Albulescu et al. 2022; Qazi et al. 2024] |
| XP for longer explanations | Rewards padding; reward key points instead |
| Feeding confidence ratings into FSRS | Immediate confidence is inflated by fluency [Rhodes & Tauber 2011] |

## Sources

Every source was found and checked by web search on November 21, 2026. Effect sizes were read from the paper or its abstract, except where marked *(not checked)*: there only the paper's existence was confirmed.

- Adesope, O. O., Trevisan, D. A., & Sundararajan, N. (2017). Rethinking the use of tests: A meta-analysis of practice testing. *Review of Educational Research, 87*(3), 659–701. https://doi.org/10.3102/0034654316689306
- Agarwal, P. K. (2019). Retrieval practice & Bloom's taxonomy: Do students need fact knowledge before higher order learning? *Journal of Educational Psychology, 111*(2), 189–209. https://doi.org/10.1037/edu0000282
- Ainsworth, S. (2006). DeFT: A conceptual framework for considering learning with multiple representations. *Learning and Instruction, 16*(3), 183–198. https://doi.org/10.1016/j.learninstruc.2006.03.001
- Albulescu, P., et al. (2022). "Give me a break!" A systematic review and meta-analysis on the efficacy of micro-breaks. *PLoS ONE, 17*(8), e0272460. https://doi.org/10.1371/journal.pone.0272460
- Alfieri, L., Nokes-Malach, T. J., & Schunn, C. D. (2013). Learning through case comparisons: A meta-analytic review. *Educational Psychologist, 48*(2), 87–113. https://doi.org/10.1080/00461520.2013.775712
- Bai, S., Hew, K. F., & Huang, B. (2020). Does gamification improve student learning outcome? *Educational Research Review, 30*, 100322. https://doi.org/10.1016/j.edurev.2020.100322
- Barbieri, C. A., Miller-Cotto, D., Clerjuste, S. N., & Chawla, K. (2023). A meta-analysis of the worked examples effect on mathematics performance. *Educational Psychology Review, 35*, 11. https://doi.org/10.1007/s10648-023-09745-1
- Bisra, K., Liu, Q., Nesbit, J. C., Salimi, F., & Winne, P. H. (2018). Inducing self-explanation: A meta-analysis. *Educational Psychology Review, 30*, 703–725. https://doi.org/10.1007/s10648-018-9434-x
- Biwer, F., de Bruin, A., & Persky, A. (2023). Study smart: Impact of a learning strategy training on students' study behavior and academic performance. *Advances in Health Sciences Education, 28*, 147–167. https://doi.org/10.1007/s10459-022-10149-z
- Brunmair, M., & Richter, T. (2019). Similarity matters: A meta-analysis of interleaved learning and its moderators. *Psychological Bulletin, 145*(11), 1029–1052. https://doi.org/10.1037/bul0000209
- Butler, A. C. (2010). Repeated testing produces superior transfer of learning relative to repeated studying. *JEP: Learning, Memory, and Cognition, 36*(5), 1118–1133. https://doi.org/10.1037/a0019902
- Butler, A. C., Fazio, L. K., & Marsh, E. J. (2011). The hypercorrection effect persists over a week, but high-confidence errors return. *Psychonomic Bulletin & Review, 18*(6), 1238–1244. https://doi.org/10.3758/s13423-011-0173-y
- Butler, A. C., Karpicke, J. D., & Roediger, H. L. (2007). The effect of type and timing of feedback on learning from multiple-choice tests. *JEP: Applied, 13*(4), 273–281. https://doi.org/10.1037/1076-898X.13.4.273
- Butler, A. C., & Roediger, H. L. (2008). Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing. *Memory & Cognition, 36*(3), 604–616. https://pubmed.ncbi.nlm.nih.gov/18491500/
- Butterfield, B., & Metcalfe, J. (2001). Errors committed with high confidence are hypercorrected. *JEP: Learning, Memory, and Cognition, 27*(6), 1491–1494. https://doi.org/10.1037/0278-7393.27.6.1491
- Chi, M. T. H., de Leeuw, N., Chiu, M.-H., & LaVancher, C. (1994). Eliciting self-explanations improves understanding. *Cognitive Science, 18*(3), 439–477. https://doi.org/10.1016/0364-0213(94)90016-7
- Clark, J. M., & Paivio, A. (1991). Dual coding theory and education. *Educational Psychology Review, 3*, 149–210. https://doi.org/10.1007/BF01320076
- Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin, 125*(6), 627–668. https://doi.org/10.1037/0033-2909.125.6.627
- Dochy, F., Segers, M., Van den Bossche, P., & Gijbels, D. (2003). Effects of problem-based learning: A meta-analysis. *Learning and Instruction, 13*(5), 533–568. https://doi.org/10.1016/S0959-4752(02)00025-7
- Dunlosky, J., Greve, A., & Badali, S. (2023). Successive relearning: An introduction and guide for educators. In C. Overson et al. (Eds.), *In Their Own Words* (pp. 83–93). APA Division 2. https://www.unh.edu/teaching-learning-resource-hub/sites/default/files/media/2023-06/itow-successive-relearning-dunlosky-greve-badali-wissman-rawson.pdf
- Dunlosky, J., & Rawson, K. A. (2012). Overconfidence produces underachievement. *Learning and Instruction, 22*(4), 271–280. *(not checked)*
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest, 14*(1), 4–58. https://doi.org/10.1177/1529100612453266
- Fernandes, M. A., Wammes, J. D., & Meade, M. E. (2018). The surprisingly powerful influence of drawing on memory. *Current Directions in Psychological Science, 27*(5), 302–308. https://doi.org/10.1177/0963721418755385
- Fernbach, P. M., Rogers, T., Fox, C. R., & Sloman, S. A. (2013). Political extremism is supported by an illusion of understanding. *Psychological Science, 24*(6), 939–946. https://doi.org/10.1177/0956797612464058
- Fiorella, L., & Mayer, R. E. (2016). Eight ways to promote generative learning. *Educational Psychology Review, 28*, 717–741. https://doi.org/10.1007/s10648-015-9348-9
- Gais, S., Lucas, B., & Born, J. (2006). Sleep after learning aids memory recall. *Learning & Memory, 13*(3), 259–262. *(not checked)*
- Gentner, D., Loewenstein, J., & Thompson, L. (2003). Learning and transfer: A general role for analogical encoding. *Journal of Educational Psychology, 95*(2), 393–408. https://doi.org/10.1037/0022-0663.95.2.393
- Gollwitzer, P. M., & Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes. *Advances in Experimental Social Psychology, 38*, 69–119. https://doi.org/10.1016/S0065-2601(06)38002-1
- Hanus, M. D., & Fox, J. (2015). Assessing the effects of gamification in the classroom. *Computers & Education, 80*, 152–161. https://doi.org/10.1016/j.compedu.2014.08.019
- Harkin, B., et al. (2016). Does monitoring goal progress promote goal attainment? A meta-analysis of the experimental evidence. *Psychological Bulletin, 142*(2), 198–229. *(effect size not checked)*
- Hattie, J., & Timperley, H. (2007). The power of feedback. *Review of Educational Research, 77*(1), 81–112. https://doi.org/10.3102/003465430298487
- Higham, P. A., et al. (2023). Spaced retrieval practice: Can restudying trump retrieval? *Educational Psychology Review, 35*, 98. https://doi.org/10.1007/s10648-023-09809-2
- Humiston, G. B., Tucker, M. A., Summer, T., & Wamsley, E. J. (2019). Resting states and memory consolidation: A preregistered replication and meta-analysis. *Scientific Reports, 9*, 19345. https://doi.org/10.1038/s41598-019-56033-6
- Imundo, M. N., Pan, S. C., Bjork, E. L., & Bjork, R. A. (2020). Where and how to learn: The interactive benefits of contextual variation, restudying, and retrieval practice for learning. *Quarterly Journal of Experimental Psychology*. https://sites.lifesci.ucla.edu/psych-bjorklab/wp-content/uploads/sites/13/2020/12/ImundoEtAl.Context-Retrieval-Submission-Final-Version-11.30.2020.pdf
- Kalyuga, S., Ayres, P., Chandler, P., & Sweller, J. (2003). The expertise reversal effect. *Educational Psychologist, 38*(1), 23–31. https://ro.uow.edu.au/edupapers/136
- Karpicke, J. D., & Blunt, J. R. (2011). Retrieval practice produces more learning than elaborative studying with concept mapping. *Science, 331*(6018), 772–775. https://doi.org/10.1126/science.1199327
- Karpicke, J. D., & Roediger, H. L. (2008). The critical importance of retrieval for learning. *Science, 319*, 966–968. https://pubmed.ncbi.nlm.nih.gov/18276894/
- Kobayashi, K. (2019). Learning by preparing-to-teach and teaching: A meta-analysis. *Japanese Psychological Research*. https://doi.org/10.1111/jpr.12221
- Kornell, N. (2009). Optimising learning using flashcards: Spacing is more effective than cramming. *Applied Cognitive Psychology, 23*, 1297–1317. https://doi.org/10.1002/acp.1537
- Kornell, N., & Bjork, R. A. (2008). Learning concepts and categories: Is spacing the "enemy of induction"? *Psychological Science, 19*(6), 585–592. https://doi.org/10.1111/j.1467-9280.2008.02127.x
- Kornell, N., Hays, M. J., & Bjork, R. A. (2009). Unsuccessful retrieval attempts enhance subsequent learning. *JEP: Learning, Memory, and Cognition, 35*(4), 989–998. https://pubmed.ncbi.nlm.nih.gov/19586265/
- Kulik, C.-L. C., Kulik, J. A., & Bangert-Drowns, R. L. (1990). Effectiveness of mastery learning programs: A meta-analysis. *Review of Educational Research, 60*(2), 265–299.
- Lally, P., van Jaarsveld, C. H. M., Potts, H. W. W., & Wardle, J. (2010). How are habits formed: Modelling habit formation in the real world. *European Journal of Social Psychology, 40*, 998–1009. https://doi.org/10.1002/ejsp.674
- Latimier, A., Peyre, H., & Ramus, F. (2021). A meta-analytic review of the benefit of spacing out retrieval practice episodes on retention. *Educational Psychology Review, 33*, 959–987. https://doi.org/10.1007/s10648-020-09572-8
- Little, J. L., Bjork, E. L., Bjork, R. A., & Angello, G. (2012). Multiple-choice tests exonerated, at least of some charges. *Psychological Science, 23*(11), 1337–1344. https://doi.org/10.1177/0956797612443370
- Locke, E. A., & Latham, G. P. (2002). Building a practically useful theory of goal setting and task motivation. *American Psychologist, 57*(9), 705–717.
- MacLeod, C. M., & Bodner, G. E. (2017). The production effect in memory. *Current Directions in Psychological Science, 26*(4), 390–395. https://doi.org/10.1177/0963721417691356
- Mayer, R. E. (2023). Research-based principles for designing multimedia instruction. In C. Overson et al. (Eds.), *In Their Own Words* (pp. 143–157). APA Division 2.
- Mazza, S., et al. (2016). Relearn faster and retain longer: Along with practice, sleep makes perfect. *Psychological Science, 27*(10), 1321–1330. https://doi.org/10.1177/0956797616659930
- Murayama, K., Miyatsu, T., Buchli, D., & Storm, B. C. (2014). Forgetting as a consequence of retrieval: A meta-analytic review of retrieval-induced forgetting. *Psychological Bulletin, 140*(5), 1383–1409. https://centaur.reading.ac.uk/37052/
- Myers, S. J., Davis, S. D., & Chan, J. C. K. (2021). Does expressive writing or an instructional intervention reduce the impacts of test anxiety in a college classroom? *Cognitive Research: Principles and Implications, 6*, 44. https://doi.org/10.1186/s41235-021-00309-x
- Nelson, T. O., & Dunlosky, J. (1991). When people's judgments of learning (JOLs) are extremely accurate at predicting subsequent recall: The "delayed-JOL effect". *Psychological Science, 2*(4), 267–271. https://doi.org/10.1111/j.1467-9280.1991.tb00147.x
- Pan, S. C., & Carpenter, S. K. (2023). Prequestioning and pretesting effects: A review of empirical research, theoretical perspectives, and implications for educational practice. *Educational Psychology Review, 35*, 97. https://doi.org/10.1007/s10648-023-09814-5
- Pan, S. C., & Rickard, T. C. (2018). Transfer of test-enhanced learning: Meta-analytic review and synthesis. *Psychological Bulletin, 144*(7), 710–756. https://doi.org/10.1037/bul0000151
- Payne, J. D., et al. (2012). Memory for semantically related and unrelated declarative information: The benefit of sleep, the cost of wake. *PLoS ONE, 7*(3), e33079. https://doi.org/10.1371/journal.pone.0033079
- Pressley, M., McDaniel, M. A., Turnure, J. E., Wood, E., & Ahmad, M. (1987). Generation and precision of elaboration: Effects on intentional and incidental learning. *JEP: Learning, Memory, and Cognition, 13*(2), 291–300. https://doi.org/10.1037/0278-7393.13.2.291
- Qazi, A. S., et al. (2024). Acute exercise and memory: A systematic review and meta-analysis. *Frontiers in Cognition, 3*, 1367569. https://doi.org/10.3389/fcogn.2024.1367569
- Rawson, K. A., Dunlosky, J., & Sciartelli, S. M. (2013). The power of successive relearning: Improving performance on course exams and long-term retention. *Educational Psychology Review, 25*, 523–548. https://doi.org/10.1007/s10648-013-9240-4
- Renkl, A., & Atkinson, R. K. (2003). Structuring the transition from example study to problem solving in cognitive skill acquisition: A cognitive load perspective. *Educational Psychologist, 38*(1), 15–22.
- Rhodes, M. G., & Tauber, S. K. (2011). The influence of delaying judgments of learning on metacognitive accuracy: A meta-analytic review. *Psychological Bulletin, 137*(1), 131–148. https://doi.org/10.1037/a0021705
- Roberts, B. R. T., MacLeod, C. M., & Fernandes, M. A. (2022). The enactment effect: A systematic review and meta-analysis of behavioral, neuroimaging, and patient studies. *Psychological Bulletin, 148*(5–6), 397–434. https://doi.org/10.1037/bul0000360
- Rohrer, D., Taylor, K., Pashler, H., Wixted, J. T., & Cepeda, N. J. (2005). The effect of overlearning on long-term retention. *Applied Cognitive Psychology, 19*, 361–374. https://doi.org/10.1002/acp.1083
- Rowland, C. A. (2014). The effect of testing versus restudy on retention: A meta-analytic review of the testing effect. *Psychological Bulletin, 140*(6), 1432–1463. https://doi.org/10.1037/a0037559
- Rozenblit, L., & Keil, F. (2002). The misunderstood limits of folk science: An illusion of explanatory depth. *Cognitive Science, 26*(5), 521–562. https://doi.org/10.1207/s15516709cog2605_1
- Sailer, M., & Homner, L. (2020). The gamification of learning: A meta-analysis. *Educational Psychology Review, 32*, 77–112. https://doi.org/10.1007/s10648-019-09498-w
- Schroeder, N. L., & Kucera, A. C. (2022). Refutation text facilitates learning: A meta-analysis of between-subjects experiments. *Educational Psychology Review, 34*, 957–987. https://doi.org/10.1007/s10648-021-09656-z
- Schroeder, N. L., Nesbit, J. C., Anguiano, C. J., & Adesope, O. O. (2018). Studying and constructing concept maps: A meta-analysis. *Educational Psychology Review, 30*, 431–455. https://doi.org/10.1007/s10648-017-9403-9
- Sinha, T., & Kapur, M. (2021). When problem solving followed by instruction works: Evidence for productive failure. *Review of Educational Research, 91*(5), 761–798. https://doi.org/10.3102/00346543211019105
- Sisk, V. F., Burgoyne, A. P., Sun, J., Butler, J. L., & Macnamara, B. N. (2018). To what extent and under which circumstances are growth mind-sets important to academic achievement? *Psychological Science, 29*(4), 549–571. https://doi.org/10.1177/0956797617739704
- St. Hilaire, K. J., Chan, J. C. K., & Ahn, D. (2023). Guessing as a learning intervention: A meta-analytic review of the prequestion effect. *Psychonomic Bulletin & Review*. https://doi.org/10.3758/s13423-023-02353-8
- Sundararajan, N., & Adesope, O. (2020). Keep it coherent: A meta-analysis of the seductive details effect. *Educational Psychology Review, 32*(3), 707–734. https://doi.org/10.1007/s10648-020-09522-4
- Wammes, J. D., Meade, M. E., & Fernandes, M. A. (2016). The drawing effect: Evidence for reliable and robust memory benefits in free recall. *Quarterly Journal of Experimental Psychology, 69*(9), 1752–1776. https://doi.org/10.1080/17470218.2015.1094494
- Wang, A. Y., Thomas, M. H., & Ouellette, J. A. (1992). Keyword mnemonic and retention of second-language vocabulary words. *Journal of Educational Psychology, 84*(4), 520–528. https://stars.library.ucf.edu/facultybib1990/601
- Wisniewski, B., Zierer, K., & Hattie, J. (2020). The power of feedback revisited: A meta-analysis of educational feedback research. *Frontiers in Psychology, 10*, 3087. https://doi.org/10.3389/fpsyg.2019.03087
- Yan, V. X., Bjork, E. L., & Bjork, R. A. (2016). On the difficulty of mending metacognitive illusions: A priori theories, fluency effects, and misattributions of the interleaving benefit. *Journal of Experimental Psychology: General, 145*(7), 918–933. https://doi.org/10.1037/xge0000177
