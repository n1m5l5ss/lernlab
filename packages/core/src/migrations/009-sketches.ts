// 009: the learner's own sketch for a card (#220). `file` is a PNG in the media folder ('' when the learner
// only described the picture in words), `text` that description. Kept apart from the card's own fields, so a
// sketch is never part of a deck export; it goes when the card goes. It never changes the schedule (FSRS).
import type { DB } from '../host';
import type { Migration } from '../migrate';

export const migration: Migration = {
  version: 9,
  name: '009-sketches',
  up,
};

function up(d: DB) {
  d.exec(`CREATE TABLE IF NOT EXISTS sketches (
      item_id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
      file TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL DEFAULT '',
      created_day TEXT NOT NULL
    )`);
}
