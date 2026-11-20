// Export a deck as a .lernpack (cards and media) or a CSV. Both import back to the same cards.
import type { Row } from './host';
import type { ItemRow } from './schema';
import { getDb, type DB } from './db';
import { getDeck, readMedia, type NormalizedCard } from './library';
import { writeLernpack } from './formats/lernpack';
import { UserError } from './errors';

/** Extra keys the card fields `choices`, `correct`, `steps` and `altAnswers` are stored under. */
const FROM_EXTRA = { choices: 'choices', correct: 'correct', steps: 'steps', alt: 'altAnswers' } as const;

function deckCards(deckId: number, deckName: string, d: DB): NormalizedCard[] {
  return d
    .prepare('SELECT * FROM items WHERE deck_id = ? ORDER BY ord')
    .all(deckId)
    .map((row: Row) => {
      const r = row as unknown as ItemRow;
      const extra: Record<string, string> = JSON.parse(r.extra ?? '{}');
      const fields: Partial<NormalizedCard> = {};
      for (const [key, field] of Object.entries(FROM_EXTRA)) {
        if (extra[key]) fields[field] = extra[key];
        delete extra[key];
      }
      return {
        sourceId: String(r.id),
        type: ['mcq', 'order', 'cloze'].includes(r.kind) ? r.kind : undefined,
        front: r.target,
        back: r.meaning,
        ...fields,
        example: r.sentence_html || undefined,
        exampleTranslation: r.sentence_meaning || undefined,
        explanation: r.grammar || undefined,
        notes: r.notes || undefined,
        image: r.image || undefined,
        audio: r.audio || undefined,
        video: r.video || undefined,
        category: r.category || undefined,
        tags: JSON.parse(r.tags),
        // The deck's own name is not a sub-deck, so a copy imported under another name stays whole.
        subdeck: r.deck && r.deck !== deckName ? r.deck : undefined,
        group: r.grp || undefined,
        rank: Number(r.rank) || undefined,
        extra: Object.keys(extra).length ? extra : undefined,
      };
    });
}

/** CSV columns of an export: every card field a spreadsheet can hold, named so the importer reads them back. */
const CSV_COLUMNS: [string, (c: NormalizedCard) => string | number | undefined][] = [
  ['front', (c) => c.front],
  ['back', (c) => c.back],
  ['alt_answers', (c) => c.altAnswers],
  ['example', (c) => c.example],
  ['example translation', (c) => c.exampleTranslation],
  ['explanation', (c) => c.explanation],
  ['notes', (c) => c.notes],
  ['category', (c) => c.category],
  ['tags', (c) => (c.tags ?? []).join(' ')],
  ['type', (c) => c.type],
  ['choices', (c) => c.choices],
  ['correct', (c) => c.correct],
  ['steps', (c) => c.steps],
  ['image', (c) => c.image],
  ['audio', (c) => c.audio],
  ['video', (c) => c.video],
  ['deck', (c) => c.subdeck],
  ['lesson', (c) => c.group],
  ['rank', (c) => c.rank],
  ['reading', (c) => c.extra?.reading],
  ['id', (c) => c.sourceId],
];

/** Quote a cell when it holds a separator, a quote or a line break, or starts like a # comment line. */
const cell = (v: string | number | undefined) => {
  const s = String(v ?? '');
  return /^#|[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A deck as a CSV that imports back to the same cards. The media files themselves travel in a .lernpack. */
export function deckToCsv(cards: NormalizedCard[]): string {
  const lines = [CSV_COLUMNS.map(([name]) => name).join(',')];
  for (const c of cards) lines.push(CSV_COLUMNS.map(([, get]) => cell(get(c))).join(','));
  return `${lines.join('\n')}\n`;
}

export function exportDeck(
  deckId: number,
  format: 'lernpack' | 'csv',
  d: DB = getDb(),
): { name: string; data: Uint8Array; type: string } {
  const deck = getDeck(deckId, d);
  if (!deck) throw new UserError('deck_not_found', 'Deck not found');
  const cards = deckCards(deckId, deck.name, d);
  const safe = deck.name.replace(/[^\w\- ]+/g, '_');
  if (format === 'csv')
    return { name: `${safe}.csv`, data: new TextEncoder().encode(deckToCsv(cards)), type: 'text/csv' };
  const media: Record<string, Uint8Array> = {};
  for (const c of cards)
    for (const f of [c.image, c.audio, c.video]) {
      if (f && !media[f] && !/^https?:/.test(f)) {
        const b = readMedia(f);
        if (b) media[f] = b;
      }
    }
  const data = writeLernpack(
    {
      deck: { name: deck.name, language: deck.language, description: deck.description, goal: deck.settings.goal },
      generator: 'LernLab',
    },
    cards,
    media,
  );
  return { name: `${safe}.lernpack`, data, type: 'application/zip' };
}
