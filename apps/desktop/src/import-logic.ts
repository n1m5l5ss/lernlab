// Import screen logic: column mapping edits, the target deck and the report lines. No React here.
import type { ColumnMapping, MappableField } from '@lernlab/core/importpreview';
import type { ImportResult } from '@lernlab/core/importer';

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

/** A reason a card or file was skipped, as the report names it (locales: decks.importReport.reason.<reason>). */
export type SkipLine = { reason: string; count: number };
/** What the report shows: the result, plus reasons the screen learned from the preview. */
export type ReportInput = ImportResult & { skipped?: SkipLine[] };

export type ReportLines = { added: number; updated: number; total: number; skipped: SkipLine[] };

/** Report lines from an import result; skipped reasons from the result and the preview are merged. */
export function reportLines(r: ReportInput, fromPreview: SkipLine[] = []): ReportLines {
  const skipped = new Map<string, number>();
  for (const s of [
    ...(r.skipped ?? fromPreview),
    ...(r.mediaMissing ? [{ reason: 'missing_media', count: r.mediaMissing }] : []),
  ])
    if (s.count > 0) skipped.set(s.reason, (skipped.get(s.reason) ?? 0) + s.count);
  return {
    added: r.added,
    updated: r.updated,
    total: r.total,
    skipped: [...skipped].map(([reason, count]) => ({ reason, count })),
  };
}
