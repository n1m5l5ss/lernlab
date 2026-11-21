// Fuzz tests for everything that reads a deck file someone else made (#158). Deck files are
// untrusted (CLAUDE.md), so for any input, however broken or hostile, an importer must either work or
// fail with a UserError the app can show. A TypeError, RangeError or hang is a bug, and so is any
// HTML that survives sanitising with a tag or attribute that could run code.
//
// `npm test` runs a quick pass (FUZZ_RUNS, default 150 per property). The nightly fuzz workflow runs
// many more; when it finds a failure, fast-check prints the seed and the smallest failing input, which
// becomes a normal test here.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { strToU8, zipSync } from 'fflate';
import { cleanupTempDir } from './test-utils';

const dir = mkdtempSync(join(tmpdir(), 'lernlab-fuzz-'));
process.env.LERNLAB_DATA = dir;
const { importFile } = await import('../src/importer');
const { csvToCards } = await import('../src/formats/csv');
const { readLernpack, writeLernpack } = await import('../src/formats/lernpack');
const { readApkg } = await import('../src/formats/apkg');
const { writeApkg } = await import('../src/formats/apkgwrite');
const { listZip, unsafeZipPath } = await import('../src/formats/zip');
const { sanitizeHtml, SAFE_TAGS } = await import('../src/cards');
const { cleanVariants, parseVariants, VARIANTS_MAX, VARIANT_MAX_LENGTH } = await import('../src/variants');
const { UserError } = await import('../src/errors');
const { installNodeHost } = await import('@lernlab/storage-sqlite');
installNodeHost();
const { getDb } = await import('../src/db');
after(() => cleanupTempDir(dir));

const RUNS = Number(process.env.FUZZ_RUNS) || 150;
const params = (numRuns = RUNS) => ({
  numRuns,
  seed: process.env.FUZZ_SEED ? Number(process.env.FUZZ_SEED) : undefined,
});

/** Works, or fails the way the app expects. Anything else is a crash the user would see. */
function worksOrUserError(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
  }
}

// Pieces attackers and broken exporters use, so random strings hit the interesting cases often.
const HOSTILE = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<iframe src="https://evil.example">',
  '<scr<script>ipt>',
  '<b onclick=x>',
  '</b>',
  '<br/>',
  '{{c1::x}}',
  '\\(x^2\\)',
  '[sound:../../etc/passwd]',
  '"',
  "'",
  ',',
  ';',
  '\t',
  '\n',
  '\r\n',
  '\x1f',
  '\0',
  '\uFEFF',
  '\uD800',
  '|',
  '**',
  '`',
  '..',
  '/',
  '\\',
  'C:',
];
const chunk = fc.oneof(
  fc.constantFrom(...HOSTILE),
  fc.string({ maxLength: 20 }),
  fc.string({ unit: 'binary', maxLength: 8 }),
);
const hostileText = fc.array(chunk, { maxLength: 40 }).map((a) => a.join(''));

/** Flip, drop, insert and cut bytes of a valid file: the usual shape of a damaged or tampered deck. */
const mutate = (seed: Uint8Array) =>
  fc
    .array(
      fc.oneof(
        fc.record({ op: fc.constant('flip' as const), at: fc.nat(), byte: fc.integer({ min: 0, max: 255 }) }),
        fc.record({ op: fc.constant('cut' as const), at: fc.nat() }),
        fc.record({ op: fc.constant('insert' as const), at: fc.nat(), bytes: fc.uint8Array({ maxLength: 16 }) }),
      ),
      { minLength: 1, maxLength: 6 },
    )
    .map((ops) => {
      let b = seed.slice();
      for (const o of ops) {
        const at = b.length ? o.at % b.length : 0;
        if (o.op === 'flip') b[at] = o.byte;
        else if (o.op === 'cut') b = b.slice(0, at);
        else b = new Uint8Array([...b.subarray(0, at), ...o.bytes, ...b.subarray(at)]);
      }
      return b;
    });

const SAFE = new Set<string>(SAFE_TAGS);

test('sanitizeHtml: whatever goes in, only bare safe-list tags come out', () => {
  fc.assert(
    fc.property(hostileText, (html) => {
      const out = sanitizeHtml(html);
      for (const [tag, name] of out.matchAll(/<\/?([^\s>/]*)[^>]*>?/g)) {
        assert.ok(SAFE.has(name.toLowerCase()), `unexpected tag ${JSON.stringify(tag)} from ${JSON.stringify(html)}`);
        assert.match(tag, /^<\/?[a-z0-9]+>$/i, `tag with attributes or unclosed: ${JSON.stringify(tag)}`);
      }
      assert.equal(sanitizeHtml(out), out, 'sanitising twice changes nothing');
    }),
    params(RUNS * 4),
  );
});

test('CSV and pasted text: any input is read or refused cleanly', () => {
  fc.assert(
    fc.property(hostileText, (text) => worksOrUserError(() => csvToCards(text))),
    params(RUNS * 2),
  );
});

test('question variants: any text gives a few plain-text questions, and cleaning is stable', () => {
  fc.assert(
    fc.property(hostileText, (text) => {
      const variants = parseVariants(text);
      assert.ok(variants.length <= VARIANTS_MAX);
      for (const v of variants) {
        assert.ok(v.prompt && v.prompt.length <= VARIANT_MAX_LENGTH && !v.prompt.includes('|'));
        assert.ok(['recall', 'apply', 'analyse'].includes(v.level));
      }
      const line = cleanVariants(text);
      assert.equal(cleanVariants(line), line, 'cleaning twice changes nothing');
      assert.equal(parseVariants(line).length, variants.length);
    }),
    params(RUNS * 2),
  );
});

test('zip listing: random and damaged bytes never crash, unsafe paths are always caught', () => {
  const seed = zipSync({ 'manifest.json': strToU8('{}'), 'cards.csv': strToU8('front,back\na,b') });
  fc.assert(
    fc.property(fc.oneof(fc.uint8Array({ maxLength: 300 }), mutate(seed)), (bytes) =>
      worksOrUserError(() => listZip(bytes)),
    ),
    params(),
  );
  const segment = fc.oneof(fc.constantFrom('..', '.', 'media', 'a b', 'C:', ''), fc.string({ maxLength: 6 }));
  fc.assert(
    fc.property(fc.array(segment, { minLength: 1, maxLength: 6 }), fc.constantFrom('/', '\\'), (parts, sep) => {
      const name = parts.join(sep);
      if (parts.includes('..') || /^[/\\]/.test(name) || /^[a-zA-Z]:/.test(name))
        assert.ok(unsafeZipPath(name), `not flagged: ${JSON.stringify(name)}`);
    }),
    params(RUNS * 2),
  );
});

const card = fc.record(
  {
    front: hostileText,
    back: hostileText,
    example: hostileText,
    notes: hostileText,
    image: fc.constantFrom('a.png', '../../evil.png', '/etc/passwd', 'C:\\x.png', 'https://example.com/x.png'),
    tags: fc.array(fc.string({ maxLength: 8 }), { maxLength: 3 }),
    type: fc.constantFrom('basic', 'cloze', 'mcq', 'order', 'numeric', 'code', 'occlusion', 'weird'),
    choices: hostileText,
    correct: fc.string({ maxLength: 6 }),
  },
  { requiredKeys: ['front', 'back'] },
);

test('.lernpack: hostile cards and damaged packages never crash the reader', () => {
  fc.assert(
    fc.property(fc.array(card, { maxLength: 5 }), hostileText, (cards, name) => {
      const pack = writeLernpack({ deck: { name }, generator: 'fuzz' }, cards, { 'a.png': strToU8('x') });
      worksOrUserError(() => readLernpack(pack));
    }),
    params(),
  );
  const seed = writeLernpack({ deck: { name: 'Seed' }, generator: 'fuzz' }, [{ front: 'a', back: 'b' }], {});
  fc.assert(
    fc.property(mutate(seed), (bytes) => worksOrUserError(() => readLernpack(bytes))),
    params(),
  );
});

test('Anki .apkg: hostile notes and damaged packages never crash the reader', () => {
  fc.assert(
    fc.property(fc.array(card, { minLength: 1, maxLength: 4 }), (cards) => {
      const pkg = writeApkg('Fuzz', cards, {});
      worksOrUserError(() => readApkg(pkg));
    }),
    params(Math.ceil(RUNS / 3)),
  );
  const seed = writeApkg('Seed', [{ front: 'a', back: 'b' }], {});
  fc.assert(
    fc.property(mutate(seed), (bytes) => worksOrUserError(() => readApkg(bytes))),
    params(Math.ceil(RUNS / 3)),
  );
});

// Fields that are plain text (an Anki front written as `&lt;b&gt;`) are stored decoded, so a literal
// `<script>` can be a card's text. The screen never trusts a stored field: Rich (apps/desktop/src/rich.tsx)
// sanitises again before showing it, and the CSP blocks inline scripts. So the check is on what is shown.
test('full import: nothing that runs code can be shown from an imported card', () => {
  const ext = fc.constantFrom('csv', 'tsv', 'txt', 'json', 'lernpack', 'apkg');
  fc.assert(
    fc.property(ext, fc.array(card, { minLength: 1, maxLength: 3 }), (kind, cards) => {
      const bytes =
        kind === 'lernpack'
          ? writeLernpack({ deck: { name: 'Fuzz' }, generator: 'fuzz' }, cards, {})
          : kind === 'apkg'
            ? writeApkg('Fuzz', cards, {})
            : kind === 'json'
              ? strToU8(JSON.stringify(cards))
              : strToU8(cards.map((c) => `${c.front}\t${c.back}`).join('\n'));
      worksOrUserError(() => importFile(`fuzz.${kind}`, bytes, { deckName: 'Fuzz' }));
    }),
    params(Math.ceil(RUNS / 3)),
  );
  const rows = getDb().prepare('SELECT * FROM items').all() as Record<string, unknown>[];
  for (const row of rows)
    for (const [col, value] of Object.entries(row)) {
      if (typeof value !== 'string') continue;
      const shown = sanitizeHtml(value); // what renderCardHtml does first
      assert.doesNotMatch(shown, /<\s*(script|iframe|object|embed|svg|img)\b/i, `${col}: ${value}`);
      assert.doesNotMatch(shown, /<[^>]*\son\w+\s*=/i, `${col}: event handler in ${value}`);
      assert.doesNotMatch(shown, /<[^>]*javascript:/i, `${col}: ${value}`);
    }
});
