// Import (or refresh) study items from an Anki deck. Progress is kept: items are upserted by note id.
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { notesInDeck, cardDecks, mediaFile, type AnkiNote } from './anki';
import { getDb, MEDIA_DIR, tx, setMeta, type DB } from './db';
import { stripHtml, splitArticle } from '../shared/text';
import type { ItemKind } from '../shared/types';

const field = (n: AnkiNote, ...names: string[]) => {
  for (const name of names) if (n.fields[name]) return n.fields[name].value ?? '';
  return '';
};

export function detectKind(target: string, meaning: string, tags: string[]): ItemKind {
  if (tags.includes('grammar')) return 'grammar';
  if (tags.includes('number')) return 'number';
  if (tags.includes('phrase') || tags.includes('survival')) return 'phrase';
  const { article, word } = splitArticle(target);
  if (article && /^[A-ZÄÖÜ]/.test(word)) return 'noun';
  if (/^to\s/i.test(meaning.trim()) && /^[a-zäöüß]+(en|n|ern|eln)$/.test(target.trim())) return 'verb';
  if (target.trim().split(/\s+/).length >= 3) return 'phrase';
  return 'word';
}

export type ImportResult = { deck: string; notes: number; added: number; updated: number; media: number; mediaMissing: number };

export async function importDeck(deck: string, onProgress?: (msg: string) => void, d: DB = getDb()): Promise<ImportResult> {
  onProgress?.(`Reading notes from Anki deck "${deck}"…`);
  const notes = await notesInDeck(deck);
  const deckOf = await cardDecks(notes.map((n) => n.cards[0]).filter(Boolean));

  const parsed = notes.map((n) => {
    const target = stripHtml(field(n, 'Target', 'Front', 'Word', 'Expression'));
    const meaning = stripHtml(field(n, 'Meaning', 'Back', 'Definition'));
    const sentenceHtml = field(n, 'Sentence', 'Example').trim();
    const audioRaw = field(n, 'Audio', 'Sound');
    const audio = audioRaw.match(/\[sound:([^\]]+)\]/)?.[1] ?? null;
    const tags = n.tags;
    const { article, word } = splitArticle(target);
    const kind = detectKind(target, meaning, tags);
    const rank = parseInt(stripHtml(field(n, 'Rank')), 10) || 0;
    const subdeck = deckOf[n.noteId] ?? deck;
    return {
      id: n.noteId,
      deck: subdeck,
      kind,
      target,
      article: kind === 'noun' ? article : null,
      word: kind === 'noun' ? word : target,
      meaning,
      sentenceHtml,
      sentence: stripHtml(sentenceHtml),
      sentenceMeaning: stripHtml(field(n, 'SentenceMeaning', 'Translation')),
      grammar: stripHtml(field(n, 'Grammar')),
      notes: stripHtml(field(n, 'Notes')),
      audio,
      rank,
      tags,
      grp: tags.find((t) => /^G\d+$/.test(t)) ?? null,
    };
  }).filter((p) => p.target && p.meaning);

  // Introduction order: vocabulary by frequency rank, with "about me" words woven in every 4th slot
  // after the first 12 (personal words stick better and make speaking practice about your own life).
  const vocab = parsed.filter((p) => p.kind !== 'grammar' && !p.tags.includes('aboutme')).sort((a, b) => (a.rank || 9999) - (b.rank || 9999));
  const aboutMe = parsed.filter((p) => p.kind !== 'grammar' && p.tags.includes('aboutme'));
  const order: typeof parsed = [];
  let ai = 0;
  vocab.forEach((v, i) => {
    order.push(v);
    if (i >= 11 && i % 4 === 3 && ai < aboutMe.length) order.push(aboutMe[ai++]);
  });
  while (ai < aboutMe.length) order.push(aboutMe[ai++]);
  const grammar = parsed.filter((p) => p.kind === 'grammar').sort((a, b) => (a.grp ?? '').localeCompare(b.grp ?? '') || a.target.localeCompare(b.target));
  order.push(...grammar);

  const now = new Date().toISOString();
  let added = 0;
  let updated = 0;
  tx(d, () => {
    const exists = d.prepare('SELECT 1 FROM items WHERE id = ?');
    const upsert = d.prepare(`
      INSERT INTO items (id, deck, kind, target, article, word, meaning, sentence_html, sentence, sentence_meaning,
        grammar, notes, audio, rank, tags, grp, ord, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET deck=excluded.deck, kind=excluded.kind, target=excluded.target,
        article=excluded.article, word=excluded.word, meaning=excluded.meaning, sentence_html=excluded.sentence_html,
        sentence=excluded.sentence, sentence_meaning=excluded.sentence_meaning, grammar=excluded.grammar,
        notes=excluded.notes, audio=excluded.audio, rank=excluded.rank, tags=excluded.tags, grp=excluded.grp,
        ord=excluded.ord, updated_at=excluded.updated_at`);
    order.forEach((p, i) => {
      if (exists.get(p.id)) updated++;
      else added++;
      upsert.run(p.id, p.deck, p.kind, p.target, p.article, p.word, p.meaning, p.sentenceHtml, p.sentence,
        p.sentenceMeaning, p.grammar, p.notes, p.audio, p.rank, JSON.stringify(p.tags), p.grp, i, now);
    });
  });

  // Copy audio into the app so it keeps working even when Anki is closed.
  let media = 0;
  let mediaMissing = 0;
  const files = [...new Set(order.map((p) => p.audio).filter(Boolean) as string[])];
  for (const [i, f] of files.entries()) {
    const dest = resolve(MEDIA_DIR, f);
    if (existsSync(dest)) continue;
    if (i % 50 === 0) onProgress?.(`Copying audio ${i + 1}/${files.length}…`);
    const buf = await mediaFile(f).catch(() => null);
    if (buf) {
      writeFileSync(dest, buf);
      media++;
    } else mediaMissing++;
  }

  setMeta(d, 'lastImport', { deck, at: now, notes: order.length });
  const result = { deck, notes: order.length, added, updated, media, mediaMissing };
  onProgress?.(`Done: ${order.length} notes (${added} new, ${updated} updated), ${media} audio files copied.`);
  return result;
}
