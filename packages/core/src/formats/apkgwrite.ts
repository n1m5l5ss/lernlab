// Anki .apkg export: a zip with a legacy (schema 11) collection.anki2, a `media` map and the media files
// named "0", "1"…, which every Anki 2.1 and current Anki imports. Cards go in as new cards, without
// scheduling: LernLab's FSRS state does not map onto Anki's own.
import { strToU8, zipSync, type Zippable } from 'fflate';
import type { DB } from '../host';
import { host } from '../host';
import { stripHtml } from '../text';
import { sha1Hex } from '../sha1';
import { mediaKind, type NormalizedCard } from '../library';
import { DECK_SEPARATOR } from '../decktree';
import { parseVariants } from '../variants';
import { parseCorrections } from '../misconceptions';
import { keyPointsAsBack, parseKeyPoints } from '../explain';
import { parseWorkedSteps, workedStepsAsText } from '../worked';

/** A LernLab card id in a note's guid, so importing the package back updates the same cards. */
export const GUID_PREFIX = 'lernlab-';

// Fixed note type ids: exporting again reuses the same note types in Anki instead of adding copies.
const BASIC_ID = 1_731_000_000_491;
const CLOZE_ID = 1_731_000_000_492;

/** Field names chosen so LernLab's own Anki importer maps them back (see FIELD_MAP in apkg.ts). */
const EXTRA_FIELDS = ['Example', 'Example translation', 'Explanation', 'Notes', 'Image', 'Audio', 'Video'];
const BASIC_FIELDS = ['Front', 'Back', ...EXTRA_FIELDS];
const CLOZE_FIELDS = ['Text', 'Back', ...EXTRA_FIELDS];

const section = (f: string, cls: string) => `{{#${f}}}<div class="${cls}">{{${f}}}</div>{{/${f}}}`;
const MEDIA_SIDE = `${section('Image', 'image')}\n{{Audio}}\n{{Video}}`;
const ANSWER_SIDE = [
  '<hr id=answer>',
  '{{Back}}',
  section('Example', 'example'),
  section('Example translation', 'translation'),
  section('Explanation', 'explanation'),
  section('Notes', 'notes'),
].join('\n');
const CSS = `.card { font-family: arial; font-size: 20px; text-align: center; }
.example, .translation, .explanation, .notes { margin-top: 0.75em; }
.translation, .notes { font-size: 0.85em; opacity: 0.8; }
.image img { max-width: 100%; }
.cloze { font-weight: bold; }`;
const LATEX_PRE =
  '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n' +
  '\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n';

function noteType(id: number, name: string, cloze: boolean, fields: string[], did: number, mod: number) {
  const first = fields[0];
  const tmpl = cloze
    ? {
        name: 'Cloze',
        qfmt: `{{cloze:${first}}}\n${MEDIA_SIDE}`,
        afmt: `{{cloze:${first}}}\n${MEDIA_SIDE}\n${ANSWER_SIDE}`,
      }
    : { name: 'Card 1', qfmt: `{{${first}}}\n${MEDIA_SIDE}`, afmt: `{{FrontSide}}\n${ANSWER_SIDE}` };
  return {
    id,
    name,
    type: cloze ? 1 : 0,
    mod,
    usn: -1,
    sortf: 0,
    did,
    tmpls: [{ ...tmpl, ord: 0, bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0 }],
    flds: fields.map((f, ord) => ({ name: f, ord, sticky: false, rtl: false, font: 'Arial', size: 20, media: [] })),
    css: CSS,
    latexPre: LATEX_PRE,
    latexPost: '\\end{document}',
    latexsvg: false,
    req: [[0, 'any', [0]]],
    tags: [],
    vers: [],
  };
}

function deckJson(id: number, name: string, mod: number) {
  return {
    id,
    name,
    desc: '',
    mod,
    usn: -1,
    collapsed: false,
    browserCollapsed: false,
    newToday: [0, 0],
    revToday: [0, 0],
    lrnToday: [0, 0],
    timeToday: [0, 0],
    dyn: 0,
    conf: 1,
    extendNew: 0,
    extendRev: 0,
  };
}

const DECK_OPTIONS = {
  id: 1,
  name: 'Default',
  mod: 0,
  usn: 0,
  maxTaken: 60,
  autoplay: true,
  timer: 0,
  replayq: true,
  dyn: false,
  new: { bury: false, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20 },
  rev: { bury: false, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
  lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
};

const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null,
  ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null,
  models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null,
  usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null,
  flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null,
  mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null,
  ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null,
  odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null,
  ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn ON notes (usn);
CREATE INDEX ix_cards_usn ON cards (usn);
CREATE INDEX ix_revlog_usn ON revlog (usn);
CREATE INDEX ix_cards_nid ON cards (nid);
CREATE INDEX ix_cards_sched ON cards (did, queue, due);
CREATE INDEX ix_revlog_cid ON revlog (cid);
CREATE INDEX ix_notes_csum ON notes (csum);`;

/** Plain text in an Anki field, which Anki reads as HTML. */
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;');
/**
 * Anki has no question variants, corrections for wrong choices or key points: they go under the notes, one
 * per line ("apply: …", "EC2: Many people think…", "• Earth is tilted"), so they are not lost.
 */
const notesOf = (c: NormalizedCard) => {
  const choices = (c.choices ?? '').split('|').map((x) => x.trim());
  const corrections = parseCorrections(c.corrections).map((text, i) =>
    text && choices[i] ? `${choices[i]}: ${escapeHtml(text)}` : '',
  );
  // An explain card's key points, unless they already are its back (it had no model explanation).
  const points = parseKeyPoints(c.keyPoints);
  const pointsLine =
    points.length && c.back !== keyPointsAsBack(points)
      ? escapeHtml(keyPointsAsBack(points)).replace(/\n/g, '<br>')
      : '';
  return [
    c.notes ?? '',
    ...parseVariants(c.variants).map((v) => escapeHtml(`${v.level}: ${v.prompt}`)),
    ...corrections,
    pointsLine,
    // A worked example's steps, numbered ("1. Divide by 2: x = 4").
    escapeHtml(workedStepsAsText(parseWorkedSteps(c.workedSteps))).replace(/\n/g, '<br>'),
  ]
    .filter(Boolean)
    .join('<br>');
};

/** The cloze numbers in a text: {{c1::…}} and {{c3::…}} give cards with ord 0 and 2. */
const clozeOrds = (text: string) => {
  const ords = [...new Set([...text.matchAll(/\{\{c(\d+)::/g)].map((m) => Number(m[1]) - 1))].filter((n) => n >= 0);
  return ords.length ? ords.sort((a, b) => a - b) : [0];
};

/** Card types whose back LernLab keeps as (sanitised) HTML; every other back is plain text. */
const HTML_BACKS = ['cloze', 'mcq', 'order'];

/**
 * Anki has no choice or ordering cards: an empty back shows the right choices, or the steps in order.
 * A plain-text back (code output, a number) is escaped, with its line breaks kept.
 */
function answerOf(c: NormalizedCard): string {
  if (c.back.trim() || !c.type)
    return HTML_BACKS.includes(c.type ?? '') ? c.back : escapeHtml(c.back).replace(/\r?\n/g, '<br>');
  const list = (s?: string) =>
    (s ?? '')
      .split('|')
      .map((x) => x.trim())
      .filter(Boolean);
  if (c.type === 'order')
    return list(c.steps)
      .map((step, i) => `${i + 1}. ${step}`)
      .join('<br>');
  const choices = list(c.choices);
  const right = list(c.correct).map((r) => (/^\d+$/.test(r) ? choices[Number(r) - 1] : r));
  return right.filter(Boolean).join('<br>');
}

/**
 * Write cards as an Anki package. Card fields hold HTML only where LernLab keeps HTML (cloze text,
 * the back of cloze/choice/order cards, example, explanation, notes); other text is escaped.
 * `media` is keyed by file name and holds the files the cards use.
 */
export function writeApkg(
  deckName: string,
  cards: NormalizedCard[],
  media: Record<string, Uint8Array>,
  now = Date.now(),
): Uint8Array {
  const sec = Math.floor(now / 1000);
  const deckIds = new Map<string, number>();
  const deckOf = (c: NormalizedCard) => {
    const sub = c.subdeck?.trim();
    const name =
      !sub || sub === deckName
        ? deckName
        : sub.startsWith(deckName + DECK_SEPARATOR)
          ? sub
          : `${deckName}${DECK_SEPARATOR}${sub}`;
    // Parents first, so every level of the path exists in Anki.
    const parts = name.split(DECK_SEPARATOR);
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join(DECK_SEPARATOR);
      if (!deckIds.has(path)) deckIds.set(path, now + deckIds.size + 1);
    }
    return deckIds.get(name)!;
  };
  const rootId = deckOf({ front: '', back: '' });

  const mediaField = (c: NormalizedCard) => {
    const sound = (f?: string) => (f && media[f] ? `[sound:${f}]` : '');
    const src = c.image && (media[c.image] || /^https?:/.test(c.image)) ? c.image : '';
    const alt = c.imageAlt ? ` alt="${escapeAttr(c.imageAlt)}"` : '';
    return [src ? `<img src="${escapeAttr(src)}"${alt}>` : '', sound(c.audio), sound(c.video)];
  };

  const bytes = host().buildSqliteBytes((db: DB) => {
    db.exec(SCHEMA);
    const note = db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, ?)');
    const card = db.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, -1, 0, 0, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?)');
    let cardId = now;
    db.exec('BEGIN');
    cards.forEach((c, i) => {
      const cloze = c.type === 'cloze' || /\{\{c\d+::/.test(c.front);
      const front = cloze ? c.front : escapeHtml(c.front);
      const back = c.type ? answerOf(c) : escapeHtml(c.back);
      const fields = [
        front,
        back,
        c.example ?? '',
        escapeHtml(c.exampleTranslation ?? ''),
        c.explanation ?? '',
        notesOf(c),
        ...mediaField(c),
      ];
      const sort = stripHtml(front);
      const tags = (c.tags ?? []).map((t) => t.trim().replace(/\s+/g, '_')).filter(Boolean);
      const nid = now + i;
      const guid =
        c.sourceId !== undefined ? `${GUID_PREFIX}${c.sourceId}` : sha1Hex(`${deckName}\0${c.front}`).slice(0, 10);
      note.run(
        nid,
        guid,
        cloze ? CLOZE_ID : BASIC_ID,
        sec,
        tags.length ? ` ${tags.join(' ')} ` : '',
        fields.join('\x1f'),
        sort,
        parseInt(sha1Hex(sort).slice(0, 8), 16),
        '',
      );
      const did = deckOf(c);
      for (const ord of cloze ? clozeOrds(c.front) : [0]) card.run(++cardId, nid, did, ord, sec, i + 1, '');
    });
    const decks: Record<string, object> = { 1: deckJson(1, 'Default', sec) };
    for (const [name, id] of deckIds) decks[id] = deckJson(id, name, sec);
    const conf = {
      activeDecks: [rootId],
      curDeck: rootId,
      curModel: BASIC_ID,
      newSpread: 0,
      collapseTime: 1200,
      timeLim: 0,
      estTimes: true,
      dueCounts: true,
      sortType: 'noteFld',
      sortBackwards: false,
      addToCur: true,
      nextPos: cards.length + 1,
    };
    const models = {
      [BASIC_ID]: noteType(BASIC_ID, 'Basic (LernLab)', false, BASIC_FIELDS, rootId, sec),
      [CLOZE_ID]: noteType(CLOZE_ID, 'Cloze (LernLab)', true, CLOZE_FIELDS, rootId, sec),
    };
    db.prepare('INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)').run(
      Math.floor(new Date(now).setHours(4, 0, 0, 0) / 1000),
      now,
      now,
      JSON.stringify(conf),
      JSON.stringify(models),
      JSON.stringify(decks),
      JSON.stringify({ 1: DECK_OPTIONS }),
      '{}',
    );
    db.exec('COMMIT');
  });

  const files: Zippable = { 'collection.anki2': bytes };
  const map: Record<string, string> = {};
  Object.entries(media).forEach(([name, data], i) => {
    map[i] = name;
    // Pictures and sounds are already compressed: store them as they are.
    files[String(i)] = [data, { level: mediaKind(name) ? 0 : 6 }];
  });
  files.media = strToU8(JSON.stringify(map));
  return zipSync(files, { level: 6 });
}
