// 006: the level of the question asked (#198). A card can be asked in other wordings, each recall, apply or
// analyse (variants.ts); each answer keeps the level it was asked at, so Progress can show the mix.
// NULL is the card's own question. The schedule is unchanged: still one grade per card per day.
import type { DB, Row } from '../host';
import type { Migration } from '../migrate';

export const migration: Migration = {
  version: 6,
  name: '006-attempt-level',
  up,
};

function up(d: DB) {
  const cols = d
    .prepare('PRAGMA table_info(attempts)')
    .all()
    .map((r: Row) => r.name);
  if (!cols.includes('level')) d.exec('ALTER TABLE attempts ADD COLUMN level TEXT');
}
