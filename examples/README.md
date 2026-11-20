# Sample decks

Ready-to-import decks, also useful as templates for making your own.

## Example decks

Three complete decks, one each for a language, a certification and a science. Download a `.lernpack` and drop it on the Decks screen in LernLab.

| Download | What's inside |
|---|---|
| [spanish-first-conversations.lernpack](spanish-first-conversations.lernpack) | **Spanish: first conversations.** 41 cards: greetings and polite phrases, 16 nouns with *el* and *la* (for the sorting game), 8 key verbs, example sentences with translations, two gap sentences and two grammar questions. Answers typed without accents or `¿` are accepted. |
| [networking-essentials.lernpack](networking-essentials.lernpack) | **Networking essentials.** 38 cards for entry-level networking certifications such as CompTIA Network+: 15 well-known ports, OSI layers, devices, IPv4 and IPv6 addressing, exam-style multiple-choice questions and two ordering cards. Written from scratch; no real exam questions. |
| [chemistry-first-20-elements.lernpack](chemistry-first-20-elements.lernpack) | **Chemistry: the first 20 elements.** 36 cards: names and symbols of elements 1 to 20, sorted into metals, nonmetals and metalloids, plus atoms, ions, bonds and a few formulas. |

Each one is built from a folder in [`decks/`](decks/) with a `manifest.json` and a `cards.csv` you can open in any spreadsheet. Every card has an `id`, so a fixed card updates in place when people import the deck again. After you change a `cards.csv`, rebuild the packages with `npx tsx scripts/build-example-lernpack.ts`. `packages/core/test/example-decks.test.ts` checks that every example imports cleanly and that each `.lernpack` matches its folder.

## Small decks and the template

| Download | What's inside |
|---|---|
| [german-colours-with-pictures.zip](downloads/german-colours-with-pictures.zip) | German colour words with pictures, plus two verbs with animated GIFs. Shows how media folders work. |
| [german-a1-starter.zip](downloads/german-a1-starter.zip) | First German words, with articles and example sentences |
| [aws-cloud-basics.zip](downloads/aws-cloud-basics.zip) | Core AWS services for the Cloud Practitioner exam |
| [biology-the-cell.zip](downloads/biology-the-cell.zip) | Parts of the cell and what they do |
| [template.zip](downloads/template.zip) | An empty template: manifest, a `cards.csv` with every column, and empty `images/`, `audio/` and `video/` folders |

[german-colours-with-pictures.lernpack](german-colours-with-pictures.lernpack) is the same colours deck as LernLab exports it: a `.lernpack` version 1 package with `manifest.json`, `cards.jsonl` and `media/`. `npx tsx scripts/build-example-lernpack.ts` rebuilds it too.

The unzipped versions are in [`decks/`](decks/), so you can see exactly how a package looks. The plain spreadsheet files (`*.csv`, `*.tsv`) in this folder also import on their own.

To make your own: download `template.zip`, unzip it, edit `cards.csv` in Excel or Google Sheets, drop your pictures into `media/images/`, zip the folder again and import it. The full format is in [docs/FORMAT.md](../docs/FORMAT.md).

All decks in this folder are CC0 (public domain): copy, change and share them freely. Rebuild the small decks and zips with `python3 scripts/build_sample_decks.py`.
