// 002: practice attempts. A practice session records its answers but never touches the schedule;
// the flag keeps them apart from real reviews in history and statistics.
import type { DB, Row } from '../host';
import type { Migration } from '../migrate';

export const migration: Migration = {
  version: 2,
  name: '002-practice-attempts',
  up,
};

function up(d: DB) {
  const cols = d
    .prepare('PRAGMA table_info(attempts)')
    .all()
    .map((r: Row) => r.name);
  if (!cols.includes('practice')) d.exec('ALTER TABLE attempts ADD COLUMN practice INTEGER NOT NULL DEFAULT 0');
}
