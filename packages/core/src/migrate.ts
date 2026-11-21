// Numbered database migrations. Each one runs once, in order, inside a transaction, and is
// recorded in the schema_version table. Before any pending migration runs on an existing
// database, the storage host makes a backup; if a migration fails, that backup is restored.
import type { DB } from './host';
import { migration as m001 } from './migrations/001-v02-schema';
import { migration as m002 } from './migrations/002-practice-attempts';
import { migration as m003 } from './migrations/003-study-indexes';
import { migration as m004 } from './migrations/004-deck-stats-indexes';

export type Migration = {
  /** 1, 2, 3… in the order they run. Never reuse or renumber one that has shipped. */
  version: number;
  /** File name without extension, e.g. "002-review-log". */
  name: string;
  up(d: DB): void;
};

/** Every migration, oldest first. Add new ones at the end as migrations/NNN-name.ts. */
export const MIGRATIONS: Migration[] = [m001, m002, m003, m004];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export class MigrationError extends Error {
  readonly code = 'migration_failed';
  constructor(
    readonly migration: string,
    readonly backupFile: string | null,
    readonly cause: unknown,
  ) {
    super(
      `LernLab could not update your data to the new version (step ${migration}: ${(cause as Error)?.message ?? cause}). ` +
        (backupFile
          ? `Nothing was lost: your data was put back exactly as it was before the update. A copy is also kept at ${backupFile}.`
          : 'Nothing was changed.'),
    );
  }
}

const hasTable = (d: DB, name: string) =>
  !!d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

/** The version this database is at (0 if it predates numbered migrations). */
export function schemaVersion(d: DB): number {
  if (!hasTable(d, 'schema_version')) return 0;
  return Number(d.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_version').get()!.v);
}

export function pendingMigrations(d: DB, migrations = MIGRATIONS): Migration[] {
  const current = schemaVersion(d);
  return migrations.filter((m) => m.version > current);
}

export type MigrateOptions = {
  /** Copy the database before migrating. Returns where the copy is. */
  backup?: (fromVersion: number) => string;
  /** Put the backup back after a failed migration. The handle `d` may be closed by this. */
  restore?: (backupFile: string) => void;
  migrations?: Migration[];
  now?: () => Date;
};

/** Run every pending migration. Throws MigrationError (after restoring the backup) if one fails. */
export function migrate(d: DB, opts: MigrateOptions = {}): { applied: string[]; backupFile: string | null } {
  const pending = pendingMigrations(d, opts.migrations);
  if (!pending.length) return { applied: [], backupFile: null };
  const isEmpty = !d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").get();
  const backupFile = !isEmpty && opts.backup ? opts.backup(schemaVersion(d)) : null;
  const applied: string[] = [];
  for (const m of pending) {
    try {
      d.exec('BEGIN');
      if (!hasTable(d, 'schema_version'))
        d.exec(
          'CREATE TABLE schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
        );
      m.up(d);
      d.prepare('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)').run(
        m.version,
        m.name,
        (opts.now?.() ?? new Date()).toISOString(),
      );
      d.exec('COMMIT');
      applied.push(m.name);
    } catch (e) {
      try {
        d.exec('ROLLBACK');
      } catch {
        /* the transaction may already be gone */
      }
      if (backupFile && opts.restore) opts.restore(backupFile);
      throw new MigrationError(m.name, backupFile, e);
    }
  }
  return { applied, backupFile };
}
