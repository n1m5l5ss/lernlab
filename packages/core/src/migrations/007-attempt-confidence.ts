// 007: how sure the learner was of an answer, 1 to 5 (#205). An optional tap after a recall answer; NULL when
// it was skipped or the rating is turned off. It feeds the calibration chart on Progress and nothing else: it
// never changes the schedule (FSRS), the mastery ladder or XP. The partial index finds the rated answers quickly.
import type { DB, Row } from '../host';
import type { Migration } from '../migrate';

export const migration: Migration = {
  version: 7,
  name: '007-attempt-confidence',
  up,
};

function up(d: DB) {
  const cols = d
    .prepare('PRAGMA table_info(attempts)')
    .all()
    .map((r: Row) => r.name);
  if (!cols.includes('confidence')) d.exec('ALTER TABLE attempts ADD COLUMN confidence INTEGER');
  d.exec('CREATE INDEX IF NOT EXISTS attempts_confidence ON attempts(item_id, day) WHERE confidence IS NOT NULL');
}
