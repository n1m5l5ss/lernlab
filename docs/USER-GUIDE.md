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

The easiest way is a spreadsheet. On the Decks screen, press **Download the CSV template**. Fill it in with Excel, LibreOffice or Google Sheets, save it as CSV and import it. The columns are explained in [FORMAT.md](FORMAT.md#csv--tsv).

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
- **Blitz**: a timed round, only with cards you already know;
- **Boss fight**: your hardest cards from today, with three lives.

Some things to know:

- **Type the answer.** LernLab forgives capitals and a one-letter typo in longer words. It also accepts German umlauts written as `ae`, `oe` and `ue`. If it marks you wrong when you were right, press **I was right**.
- **Hint** (`Tab`) shows the first letter and the length of the answer. Press it again to **Show answer**; then type the answer once to fix it in memory.
- **Other ways to ask.** A card with extra questions (see [Edit cards](#edit-cards)) is asked in a new way at each review, with its level shown next to the block title: **Recall**, **Apply** or **Analyse**. The answer is the same, and it still counts once a day.
- **Show answer** on a flip card turns it over. Then say how you did: **Didn't know**, **Partly** or **Knew it**.
- **How sure were you?** After about 1 in 4 typed, fill-the-gap, flip or ordering answers (so sessions stay quick), a quiet row asks how sure you were, from **1** (guessing) to **5** (certain). Which answers ask is fixed by the card, the day and its place in the round. It is optional: press **Continue** to skip it. When the row shows, a correct answer waits for you instead of moving on by itself; after a typed or ordering answer, a tap or the keys `1`–`5` rate and go on in one step; on a flip card (where `1`–`3` say how you did) click a number before you rate the card. It is never timed, never asked for a card brought back or in practice mode, and it never changes when a card is next due or the XP you earn. Turn it off in **Settings → Studying**.
- **New cards are never timed.** Timers only appear on cards you already know.
- **Missed cards come back.** A card you miss comes back after 4 to 6 other cards, until you get it right once. A new card comes back until you have recalled it twice in the session. Once a card has done that, it doesn't come back again in this session, and no card comes back more than 3 times, so a hard card never holds you up. These extra tries are practice: they never change when the card is next due. If the session ends first, that's fine: the card comes back on another day. A card you got wrong but rated 4 or 5 (**How sure were you?**) always comes back once later in the session, even if it is asked again in a later block anyway: confident mistakes are the easiest to fix, right after you see the answer.
- **Guess first.** When today's new cards start a new topic (a tag, a sub-deck, or a whole new deck, where you haven't seen any of its cards yet), you get 5 to 8 of its questions first, mostly the cards you are about to learn. Type a guess if you like, or just think of one, then press **Show answer** (`Enter`); on a multiple-choice question, pick a choice (or press its number). Wrong guesses are expected and help you learn: guessing first helps you remember those answers later. There is no timer, and nothing you guess is marked or changes when a card is next due. **Skip to the new cards** ends the round at any time. Language decks don't get this round, because you can't guess a foreign word; neither do ordering cards.
- **Games never count as knowing a card.** Only a real attempt to remember (typing, saying, choosing the answer to a question) moves a card's schedule, and only the first one each day.
- To stop, press **End session** or `Esc`. Every answer so far is saved, and the session still counts for today.

### The summary

At the end you see how many answers you recalled, how many new cards you started, the XP you earned, and your days this week. Cards you missed are listed: they come back tomorrow. Press **One more round** (`Space`) or **Done** (`Enter`).

After a session in which you met new cards, **Will you know these tomorrow?** shows each new card's question, without the answer. Answer **Yes**, **Not sure** or **No** for any you like; each answer is saved at once, and you can skip them all. At the end of your next session on a later day, once some of those cards have come back, the summary shows how your guesses held up ("You said yes to 4 cards that came back: you knew 3"). Cards you were not sure about come first in the next warm-up. None of this changes when a card is next due; it stays on your computer.

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
- A **Code** card holds a snippet and its language (Python, JavaScript, SQL and more are coloured). Add the output and you predict what the code prints; put a gap like `{{c1::range}}` in the code and you type the missing token; leave both out and you put the lines in order. Code is never run. Typed code answers must match exactly, but spacing around punctuation and line breaks doesn't matter, so `0 1 2` counts for three lines of output. The rules are in [FORMAT.md](FORMAT.md#code-cards).
- An **Image occlusion** card hides parts of a picture. Add an image, then drag on it to draw a box over each part (or press **Add box**), and give each box a label. Tab to a box to move it with the arrow keys, resize it with Shift + arrow keys or remove it with Delete. Choose **Hide one** (the other boxes show their labels) or **Hide all** (every box is hidden). Each box becomes its own card: you type the hidden label. The rules are in [FORMAT.md](FORMAT.md#image-occlusion-cards).
- Write math in LaTeX between `\( … \)` in a line, or `\[ … \]` on its own line: `\( \frac{1}{2} mv^2 \)`. When the answer is a formula, type its LaTeX; spaces and braces around one symbol don't matter. The rules are in [FORMAT.md](FORMAT.md#math-and-numeric-cards).
- **Common mix-ups** (Multiple choice cards): under the choices, each wrong choice has a box. Write why it is wrong, ideally as "Many people think X. In fact Y, because Z." When someone picks that choice, they see your note under **A common mix-up**, followed by the right answer, instead of a plain "wrong". It changes nothing about the grade. Leave a box empty for a plain answer. In a CSV, put them in a `corrections` column, one per choice in the order of the choices, separated by `|` like the choices: `Many people think EC2 is serverless. In fact you patch its servers.|||RDS is a database.` ([FORMAT.md](FORMAT.md#corrections-for-wrong-choices)).
- **Other ways to ask** (Basic and Number answer cards): press **Add a question** to ask the same thing in new words, with the same answer. Pick its level: **Recall** (the fact in other words), **Apply** (a situation where the answer is needed: "A patient has X. Which drug?") or **Analyse** (a prediction or a why: "What happens if the dose doubles?"). A card holds up to 8. The card keeps one schedule; your sessions take turns asking its questions, so you learn the idea and not just the wording. In a CSV, put them in a `variants` column: `apply: A patient has X. Which drug? | analyse: What if the dose doubles?` ([FORMAT.md](FORMAT.md#question-variants)).
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
- **Study days**: a calendar of the last year;
- **Memory**: the share of reviews you recalled, week by week, against your target;
- **How sure you were**: for each rating from 1 to 5, how often those cards were right at their next review ("Cards you rated 5 were right 93% of the time at their next review; rated 4, 61%"). A rating shows a bar once 5 of its cards have come back. It shows whether your feeling of knowing can be trusted: if your 5s are often wrong, study a bit longer before you move on;
- your hardest cards, with **Study these** to start a session with them;
- your streak, your streak freezes and your badges.

A card counts as learned once you have recalled it from memory, not just recognised it.

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

When you ask the assistant for cards (for example from a PDF or a web page), to fix or merge cards, to tag, star, suspend or move them, to change your goals, to plan a deck toward an exam, or to export a deck, it cannot do it itself. Its proposals appear under **AI requests** in the sidebar, one card each, with the assistant's note on where they come from:

- Edit the deck name and any card, untick the cards you don't want, then click **Add N cards**. The cards start as new cards.
- A fix shows each field as it is now above the proposed text. Change the text if you like, then click **Save the fix**. The card keeps its progress.
- A merge shows the card to keep and its duplicates. The duplicates you leave ticked are suspended and tagged `merged`, never deleted; find them in the card browser by that tag.
- Tagging, starring, suspending or moving cards lists the cards it touches. Untick any you want left alone.
- New goals or a study plan show what you have now next to the proposed values. Change any value, then click **Use these goals** or **Save the plan**.
- An export asks you where to save the file when you click **Export…**. The assistant never gets the file.
- **Decline** removes the request. Nothing is changed.

## Settings

- **Language and display**: interface language, theme (**Match my computer**, **Light** or **Dark**), text size and **Reduce motion**.
- **Studying**: daily goal, default session length, timers (**Off**, **Relaxed**, **Normal**, **Challenge**), new cards per day, target memory retention, **Ask how sure I was** (on by default: about 1 answer in 4 asks; off: never), sound effects, and the teacher's voice for language decks.
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
