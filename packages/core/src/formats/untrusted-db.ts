// A SQLite database someone else wrote (an Anki collection, a restored backup or data export) is untrusted.
// A view (say an endless WITH RECURSIVE named like a real table), a trigger or a virtual table could make a
// plain SELECT run forever or change data behind the app's back. LernLab and Anki only ever create plain
// tables and indexes, so a database with anything else is refused before it is read.
import type { DB } from '../host';

/** True if the database has a view, a trigger or a virtual table. Also turns off trusted_schema for `db`. */
export function hasRiskySchema(db: DB): boolean {
  db.exec('PRAGMA trusted_schema = OFF');
  return !!db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type IN ('view', 'trigger') OR upper(sql) LIKE 'CREATE VIRTUAL%' LIMIT 1",
    )
    .get();
}
