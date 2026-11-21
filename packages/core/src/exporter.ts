// Export a deck as a .lernpack (cards and media), a CSV or an Anki .apkg. All import back to the same cards.
import type { Row } from './host';
import type { ItemRow } from './schema';
import { getDb, type DB } from './db';
import { getDeck, readMedia, type NormalizedCard } from './library';
import { writeLernpack } from './formats/lernpack';
import { writeApkg } from './formats/apkgwrite';
import { cardsToCsv } from './formats/csv';
import { UserError } from './errors';

/** Extra keys the card fields `choices`, `correct`, `steps`, `altAnswers`, `imageAlt` and `tolerance` are stored under. */
const FROM_EXTRA = {
  choices: 'choices',
  correct: 'correct',
  steps: 'steps',
  alt: 'altAnswers',
  imageAlt: 'imageAlt',
  tolerance: 'tolerance',
} as const;

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
        type: ['mcq', 'order', 'cloze', 'numeric'].includes(r.kind) ? r.kind : undefined,
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

export function exportDeck(
  deckId: number,
  format: 'lernpack' | 'csv' | 'apkg',
  d: DB = getDb(),
): { name: string; data: Uint8Array; type: string } {
  const deck = getDeck(deckId, d);
  if (!deck) throw new UserError('deck_not_found', 'Deck not found');
  const cards = deckCards(deckId, deck.name, d);
  const safe = deck.name.replace(/[^\w\- ]+/g, '_');
  // A plain CSV holds media file names, not the files: those travel in a .lernpack.
  if (format === 'csv')
    return { name: `${safe}.csv`, data: new TextEncoder().encode(cardsToCsv(cards)), type: 'text/csv' };
  const media: Record<string, Uint8Array> = {};
  for (const c of cards)
    for (const f of [c.image, c.audio, c.video]) {
      if (f && !media[f] && !/^https?:/.test(f)) {
        const b = readMedia(f);
        if (b) media[f] = b;
      }
    }
  if (format === 'apkg')
    return { name: `${safe}.apkg`, data: writeApkg(deck.name, cards, media), type: 'application/zip' };
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
