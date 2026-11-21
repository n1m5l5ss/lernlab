// Anki .apkg / .colpkg import: legacy collection.anki2/anki21 and the newer zstd-compressed anki21b.
import type { DB, Row } from '../host';
import { strFromU8 } from 'fflate';
import { host } from '../host';
import { stripHtml } from '../text';
import type { NormalizedCard } from '../library';
import { UserError } from '../errors';
import { IMPORT_LIMITS, isZstd, readZip, unzstd } from './zip';
import { reviewsFromRevlog, type PastReview, type RevlogRow } from '../ankihistory';
import { mediaKind } from '../library';
import { GUID_PREFIX } from './apkgwrite';

const MEDIA_MAP_BYTES = 64 * 1024 * 1024;

/** Minimal protobuf reader for Anki's MediaEntries { repeated MediaEntry entries = 1 { string name = 1 } }. */
function mediaNamesFromProto(buf: Uint8Array): string[] {
  const names: string[] = [];
  let i = 0;
  const varint = (): number => {
    let r = 0,
      s = 0,
      b;
    do {
      b = buf[i++];
      r += (b & 0x7f) * 2 ** s;
      s += 7;
    } while (b & 0x80);
    return r;
  };
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
          if ((k & 7) === 2) {
            const l = varint();
            if (k >> 3 === 1) name = new TextDecoder().decode(buf.subarray(i, i + l));
            i += l;
          } else if ((k & 7) === 0) varint();
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

export type ApkgResult = {
  cards: NormalizedCard[];
  media: Record<string, Uint8Array>;
  decks: string[];
  /** Media the package lists but does not contain. */
  mediaMissing: string[];
  /** Past answers that count, per note id (the note's first card), from the revlog when the package has one. */
  history: Map<number, PastReview[]>;
};

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

/** The LernLab card id in a guid LernLab wrote, as text (the same rule as a .lernpack's own ids). */
const ownId = (guid: unknown): string | undefined =>
  typeof guid === 'string' && guid.startsWith(GUID_PREFIX) && /^\d{1,16}$/.test(guid.slice(GUID_PREFIX.length))
    ? guid.slice(GUID_PREFIX.length)
    : undefined;

const damaged = () => new UserError('anki_damaged', 'This Anki package is damaged and could not be read');

/**
 * A LernLab card is one Anki note, so the note's first card (lowest `ord`, usually front → back) gives the
 * history; reviews of its other cards (e.g. the reverse card) are left out.
 */
function history(db: DB, firstCard: Map<number, number>, ownIds: Map<number, number>): Map<number, PastReview[]> {
  const rows = new Map<number, RevlogRow[]>();
  const all = db.prepare('SELECT id, cid, ease, ivl, factor, type FROM revlog ORDER BY cid, id').all();
  for (const r of all) {
    const nid = firstCard.get(Number(r.cid));
    if (nid === undefined) continue;
    const list = rows.get(nid) ?? [];
    list.push({
      time: Number(r.id),
      ease: Number(r.ease),
      type: Number(r.type),
      ivl: Number(r.ivl),
      factor: Number(r.factor),
    });
    rows.set(nid, list);
  }
  const out = new Map<number, PastReview[]>();
  for (const [nid, list] of rows) {
    const reviews = reviewsFromRevlog(list);
    if (reviews.length) out.set(ownIds.get(nid) ?? nid, reviews);
  }
  return out;
}

export function readApkg(buf: Uint8Array): ApkgResult {
  const files = readZip(buf, (n) => /^(collection\.anki2|collection\.anki21b?|media)$/.test(n));
  const colName = ['collection.anki21b', 'collection.anki21', 'collection.anki2'].find((n) => files[n]);
  if (!colName) throw new UserError('not_anki', 'Not an Anki package (no collection inside)');
  let db: DB;
  try {
    db = host().openSqliteBytes(unzstd(files[colName], IMPORT_LIMITS.collectionBytes));
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw damaged();
  }
  try {
    // The collection is a database someone else wrote. A view (say an endless WITH RECURSIVE named `notes`),
    // a trigger or a virtual table could make a plain SELECT run forever, so only real tables are read.
    db.exec('PRAGMA trusted_schema = OFF');
    const odd = db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type IN ('view', 'trigger') OR upper(sql) LIKE 'CREATE VIRTUAL%' LIMIT 1",
      )
      .get();
    if (odd) throw damaged();
    // Note types → ordered field names. Newer collections keep them in tables, older ones in col.models JSON.
    const fieldNames = new Map<number, string[]>();
    const deckNames = new Map<number, string>();
    const hasTable = (t: string) => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
    if (hasTable('fields')) {
      for (const r of db.prepare('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord').all() as Row[]) {
        const arr = fieldNames.get(Number(r.ntid)) ?? [];
        arr[Number(r.ord)] = String(r.name);
        fieldNames.set(Number(r.ntid), arr);
      }
      // Anki separates deck levels with the \x1f control character.
      for (const r of db.prepare('SELECT id, name FROM decks').all() as Row[])
        // eslint-disable-next-line no-control-regex
        deckNames.set(Number(r.id), String(r.name).replace(/\x1f/g, '::'));
    } else {
      // Older collections keep note types and decks as JSON in the single `col` row.
      type ModelJson = { id: number; flds: { name: string; ord: number }[] };
      type DeckJson = { id: number; name: string };
      const col = db.prepare('SELECT models, decks FROM col').get() as { models: string; decks: string };
      for (const m of Object.values(JSON.parse(col.models)) as ModelJson[])
        fieldNames.set(
          Number(m.id),
          m.flds.sort((a, b) => a.ord - b.ord).map((f) => f.name),
        );
      for (const dk of Object.values(JSON.parse(col.decks)) as DeckJson[]) deckNames.set(Number(dk.id), dk.name);
    }

    const noteDeck = new Map<number, number>();
    const firstCard = new Map<number, number>();
    for (const r of db.prepare('SELECT id, nid, did FROM cards ORDER BY ord').all() as Row[])
      if (!noteDeck.has(Number(r.nid))) {
        noteDeck.set(Number(r.nid), Number(r.did));
        firstCard.set(Number(r.id), Number(r.nid));
      }

    const cards: NormalizedCard[] = [];
    const usedDecks = new Set<string>();
    // A note LernLab exported carries the card's own id in its guid: imported back, it updates that card.
    const hasGuid = !!db.prepare("SELECT 1 FROM pragma_table_info('notes') WHERE name = 'guid'").get();
    const ownIds = new Map<number, number>();
    for (const n of db.prepare(`SELECT id, mid, flds, tags${hasGuid ? ', guid' : ''} FROM notes`).all() as Row[]) {
      const values: string[] = String(n.flds).split('\x1f');
      if (values.length === 1 && /please update to the latest anki/i.test(values[0])) continue; // placeholder in new exports
      const names =
        fieldNames.get(Number(n.mid)) ??
        values.map((_, i) => (i === 0 ? 'Front' : i === 1 ? 'Back' : `Field ${i + 1}`));
      // Built field by field from the note type's field names (see FIELD_MAP).
      const card: NormalizedCard & { extra: Record<string, string> } & Record<string, unknown> = {
        front: '',
        back: '',
        sourceId: ownId(n.guid) ?? Number(n.id),
        tags: String(n.tags).trim().split(/\s+/).filter(Boolean),
        extra: {},
      };
      const all = values.join(' ');
      const sounds = [...all.matchAll(/\[sound:([^\]]+)\]/g)].map((m) => m[1]);
      const img = all.match(/<img[^>]+src=["']?([^"' >]+)/i)?.[1];
      const video = sounds.find((f) => mediaKind(f) === 'video');
      const sound = sounds.find((f) => f !== video);
      if (sound) card.audio = sound;
      if (video) card.video = video;
      if (img) card.image = safeDecode(img);
      names.forEach((name, i) => {
        const raw = (values[i] ?? '')
          .replace(/\[sound:[^\]]+\]/g, '')
          .replace(/<img[^>]*>/gi, '')
          .trim();
        if (!raw) return;
        const hit = FIELD_MAP.find(([, re]) => re.test(name.trim()));
        if (hit && !card[hit[0]] && hit[0] !== 'reading')
          (card as Record<string, unknown>)[hit[0]] = hit[0] === 'rank' ? Number(stripHtml(raw)) || undefined : raw;
        else if (hit?.[0] === 'reading') card.extra.reading = stripHtml(raw);
        else card.extra[name] = raw;
      });
      // Fall back to the first two non-empty fields.
      const plain = names.map((_, i) =>
        (values[i] ?? '')
          .replace(/\[sound:[^\]]+\]/g, '')
          .replace(/<img[^>]*>/gi, '')
          .trim(),
      );
      if (!card.front) card.front = plain.find((v) => v) ?? '';
      if (!card.back) card.back = plain.find((v) => v && v !== card.front) ?? '';
      if (/\{\{c\d+::/.test(card.back) && !/\{\{c\d+::/.test(card.front))
        [card.front, card.back] = [card.back, card.front];
      const deckName = deckNames.get(noteDeck.get(Number(n.id)) ?? -1);
      if (deckName) {
        card.subdeck = deckName;
        usedDecks.add(deckName);
      }
      if (typeof card.sourceId === 'string') ownIds.set(Number(n.id), Number(card.sourceId));
      cards.push(card);
    }

    // Media: a map from zip entry ("0", "1"…) to file name; JSON in old packages, zstd protobuf in new ones.
    // Only files a card uses are unpacked.
    const media: Record<string, Uint8Array> = {};
    const mediaMissing: string[] = [];
    const mediaMap = files.media;
    if (mediaMap) {
      let names: Record<string, string> = {};
      if (isZstd(mediaMap))
        mediaNamesFromProto(unzstd(mediaMap, MEDIA_MAP_BYTES)).forEach((n, i) => {
          names[String(i)] = n;
        });
      else names = JSON.parse(strFromU8(mediaMap)) as Record<string, string>;
      const used = new Set(cards.flatMap((c) => [c.audio, c.image, c.video]).filter(Boolean));
      const wanted = new Map(Object.entries(names).filter(([, name]) => used.has(name)));
      const entries = readZip(buf, (n) => wanted.has(n));
      // zstd inside the zip hides the real size from the zip checks, so cap each file by its kind and all
      // of them together: a 2 KB package must not unpack to gigabytes.
      let total = 0;
      for (const [k, name] of wanted) {
        if (!entries[k]) {
          mediaMissing.push(name);
          continue;
        }
        const kind = mediaKind(name);
        const data = unzstd(entries[k], kind ? IMPORT_LIMITS[kind] : IMPORT_LIMITS.image);
        total += data.length;
        if (total > IMPORT_LIMITS.unpackedBytes)
          throw new UserError('zip_too_big', 'The file unpacks to too much data', {
            mb: Math.round(IMPORT_LIMITS.unpackedBytes / 1024 / 1024),
          });
        media[name] = data;
      }
    }
    return {
      cards,
      media,
      decks: [...usedDecks],
      mediaMissing,
      history: hasTable('revlog') ? history(db, firstCard, ownIds) : new Map(),
    };
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw damaged();
  } finally {
    db.close();
  }
}
