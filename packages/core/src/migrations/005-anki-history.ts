// 005: reviews brought over from Anki (#48). They are kept apart from `attempts`, which holds answers
// given in LernLab (with XP, format and streak days); these only explain where a card's schedule came from.
import type { DB } from '../host';
import type { Migration } from '../migrate';

export const migration: Migration = {
  version: 5,
  name: '005-anki-history',
  up,
};

function up(d: DB) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS imported_reviews (
      item_id INTEGER NOT NULL,
      ts TEXT NOT NULL,
      day TEXT NOT NULL,
      grade INTEGER NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY (item_id, ts)
    ) WITHOUT ROWID;
  `);
}
