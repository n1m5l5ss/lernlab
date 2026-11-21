// "What's new" after an update (issue #58): notes from the changelog or a GitHub Release, and when to show them.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-whatsnew-'));
process.env.LERNLAB_DATA = dir;
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { getDb } = await import('../src/db');
const { compareVersions, lastSeenVersion, markVersionSeen, notesFromChangelog, notesFromReleaseHtml, whatsNewToShow } =
  await import('../src/whatsnew');
after(() => cleanupTempDir(dir));

const CHANGELOG = `# Changelog

Intro text.

## [0.4.0](https://github.com/x/y/compare/v0.3.0...v0.4.0) (2026-12-01)


### Added

* add a session length picker ([2812206](https://github.com/x/y/commit/2812206)), closes [#10](https://github.com/x/y/issues/10)
* show **bold** and \`code\` as plain words ([1a2b3c4](https://x))
* one
* two
* three
* six is too many ([2a2b3c4](https://x))


### Fixed

* keep the streak when the clock changes ([abc1234](https://github.com/x/y/commit/abc1234))

### Performance

* start faster

## [0.3.0] - 2026-11-20

### Added
- Older things.
`;

test('the newest changelog section becomes plain items: up to 5 New and 5 Fixed', () => {
  const notes = notesFromChangelog(CHANGELOG);
  assert.deepEqual(notes, {
    version: '0.4.0',
    added: ['Add a session length picker', 'Show bold and code as plain words', 'One', 'Two', 'Three'],
    fixed: ['Keep the streak when the clock changes'],
  });
});

test('Keep a Changelog style sections (- items, plain version heading) work too', () => {
  const notes = notesFromChangelog('# Changelog\n\n## [0.2.0] - 2026-11-20\n\n### Added\n- Decks for any subject.\n');
  assert.deepEqual(notes, { version: '0.2.0', added: ['Decks for any subject.'], fixed: [] });
});

test('a changelog without releases gives no notes', () => {
  assert.equal(notesFromChangelog('# Changelog\n\n## [Unreleased]\n\n### Added\n- Soon\n'), null);
  assert.equal(notesFromChangelog(''), null);
});

test("the repo's own CHANGELOG.md parses", () => {
  const md = readFileSync(new URL('../../../CHANGELOG.md', import.meta.url), 'utf8');
  const notes = notesFromChangelog(md);
  assert.ok(notes);
  assert.match(notes.version, /^\d+\.\d+\.\d+/);
  assert.ok(notes.added.length + notes.fixed.length > 0);
  assert.ok(notes.added.length <= 5 && notes.fixed.length <= 5);
  for (const item of [...notes.added, ...notes.fixed]) assert.doesNotMatch(item, /\]\(|https?:|closes/);
});

test('GitHub Release notes (HTML) become plain New and Fixed items, with no markup left', () => {
  const html = `<h2><a href="https://x">0.4.0</a> (2026-12-01)</h2>
<h3>Added</h3>
<ul>
<li>add a picker &amp; more (<a href="https://x/commit/1"><code>2812206</code></a>), closes <a href="https://x/10">#10</a></li>
<li><img src=x onerror="alert(1)">show <strong>bold</strong> text</li>
</ul>
<h3>Bug Fixes</h3>
<ul><li>keep the streak (<a href="https://x">abc1234</a>)</li></ul>
<h3>Performance</h3><ul><li>faster</li></ul>`;
  assert.deepEqual(notesFromReleaseHtml(html), {
    added: ['Add a picker & more', 'Show bold text'],
    fixed: ['Keep the streak'],
  });
  assert.deepEqual(notesFromReleaseHtml(''), { added: [], fixed: [] });
  assert.deepEqual(notesFromReleaseHtml(null), { added: [], fixed: [] });
});

test('versions compare numerically, and a beta comes before its release', () => {
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.0-beta.2', '1.0.0'), -1);
  assert.equal(compareVersions('1.0.0-beta.10', '1.0.0-beta.2'), 1);
  assert.equal(compareVersions('v1.2.3', '1.2.3'), 0);
});

const NOTES = { version: '0.4.0', added: ['A'], fixed: ['B'] };

test('shown once after an update to a newer version, never for a new user or on the same version', () => {
  // Updated from 0.3.0: show.
  assert.deepEqual(whatsNewToShow({ current: '0.4.0', lastSeen: '0.3.0', isNewUser: false, notes: NOTES }), NOTES);
  // Used the app before this feature existed (nothing saved yet): show.
  assert.deepEqual(whatsNewToShow({ current: '0.4.0', lastSeen: null, isNewUser: false, notes: NOTES }), NOTES);
  // Already seen, or a brand-new user: nothing.
  assert.equal(whatsNewToShow({ current: '0.4.0', lastSeen: '0.4.0', isNewUser: false, notes: NOTES }), null);
  assert.equal(whatsNewToShow({ current: '0.4.0', lastSeen: null, isNewUser: true, notes: NOTES }), null);
  // Went back to an older version: nothing.
  assert.equal(whatsNewToShow({ current: '0.3.0', lastSeen: '0.4.0', isNewUser: false, notes: NOTES }), null);
  // No notes, empty notes, notes for a newer version, or notes already covered by what was seen: nothing.
  assert.equal(whatsNewToShow({ current: '0.4.0', lastSeen: '0.3.0', isNewUser: false, notes: null }), null);
  const empty = { version: '0.4.0', added: [], fixed: [] };
  assert.equal(whatsNewToShow({ current: '0.4.0', lastSeen: '0.3.0', isNewUser: false, notes: empty }), null);
  assert.equal(whatsNewToShow({ current: '0.3.5', lastSeen: '0.3.0', isNewUser: false, notes: NOTES }), null);
  assert.equal(
    whatsNewToShow({ current: '0.4.1', lastSeen: '0.4.0', isNewUser: false, notes: NOTES }),
    null,
    'a patch build whose changelog still ends at 0.4.0 shows nothing new',
  );
  // A beta of the next version still shows the notes of the last release it includes.
  assert.deepEqual(
    whatsNewToShow({ current: '0.5.0-beta.1', lastSeen: '0.3.0', isNewUser: false, notes: NOTES }),
    NOTES,
  );
});

test('the last seen version is kept in the database (no migration)', () => {
  assert.equal(lastSeenVersion(getDb()), null);
  markVersionSeen(getDb(), '0.4.0');
  assert.equal(lastSeenVersion(getDb()), '0.4.0');
});
