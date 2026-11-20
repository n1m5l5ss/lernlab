import { getDb, type DB } from './db';
import { getDeck, readMedia, type NormalizedCard } from './library';
import { writeLernpack } from './formats/lernpack';
import { cardsToCsv } from './formats/csv';

function deckCards(deckId: number, d: DB): NormalizedCard[] {
  return d
    .prepare('SELECT * FROM items WHERE deck_id = ? ORDER BY ord')
    .all(deckId)
    .map((r: any) => ({
      sourceId: String(r.id),
      front: r.target,
      back: r.meaning,
      example: r.sentence_html || undefined,
      exampleTranslation: r.sentence_meaning || undefined,
      explanation: r.grammar || undefined,
      notes: r.notes || undefined,
      image: r.image || undefined,
      audio: r.audio || undefined,
      video: r.video || undefined,
      category: r.category || undefined,
      tags: JSON.parse(r.tags),
      subdeck: r.deck,
      group: r.grp || undefined,
      rank: Number(r.rank) || undefined,
      extra: Object.keys(JSON.parse(r.extra ?? '{}')).length ? JSON.parse(r.extra) : undefined,
    }));
}

export function exportDeck(
  deckId: number,
  format: 'lernpack' | 'csv',
  d: DB = getDb(),
): { name: string; data: Uint8Array; type: string } {
  const deck = getDeck(deckId, d);
  if (!deck) throw new Error('Deck not found');
  const cards = deckCards(deckId, d);
  const safe = deck.name.replace(/[^\w\- ]+/g, '_');
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
