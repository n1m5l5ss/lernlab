import { rmSync } from 'node:fs';

/** Remove a temp folder. On Windows an open SQLite file can't be deleted, so a failure here is ignored. */
export function cleanupTempDir(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch {
    // The OS cleans its temp folder; never fail a test run over cleanup.
  }
}
