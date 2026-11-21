// 004: indexes for the deck list and stats (#130, docs/TESTING.md "Performance budgets").
// - items_deck_state: the per-deck counts read deck, suspended and kind from this index instead of the
//   wide items rows. It replaces items_deck, which is a prefix of it.
// - srs_introduced: "cards introduced today" (each deck's new-card limit) without scanning srs.
// - items_ord: the next new cards (in deck order) across all decks without sorting every card.
// - items_tags: the list of tags and tag sessions read the tags from this index, not the wide rows.
// - items_starred: the starred count and starred sessions read only the starred cards.
import type { DB } from '../host';
import type { Migration } from '../migrate';

export const migration: Migration = {
  version: 4,
  name: '004-deck-stats-indexes',
  up,
};

function up(d: DB) {
  d.exec(`
    CREATE INDEX IF NOT EXISTS items_deck_state ON items(deck_id, suspended, kind);
    DROP INDEX IF EXISTS items_deck;
    CREATE INDEX IF NOT EXISTS srs_introduced ON srs(introduced_day);
    CREATE INDEX IF NOT EXISTS items_ord ON items(ord);
    CREATE INDEX IF NOT EXISTS items_tags ON items(tags);
    CREATE INDEX IF NOT EXISTS items_starred ON items(suspended) WHERE starred = 1;
  `);
}
