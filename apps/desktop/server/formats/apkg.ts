// Anki .apkg / .colpkg import: legacy collection.anki2/anki21 and the newer zstd-compressed anki21b.
import { unzipSync, strFromU8 } from 'fflate';
import { decompress } from 'fzstd';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openReadonly } from '../db';
import { stripHtml } from '../../shared/text';
import type { NormalizedCard } from '../library';

const ZSTD = [0x28, 0xb5, 0x2f, 0xfd];
const isZstd = (b: Uint8Array) => ZSTD.every((x, i) => b[i] === x);
const unz = (b: Uint8Array) => (isZstd(b) ? decompress(b) : b);

/** Minimal protobuf reader for Anki's MediaEntries { repeated MediaEntry entries = 1 { string name = 1 } }. */
function mediaNamesFromProto(buf: Uint8Array): string[] {
  const names: string[] = [];
  let i = 0;
  const varint = (): number => { let r = 0, s = 0, b; do { b = buf[i++]; r += (b & 0x7f) * 2 ** s; s += 7; } while (b & 0x80); return r; };
  while (i < buf.length) {
    const key = varint();
    const wire = key & 7;
    if (wire === 2) {
      const len = varint();
      const end = i + len;
      if (key >> 3 === 1) {
        let name = '';
        while (i < end) {
          const k = varint();
          if ((k & 7) === 2) { const l = varint(); if (k >> 3 === 1) name = new TextDecoder().decode(buf.subarray(i, i + l)); i += l; }
          else if ((k & 7) === 0) varint();
          else if ((k & 7) === 5) i += 4;
          else if ((k & 7) === 1) i += 8;
        }
        names.push(name);
      }
      i = end;
    } else if (wire === 0) varint();
    else if (wire === 5) i += 4;
    else if (wire === 1) i += 8;
  }
  return names;
}

const FIELD_MAP: [keyof NormalizedCard | 'reading', RegExp][] = [
  ['front', /^(target|front|word|term|expression|question|text|vocab|kanji|vocabulary)$/i],
  ['back', /^(meaning|back|definition|answer|translation|english|glossary)$/i],
  ['example', /^(sentence|example|example sentence|context)$/i],
  ['exampleTranslation', /^(sentence ?meaning|sentence translation|example translation|sentence-english)$/i],
  ['explanation', /^(grammar|explanation|rule)$/i],
  ['notes', /^(notes?|extra|hint|mnemonic|back extra)$/i],
  ['reading', /^(reading|furigana|pronunciation|romaji|ipa)$/i],
  ['rank', /^(rank|frequency|freq)$/i],
  ['category', /^(category|gender)$/i],
];

export type ApkgResult = { cards: NormalizedCard[]; media: Record<string, Uint8Array>; decks: string[] };

export function readApkg(buf: Uint8Array): ApkgResult {
  const files = unzipSync(buf);
  const colName = ['collection.anki21b', 'collection.anki21', 'collection.anki2'].find((n) => files[n]);
  if (!colName) throw new Error('Not an Anki package (no collection inside)');
  const dir = mkdtempSync(join(tmpdir(), 'apkg-'));
  try {
    const dbFile = join(dir, 'col.db');
    writeFileSync(dbFile, unz(files[colName]));
    const db = openReadonly(dbFile);

    // Note types → ordered field names. Newer collections keep them in tables, older ones in col.models JSON.
    const fieldNames = new Map<number, string[]>();
    const deckNames = new Map<number, string>();
    const hasTable = (t: string) => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
    if (hasTable('fields')) {
      for (const r of db.prepare('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord').all() as any[]) {
        const arr = fieldNames.get(Number(r.ntid)) ?? [];
        arr[Number(r.ord)] = r.name;
        fieldNames.set(Number(r.ntid), arr);
      }
      // Anki separates deck levels with the \x1f control character.
      // eslint-disable-next-line no-control-regex
      for (const r of db.prepare('SELECT id, name FROM decks').all() as any[]) deckNames.set(Number(r.id), String(r.name).replace(/\x1f/g, '::'));
    } else {
      const col = db.prepare('SELECT models, decks FROM col').get() as any;
      for (const m of Object.values(JSON.parse(col.models)) as any[]) fieldNames.set(Number(m.id), m.flds.sort((a: any, b: any) => a.ord - b.ord).map((f: any) => f.name));
      for (const dk of Object.values(JSON.parse(col.decks)) as any[]) deckNames.set(Number(dk.id), dk.name);
    }

    const noteDeck = new Map<number, number>();
    for (const r of db.prepare('SELECT nid, did FROM cards ORDER BY ord').all() as any[]) if (!noteDeck.has(Number(r.nid))) noteDeck.set(Number(r.nid), Number(r.did));

    const cards: NormalizedCard[] = [];
    const usedDecks = new Set<string>();
    for (const n of db.prepare('SELECT id, mid, flds, tags FROM notes').all() as any[]) {
      const values: string[] = String(n.flds).split('\x1f');
      if (values.length === 1 && /please update to the latest anki/i.test(values[0])) continue; // placeholder in new exports
      const names = fieldNames.get(Number(n.mid)) ?? values.map((_, i) => (i === 0 ? 'Front' : i === 1 ? 'Back' : `Field ${i + 1}`));
      const card: any = { sourceId: Number(n.id), tags: String(n.tags).trim().split(/\s+/).filter(Boolean), extra: {} };
      const all = values.join(' ');
      const sound = all.match(/\[sound:([^\]]+)\]/)?.[1];
      const img = all.match(/<img[^>]+src=["']?([^"' >]+)/i)?.[1];
      if (sound) card.audio = sound;
      if (img) card.image = decodeURIComponent(img);
      names.forEach((name, i) => {
        const raw = (values[i] ?? '').replace(/\[sound:[^\]]+\]/g, '').replace(/<img[^>]*>/gi, '').trim();
        if (!raw) return;
        const hit = FIELD_MAP.find(([, re]) => re.test(name.trim()));
        if (hit && !card[hit[0]] && hit[0] !== 'reading') card[hit[0]] = hit[0] === 'rank' ? Number(stripHtml(raw)) || undefined : raw;
        else if (hit?.[0] === 'reading') card.extra.reading = stripHtml(raw);
        else card.extra[name] = raw;
      });
      // Fall back to the first two non-empty fields.
      const plain = names.map((_, i) => (values[i] ?? '').replace(/\[sound:[^\]]+\]/g, '').replace(/<img[^>]*>/gi, '').trim());
      if (!card.front) card.front = plain.find((v) => v) ?? '';
      if (!card.back) card.back = plain.find((v) => v && v !== card.front) ?? '';
      if (/\{\{c\d+::/.test(card.back) && !/\{\{c\d+::/.test(card.front)) [card.front, card.back] = [card.back, card.front];
      const deckName = deckNames.get(noteDeck.get(Number(n.id)) ?? -1);
      if (deckName) { card.subdeck = deckName; usedDecks.add(deckName); }
      cards.push(card);
    }
    db.close();

    // Media: a map from zip entry ("0", "1"…) to file name; JSON in old packages, zstd protobuf in new ones.
    const media: Record<string, Uint8Array> = {};
    if (files.media) {
      const raw = files.media;
      let names: Record<string, string> = {};
      if (isZstd(raw)) mediaNamesFromProto(decompress(raw)).forEach((n, i) => { names[String(i)] = n; });
      else names = JSON.parse(strFromU8(raw));
      for (const [k, name] of Object.entries(names)) if (files[k]) media[name] = unz(files[k]);
    }
    return { cards, media, decks: [...usedDecks] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
