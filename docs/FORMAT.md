# Deck formats

LernLab imports and exports decks in open formats, so your cards never get locked in.

| Format | Import | Export | Best for |
|---|---|---|---|
| `.lernpack` | ✅ | ✅ | Sharing complete decks with media (the native format) |
| CSV / TSV / TXT | ✅ | ✅ | Spreadsheets, Quizlet-style lists, quick authoring |
| Pasted text | ✅ | — | Copying a list from anywhere, with custom separators |
| JSON | ✅ | — | Scripts and generators |
| `.zip` with a CSV plus media files | ✅ | — | CSV decks with images, audio or video |
| Anki `.apkg` / `.colpkg` | ✅ | ✅ `.apkg` | Moving between LernLab and Anki: old (`collection.anki2/anki21`) and new (`anki21b`, zstd) packages |
| Live Anki (AnkiConnect) | ✅ | — | Pulling a deck straight from a running Anki |

The deck gallery (Decks → Deck gallery) installs community `.lernpack` decks from GitHub; its `index.json` format is in [GALLERY.md](GALLERY.md).

Re-importing a deck **updates** cards instead of duplicating them, and keeps your progress. Cards are matched by their `id`, or, if there is none, by deck name plus front and back. Exports (CSV, `.lernpack` and Anki `.apkg`) write each card's own id, so importing an export back into the same deck updates it in place; importing it into another deck makes a copy.

## Deck package: `.lernpack` format version 1

**Status: version 1, frozen (November 2026).** This section is the stable spec that other tools can build on. Version 1 will not change in a way that breaks an existing reader or writer: new optional fields may be added (see [Versioning](#versioning)), and anything that would break a version 1 reader gets a new version number. The machine-readable rules are the JSON Schemas in [`docs/schema/`](schema/):

- [`manifest.schema.json`](schema/manifest.schema.json): `manifest.json`
- [`card.schema.json`](schema/card.schema.json): one card (a line of `cards.jsonl`)

Both use JSON Schema draft 2020-12. A complete example built by LernLab's own exporter is [`examples/german-colours-with-pictures.lernpack`](../examples/german-colours-with-pictures.lernpack) (rebuild it with `npx tsx scripts/build-example-lernpack.ts`). The unzipped decks in `examples/decks/` and the zips in `examples/downloads/` show the hand-made `cards.csv` style.

A deck package is a zip file. It can end in `.lernpack` or `.zip`: readers recognise it by its content (a zip with a `manifest.json`), not by its ending. Which ending the app offers by default is decided together with the product name.

```
german-colours.lernpack
└── german-colours/          optional single top folder (any name)
    ├── manifest.json        required: format, version, deck name, language, description
    ├── cards.csv            the cards, one row per card (edit in Excel or Google Sheets)
    ├── cards.jsonl          or: one JSON card per line (lossless; what LernLab writes)
    └── media/               optional
        ├── images/          .jpg .png .webp .gif (animated GIFs work)
        │   ├── rot.png
        │   └── drehen.gif
        ├── audio/           .mp3 .ogg .m4a .wav
        │   └── rot.mp3
        └── video/           .mp4 .webm
```

Rules:

- **Top folder.** The files may sit at the root of the zip or inside one top folder. The folder that holds `manifest.json` is the package root.
- **Cards file.** A package has one cards file in its root. If there is more than one, readers use the first they find in this order:
  1. `cards.jsonl`: one JSON card per line, UTF-8. Blank lines are ignored. Each card follows `card.schema.json`.
  2. `cards.json`: a JSON array of the same cards.
  3. `cards.csv` (or `cards.tsv`): UTF-8 (a byte order mark is allowed), with a header row and the same columns as a plain CSV (below). This is the easiest format to make by hand.
  - A package without any of these is rejected.
- **Media.** Every file under `media/`, in any subfolder, is a media file, except `.txt` and `.md` files (notes for people). Files are matched by **file name**, so names must be unique across subfolders.
  - In a card, write the file name, with or without its subfolder: `rot.png`, `images/rot.png` and `media/images/rot.png` all find `media/images/rot.png`.
  - `image`, `audio` and `video` may also be an `https://` URL; it is shown when the computer is online.
  - Missing files are listed in the import report, never silently dropped.
  - GIFs are images: put them in `images/`.
- **Limits:** see [Limits](#limits) below. They apply to every zip-based format.
- **Without a manifest.** A zip with just a CSV and media files also imports, as a plain CSV with media (not a `.lernpack`). The deck is named after the CSV file.

What LernLab writes when it exports: `manifest.json`, `cards.jsonl`, a matching `cards.csv` (every column of a CSV export, so the deck opens in a spreadsheet; readers use `cards.jsonl` first), and every media file the cards use, sorted by kind into `media/images/`, `media/audio/` and `media/video/`. Cards point at their files by that path inside `media/` (`images/rot.png`), in both cards files. Packages written before this, with only `cards.jsonl` and media flat in `media/`, are valid version 1 packages too, so readers must handle either layout.

### Versioning

- `version` is an integer. This spec is version 1.
- **Readers ignore unknown fields.** A key that a reader does not know, in `manifest.json`, in `deck`, or in a card, is skipped without an error. So are unknown files in the zip. This lets a newer writer add optional fields without breaking older readers.
- Readers ignore an unknown card `type` and pick the type from the card's content, as if `type` were missing.
- **Readers are lenient about `deck`.** Writers must include it (the schema requires it), but LernLab still imports a manifest without `deck` and names the deck after the file. A `deck` that is not an object is refused (`not_lernpack`).
- A reader refuses a package whose `version` is higher than the one it knows, with a message that a newer app is needed. It never guesses.
- A writer adds only optional fields within version 1. Anything an old reader would get wrong if it ignored it (a new required field, a changed meaning) needs version 2.
- Optional fields added since version 1 was published: `imageAlt` on cards (November 2026, `image_alt` in CSV); `tolerance` and the card type `numeric` (November 2026); `code`, `codeLang` and the card type `code` (November 2026); `occlusion`, `occlusionGroup`, `occlusionMode` and the card type `occlusion` (November 2026, image occlusion; still version 1). An older reader studies a numeric card as a basic card, a code card as a basic card without its code, and an occlusion card as a basic card with the whole image (front: the question, back: the box's label) and no box hidden. `variants` on cards (November 2026, the same text in CSV): other ways to ask a card's question; an older reader ignores it and asks the card's own question. `corrections` on multiple-choice cards (November 2026, the same text in CSV): a correction per wrong choice; an older reader ignores it and says a plain "wrong". The card type `myth` (November 2026): an older reader studies it as a basic card (front: the myth, back: why it is wrong). The card type `explain` and `keyPoints` (November 2026, `key_points` in CSV): an older reader ignores the points and studies a basic card (front: the question, back: the model explanation, or the key points one per line when there is none). The card type `twin` and `twin` (November 2026): an older reader ignores the second side and studies a basic card (front: the first side, back: the answer). `keyTerms` on cards (November 2026, `key_terms` in CSV): the key terms of the answer, highlighted when it shows; an older reader ignores it and shows the answer without a highlight. The card type `worked` and `workedSteps` (November 2026, `worked_steps` in CSV): an older reader ignores the steps and studies a basic card (front: the problem, back: the answer). `mnemonic` on cards (November 2026, the same name in CSV): a memory aid shown only after a miss or a hint; an older reader ignores it. `requires` (November 2026): an older reader ignores it and keeps the deck's order. `case` on cards (November 2026, the same text in CSV): the case a question belongs to; an older reader ignores it, so writers put the case before the question in `front`.

### manifest.json

```json
{
  "format": "lernpack",
  "version": 1,
  "deck": {
    "name": "AWS Cloud Basics",
    "language": null,
    "description": "Core services for the AWS Cloud Practitioner exam",
    "goal": { "label": "AWS CCP", "words": 300 }
  },
  "cards": 16,
  "created": "2026-11-20T10:00:00Z",
  "generator": "LernLab"
}
```

| Key | Required | Meaning |
|---|---|---|
| `format` | yes | Always `"lernpack"` |
| `version` | yes | Format version: `1` |
| `deck` | yes | The deck: an object with the keys below |
| `deck.name` | yes | Deck name. If it is missing or empty, readers use the file name |
| `deck.language` | no | Language code (`de`, `ja`, `ko`, `fr`, …) for a language deck, or `null` for any other subject |
| `deck.description` | no | Short description |
| `deck.goal` | no | Study goal: `label` and `words` (required), `hoursLow`, `hoursHigh` and `tag` (optional) |
| `cards` | no | Number of cards. Informational: readers count the cards file |
| `created` | no | When the package was written (ISO 8601, UTC) |
| `generator` | no | The program that wrote it, e.g. `LernLab` |

When a package is imported into a deck that already exists (matched by name), the deck's name, language and goal stay as they are; the description is filled in only if the deck has none.

### cards.jsonl

Each line is one card. Only `front` is required.

```json
{"id":"s3","front":"Amazon S3","back":"Object storage for any amount of data","category":"Storage","tags":["aws","storage"],"image":"s3.png"}
{"id":"serverless","type":"mcq","front":"Which TWO services are serverless?","choices":"Amazon EC2|AWS Lambda|AWS Fargate|Amazon RDS","correct":"2|3","explanation":"Lambda and Fargate need no server management."}
{"id":"tcp","type":"order","front":"Order the TCP handshake","steps":"SYN|SYN-ACK|ACK"}
{"id":"loop","type":"code","front":"What does this print?","code":"for i in range(3):\n    print(i)","codeLang":"python","back":"0\n1\n2"}
{"id":"heart-aorta","type":"occlusion","front":"Label the heart","back":"Aorta","image":"heart.png","imageAlt":"A diagram of the heart","occlusion":"0.4,0.05,0.2,0.1","occlusionGroup":"heart","occlusionMode":"all"}
{"id":"mito","front":"The {{c1::mitochondrion}} is the powerhouse of the cell","back":"Biology 101"}
{"id":"sohn","front":"der Sohn","back":"son","example":"Mein <b>Sohn</b> ist zehn.","exampleTranslation":"My son is ten.","audio":"sohn.mp3","category":"der"}
```

| Field | Meaning |
|---|---|
| `id` | Stable id so updates keep progress. Write a string; readers also accept a number |
| `type` | `basic` (default), `cloze`, `mcq`, `order`, `numeric` (see [Math and numeric cards](#math-and-numeric-cards)), `code` (see [Code cards](#code-cards)), `occlusion` (see [Image occlusion cards](#image-occlusion-cards)), `myth` (see [Myth cards](#myth-cards)), `explain` (see [Explain cards](#explain-cards)), `worked` (see [Worked examples](#worked-examples)). Without it the type comes from the content: `{{c1::…}}` makes a cloze, `choices` an mcq, `steps` an order card, `code` a code card, `occlusion` with an `image` an occlusion card, two or more `keyPoints` an explain card, two or more `workedSteps` a worked example, `twin` a compare card (`twin`, see [Compare cards](#compare-cards)) |
| `front` | Term, question or prompt (required, not empty). Cloze: text with `{{c1::answer}}` or `{{c1::answer::hint}}` (Anki syntax) |
| `back` | Definition or answer |
| `altAnswers` | Other accepted answers, separated by `|` (e.g. `colour|color`) |
| `variants` | Other ways to ask the card's question, each with a level, separated by `|`: `apply: A patient has X. Which mechanism? \| analyse: What happens if X doubles?` See [Question variants](#question-variants) (optional, added after v1 was published; older readers ignore it) |
| `example` | Example sentence. Mark the studied word with `<b>…</b>` to get fill-the-gap rounds |
| `exampleTranslation` | Translation of the example |
| `explanation` | Shown after answering (rule, rationale) |
| `notes` | Extra notes |
| `mnemonic` | A memory aid for the card, plain text with `**bold**`, `*italic*` and `` `code` ``, at most 300 characters. It is never shown before a recall attempt: only after a miss or when the learner asks for a hint, and no longer by itself once the card was recalled twice in a row (optional, added after v1 was published; older readers ignore it) |
| `category` | Group for sorting rounds (`der`/`die`/`das`, `Storage`/`Compute`, `Cardio`…) |
| `choices` | Multiple choice / multi-select: the choices, separated by `|` |
| `correct` | Multiple choice: the correct choices as 1-based numbers or as texts, separated by `|` |
| `keyPoints` | Explain card: its 2–5 key points, separated by `|`: `Earth is tilted\|The tilt changes the angle of sunlight`. See [Explain cards](#explain-cards) (optional, added after v1 was published; older readers ignore it) |
| `twin` | Compare card: the second thing, shown beside the front: `effect: a result`. See [Compare cards](#compare-cards) (optional, added after v1 was published; older readers ignore it) |
| `requires` | What to learn first: fronts of other cards of the deck or tags, separated by `|`: `Derivative\|#functions`. See [Prerequisites](#prerequisites) (optional, added after v1 was published; older readers ignore it) |
| `keyTerms` | The key terms of the answer, separated by `|`: `mitochondrion\|ATP`. They are highlighted when the answer shows. See [Key terms](#key-terms) (optional, added after v1 was published; older readers ignore it) |
| `case` | Case chain: the case this question belongs to: `A 58-year-old man has crushing chest pain…`. Cards of one deck with the same case form a chain. See [Case chains](#case-chains) (optional, added after v1 was published; older readers ignore it) |
| `workedSteps` | Worked example: its 2–8 solution steps, separated by `|`, each `what you do :: result`: `Subtract 3 from both sides :: 2x = 8\|Divide both sides by 2 :: x = 4`. See [Worked examples](#worked-examples) (optional, added after v1 was published; older readers ignore it) |
| `corrections` | Multiple choice: a correction per wrong choice, in the order of `choices`, separated by `|`: `Many people think EC2 is serverless. In fact you manage its servers.\|\|\|RDS is a database.` See [Corrections for wrong choices](#corrections-for-wrong-choices) (optional, added after v1 was published; older readers ignore it) |
| `steps` | Ordering card: steps in the correct order, separated by `|` |
| `tolerance` | Numeric card: how far off a typed number may be, `0.05` (in the card's unit) or `1%` (optional, added after v1 was published) |
| `code` | Code card: the code as plain text, with its line breaks and indentation (optional, added after v1 was published; older readers ignore it) |
| `codeLang` | Code card: the code's language, e.g. `python` (optional, added after v1 was published) |
| `occlusion` | Occlusion card: the box hidden on the image, `x,y,w,h` as fractions of the image's width and height (optional, added after v1 was published; older readers ignore it) |
| `occlusionGroup` | Occlusion card: the same text on every box of one picture (optional, added after v1 was published; default: the image's file name) |
| `occlusionMode` | Occlusion card: `one` (default) or `all` (optional, added after v1 was published) |
| `image` | Image file name inside `media/` (or an `https://` URL). GIFs work as images |
| `imageAlt` | Description of the image, in plain text, read out by screen readers (its alt text). Write what a picture question needs to be answered (optional, added after v1 was published; older readers ignore it) |
| `audio` | Audio file name inside `media/` (or an `https://` URL) |
| `video` | Video file name inside `media/` (or an `https://` URL): mp4 or webm |
| `tags` | Array of strings |
| `subdeck` | Sub-deck path, e.g. `Medicine::Cardio`. Without it the card goes in the deck itself |
| `group` | Lesson group: cards with the same group are taught together in a mini-lesson |
| `rank` | Introduction order (e.g. word frequency rank); lower comes first |
| `extra` | Any other fields (object of strings), e.g. `{"reading": "…"}` |

Without an `id`, a card is matched on re-import by deck name plus front and back.

Math is written in LaTeX between `\( … \)` (in a line) or `\[ … \]` / `$$ … $$` (on its own line); see [Math and numeric cards](#math-and-numeric-cards).

Allowed formatting in text (the safe list): `<b> <strong> <i> <em> <u> <s> <mark> <sup> <sub> <small> <code> <pre> <br> <p> <div> <span> <ul> <ol> <li>`. They are kept without attributes; every other tag is removed when a card is saved and again when it is shown, because decks are shared files. In CSV and in the card editor you can also write `**bold**`, `*italic*`, `` `code` `` and `==key term==` (see [Key terms](#key-terms)).

## Question variants

A card can ask its question in more than one way: the definition, a scenario ("A patient has X. Which mechanism?"), a prediction ("What happens if X doubles?") or the same fact in other words. The answer stays the card's own. `variants` holds the other questions in one line of text:

```
apply: A patient has X. Which mechanism? | analyse: What happens if X doubles? | In other words?
```

- Questions are separated by `|`, so a question can't contain one (writers turn it into `/`).
- Each question may start with its **level** and a colon: `recall` (remember the fact), `apply` (use it in a new situation) or `analyse` (predict, compare, explain why; `analyze` is read too). A question without a level is a recall question. The card's own question (its front) is always recall.
- Plain text: formatting tags are removed. At most 8 questions of up to 500 characters each are kept; empty questions and repeats are dropped.
- Only cards asked as a written question use them: basic, language and numeric cards. Cloze, multiple-choice, order, code and occlusion cards ask in their own way and drop the field.
- The card is still one card with one schedule (one grade per day, whichever question was asked). A new card is learned with its own question; after that, each review asks the next question in turn, and a mock exam picks one at random. Exported to Anki, the questions are added under the notes.

## Corrections for wrong choices

A multiple-choice card can explain a common mistake: a short correction for any wrong choice, shown when that choice is picked, in place of a plain "wrong" ("Many people think X. In fact Y, because Z."). The right answer is still shown, and the grade is the same. `corrections` holds them in one line, one slot per choice in the order of `choices`, separated by `|` like the choices:

```
choices:     EC2|Lambda|Fargate|RDS
correct:     2|3
corrections: Many people think EC2 is serverless. In fact you still patch and scale its servers.|||RDS is a database, not a place to run code.
```

- An empty slot is a choice without a correction; empty slots at the end can be left out. A correction can't contain `|` (writers turn it into `/`).
- Plain text: formatting tags are removed, but `**bold**`, `*italic*` and `` `code` `` work. At most 500 characters per correction.
- Slots of correct choices and slots past the last choice are dropped. Other card types drop the field.
- Exported to Anki, each correction is added under the notes, after its choice ("EC2: Many people think…").

## Myth cards

A card of type `myth` states a common misconception on its front and explains on its back why it is wrong:

```json
{"type":"myth","front":"We only use 10% of our brains.","back":"Brain scans show activity all over the brain, even during sleep."}
```

In CSV, put `myth` in the `type` column. A session asks "True or myth?" (the answer is always myth), then asks you to say why before it shows the back, and you rate yourself as on a flip card. It is a normal recall with one grade per day. Myth cards have no question variants, and they are left out of games, guess-first rounds and mock exams, so a myth is never shown as a fact. Exported to Anki, a myth card is a basic card.

## Key terms

Mark the key part of an answer and it is highlighted when the answer shows, so the eye finds what matters:

```json
{"front":"What does a ribosome do?","back":"It builds proteins by reading messenger RNA","keyTerms":"proteins|messenger RNA"}
```

- When you write a card, in the editor or in a CSV, put `==` around the term in the back instead: `It builds ==proteins== by reading ==messenger RNA==`. The marks must touch the term and stand apart from other letters, so `a == b` and `a==b` stay as written. They are not applied inside a formula.
- The back of a basic, number, myth or explain card is stored as plain text, without the marks, so typed answers, games and other apps see `It builds proteins by reading messenger RNA`. The terms are kept beside it. LernLab writes them as `keyTerms` (`key_terms` in CSV), separated by `|`, and reads both that field and `==` marks in the back; the marks win.
- A card keeps at most 5 key terms of at most 100 characters each, plain text. A term that is not in the answer as a whole word, or that holds a `=`, is dropped. Every place the term stands in the answer is highlighted.
- In fields that keep their formatting (explanation, notes, example, a cloze front, a multiple-choice back), `==term==` becomes `<mark>term</mark>` like `**bold**` becomes `<b>`, and no `keyTerms` are kept.
- Exported to Anki, the answer is plain text.

## Explain cards

A card of type `explain` asks a why or how question. Its back is a model explanation, and `keyPoints` lists the 2–5 points a good explanation covers, separated by `|`:

```json
{"type":"explain","front":"Why do we have seasons?","back":"Earth's tilted axis changes how directly sunlight hits each half.","keyPoints":"Earth is tilted|The tilt changes the angle of sunlight|Not the distance to the sun"}
```

- In CSV, put `explain` in the `type` column and the points in a `key_points` column. Two or more key points make an explain card even without a type.
- Key points are plain text with `**bold**`, `*italic*` and `` `code` ``, at most 300 characters each. Repeats and blanks are dropped, a sixth point and later ones too. With fewer than two, the card is a basic card and keeps none.
- The back may be empty. A writer then puts the key points in the back, one per line starting with `• `, so an older reader still has an answer; a reader that knows explain cards drops such a back again.
- A session asks you to type your explanation, then shows the back and the key points. You tick the points you covered: all of them is Good, some is Hard, none is Again, and only with every point ticked can you say "That was easy" (Easy, once you have reviewed the card before). It is a normal recall with one grade per day, with no timer. Explain cards have no question variants, and they are left out of games, guess-first rounds, distractors and mock exams, which need a short answer.
- A basic card tagged `why` or `how` is never flipped either: you type an explanation before its back shows, then rate yourself as on a flip card. (A short back is still typed and checked.)
- Exported to Anki, an explain card is a basic card with its key points under the notes (or as its back when it has none).

## Prerequisites

Any card can say what to learn first in `requires`: the fronts of other cards of the same deck, or tags, separated by `|`.

```json
{"front":"Chain rule","back":"Outer derivative times inner derivative","requires":"Derivative|#functions"}
```

- A name is matched to a card's front first (ignoring case and punctuation), then to a tag, which stands for every card with that tag. `#functions` always means the tag.
- New cards are met after the cards they require were recalled (answered from memory once). This only orders new cards: a card whose basics are not ready moves to the end of the queue and is still met when nothing else is left. Nothing is locked.
- Cards tagged `key-term` are met before the other new cards.
- When a due card that was forgotten twice or more requires cards you know only weakly, a session shows those first as quick multiple-choice questions; a required card that is due is reviewed before the card that needs it.
- Deck files are untrusted: at most 10 names of 200 characters, plain text. Names that match nothing are ignored, a card never requires itself, and a link that would close a circle is dropped.

## Compare cards

A card of type `twin` puts two things that are easy to mix up side by side. Its front is the first, `twin` is the second, and its back says what they share and the one key difference:

```json
{"type":"twin","front":"affect: to influence","twin":"effect: a result","back":"Both are about change. Affect is the verb, effect is the noun."}
```

- In CSV, put the second thing in a `twin` column. A basic card with a `twin` is a compare card even without a type.
- `twin` is plain text of at most 500 characters. Other card types drop it.
- The back may be empty: the learner then checks their own answer without a written one.
- A session shows both sides and asks "What do they share? What is the one key difference?". You answer in your head, show the back and rate yourself as on a flip card. It is a normal recall with one grade per day. Compare cards stay out of games, wrong choices, guess rounds and mock exams.
- LernLab offers to add one after you mixed up the same two cards three times. Which cards you mix up stays on your computer; it is not part of a deck file.
- Exported to Anki, a compare card is a basic card with its front and back.
## Case chains

A case chain is a short case (a patient, a legal fact pattern, an architecture, a historical situation) followed by a few linked questions, usually 2–4: diagnose, explain, decide. Each question is an ordinary card with its own answer. The cards carry the same `case`:

```json
{"front":"What is the most likely diagnosis?","back":"Inferior STEMI","case":"A 58-year-old man has crushing chest pain for 40 minutes. His ECG shows ST elevation in II, III and aVF."}
{"front":"Which artery is most likely blocked?","back":"Right coronary artery","case":"A 58-year-old man has crushing chest pain for 40 minutes. His ECG shows ST elevation in II, III and aVF."}
```

- In CSV, repeat the case in a `case` column on each of its rows. Cards of one deck with exactly the same case form a chain, in the order of the file.
- `case` is plain text with `**bold**`, `*italic*` and `` `code` ``, on one line (line breaks become spaces), at most 2000 characters. Cloze, ordering, code and image occlusion cards drop it.
- **For older readers,** a writer puts the case before the question in `front`, separated by an empty line, so the card can still be answered. A reader that knows `case` drops it from the front again: a front that starts with the case is the question alone.
- Each question is its own card: it is reviewed when it is due and graded by its own recall, once a day. The case shows above every question, in sessions and in the card browser's preview. Questions of one case that come up in the same round are asked together, in order.
- A mock exam draws a case whole: all its questions, in order, with the case above each.
- Case questions are left out of games and guess-first rounds, where the case would be missing.
- Exported to Anki, each question is a basic card with the case before the question.

## Worked examples

A card of type `worked` holds one solved problem: the problem on the front, the answer on the back and the solution in `workedSteps`, 2–8 steps separated by `|`. Each step is `what you do :: result`:

```json
{"type":"worked","front":"Solve 2x + 3 = 11","back":"x = 4","workedSteps":"Subtract 3 from both sides :: 2x = 8|Divide both sides by 2 :: x = 4"}
```

- In CSV, put `worked` in the `type` column and the steps in a `worked_steps` column. Two or more steps make a worked example even without a type.
- The first `::` splits a step; a step without `::` is only a result. A step without a result is dropped, a ninth step and later ones too. With fewer than two steps, the card is a basic card and keeps none. Steps are plain text with `**bold**`, `*italic*`, `` `code` `` and math in `\( … \)`; what you do is at most 300 characters, a result at most 200. A `|` can't be part of a step.
- The back may be empty: it is then the last step's result. An older reader studies a basic card with the problem and this answer.
- **The ladder.** A session first shows the full example to study. Next it shows all steps but the last and you type the last result; then the last two; and so on until you solve the whole problem. A rung done right moves you one up, a miss one down, so a problem you can no longer solve fades its first steps back in. The rungs are practice: they never grade the card and it stays a new (or due) card. Only solving the whole problem is a recall with one grade per day: every step right is Good, right with a small slip is Hard, a wrong step is Again. There is no timer.
- A typed step is checked like a typed answer: a result that is a number with an optional unit (`9.81 m/s^2`) by its value, a formula by its LaTeX source, anything else as text, where a small typo is a slip and spaces never matter (`x=4` is `x = 4`).
- Worked examples have no question variants, and they are left out of games, guess-first rounds, distractors and mock exams.
- Exported to Anki, a worked example is a basic card with its steps under the notes, numbered.

## Math and numeric cards

**Math.** Any card text can hold LaTeX formulas, written like Anki writes them: `\( \frac{1}{2} mv^2 \)` inside a line, `\[ … \]` or `$$ … $$` on a line of their own. A single `$` is never math, so prices stay prices. The app draws formulas with KaTeX (bundled, works offline) and keeps its MathML, so screen readers read the formula.

- The safe list still applies first: tags are removed even inside a formula. Write `<` as `\lt` or with a space after it (`a < b`).
- Formulas run untrusted: `\href`, `\url`, `\includegraphics` and the `\html…` commands do nothing. A formula with a mistake shows its source in the error colour instead of breaking the card.
- `**bold**` and `*italic*` are not applied inside a formula, so `z^*` stays as written.

**Typed answers with math.** When the answer is a formula, what you type is compared with its LaTeX source, exactly (no typo forgiveness, because one character changes the meaning). These differences don't matter:

- the delimiters (`2x` matches `\(2x\)`) and all spaces;
- braces around a single symbol: `x^{2}` = `x^2`, `\frac{1}{2}` = `\frac12`;
- layout-only commands: `\left`, `\right`, `\displaystyle`, `\,` `\;` `\quad` and the like; `\dfrac` and `\tfrac` are `\frac`;
- the multiplication sign: `\cdot`, `\times`, `*`, `·` and `×` are the same sign (but a written sign is not the same as none: `2*x` ≠ `2x`);
- Unicode: `x²` = `x^2`, `−` = `-`.

Case always matters (`X` ≠ `x`). An answer with a math part is never split into alternatives on `/` or `;`; use `altAnswers` for other accepted forms.

**Numeric cards** (`type: numeric`). The back is a number, then optionally `± tolerance` and a unit: `9.81 m/s^2`, `9.81 ± 0.05 m/s^2`, `300 000 km/s`. If the back does not start with a number, the card is a basic card. The `tolerance` field (`0.05` or `1%`) overrides a `±` in the back. A typed answer is right when:

- its number is within the tolerance. Without a tolerance it must be the same number (only rounding noise in the computer's arithmetic is forgiven).
- Numbers can be typed as `9.81` or `9,81` (a single comma is a decimal comma; with both, the last one is the decimal mark), with digit groups (`300 000`, `1,234.5`, `1.234,5`), in scientific notation (`6.02e23`, `6.02 × 10^23`, `6.02·10⁻³`) and with `−` as minus.
- The unit may be left out. A typed unit must be the card's unit, written with any spacing or `²`/`^2`, or the same unit with another SI prefix (`1500 m` for `1.5 km`, `20000 µA` for `20 mA`; prefixes T to p on the base and derived SI units, litres, bar, eV, B). Units are case-sensitive (`mA` ≠ `MA`); compound units (`m/s`) must match as written.
- There are no near misses: a number is right or wrong. `altAnswers` are still accepted as text.

## Code cards

A code card (`type: code`) holds a snippet in `code` and its language in `codeLang`. The code is plain text: it is shown exactly as written (line breaks, indentation, `<` and `&`), is never treated as HTML and is **never run**. The `front` is the task (`What does this print?`). How the card is asked depends on what it holds:

- **Fill the token**: a gap like `{{c1::range}}` (or `{{c1::range::hint}}`) in the code. You type the missing token; other gaps are shown filled in.
- **Predict the output**: a `back`. The back is the exact output, plain text with its line breaks.
- **Order the lines** (a Parsons problem): neither. The non-empty lines are shuffled and you put them back in order; indentation is shown. Identical lines (two closing braces) may go either way round. A card with fewer than two lines and nothing else is studied as a basic card.

`codeLang` colours the code and names it for screen readers. Known: `python` (`py`), `javascript` (`js`), `typescript` (`ts`), `java`, `c`, `cpp` (`c++`), `csharp` (`c#`, `cs`), `go`, `rust` (`rs`), `sql`, `bash` (`sh`, `shell`). Any other language, or none, is shown as plain code.

**Typed code answers** (an output or a token) are compared exactly, with no typo forgiveness and with case mattering (`True` ≠ `true`), except for whitespace:

- a run of spaces, tabs and line breaks counts as one space, so a multi-line output can be typed on one line (`0 1 2` for three lines);
- spaces next to punctuation don't count (`[1, 2]` = `[1,2]`), but a space between two words or numbers does (`1 2` ≠ `12`);
- spaces at the start and end don't count, and curly quotes count as straight quotes.

`altAnswers` are other accepted answers, compared the same way.

## Image occlusion cards

An occlusion card (`type: occlusion`) hides one part of a picture: you name the hidden part. A picture with five labelled parts is five cards, one per box, each with its own schedule. Each card holds:

- `image`: the picture (required; without it the card is a basic card), and `imageAlt`, its description for screen readers;
- `occlusion`: its box as `x,y,w,h`, four numbers from 0 to 1 that are fractions of the image's width and height (`0.4,0.05,0.2,0.1` is a box starting 40% from the left and 5% from the top, a fifth of the width wide and a tenth of the height high), so the box fits the picture at any size. Readers keep a box inside the image and round to 4 decimals; a box that does not read as four numbers with a positive size makes a basic card;
- `back`: the box's label, the answer you type (plain text);
- `front`: the question shown above the picture (`Label the heart`), the same on every box;
- `occlusionGroup`: the boxes of one picture share it, so each card can show its siblings. Without it, the boxes of one deck with the same image file are one picture;
- `occlusionMode`: `one` hides only the asked box and shows the other boxes with their labels; `all` hides every box and marks the asked one. It is the same on every box of a picture.

Suspending, editing or deleting one box leaves its siblings as they are (a suspended box is still drawn on the picture). Occlusion cards are recall only: they are typed, graded like any card, and kept out of the choice games, picture quizzes, listening and speaking. Exported to Anki, an occlusion card is a basic note with the whole image.

## CSV / TSV

- One card per row, UTF-8. Comma, tab or semicolon is detected automatically.
- A header row is optional. Without one, column 1 is the front and column 2 is the back (Quizlet export style).
- Lines starting with `#` are ignored (except inside a quoted cell).

Recognised column names (case-insensitive):

| Column | Also accepted |
|---|---|
| `front` | term, question, word, target, prompt, expression |
| `back` | definition, answer, meaning, translation |
| `example` | sentence, context |
| `example translation` | sentence meaning, example_translation |
| `explanation` | grammar, rule, why, rationale |
| `notes` | note, hint, extra |
| `mnemonic` | mnemonics, memory aid (before November 2026 a `mnemonic` column was read as notes) |
| `category` | class, gender, article, group |
| `tags` | tag, labels (space- or comma-separated) |
| `type` | card type, kind (`mcq`, `order`, `cloze`) |
| `choices`, `correct` | options / correct answer(s) |
| `steps` | sequence |
| `alt_answers` | alternatives, also accept |
| `variants` | question variants, variant questions, other questions: see [Question variants](#question-variants) |
| `corrections` | misconceptions, choice feedback, wrong choice feedback: see [Corrections for wrong choices](#corrections-for-wrong-choices) |
| `key_points` | key points, keypoints: see [Explain cards](#explain-cards) |
| `twin` | compare with, compare_with: see [Compare cards](#compare-cards) |
| `requires` | prerequisites, learn first: see [Prerequisites](#prerequisites) |
| `key_terms` | key terms, keyterms: see [Key terms](#key-terms) |
| `case` | scenario, vignette: see [Case chains](#case-chains) |
| `worked_steps` | worked steps, solution steps: see [Worked examples](#worked-examples) |
| `tolerance` | tol |
| `code` | snippet, source code: a code card's code (quote it to keep line breaks; a line starting with `#` inside quotes is code, not a comment) |
| `code_lang` | code language, programming language |
| `occlusion`, `occlusion_group`, `occlusion_mode` | occlusion box, occlusion group, occlusion mode: an occlusion card's box (quote it: it has commas), group and mode |
| `image`, `audio`, `video` | picture, sound, gif |
| `image_alt` | image alt, image description, alt text: the image's description for screen readers |
| `deck` | subdeck, chapter, section, topic |
| `rank` | frequency, order |
| `id` | guid |

To include media with a CSV, zip the CSV together with the files it references and import the zip.

**Exporting a CSV** (Decks → a deck's options → Export CSV) writes every column above plus `lesson` and `reading`, so importing it gives the same cards. A CSV holds media file names, not the files: export a `.lernpack` to take pictures and sounds along.

**CSV template.** Decks → "Download the CSV template" saves `lernlab-template.csv`: the main columns and three example cards (a plain card with two question variants, a multiple-choice card with a correction for a wrong choice and a language card).

## Anki `.apkg`

- Notes are mapped by field name. `Front/Term/Word/Question/Text` become the front; `Back/Meaning/Definition/Answer/Extra` become the back; `Sentence/Example`, `Notes`, `Grammar` and a reading field are recognised too. Any other field is kept in `extra`.
- `[sound:…]` and `<img src="…">` become the card's audio and image; the media files are copied.
- Cloze notes (`{{c1::…}}`) become cloze cards.
- **Review history.** When the package has Anki's review log (a `.colpkg`, or an `.apkg` exported with scheduling information), the import preview offers "Keep my Anki progress", on by default. The reviews are replayed with FSRS (LernLab's scheduler, at your retention setting), so each card gets its stability, difficulty and next due date, and the reviews are kept in the `imported_reviews` table (they are not answers given in LernLab, so they add no XP or streak days). The report says how many came over (`reviews`). The rules:
  - Anki's buttons map to FSRS grades: 1 Again, 2 Hard, 3 Good, 4 Easy, in time order.
  - Counted: learning, review and relearning answers, and answers in a filtered deck that reschedules. Skipped: cramming in a filtered deck with rescheduling off, manual changes ("set due date"), Anki's own rescheduling, and entries without a button. A "forget" (reset to new) drops the history before it.
  - One grade per card per day, as in LernLab: the first answer of each day (days start at 4 a.m.) counts, later ones that day are skipped.
  - A LernLab card is one Anki note: the history of the note's first card (usually front → back) is used; reviews of its other cards, such as the reverse card, are left out.
  - Cards you have already studied in LernLab keep their own progress; importing the same package again brings nothing over twice.
- Packages exported by current Anki (`collection.anki21b`, zstd-compressed) and older ones both work.

## Export to Anki (`.apkg`)

Decks → a deck's options → **Export for Anki** saves `<deck>.apkg`, which Anki (2.1 and current versions) opens with File → Import.

- **The package.** A zip with `collection.anki2` (Anki's legacy collection, schema version 11, which every Anki version imports), a `media` file (JSON: zip entry `"0"`, `"1"`… → file name) and the media files the cards use. LernLab writes it in `packages/core/src/formats/apkgwrite.ts`.
- **Note types.** `Basic (LernLab)` with the fields `Front`, `Back`, `Example`, `Example translation`, `Explanation`, `Notes`, `Image`, `Audio`, `Video`, and `Cloze (LernLab)` with `Text`, `Back` and the same extra fields. Their ids are fixed, so exporting again reuses them in Anki.
- **Cards.** A plain card is one Basic note. A cloze card is one Cloze note, with one Anki card per gap number (`{{c1::…}}`, `{{c2::…}}`). Multiple-choice and ordering cards become Basic notes whose back shows the right choices or the steps in order. An image occlusion card becomes a Basic note with the whole image and the box's label as the back (Anki's own occlusion notes are not written). Plain text (including a code card's output and a number answer) is HTML-escaped, with its line breaks kept; formatted fields keep their HTML. Tags keep their names, with spaces turned into `_` (Anki tags have no spaces).
- **Media.** The image goes in as `<img src="…">` (with its description as `alt`), audio and video as `[sound:…]`.
- **Decks.** The deck keeps its name; sub-decks (`Deck::Sub`) become Anki sub-decks.
- **Schedule.** Cards arrive in Anki as new cards. LernLab's FSRS progress and review history are not exported.
- **Back to LernLab.** Each note's guid is `lernlab-<card id>`. Importing the package (or an Anki export of the same notes) back into the same deck updates those cards in place; into another deck it makes a copy. A deck's language is not stored in Anki, so pick it on the import screen.

**Manual check in Anki** (done before a release that changes the exporter):

1. Export a deck that has a plain card with an image and audio, a cloze card with two gaps and a sub-deck.
2. In Anki (current version and 2.1.x), File → Import → the `.apkg`. Anki reports the notes added, with no errors.
3. Browse: the deck and sub-deck exist; the cloze note has two cards; the note types are `Basic (LernLab)` and `Cloze (LernLab)`.
4. Study one card of each kind: the image shows, the audio plays, the cloze gaps hide and reveal.
5. Tools → Check Database reports no problems. Import the same file again: nothing is duplicated.

## Live import from Anki (AnkiConnect)

- Needs Anki open with the AnkiConnect add-on (code `2055492159`). LernLab talks to it only on this computer (`http://127.0.0.1:8765`); `ANKICONNECT_URL` may change the port but never the host.
- **Decks → Import → From Anki** lists every Anki deck with its card count. Tick one or more; a ticked parent deck brings its subdecks along. Each ticked deck becomes one LernLab deck, with its audio and images copied.
- When Anki can't be reached, the panel explains how to open Anki and install the add-on, and offers to check again. It tells apart "Anki is closed" from "another program answers on that port".
- Each deck gets its own import report (`import.status` → `results`), or an error code such as `anki_unreachable` or `anki_deck_empty`.

## Limits

Deck files are treated as untrusted. The importer checks them before it unpacks anything (`IMPORT_LIMITS` in `packages/core/src/formats/zip.ts`):

| What | Limit | What happens |
|---|---|---|
| File you import | 500 MB | The file is refused |
| Everything inside a zip, unpacked (as the zip declares it) | 2 GB | `zip_too_big`: the file is refused |
| One zip entry's compression ratio | 1000 : 1 (entries over 1 MB) | `zip_too_big`: refused as a zip bomb |
| Files inside one zip | 20,000 | `zip_too_many_files` |
| Anki collection after zstd decompression | 1 GB | `zip_too_big` |
| Cards in one import | 100,000 | `too_many_cards`: split the file |
| Image / audio / video file | 20 MB / 50 MB / 200 MB | `media_too_large`: that file is left out, the cards still import |

- **Paths:** a zip entry whose path contains `..`, starts with `/` or `\`, or names a drive (`C:`) makes the whole file fail with `zip_unsafe_path`. Media files are always saved under their own name in the media folder, never at a path from the zip.
- **Nested zips** (`.zip`, `.apkg`, `.colpkg`, `.lernpack` inside a zip) are not opened: `nested_zip_ignored`.
- **File type** is checked by content, not by name: an image that is really a program, a web page or audio is left out (`media_wrong_type`). Only the image, audio and video types listed above are saved (`media_unsupported`). Only media files that a card uses are unpacked.
- **Text encoding:** UTF-8, and UTF-16 with a byte order mark (Excel's "Unicode text"). A file that is not valid UTF-8 is read as Windows-1252 with the warning `encoding_guessed`. A binary file fails with `not_text`.

## Import report

Every import (file, pasted text, live Anki) answers with the same report (`ImportReport` in `packages/core/src/importer.ts`):

| Field | Meaning |
|---|---|
| `deck` | The deck the cards went into |
| `format` | `lernpack`, `apkg`, `csv+media`, `json`, `csv`, `tsv`, `paste` or `anki` |
| `added`, `updated`, `total` | New cards, cards matched by id (text updated, progress kept), cards in the deck afterwards |
| `skipped` | Rows not imported: `{ row, code }`. `row` is the line in a CSV, TSV or JSONL file, otherwise the card's position (from 1) |
| `skippedCount` | All skipped rows (`skipped` lists the first 500) |
| `media` | Media files saved |
| `mediaMissing`, `missingMedia` | How many media files cards refer to that were not in the file, and their names (first 500) |
| `warnings` | Files left out: `{ code, file }` |
| `reviews` | Past Anki reviews replayed into the schedule (0 for other formats) |

Codes for skipped rows: `row_no_front`, `row_duplicate` (the same card earlier in the file), `row_invalid` (a JSON value that is not a card). Warning codes: `media_unsupported`, `media_too_large`, `media_wrong_type`, `nested_zip_ignored`, `encoding_guessed`. A file that cannot be imported at all fails with one error code instead: `zip_damaged`, `zip_unsafe_path`, `zip_too_big`, `zip_too_many_files`, `too_many_cards`, `bad_json`, `not_text`, `no_cards`, `unsupported_zip`, `not_lernpack`, `lernpack_too_new`, `lernpack_no_cards`, `not_anki`, `anki_damaged`. Every code has a message under `errors.<code>` in `locales/*.json`; `file`, `mb` and `max` fill its placeholders.

## Progress export

Progress isn't part of a shared deck. Your study history lives in the local database (`lernlab.db` in the data folder). `GET /api/summary/today` and `data/progress/YYYY-MM-DD.json` give a daily JSON summary for scripts and AI tutors.
