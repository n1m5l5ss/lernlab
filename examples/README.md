# Sample decks

Ready-to-import decks, also useful as templates for making your own.

| Download | What's inside |
|---|---|
| [german-colours-with-pictures.zip](downloads/german-colours-with-pictures.zip) | German colour words with pictures, plus two verbs with animated GIFs. Shows how media folders work. |
| [german-a1-starter.zip](downloads/german-a1-starter.zip) | First German words, with articles and example sentences |
| [aws-cloud-basics.zip](downloads/aws-cloud-basics.zip) | Core AWS services for the Cloud Practitioner exam |
| [biology-the-cell.zip](downloads/biology-the-cell.zip) | Parts of the cell and what they do |
| [template.zip](downloads/template.zip) | An empty template: manifest, a `cards.csv` with every column, and empty `images/`, `audio/` and `video/` folders |

The unzipped versions are in [`decks/`](decks/), so you can see exactly how a package looks. The plain spreadsheet files (`*.csv`, `*.tsv`) in this folder also import on their own.

To make your own: download `template.zip`, unzip it, edit `cards.csv` in Excel or Google Sheets, drop your pictures into `media/images/`, zip the folder again and import it. The full format is in [docs/FORMAT.md](../docs/FORMAT.md).

All sample decks are CC0 (public domain). Rebuild them with `python3 scripts/build_sample_decks.py`.
