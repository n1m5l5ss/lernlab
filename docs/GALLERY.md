# Deck gallery

The deck gallery lists free community decks that anyone can install with one click (Decks → **Deck gallery**). The decks live as `.lernpack` files ([format version 1](FORMAT.md#deck-package-lernpack-format-version-1)) in a public GitHub repository, next to one `index.json` that lists them.

## When the app goes online

Only while the user has the gallery open (principle 4). Opening it downloads `index.json`; **Install** downloads that one deck file. Nothing is fetched at start-up, in the background or for decks the user did not choose. `apps/desktop/backend/gallery.test.ts` checks that no request is made before the gallery is opened.

All downloads run in the data process (`apps/desktop/backend/gallery.ts`), never in the window or the main process:

| What | Limit |
|---|---|
| `index.json` | 2 MB, 15 s, at most 5,000 decks |
| One deck file | its `size` from the index (at most 200 MB), 120 s |

A download that is bigger than allowed is stopped while it streams (`gallery_too_big`). No connection gives `gallery_offline`, an HTTP error `gallery_unavailable`; the gallery then says it can't be reached, that your own decks work offline as always, and offers **Try again**.

## Where the index lives

The default address is one constant, `GALLERY_INDEX_URL` in `packages/core/src/gallery.ts`:

```
https://raw.githubusercontent.com/n1m5l5ss/lernlab-decks/main/index.json
```

For testing, the environment variable `LERNLAB_GALLERY_URL` can point at another `https://` index, or at a plain `http://` one on this computer (`127.0.0.1`, `localhost`, `[::1]`). Any other value is ignored.

## index.json (version 1)

```json
{
  "format": "lernlab-gallery",
  "version": 1,
  "updated": "2026-11-21",
  "decks": [
    {
      "id": "german-colours",
      "title": "German colours",
      "description": "Twelve colours with pictures, for beginners.",
      "language": "de",
      "cards": 12,
      "licence": "CC-BY-4.0",
      "author": "LernLab",
      "url": "decks/german-colours.lernpack",
      "sha256": "4f0c…64 hex digits…",
      "size": 24353,
      "tags": ["beginner", "colours"]
    }
  ]
}
```

| Key | Required | Meaning |
|---|---|---|
| `format` | yes | Always `"lernlab-gallery"` |
| `version` | yes | `1`. An app refuses an index with a version it does not know (`gallery_bad_index`) |
| `updated` | no | When the index was last changed (ISO 8601 date) |
| `decks` | yes | The decks, in the order the gallery shows them |
| `decks[].id` | yes | Unique, stable: lower-case letters, digits and `-`, up to 80 characters |
| `decks[].title` | yes | The deck's name in the gallery; the installed deck gets this name |
| `decks[].description` | no | One or two sentences |
| `decks[].language` | no | Language code of the cards' front side (`de`, `pt-BR`), or `null` for any other subject |
| `decks[].cards` | yes | Number of cards (1–100,000), for display |
| `decks[].licence` | yes | [SPDX](https://spdx.org/licenses/) licence id or expression: `CC-BY-4.0`, `CC-BY-SA-4.0`, `CC0-1.0`, `MIT OR CC0-1.0` |
| `decks[].author` | yes | Who made the deck |
| `decks[].url` | yes | The `.lernpack` file: a path relative to `index.json`, or an absolute `https://` URL on the index's own site or on GitHub (`github.com`, `raw.githubusercontent.com`, `objects.githubusercontent.com`) |
| `decks[].sha256` | yes | SHA-256 of the file, 64 hex digits |
| `decks[].size` | yes | Size of the file in bytes |
| `decks[].tags` | no | Words for search (up to 20) |

Readers ignore unknown keys. An entry that breaks a rule above (a missing licence, a bad checksum, a URL elsewhere, a repeated id) is left out and the rest of the index still loads; an index that is not JSON or not a gallery index is refused as a whole.

## Installing

1. The window sends only the deck's `id`. The data process looks it up in the index it downloaded when the gallery was opened, so a deck that is not listed there can't be installed (`gallery_unknown_deck`).
2. The file is downloaded with the size limit from the index. Its size and SHA-256 must match the index exactly, or nothing is imported (`gallery_checksum`).
3. Then it goes through the normal importer for untrusted deck files: zip path checks, size and ratio limits, media type checks and HTML sanitising ([Limits](FORMAT.md#limits)). The deck gets the gallery title; installing it again updates its cards by id and keeps progress.

The licence is shown on every deck in the list, next to its **Install** button, and is part of the button's accessible name.

## Sharing a deck

The gallery's **Share your deck** link opens the [deck submission form](../.github/ISSUE_TEMPLATE/deck_submission.yml) in LernLab's issues. It asks for the title, a description, the language, the author, an open licence (CC BY 4.0, CC BY-SA 4.0 or CC0) and the `.lernpack` file.

A maintainer then, in the `lernlab-decks` repository:

1. imports the file into LernLab to check it, and exports it again if needed;
2. adds it as `decks/<id>.lernpack`;
3. adds its entry to `index.json`, with `sha256sum decks/<id>.lernpack` and `stat -c %s decks/<id>.lernpack` for `sha256` and `size`;
4. merges to `main`. The app sees the new deck the next time someone opens the gallery.
