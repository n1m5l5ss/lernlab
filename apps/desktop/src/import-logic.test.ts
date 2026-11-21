import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPPABLE_FIELDS } from '@lernlab/core/importpreview';
import type { ImportReport } from '@lernlab/core/importer';
import { MAPPABLE, defaultTarget, fieldOf, reportLines, setColumn } from './import-logic';

test('the mapping menu lists every field the importer can map', () => {
  assert.deepEqual([...MAPPABLE].sort(), Object.keys(MAPPABLE_FIELDS).sort());
});

test('a column feeds one field and a field reads one column', () => {
  let f = setColumn({}, 0, 'front');
  f = setColumn(f, 2, 'back');
  assert.deepEqual(f, { front: 0, back: 2 });
  assert.equal(fieldOf(f, 2), 'back');
  assert.equal(fieldOf(f, 1), '');
  f = setColumn(f, 1, 'front');
  assert.deepEqual(f, { front: 1, back: 2 }, 'front moves to its new column');
  f = setColumn(f, 2, 'notes');
  assert.deepEqual(f, { front: 1, notes: 2 }, 'the column stops feeding back');
  assert.deepEqual(setColumn(f, 2, ''), { front: 1 });
});

test('the target deck is an existing deck with the same name, else a new one', () => {
  const decks = [
    { id: 4, name: 'German' },
    { id: 7, name: 'AWS' },
  ];
  assert.equal(defaultTarget(decks, ' aws '), 7);
  assert.equal(defaultTarget(decks, 'Biology'), 'new');
});

test('the report counts added and updated cards and groups skips by reason', () => {
  const r = {
    added: 3,
    updated: 2,
    total: 9,
    skipped: [
      { row: 4, code: 'row_no_front' },
      { row: 7, code: 'row_duplicate' },
      { row: 9, code: 'row_no_front' },
    ],
    skippedCount: 5,
    media: 0,
    mediaMissing: 1,
    missingMedia: ['hund.png'],
    warnings: [{ code: 'media_wrong_type', file: 'evil.png' }],
    format: 'csv',
  } as ImportReport;
  assert.deepEqual(reportLines(r), {
    added: 3,
    updated: 2,
    total: 9,
    skipped: [
      { code: 'row_no_front', count: 2 },
      { code: 'row_duplicate', count: 1 },
      { code: 'missing_media', count: 1 },
    ],
    moreSkipped: 2,
    missingMedia: ['hund.png'],
    warnings: [{ code: 'media_wrong_type', file: 'evil.png' }],
  });
  const clean = reportLines({ ...r, skipped: [], skippedCount: 0, mediaMissing: 0, missingMedia: [], warnings: [] });
  assert.deepEqual([clean.skipped, clean.moreSkipped, clean.warnings], [[], 0, []]);
});
