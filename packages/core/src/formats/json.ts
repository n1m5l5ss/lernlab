// JSON cards (a .json file, or cards.json / cards.jsonl in a deck package). The data is untrusted:
// only known fields of the right type are kept.
import type { NormalizedCard } from '../library';

const TEXT_FIELDS = [
  'front',
  'back',
  'example',
  'exampleTranslation',
  'explanation',
  'notes',
  'image',
  'imageAlt',
  'audio',
  'video',
  'category',
  'subdeck',
  'group',
  'type',
  'choices',
  'correct',
  'steps',
  'altAnswers',
  'tolerance',
] as const;

const text = (v: unknown) =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : undefined;

/** One JSON value as a card, or null when it is not an object. `id` is accepted as the source id. */
export function jsonToCard(raw: unknown): NormalizedCard | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const card: NormalizedCard = { front: text(o.front) ?? '', back: text(o.back) ?? '' };
  for (const k of TEXT_FIELDS.slice(2)) {
    const v = text(o[k]);
    if (v) card[k] = v;
  }
  const id = o.sourceId ?? o.id;
  if (typeof id === 'number' && Number.isSafeInteger(id)) card.sourceId = id;
  else if (text(id)) card.sourceId = text(id);
  if (Array.isArray(o.tags)) card.tags = o.tags.map(text).filter((t): t is string => !!t);
  else if (typeof o.tags === 'string') card.tags = o.tags.split(/[\s,;]+/).filter(Boolean);
  if (typeof o.rank === 'number' && Number.isFinite(o.rank)) card.rank = o.rank;
  if (o.extra && typeof o.extra === 'object' && !Array.isArray(o.extra)) {
    const extra = Object.entries(o.extra).flatMap(([k, v]) => (text(v) !== undefined ? [[k, text(v)!]] : []));
    if (extra.length) card.extra = Object.fromEntries(extra);
  }
  return card;
}

/** Parse JSON text, or return undefined when it is not valid JSON. */
export function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}
