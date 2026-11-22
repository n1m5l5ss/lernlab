# User guide

This guide shows how to use LernLab: get cards in, study, follow your progress and keep your data safe. Names in **bold** are the words you see on screen.

This guide describes version 1.1.1 of the app. <!-- x-release-please-version -->

LernLab has five places, in the sidebar on the left: **Home**, **Decks**, **Cards**, **Progress** and **Settings**.

- [First start](#first-start)
- [Get cards in](#get-cards-in)
- [Study](#study)
- [Edit cards](#edit-cards)
- [Follow your progress](#follow-your-progress)
- [Back up and move your data](#back-up-and-move-your-data)
- [Settings](#settings)
- [Keyboard](#keyboard)

## First start

The first time you open LernLab, it asks what you would like to do:

- **Learn a language** adds a small German starter deck.
- **Study a subject** adds a small biology deck.
- **I have my own cards** takes you to the import.

Pick one and press **Continue**. **Try a 2-minute sample first** adds the sample deck and starts a short session right away. **Skip for now** opens the app with no decks. You can import the same sample decks later from the `examples/` folder.

Below the choices, **Plan when you'll study (optional)** lets you make a study plan straight away (see [Study plan](#study-plan)). You can also leave it empty and make one later in Settings.

### Study plan

People who decide when they will study are more likely to do it. Tie studying to something you already do every day:

- **After I…**: what you do just before, for example *finish dinner*.
- **I'll study for**: 5, 10 or 20 minutes.
- **Backup plan: if…** (optional): for days when the plan does not fit, for example *I'm tired*. Then one 5-minute session is enough.

LernLab shows your plan as a sentence: "After I finish dinner, I'll study for 5 minutes. If I'm tired, I'll do one 5-minute session." When the daily reminder is on (desktop app), it shows this sentence instead of its usual lines. What you type stays plain text on this computer, up to 80 characters per field. To remove the plan, empty **After I…**.

Once you have studied a few times, Settings → **Study plan** can tell you the hour you usually study, worked out from your own sessions on this computer. In the desktop app, **Remind me then** sets the daily reminder to that time.

## Get cards in

Go to **Decks** and press **Import**, or drop a file on the dashed box on the Decks screen. In the desktop app you can also use **File → Import deck…** (`Ctrl+O`, or `Cmd+O` on a Mac), or open a `.lernpack` file from your file manager.

The import panel has three tabs.

### File

Drop a file or press **Choose file**. LernLab reads:

- `.lernpack`: LernLab's own deck file, with pictures and sound inside;
- Anki `.apkg` and `.colpkg`;
- CSV, TSV and TXT spreadsheets;
- JSON;
- a `.zip` with a CSV and its pictures, audio or video.

Before anything is saved, you see the first cards and how many were found. If LernLab can't tell what each column holds, it asks you: choose **Front**, **Back** or another field for each column, or **Ignore this column**. Under **Import into**, pick an existing deck or **A new deck**. Then press **Import**.

An Anki `.apkg` with past reviews shows **Keep my Anki progress**. Leave it ticked and cards you already know in Anki come up when they are due, instead of starting from zero.

You can leave **Deck name** empty: the name comes from the file. Set **Language** for a language deck. Language decks get listening, speaking and sentence rounds.

### Paste text

Paste one card per line, for example a list copied from Quizlet or a document. Choose what separates the term from the definition (**Tab**, **Comma**, **Dash**, **Colon**, **Semicolon** or **Pipe**) and what separates the cards.

### From Anki

With Anki open and the AnkiConnect add-on installed, LernLab lists your Anki decks. Tick the ones you want and import them. A ticked deck brings its subdecks along. If LernLab can't reach Anki, the panel shows the steps to fix it. No add-on? Export the deck from Anki as `.apkg` and use the **File** tab.

### From the deck gallery

On the Decks screen, choose **Deck gallery** to browse free decks made by the community. Search by name, language or topic. Every deck shows its licence next to its **Install** button. Installing a deck adds it like any other import, and installing it again later brings in its fixes and keeps your progress. LernLab goes online only while the gallery is open. To share your own deck, choose **Share your deck** and fill in the form.

### After the import

The report says how many cards were added, how many were updated and how many were skipped, and why. It also lists pictures or sounds that were missing from the file.

Importing the same file again **updates** the cards. It never makes copies, and your progress stays.

### Make your own deck file

The easiest way is a spreadsheet. On the Decks screen, press **Download the CSV template**. Fill it in with Excel, LibreOffice or Google Sheets, save it as CSV and import it. Its example rows show a plain card, a multiple-choice card, a language card and an **Explain it** card: for one of those, write the why or how question in `front`, a model answer in `back` and 2–5 key points in `key_points`, separated by `|`. The columns are explained in [FORMAT.md](FORMAT.md#csv--tsv).

The [`examples/`](../examples/) folder has ready decks to try or copy:

| Deck | Subject | File |
|---|---|---|
| Spanish: first conversations | A language | [`spanish-first-conversations.lernpack`](../examples/spanish-first-conversations.lernpack) |
| Networking essentials | A certification | [`networking-essentials.lernpack`](../examples/networking-essentials.lernpack) |
| Chemistry: the first 20 elements | A science | [`chemistry-first-20-elements.lernpack`](../examples/chemistry-first-20-elements.lernpack) |

## Study

### Start a session

**Home** shows what is waiting today: reviews due, new cards and an estimated time.

1. Under **What to study**, pick a deck. You can also pick **All decks**, your **Starred cards**, your **Hardest cards**, or every card with one **Tag**.
2. Under **Session length**, pick **5 min**, **10 min** or **20 min**.
3. Press **Start studying** (or `Enter`).

**Study** on a deck in **Decks** also takes you to Home with that deck picked.

### During a session

A session is a run of short blocks. Each block lasts about a minute and has its own format. The name of the block is at the top of the screen. You may see:

- **Warm-up**: three quick, easy cards;
- **Guess first**: when your new cards start a topic you haven't met yet, a few of its questions come before the cards (see below);
- **New cards**: meet a card, then answer it;
- **Review** and **Recall**: answer from memory, typed or with a multiple-choice question;
- **Fill the gap**: type the missing word;
- **Listen** and **Speak** (language decks): answer what you hear, or say the answer out loud;
- **Category sprint**, **Match pairs**, **True or false** and **Word rain**: quick games;
- **Which one is this?** The category sprint sorts cards into groups: a card's category, or, in a deck that is not a language deck, tags that split the deck into groups (art styles, bird species, problem types: at least three cards per tag, one such tag per card). It picks up to four groups, starting with the ones you mix up most, from your wrong picks in earlier rounds and from cards you mixed up. A round made from tags has no clock. It is practice: it never changes when a card is due;
- **New words by theme** (language decks): the next new word sets the theme (its sub-deck and tag), and the other new words of that theme come with it. Themes are mixed later, in review;
- **Related cards**: when you review some cards of a small group that share a tag and the start of the question ("Capital of …"), the group's other cards you have learned get one quick multiple-choice question, so they don't fade while their neighbours are practised. It happens once within a day or two and never changes when those cards are due;
- **Blitz**: a timed round, only with cards you already know;
- **Boss fight**: your hardest cards from today, with three lives.

Some things to know:

- **Type the answer.** LernLab forgives capitals and a one-letter typo in longer words. It also accepts German umlauts written as `ae`, `oe` and `ue`. If it marks you wrong when you were right, press **I was right**.
- **Hint** (`Tab`) shows the first letter and the length of the answer. Press it again to **Show answer**; then type the answer once to fix it in memory.
- **Other ways to ask.** A card with extra questions (see [Edit cards](#edit-cards)) is asked in a new way at each review, with its level shown next to the block title: **Recall**, **Apply** or **Analyse**. The answer is the same, and it still counts once a day.
- **Show answer** on a flip card turns it over. Then say how you did: **Didn't know**, **Partly** or **Knew it**.
- **How sure were you?** After about 1 in 4 typed, fill-the-gap, flip or ordering answers (so sessions stay quick), a quiet row asks how sure you were, from **1** (guessing) to **5** (certain). Which answers ask is fixed by the card, the day and its place in the round. It is optional: press **Continue** to skip it. When the row shows, a correct answer waits for you instead of moving on by itself; after a typed or ordering answer, a tap or the keys `1`–`5` rate and go on in one step; on a flip card (where `1`–`3` say how you did) click a number before you rate the card. It is never timed, never asked for a card brought back or in practice mode, and it never changes when a card is next due or the XP you earn. Turn it off in **Settings → Studying**.
- **New cards are never timed.** Timers only appear on cards you already know.
- **Say it aloud.** On a few flip cards, the starred ones and the ones you missed in the last week, the card asks you to **say the answer out loud first** before you show it. Saying an answer makes it stick better, but only when some cards are spoken and the rest are not, so it is at most about 1 card in 5 and never every card. Nothing listens: no microphone is used, and you rate the card as usual. Turn it off in **Settings → Studying**.
- **Act it out.** Doing an action helps you remember its name. Tag a card `action` (a procedure step, a sign, a movement) and a session may ask you to **act it out** when the answer shows: do the movement, or mime it, as you say the answer. Verbs in language decks are asked the same way. It is only asked on a few cards, at most about 1 in 5, nothing is checked, and the card is graded as usual; after a typed answer the card waits for **Continue** so you have time. Turn it off in **Settings → Studying**.
- **Missed cards come back.** A card you miss comes back after 4 to 6 other cards, until you get it right once. A new card comes back until you have recalled it twice in the session. Once a card has done that, it doesn't come back again in this session, and no card comes back more than 3 times, so a hard card never holds you up. These extra tries are practice: they never change when the card is next due. If the session ends first, that's fine: the card comes back on another day. A card you got wrong but rated 4 or 5 (**How sure were you?**) always comes back once later in the session, even if it is asked again in a later block anyway: confident mistakes are the easiest to fix, right after you see the answer.
- **Guess first.** When today's new cards start a new topic (a tag, a sub-deck, or a whole new deck, where you haven't seen any of its cards yet), you get 5 to 8 of its questions first, mostly the cards you are about to learn. Type a guess if you like, or just think of one, then press **Show answer** (`Enter`); on a multiple-choice question, pick a choice (or press its number). Wrong guesses are expected and help you learn: guessing first helps you remember those answers later. There is no timer, and nothing you guess is marked or changes when a card is next due. **Skip to the new cards** ends the round at any time. Language decks don't get this round, because you can't guess a foreign word; neither do ordering cards.
- **Try first.** For maths and science. Open a deck's settings on the Decks screen and set **Subject** to Maths or Science. When today's new cards then start a new unit (a tag or sub-deck you haven't met) that has a worked example, the session opens with that problem before the lesson, in place of the guess round. Write your attempt, or work on paper, and press **Show the worked solution** (`Ctrl + Enter`, or `⌘ + Enter` on a Mac) to compare. Getting stuck is fine: trying first helps the lesson stick. Nothing is checked, saved or graded, there is no clock, and **Skip to the lesson** is always there. The example comes right after, to study. The subject is a setting on your computer; it is not part of a deck file.
- **Games never count as knowing a card.** Only a real attempt to remember (typing, saying, choosing the answer to a question) moves a card's schedule, and only the first one each day.
- **Swap this round.** Once per session, at the start of a round, you can press **Swap this round** to do it in another format with the same cards. A typed review becomes flip cards you rate yourself (and the other way round, when the answer is short enough to type); a game or a timed round becomes a quiz without a clock, and a quiz becomes match pairs. A swap never changes what counts: recall stays recall, and practice stays practice. New cards, lessons, guess-first rounds, the boss fight and cards with their own way of asking (multiple choice, ordering, code, picture labels, myth and explain cards) can't be swapped, so the button only shows when the round has another format.
- **What a number is for.** The small number that floats up after an answer names its reason when there is one: answers in a row, a card recalled after a slip earlier in the session, or a whole round right.
- To stop, press **End session** or `Esc`. Every answer so far is saved, and the session still counts for today.

### The summary

At the end you see how many answers you recalled, how many new cards you started, the XP you earned, and your days this week. **What your XP was for** lists each reason with its share, for example **+45** next to "3 cards recalled after a slip": answers recalled from memory, cards recalled after a slip, right answers in practice rounds and games, answers in a row, rounds with every answer right, the daily goal and the boss. The lines add up to the XP shown. Cards you missed are listed: they come back tomorrow.

**How this session went** appears when your answers show a pattern. It has at most three lines and one suggested next step, and it is about the cards and how you studied, never about you:

- misses that were **mix-ups**: your wrong answer was the answer of another card in the deck (2 or more);
- a **tag** that holds at least 3 of the cards you missed and at least half of them, with **Study "tag" next** to start a session on that tag (this changes **What to study** on Home to that tag);
- misses you **felt sure of** (rated 4 or 5 on "How sure were you?", 2 or more);
- misses **answered in about a second** (3 or more; timed games and flip cards don't count);
- **hints** used on 40% or more of typed and fill-the-gap answers (from 5 answers);
- cards you missed and then **recalled later** in the same session (2 or more).

An ordinary session shows nothing here. The lines are worked out on your computer from this session's answers; they change no schedule and earn no XP, and they are the same in calm mode. Press **One more round** (`Space`) or **Done** (`Enter`).

When your wrong answer is the answer of another card in the deck (typed, or picked as a wrong choice), LernLab remembers that you mixed the two up. From then on each of them is a wrong choice in the other's multiple-choice questions, and sessions ask them next to each other, so you practise telling them apart. After three mix-ups of the same two cards, the summary shows them side by side under **You mixed these two up** and offers a **compare card**. If you like, write what they share and the one key difference; that becomes the card's answer. **Add a compare card** puts it in the deck; **Not now** means you are not asked about these two again. In a session a compare card shows both sides and asks "What do they share? What is the one key difference?": answer in your head, show the answer and rate yourself as on a flip card. Your mix-ups stay on your computer and never change when a card is due.

After a session in which you met new cards, **Will you know these tomorrow?** shows each new card's question, without the answer. Answer **Yes**, **Not sure** or **No** for any you like; each answer is saved at once, and you can skip them all. At the end of your next session on a later day, once some of those cards have come back, the summary shows how your guesses held up ("You said yes to 4 cards that came back: you knew 3"). Cards you were not sure about come first in the next warm-up. None of this changes when a card is next due; it stays on your computer.

If you turn on **Settings → Studying → Offer a quiet minute after new cards** (off by default), the summary of a session with new cards offers **A quiet minute?**. Press **Rest for a minute**, close your eyes and let your mind wander: the screen dims and a quiet countdown runs for 60 seconds (with sounds on, a soft tick tells you it is over). Resting right after learning may help new memories settle, but the studies disagree, so treat it as something to try. **End the rest** or `Esc` stops it at any time, and you never have to take it.

### Practice without changing the schedule

Tick **Practice** on Home, then press **Start practice**. A practice session lets you cram any cards, for example before a test. Your review schedule stays the same. On the Decks screen, a deck with nothing due shows **Practice** instead of **Study**.

### Take a mock exam

On the **Decks** screen, press **Exam** on a deck. The questions come from that deck's cards, and the deck's tags become the topics in your score. In the deck's settings you can set the number of **Questions**, the **Minutes (timed mode)** and the **Pass mark (%)**.

Choose how to take it:

- **Tutor:** no clock. You check each answer and see the explanation straight away, and the card's note for a common mix-up when you picked that wrong choice. When you hand it in, it counts like normal study: your first answer of the day to a question card decides when that card comes back. Questions made from flashcards, and new cards past today's limit, are practice only.
- **Timed:** one clock for the whole exam, like the real thing. You see your answers at the end, and the exam is handed in when time runs out. Timed mode is practice: it never changes when your cards come back.

During the exam you can **Flag for review**, go back with **Previous**, and see unanswered and flagged questions under **Review** before you **Hand in**. The result shows your score, whether you passed, the **Score by topic** and your **Weak areas**. Cards with other ways to ask are asked in one of them at random, with its level on the question; the result then also shows the **Score by question level**.

### Streaks

Studying on a day keeps your streak going. The day starts at 4 a.m., so a late-night session still counts for the day before.

- **Streak freezes** cover a day off for you, automatically. You start with 2 and earn one for every 7 days in a row, up to 3.
- If you miss a day with no freeze left, your streak waits for you: study 2 sessions within the next 2 days and it comes back.
- On Home, a short note next to your week says that habits take a few weeks to form and that one missed day barely matters. **Hide this note** hides it; Settings → **Study plan** → **Show a note about building the habit** brings it back.

## Edit cards

**Cards** lists every card. Search with the box at the top, or filter by **Deck**, **Tag** and **State** (**New**, **Learning**, **Known**, **Suspended**, **Starred**).

- Select a card to edit it, or press **+ Add card**. A card can be **Basic** (front and back), **Cloze** (a gap in the front, like `{{c1::word}}`), **Multiple choice**, **Put steps in order** or **Number answer** (a number with an optional unit, like `9.81 m/s^2`, and an optional tolerance, like `0.05` or `1%`). You may leave the unit out when you answer; `1500 m` counts for `1.5 km`.
- **Myth** cards hold a common misconception: write the myth on the front ("We only use 10% of our brains.") and why it is wrong on the back. In a session you first answer **True** or **Myth** (`1` or `2`). Pick **Myth**, think of why, press **Show why** (`Space`) and rate yourself, as on any card you recall in your head. Pick **True** and you see why it is a myth; the card comes back soon. It counts like any other card, once a day. Myths are never used in games or mock exams, so you never see one presented as a fact. In a CSV, put `myth` in the `type` column.
- **Explain it** cards ask a why or how question ("Why do we have seasons?"). Write a model answer on the back and 2–5 **key points** a good explanation covers. In a session you type your explanation first (`Ctrl + Enter`, or `⌘ + Enter` on a Mac, to check it; **I don't know yet** shows the answer and brings the card back soon). You can also press **Say it instead** and speak: your words appear in the box, where you can correct them, and no recording is kept. It uses the same speech input as "Say it out loud"; where that isn't available, the button is missing or a line tells you to type. Then you see the model answer and tick the key points you covered: all of them counts as Good, some as Hard, none as Again. With every point ticked you can also press **That was easy**. There is no timer, and the card counts once a day like any other. If you like, rate "How well do you understand this?" from 1 to 7 before you write and again after you tick: explaining often shows a gap you didn't notice. These ratings are not saved and never change your schedule. Explain cards are never used in games, distractors or mock exams.
- **Learn first** (under **More fields**): write the fronts of other cards of the deck, or tags as `#tag`, separated by `|`, for example `Derivative|#functions`. New cards are then met after the cards they build on were answered from memory once. It is only an order: when nothing else is new, the card comes anyway, and nothing is locked. Cards tagged `key-term` are met before the other new cards. If a card you keep forgetting builds on cards you know only weakly, a session starts with a quick **Basics first** look at those (it does not change when they are due). In files the field is `requires` ([FORMAT.md](FORMAT.md#prerequisites)).
- A **compare card** (see [The summary](#the-summary)) is edited like a basic card: its front is the first side, its back the answer. The second side comes from a deck file's `twin` field ([FORMAT.md](FORMAT.md#compare-cards)) or from the card LernLab made.
- A **Worked example** holds one solved problem, for maths, science, code or accounting. Write the problem, then 2–8 **solution steps**: what you do ("Subtract 3 from both sides") and its result ("2x = 8"). In a session you first study the full example. The next time, the last step is blank and you type its result (`Enter` to check); then the last two, and so on, until you solve the whole problem with no step shown. Get a rung right and you climb one; miss one and the example shows one more step next time. The rungs are practice. Only solving the whole problem counts for your schedule, once a day like any other card: every step right is Good, a small slip is Hard, a wrong step is Again. Numbers are checked by value (`1500 m` counts for `1.5 km`) and spaces never matter. If the checker was too strict about a step, press **I was right** next to it. There is no timer, and worked examples are never used in games or mock exams. In a CSV, put `worked` in the `type` column and the steps in `worked_steps`, like `Subtract 3 from both sides :: 2x = 8|Divide both sides by 2 :: x = 4`.
- A **case chain** is a short case with a few linked questions, as in medicine, law or certification exams: "A 58-year-old man has crushing chest pain…", then *What is the most likely diagnosis?*, *Which artery is blocked?*, *What do you do first?* Make one card per question and paste the same text into **Case (optional)** on each. The case shows above the question whenever the card is asked. Each question is its own card: it comes back when it is due and counts once a day, like any other. Questions of one case that come up in the same round are asked together, in order, and a mock exam asks the whole case together. Case questions are never used in games, where the case would be missing. In a CSV, repeat the case in a `case` column on each of its rows.
- A **translate card** has two forms of one idea on its two sides: a graph and its formula, a formula and its diagram, an example and the name of the concept. Choose **Translate** as the card type. The card is asked both ways, in turn: one review shows the front and asks for the back, the next shows the back and asks for the front. The second way is a self-check: recall the other side (sketch the graph on paper if it is one), show it, and rate yourself. Both ways count like any other review, once a day.
- A card can have a **graph** that LernLab draws with the front. In **Graph (optional)**, write a function of x, such as `y = x^2 - 1` or `y = sin(x); x = 0..6.3`, or points to join, such as `(0,1) (1,3) (2,5)`. You can use `+ - * / ^`, brackets, `pi`, `e` and `sqrt`, `sin`, `cos`, `tan`, `abs`, `exp`, `ln`, `log`; add `; x = -3..3` or `; y = 0..10` to choose the part that shows. Basic, translate, numeric and multiple-choice cards can have a graph, so "Which function is drawn?" works with typed answers or with choices. Screen readers hear a few points of the graph, not its formula. Cards with a graph are not used in games, where the graph would be missing. In a CSV, use a `graph` column, and `translate` in the `type` column.
- A basic card tagged `why` or `how` is never just flipped: you write an explanation before its back shows, then rate yourself as usual (a short answer is still typed and checked).
- A **Code** card holds a snippet and its language (Python, JavaScript, SQL and more are coloured). Add the output and you predict what the code prints; put a gap like `{{c1::range}}` in the code and you type the missing token; leave both out and you put the lines in order. Code is never run. Typed code answers must match exactly, but spacing around punctuation and line breaks doesn't matter, so `0 1 2` counts for three lines of output. The rules are in [FORMAT.md](FORMAT.md#code-cards).
- An **Image occlusion** card hides parts of a picture. Add an image, then drag on it to draw a box over each part (or press **Add box**), and give each box a label. Tab to a box to move it with the arrow keys, resize it with Shift + arrow keys or remove it with Delete. Choose **Hide one** (the other boxes show their labels) or **Hide all** (every box is hidden). Each box becomes its own card: you type the hidden label. The rules are in [FORMAT.md](FORMAT.md#image-occlusion-cards).
- Write math in LaTeX between `\( … \)` in a line, or `\[ … \]` on its own line: `\( \frac{1}{2} mv^2 \)`. When the answer is a formula, type its LaTeX; spaces and braces around one symbol don't matter. The rules are in [FORMAT.md](FORMAT.md#math-and-numeric-cards).
- **Common mix-ups** (Multiple choice cards): under the choices, each wrong choice has a box. Write why it is wrong, ideally as "Many people think X. In fact Y, because Z." When someone picks that choice, they see your note under **A common mix-up**, followed by the right answer, instead of a plain "wrong". It changes nothing about the grade. Leave a box empty for a plain answer. In a CSV, put them in a `corrections` column, one per choice in the order of the choices, separated by `|` like the choices: `Many people think EC2 is serverless. In fact you patch its servers.|||RDS is a database.` ([FORMAT.md](FORMAT.md#corrections-for-wrong-choices)).
- **Other ways to ask** (Basic and Number answer cards): press **Add a question** to ask the same thing in new words, with the same answer. Pick its level: **Recall** (the fact in other words), **Apply** (a situation where the answer is needed: "A patient has X. Which drug?") or **Analyse** (a prediction or a why: "What happens if the dose doubles?"). A card holds up to 8. The card keeps one schedule; your sessions take turns asking its questions, so you learn the idea and not just the wording. In a CSV, put them in a `variants` column: `apply: A patient has X. Which drug? | analyse: What if the dose doubles?` ([FORMAT.md](FORMAT.md#question-variants)).
- **Key terms:** put `==` around the key part of an answer, like `It builds ==proteins== from amino acids`, and it is highlighted when the answer shows. It works in the back, the explanation and the notes, and in a CSV. The marks are not part of the answer you type ([FORMAT.md](FORMAT.md#key-terms)).
- **Tips for this card:** under the preview, the editor may suggest a better card. An answer over 40 words: split it into two cards? A picture with no description: does it help the answer? Describe it if it does, and leave it out if it only decorates. A card about an idea (a why or how card, or an answer of a sentence or more) with no picture: a diagram could help. These are suggestions from simple rules on your computer; you can always save the card as it is. In a language deck, hearing a word and reading it at the same time is never flagged, because there it helps. The import preview counts the same tips for the whole file under **Tips for better cards**, and you can import first and change cards later.
- **Mnemonic** (under **More**): a memory aid for the card, like "My Very Educated Mother…" for the planets. A mnemonic is a support, not the answer, so LernLab never shows it before you try. After a miss it appears with the answer under **Your mnemonic**, and again on your next answers until you get the card right twice in a row; then it stays hidden unless you miss the card again. When you type an answer, **Hint** (`Tab`) shows it too. It never changes your grade. In a CSV, put it in a `mnemonic` column.
- Drop an image, GIF, audio or video file on the editor to add it to the card.
- Press **Record** to record your own voice on a card (up to a minute), **Play** to hear it and **Record again** to redo it. Cards with a recording play it instead of the computer voice. The first time, your system asks whether LernLab may use the microphone.
- Tick several cards to add or remove a tag, move them to another deck, suspend them or delete them. A backup is saved before a delete.
- **☆ Star** marks a card, so you can study your starred cards from Home. **Suspend** keeps a card out of your sessions.

The **…** button on a deck in **Decks** opens the deck settings: its name, the language of the cards, new cards per day, a goal and an exam date, the voice that reads cards aloud, **Export .lernpack**, **Export CSV**, **Export for Anki** and **Delete**.

## Follow your progress

**Progress** shows:

- how many cards you have learned and how many are left;
- how many cards you learn a week, and the share of reviews you recalled;
- **Your decks**: for each deck, cards learned and left, your pace, and when you will finish at that pace. A deck whose cards have other ways to ask also shows **Questions answered**: the share of recall, apply and analyse questions over the last 12 weeks. When nearly all of it is recall, it suggests a mock exam, which mixes in the other questions;
- **This week's goal**: a small, specific goal for the week, such as "40 new cards, 5 sessions", with a bar for each.
  - **New cards.** For a deck with an exam date, the cards still to learn (to the deck's goal, or the whole deck) are spread evenly over the weeks until the exam. Without an exam date, the goal is your own pace of the last 4 weeks, at least 10 cards. It never asks for more than your new cards per day allow, and the decks are added up. A card counts when you first recall it in a real review.
  - **Sessions.** One more than your average of the last 4 weeks, between 3 and 7.
  - The goal is worked out fresh every Monday and stays the same all week. A slow week is never owed: what is left is simply spread over the weeks that remain. Reaching the goal is shown as "reached"; nothing else happens, and nothing is ever blocked.
- **Progress card**: press **Progress card** next to this week's goal for a one-page summary to show a teacher, a parent or a friend: cards learned, days and minutes this week, the share of reviews recalled, this week's goal, the next exam and your top decks. **Save as picture (PNG)** saves an image file; **Print or save as PDF** opens your system's print window, where you can also choose to save a PDF (the card prints on a light page). The card is made on your computer and nothing is sent anywhere. It shows no XP or levels, so it is the same in calm mode.
- **Study days**: a calendar of the last year;
- **Memory**: the share of reviews you recalled, week by week, against your target;
- **After time away: your own numbers**: how often you recalled a card after 1 to 6 days, 7 to 29 days and 30 days or more away, next to repeats on the same day. A row shows its share once it has 20 answers. After time away, only real reviews count (your first answer of the day, never practice or games); same-day repeats include cards brought back in a session. It covers your most recent recall answers (up to 2,000, from the last year). It is a record of what happened, not an experiment: each row holds different cards. Same-day repeats usually look best because the answer is still fresh; the rows after time away show what has lasted.
- **How sure you were**: for each rating from 1 to 5, how often those cards were right at their next review ("Cards you rated 5 were right 93% of the time at their next review; rated 4, 61%"). A rating shows a bar once 5 of its cards have come back. It shows whether your feeling of knowing can be trusted: if your 5s are often wrong, study a bit longer before you move on;
- your hardest cards, with **Study these** to start a session with them;
- **How LernLab helps you remember**: four short notes you can open (recall, spacing, mixing, and why "feels easy" can mislead);
- your streak, your streak freezes and your badges.

A card counts as learned once you have recalled it from memory, not just recognised it.

### Teach it back

Explaining something to someone else shows what you really know. When you know most cards of a tag (at least 3 cards, and 4 out of 5 learned), Progress lists the tag under **Teach it back**. Language decks are left out.

1. Press **Explain it**. LernLab asks you to explain the topic to a beginner in about 60 seconds. That is a suggestion: there is no timer.
2. Say it out loud, type it, or press **Record your voice** and **Stop recording** when you are done.
3. Press **Compare with the key points**. You see your explanation (and can play your recording) above the topic's key points: the key points of its Explain it cards and the answers of its other cards, at most 8.
4. Tick the points you missed. **Practise … cards** starts a practice session with just the cards behind them.

Nothing here is saved or graded, and it never changes when your cards come back. Your text and your recording stay on your computer and are gone when you leave the screen.

## Back up and move your data

Everything stays on your computer, in one data folder: your decks, cards, progress, settings, pictures and sounds. Nothing is uploaded.

| System | Data folder |
|---|---|
| Windows | `%APPDATA%\LernLab\data` |
| macOS | `~/Library/Application Support/LernLab/data` |
| Linux | `~/.config/LernLab/data` |

### Automatic backups

LernLab copies your database into the `backups` folder inside the data folder:

- once a day (the last 7 daily copies are kept);
- before an update;
- before you delete a deck or cards;
- before a restore, an import of all your data, or **Delete all my data**.

To make one yourself, go to **Settings → Your data** and press **Back up now**.

### Restore a backup

1. Go to **Settings → Your data → Restore a backup**.
2. Choose a backup from the list. It shows its date, why it was made, and how many decks, cards and answers it holds.
3. Press **Restore**, then **Restore this backup**.

Your data as it is now is backed up first, so you can change your mind.

After a restore or an import of all your data, the AI assistant and **Allow pictures and sounds from the internet** are off. Turn them on again in Settings if you want them. A backup or zip that holds anything LernLab never makes itself is refused, and your data stays as it was.

### Move to another computer

1. On the old computer, go to **Settings → Your data → Export everything** and press **Export as zip**. The zip holds your decks, progress, settings and media.
2. On the new computer, press **Import a zip…** in the same place and choose that file. It replaces the data there, after a backup.

To share one deck instead, use **Export .lernpack** in the deck settings.

### Go back to Anki

**Export for Anki** in the deck settings saves the deck as an `.apkg` file. In Anki, choose **File → Import** and pick it. Basic and cloze cards come over with their pictures, sounds and sub-decks; they start as new cards in Anki, because your LernLab progress can't be carried over. Multiple-choice and ordering cards become basic cards that show the answer on the back; notes for common mix-ups are added under the card's notes.

### Use a synced folder

In the desktop app, **File → Use a different data folder…** moves LernLab to another folder, for example one that Dropbox or Syncthing keeps in sync. LernLab restarts and uses the new folder. Use the app on one computer at a time. **File → Open data folder** shows the folder in your file manager.

### Delete everything

**Settings → Your data → Delete all my data** removes every deck, card, answer, setting and media file. Type `DELETE` to confirm. Your backups are deleted too, so this can't be undone.

## Your AI assistant

LernLab has no AI of its own, but you can connect one you already use (Claude Desktop, the ChatGPT desktop app, Hermes Agent or any other app that supports MCP). Turn it on in **Settings → AI assistant**, then follow [AI-ASSISTANTS.md](AI-ASSISTANTS.md). Ask it how your month went, which cards you keep forgetting, or to quiz you in the chat (a chat quiz is never recorded and never changes when cards come back).

### AI requests

When you ask the assistant for cards (for example from a PDF or a web page), to fix or merge cards, to add study aids to your cards, to tag, star, suspend or move them, to change your goals, to plan a deck toward an exam, or to export a deck, it cannot do it itself. Its proposals appear under **AI requests** in the sidebar, one card each, with the assistant's note on where they come from:

- Edit the deck name and any card, untick the cards you don't want, then click **Add N cards**. The cards start as new cards.
- A fix shows each field as it is now above the proposed text. Change the text if you like, then click **Save the fix**. The card keeps its progress.
- Study aids for a card you already have are a fix too: other ways to ask its question, why each wrong choice of a multiple-choice card is wrong, key points and a model explanation for an explain card, what to learn first, a memory aid and key terms. Each field shows what the card has now above the suggestion, one entry per line (corrections: one row per wrong choice). Suggestions are cleaned to plain text and cut to the same limits as an imported deck. Accepting never counts as a review and never changes when the card comes back.
- A merge shows the card to keep and its duplicates. The duplicates you leave ticked are suspended and tagged `merged`, never deleted; find them in the card browser by that tag.
- Tagging, starring, suspending or moving cards lists the cards it touches. Untick any you want left alone.
- New goals or a study plan show what you have now next to the proposed values. Change any value, then click **Use these goals** or **Save the plan**.
- An export asks you where to save the file when you click **Export…**. The assistant never gets the file.
- **Decline** removes the request. Nothing is changed.

## Settings

- **Language and display**: interface language, theme (**Match my computer**, **Light** or **Dark**), text size and **Reduce motion**.
- **Studying**: daily goal, default session length, timers (**Off**, **Relaxed**, **Normal**, **Challenge**), new cards per day, target memory retention, **Ask how sure I was** (on by default: about 1 answer in 4 asks; off: never), **Calm mode** (see below), sound effects, and the teacher's voice for language decks.
- **Calm mode** (off by default) is for studying without game elements. It hides XP, your level, combos, the floating numbers, level and badge news, confetti and the level-up sound, in sessions, on the summary and on Home. Everything about your learning stays: answers recalled, new cards, missed cards, your streak and freezes, study days and the Progress screen (badges you earn still appear there). XP is still counted quietly, so nothing is lost if you turn calm mode off again. LernLab has no leaderboards, with or without calm mode.
- **Evening and morning rhythm** (off by default) lets sleep help your memory. After an evening session (from 5 p.m.), new cards wait for the next evening, and your next session before 5 p.m. starts with a short check of last night's new cards and the ones you got wrong. The check is a normal review on a new day. Nothing is locked: if you did not study the evening before, new cards come at any time. With the daily reminder on, **Offer the morning check at** adds a morning notification, shown only when cards from last night are waiting and you have not studied yet. In the deck list, a deck whose exam is within three days shows a short note that sleep is part of studying.
- **Study plan**: your if-then plan and backup plan, a preview of what the reminder will say, the hour you usually study, and the habit note on Home. See [Study plan](#study-plan).
- **Reminders** (desktop app): a daily reminder at a time you choose, and opening LernLab when you log in.
- **Your data**: the data folder, backups, restore, export, import and delete.
- **AI assistant**: let an AI assistant you use (Claude Desktop, the ChatGPT desktop app, Hermes Agent or any other app that supports MCP) read your decks, cards and study history. Off until you turn it on. LernLab itself stays offline, but whatever the assistant reads is sent to that assistant's AI company. When it is on, Settings shows the snippet to paste into the assistant's MCP settings; see [AI-ASSISTANTS.md](AI-ASSISTANTS.md). Turn it off and every request from the assistant is refused.
- **Updates and privacy**: automatic updates and beta updates. LernLab goes online only to check for updates, to load a deck from the gallery when you ask, and for an AI assistant you connect and turn on. Some shared decks link pictures, videos or sounds from websites instead of including them. Those stay off, and the card shows a note, until you turn on **Allow pictures and sounds from the internet**. LernLab warns you first: each such card then contacts that website, which sees your IP address, and the content comes from the deck's author, not from LernLab.

## Keyboard

| Key | What it does |
|---|---|
| `1`–`4` | Choose an answer |
| `1`–`5` | When **How sure were you?** shows after a typed or ordering answer: rate and continue |
| `Enter` | Start a session on Home; check or continue in a session; **Done** on the summary |
| `Space` | Flip a card or replay audio; **One more round** on the summary |
| `Tab` | Show a hint, then the answer, when you type an answer |
| `Esc` | Leave a session |
| `Ctrl+Enter` / `Cmd+Enter` | Start a session (desktop app, **File → Start session**) |
| `Ctrl+Shift+L` / `Cmd+Shift+L` | Start a session from anywhere, even when LernLab is in the background (desktop app) |
| `Ctrl+O` / `Cmd+O` | Import a deck file (desktop app) |
