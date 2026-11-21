// "What's new" after an update (issue #58, docs/RELEASING.md). The notes come from CHANGELOG.md at build time
// (scripts/whats-new.ts, bundled, offline) or from the GitHub Release of a downloaded update. Only the item
// text comes from there; every other word on the panel is in the language files.
// The pure parts are in releasenotes.ts, so the main process can read notes without reaching database code.
import { getMeta, setMeta, type DB } from './db';

export * from './releasenotes';

const KEY = 'lastSeenVersion';
/** The version whose "What's new" was last dismissed (or that a new user started on). Kept in `meta`. */
export const lastSeenVersion = (d: DB): string | null => getMeta<string | null>(d, KEY, null);
export const markVersionSeen = (d: DB, version: string) => setMeta(d, KEY, version);
