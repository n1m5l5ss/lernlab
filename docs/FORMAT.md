# Deck formats

LernLab imports and exports decks in open formats, so your cards never get locked in.

| Format | Import | Export | Best for |
|---|---|---|---|
| `.lernpack` | ✅ | ✅ | Sharing complete decks with media (the native format) |
| CSV / TSV / TXT | ✅ | ✅ | Spreadsheets, Quizlet-style lists, quick authoring |
| Pasted text | ✅ | — | Copying a list from anywhere, with custom separators |
| JSON | ✅ | — | Scripts and generators |
| `.zip` with a CSV plus media files | ✅ | — | CSV decks with images, audio or video |
| Anki `.apkg` / `.colpkg` | ✅ | (planned) | Moving from Anki: old (`collection.anki2/anki21`) and new (`anki21b`, zstd) packages |
| Live Anki (AnkiConnect) | ✅ | — | Pulling a deck straight from a running Anki |

Re-importing a deck **updates** cards instead of duplicating them, and keeps your progress. Cards are matched by their `id`, or, if there is none, by deck name plus front and back.

## Deck package (format version 1)

A deck package is a zip file. It can end in `.zip` or `.lernpack`; the final file ending is decided together with the product name. Download a ready-made example from `examples/downloads/`.

```
german-colours.zip
└── german-colours/          optional top folder (any name)
    ├── manifest.json        recommended: deck name, language, description
    ├── cards.csv            the cards: one row per card (main format, edit in Excel or Google Sheets)
    └── media/               optional
        ├── images/          .jpg .png .webp .gif (animated GIFs work)
        │   ├── rot.png
        │   └── drehen.gif
        ├── audio/           .mp3 .ogg .m4a .wav
        │   └── rot.mp3
        └── video/           .mp4 .webm
```

Rules:

- **Cards file.** `cards.csv` is the main format: UTF-8, comma-separated, with a header row. The same columns as a plain CSV (below).
  - `cards.jsonl` (one JSON card per line) is also accepted, for scripts and for card types that don't fit in a spreadsheet.
  - If both are present, `cards.jsonl` wins.
- **Media paths.** Write them in the `image`, `audio` and `video` columns relative to `media/`, for example `images/rot.png` or `audio/rot.mp3`.
  - The importer also finds a file by its name alone, so `rot.png` works, and so do media folders with other names.
  - Missing files are listed in the import report, never silently dropped.
- **GIFs** are images: put them in `images/`.
- **Limits** (enforced by the importer, ticket #25):
  - **Size:** images up to 20 MB, audio up to 50 MB, video up to 200 MB, 2 GB in total.
  - **Not accepted:** nested zips; file paths containing `..` or starting with `/`.
  - **File type:** checked by the file's content, not its name.
- **Without a manifest.** A zip with just a CSV and media files also works. The deck is named after the CSV file.

Exporting writes `cards.jsonl` (lossless). Writing a matching `cards.csv` beside it and sorting media into `images/`, `audio/` and `video/` is ticket #57.

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

- `deck.language` is a language code (`de`, `ja`, `ko`, `fr`, …) for language decks, or `null` for any other subject.
- Readers must ignore unknown keys. A higher `version` means a newer app is needed.

### cards.jsonl

Each line is one card. Only `front` is required.

```json
{"id":"s3","front":"Amazon S3","back":"Object storage for any amount of data","category":"Storage","tags":["aws","storage"],"image":"s3.png"}
{"id":"serverless","type":"mcq","front":"Which TWO services are serverless?","choices":"Amazon EC2|AWS Lambda|AWS Fargate|Amazon RDS","correct":"2|3","explanation":"Lambda and Fargate need no server management."}
{"id":"tcp","type":"order","front":"Order the TCP handshake","steps":"SYN|SYN-ACK|ACK"}
{"id":"mito","front":"The {{c1::mitochondrion}} is the powerhouse of the cell","back":"Biology 101"}
{"id":"sohn","front":"der Sohn","back":"son","example":"Mein <b>Sohn</b> ist zehn.","exampleTranslation":"My son is ten.","audio":"sohn.mp3","category":"der"}
```

| Field | Meaning |
|---|---|
| `id` | Stable id (any string) so updates keep progress |
| `type` | `basic` (default), `cloze`, `mcq`, `order` |
| `front` | Term, question or prompt. Cloze: text with `{{c1::answer}}` or `{{c1::answer::hint}}` (Anki syntax) |
| `back` | Definition or answer |
| `altAnswers` | Other accepted answers, separated by `|` (e.g. `colour|color`) |
| `example` | Example sentence. Mark the studied word with `<b>…</b>` to get fill-the-gap rounds |
| `exampleTranslation` | Translation of the example |
| `explanation` | Shown after answering (rule, rationale) |
| `notes` | Extra notes, mnemonics |
| `category` | Group for sorting rounds (`der`/`die`/`das`, `Storage`/`Compute`, `Cardio`…) |
| `choices`, `correct` | Multiple choice / multi-select: choices separated by `|`; correct as 1-based numbers or texts, separated by `|` |
| `steps` | Ordering card: steps in the correct order, separated by `|` |
| `image`, `audio`, `video` | File name inside `media/` (or an `https://` URL). Video can be mp4/webm; GIFs work as images |
| `tags` | Array of strings |
| `subdeck` | Sub-deck path, e.g. `Medicine::Cardio` |
| `group` | Lesson group: cards with the same group are taught together in a mini-lesson |
| `rank` | Introduction order (e.g. word frequency rank) |
| `extra` | Any other fields (object of strings), e.g. `{"reading": "…"}` |

Allowed formatting in text: `<b> <i> <u> <br> <sup> <sub> <code> <pre> <ul> <ol> <li> <mark>`. Everything else is stripped on display, because decks are shared files. In CSV you can also write `**bold**`, `*italic*` and `` `code` ``.

## CSV / TSV

- One card per row, UTF-8. Comma, tab or semicolon is detected automatically.
- A header row is optional. Without one, column 1 is the front and column 2 is the back (Quizlet export style).
- Lines starting with `#` are ignored.

Recognised column names (case-insensitive):

| Column | Also accepted |
|---|---|
| `front` | term, question, word, target, prompt, expression |
| `back` | definition, answer, meaning, translation |
| `example` | sentence, context |
| `example translation` | sentence meaning, example_translation |
| `explanation` | grammar, rule, why, rationale |
| `notes` | note, hint, mnemonic, extra |
| `category` | class, gender, article, group |
| `tags` | tag, labels (space- or comma-separated) |
| `type` | card type, kind (`mcq`, `order`, `cloze`) |
| `choices`, `correct` | options / correct answer(s) |
| `steps` | sequence |
| `alt_answers` | alternatives, also accept |
| `image`, `audio`, `video` | picture, sound, gif |
| `deck` | subdeck, chapter, section, topic |
| `rank` | frequency, order |
| `id` | guid |

To include media with a CSV, zip the CSV together with the files it references and import the zip.

## Anki `.apkg`

- Notes are mapped by field name. `Front/Term/Word/Question/Text` become the front; `Back/Meaning/Definition/Answer/Extra` become the back; `Sentence/Example`, `Notes`, `Grammar` and a reading field are recognised too. Any other field is kept in `extra`.
- `[sound:…]` and `<img src="…">` become the card's audio and image; the media files are copied.
- Cloze notes (`{{c1::…}}`) become cloze cards.
- Anki's own scheduling history is not imported yet (planned), so cards start fresh.
- Packages exported by current Anki (`collection.anki21b`, zstd-compressed) and older ones both work.

## Progress export

Progress isn't part of a shared deck. Your study history lives in the local database (`lernlab.db` in the data folder). `GET /api/summary/today` and `data/progress/YYYY-MM-DD.json` give a daily JSON summary for scripts and AI tutors.
