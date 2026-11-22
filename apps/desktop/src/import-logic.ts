// Import screen logic: column mapping edits, the target deck and the report lines. No React here.
import type { ColumnMapping, MappableField } from '@lernlab/core/importpreview';
import type { ImportReport } from '@lernlab/core/importer';
import type { SkipCode } from '@lernlab/core/library';

/** Card fields a column can feed, in the order the mapping menu lists them. */
export const MAPPABLE: MappableField[] = [
  'front',
  'back',
  'example',
  'exampleTranslation',
  'explanation',
  'notes',
  'category',
  'tags',
  'image',
  'imageAlt',
  'audio',
  'video',
  'subdeck',
  'group',
  'rank',
  'reading',
  'sourceId',
  'type',
  'choices',
  'correct',
  'steps',
  'altAnswers',
  'variants',
  'corrections',
  'keyPoints',
  'keyTerms',
  'workedSteps',
];

export type Fields = ColumnMapping['fields'];

/** The field a column feeds, or '' when it is ignored. */
export const fieldOf = (fields: Fields, column: number): MappableField | '' =>
  (Object.entries(fields).find(([, i]) => i === column)?.[0] as MappableField | undefined) ?? '';

/** Point a column at a field ('' ignores it). Each field reads one column, so it leaves any other. */
export function setColumn(fields: Fields, column: number, field: MappableField | ''): Fields {
  const out: Fields = {};
  for (const [f, i] of Object.entries(fields) as [MappableField, number][]) if (i !== column && f !== field) out[f] = i;
  if (field) out[field] = column;
  return out;
}

/** The deck to import into: an existing deck with the suggested name, or a new one. */
export const defaultTarget = (decks: { id: number; name: string }[], suggested: string): number | 'new' =>
  decks.find((d) => d.name.trim().toLowerCase() === suggested.trim().toLowerCase())?.id ?? 'new';

/** A reason cards were skipped and how many (locales: decks.importReport.reason.<code>). */
export type SkipLine = { code: SkipCode | 'missing_media'; count: number };

export type ReportLines = {
  added: number;
  updated: number;
  total: number;
  skipped: SkipLine[];
  /** Skipped rows beyond the ones the report lists by row. */
  moreSkipped: number;
  /** Names of media files cards use that were not in the import (the report lists at most 500). */
  missingMedia: string[];
  /** Files left out, with the reason (each code has a message under errors.<code>). */
  warnings: ImportReport['warnings'];
  /** Past Anki reviews replayed into the schedule. */
  reviews: number;
};

/** What the report screen shows for an import: counts, skipped rows grouped by reason, missing media and warnings. */
export function reportLines(r: ImportReport): ReportLines {
  const counts = new Map<SkipLine['code'], number>();
  for (const s of r.skipped) counts.set(s.code, (counts.get(s.code) ?? 0) + 1);
  if (r.mediaMissing) counts.set('missing_media', r.mediaMissing);
  return {
    added: r.added,
    updated: r.updated,
    total: r.total,
    skipped: [...counts].map(([code, count]) => ({ code, count })),
    moreSkipped: Math.max(0, r.skippedCount - r.skipped.length),
    missingMedia: r.missingMedia,
    warnings: r.warnings,
    reviews: r.reviews ?? 0,
  };
}
