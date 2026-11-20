// Build step (docs/RELEASING.md): turn the newest release in CHANGELOG.md into apps/desktop/backend/whats-new.json,
// which is bundled into the app so "What's new" works offline. `npm run build` in apps/desktop runs it first.
// Run by hand from the repo root: npx tsx scripts/whats-new.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { notesFromChangelog } from '../packages/core/src/whatsnew.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const notes = notesFromChangelog(readFileSync(`${root}CHANGELOG.md`, 'utf8')) ?? {
  version: '0.0.0',
  added: [],
  fixed: [],
};
writeFileSync(`${root}apps/desktop/backend/whats-new.json`, JSON.stringify(notes, null, 2) + '\n');
console.log(`whats-new.json: ${notes.version}, ${notes.added.length} new, ${notes.fixed.length} fixed`);
