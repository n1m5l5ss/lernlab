// 003: indexes for the study queries (docs/ARCHITECTURE.md §5, #56). The due queue filters and sorts srs by
// due; "answered today" looks up attempts by day and card. The composite index replaces attempts_day, which
// is a prefix of it.
import type { DB } from '../host';
import type { Migration } from '../migrate';

export const migration: Migration = {
  version: 3,
  name: '003-study-indexes',
  up,
};

function up(d: DB) {
  d.exec(`
    CREATE INDEX IF NOT EXISTS srs_due ON srs(due);
    CREATE INDEX IF NOT EXISTS attempts_day_item ON attempts(day, item_id);
    DROP INDEX IF EXISTS attempts_day;
  `);
}
