// 008: confusion pairs (#200). When a wrong answer is another card's answer, the two cards are a pair that the
// learner mixes up: `a` is the smaller card id, `count` how often it happened. Sessions use the pairs to pick
// wrong choices and to ask the two cards next to each other; they never change the schedule (FSRS).
// `twin`: '' until the compare card was offered, then 'made' or 'dismissed', so the offer comes once.
import type { DB } from '../host';
import type { Migration } from '../migrate';

export const migration: Migration = {
  version: 8,
  name: '008-confusions',
  up,
};

function up(d: DB) {
  d.exec(`CREATE TABLE IF NOT EXISTS confusions (
      a INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      b INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
      count INTEGER NOT NULL DEFAULT 0,
      last_day TEXT NOT NULL,
      twin TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (a, b)
    ) WITHOUT ROWID`);
  d.exec('CREATE INDEX IF NOT EXISTS confusions_b ON confusions(b)');
}
