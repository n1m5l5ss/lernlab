// Session planner: builds a varied, never-monotonous session out of short blocks (about 60–90 s each).
// Rules: formats rotate (never the same twice in a row); easy win first; new words are introduced,
// recognised, then recalled in the same session; a boss fight at the end recycles today's mistakes.
import { randomUUID } from 'node:crypto';
import { getDb, type DB } from './db';
import {
  allItems, dueItemIds, getSettings, grammarItemIds, introducedTodayCount, itemsByIds, learnedIds,
  learningTodayIds, leechIds, newItemIds, nextGrammarGroup, srsInfo,
} from './learn';
import * as gen from './exercises';
import { dayKey } from '../shared/game';
import { shuffle } from '../shared/text';
import type { Block, Exercise, Item, SessionLength, SessionPlan } from '../shared/types';

const SIZES: Record<SessionLength, { due: number; fresh: number; gender: number; rain: boolean; speak: number; listen: number }> = {
  mini: { due: 6, fresh: 3, gender: 0, rain: false, speak: 2, listen: 0 },
  standard: { due: 14, fresh: 5, gender: 40, rain: true, speak: 3, listen: 3 },
  long: { due: 30, fresh: 8, gender: 45, rain: true, speak: 5, listen: 4 },
};

let blockN = 0;
const bid = () => `b${++blockN}`;

export function planSession(length: SessionLength, d: DB = getDb(), now = new Date()): SessionPlan {
  const settings = getSettings(d);
  const size = SIZES[length];
  const pool = allItems(d);
  const byId = new Map(pool.map((i) => [i.id, i]));
  const get = (id: number) => byId.get(id)!;

  const due = dueItemIds(d, now, size.due).filter((id) => byId.has(id));
  const leftovers = learningTodayIds(d, now).filter((id) => byId.has(id) && get(id).kind !== 'grammar');
  const newBudget = Math.max(0, settings.newPerDay - introducedTodayCount(d, now));
  const fresh = newItemIds(d, Math.min(size.fresh, newBudget)).filter((id) => byId.has(id));
  const learned = learnedIds(d, 300).filter((id) => byId.has(id) && get(id).kind !== 'grammar');
  const group = length === 'mini' ? null : nextGrammarGroup(d, now);
  const grammar = group ? grammarItemIds(group, d).slice(0, 4) : [];
  const info = srsInfo([...due, ...learned], d);

  const blocks: Block[] = [];
  const isNoun = (id: number) => get(id).kind === 'noun';

  // 1. Ignition: three near-certain wins. Easiest learned items; on day one, guess very common words.
  const easy = [...learned].sort((a, b) => (info[b]?.mastery ?? 0) - (info[a]?.mastery ?? 0)).slice(0, 12);
  const ignitionIds = shuffle(easy.length >= 3 ? easy : [...easy, ...newItemIds(d, 6)]).slice(0, 3);
  blocks.push({
    id: bid(), kind: 'ignition', title: 'Aufwärmen', teacher: 'Drei schnelle Wörter. Los!',
    exercises: ignitionIds.map((id) => gen.mc(get(id), pool, 'de2en')),
  });

  // 2. Gender sprint: der/die/das buckets. Unknown nouns become a "guess first" pretest (generation effect).
  if (size.gender) {
    const nouns = shuffle([...learned.filter(isNoun), ...fresh.filter(isNoun), ...newItemIds(d, 40, ['noun'])]);
    const uniq = [...new Set(nouns)].slice(0, 30);
    if (uniq.length >= 4) {
      blocks.push({ id: bid(), kind: 'gender', title: 'Artikel-Sprint', teacher: 'Der, die oder das? So schnell du kannst!', itemIds: uniq, seconds: size.gender });
    }
  }

  // 3. Due reviews, first half: typed recall (production, writes the spaced-repetition grade).
  const half = Math.ceil(due.length / 2);
  const dueA = due.slice(0, half);
  const dueB = due.slice(half);
  if (dueA.length) {
    blocks.push({ id: bid(), kind: 'drill', format: 'typed', title: 'Wiederholen', teacher: 'Schreib das deutsche Wort – mit Artikel.', exercises: dueA.map((id) => gen.typed(get(id))) });
  }

  // 4. New words: meet each word, then recognise it right away.
  if (fresh.length) {
    const ex: Exercise[] = [];
    for (const id of fresh) {
      ex.push({ type: 'intro', itemId: id });
      ex.push(gen.mc(get(id), pool, Math.random() < 0.5 ? 'de2en' : 'en2de'));
    }
    blocks.push({ id: bid(), kind: 'learn', title: 'Neue Wörter', teacher: `${fresh.length} neue Wörter. Hör genau hin.`, exercises: ex });
  }

  // 5. Match pairs: fast, playful recognition across new and known words.
  const matchIds = shuffle([...new Set([...fresh, ...leftovers, ...learned.slice(0, 20)])]).slice(0, 5);
  if (matchIds.length >= 4) {
    blocks.push({ id: bid(), kind: 'match', title: 'Paare finden', teacher: 'Finde die Paare – auf Zeit!', itemIds: matchIds });
  }

  // 6. Grammar micro-lesson, then drill it immediately (cloze and sentence building).
  if (group && grammar.length) {
    const gi = grammar.map(get);
    const ex: Exercise[] = [gen.lesson(group, gi)];
    gi.forEach((it, i) => {
      const e = i % 2 === 0 ? gen.cloze(it) ?? gen.unscramble(it) : gen.unscramble(it) ?? gen.cloze(it);
      if (e) ex.push(e);
    });
    blocks.push({ id: bid(), kind: 'learn', title: 'Grammatik', teacher: 'Eine Regel, dann sofort üben.', exercises: ex });
  }

  // 7. Listening: hear the sentence, pick its meaning.
  const listenPool = shuffle([...fresh, ...learned.slice(0, 40)].filter((id) => get(id).audio));
  const listenEx = listenPool.map((id) => gen.listen(get(id), pool)).filter(Boolean).slice(0, size.listen) as Exercise[];
  if (listenEx.length >= 2) {
    blocks.push({ id: bid(), kind: 'drill', format: 'listen', title: 'Hören', teacher: 'Hör zu. Was bedeutet das?', exercises: listenEx });
  }

  // 8. Due reviews, second half: cloze in a sentence (or typed if no sentence).
  if (dueB.length) {
    blocks.push({
      id: bid(), kind: 'drill', format: 'cloze', title: 'Lückentext', teacher: 'Welches Wort fehlt?',
      exercises: dueB.map((id) => gen.cloze(get(id)) ?? gen.typed(get(id))),
    });
  }

  // 9. Speak: production effect – say a subset aloud.
  const speakIds = shuffle([...fresh, ...due, ...leftovers]).slice(0, size.speak);
  if (speakIds.length) {
    blocks.push({ id: bid(), kind: 'drill', format: 'speak', title: 'Sprechen', teacher: 'Sag es laut auf Deutsch!', exercises: speakIds.map((id) => gen.speak(get(id))) });
  }

  // 10. Recall today's new words (and yesterday's unfinished ones): first real test, writes their first grade.
  const recall = [...new Set([...fresh, ...leftovers])];
  if (recall.length) {
    blocks.push({
      id: bid(), kind: 'drill', format: 'typed', title: 'Abrufen', teacher: 'Jetzt ohne Hilfe: die neuen Wörter!',
      exercises: shuffle(recall).map((id, i) => (i % 3 === 2 ? gen.cloze(get(id)) ?? gen.typed(get(id)) : gen.typed(get(id)))),
    });
  }

  // 11. Word rain (arcade). Every other day in standard sessions, always in long ones.
  const rainIds = shuffle([...new Set([...learned, ...fresh])]).slice(0, 24);
  const rainDay = Number(dayKey(now).slice(-2)) % 2 === 0;
  if (size.rain && rainIds.length >= 6 && (length === 'long' || rainDay)) {
    const at = Math.max(2, blocks.length - 2);
    blocks.splice(at, 0, { id: bid(), kind: 'rain', title: 'Wortregen', teacher: 'Tippe die Wörter, bevor sie landen!', itemIds: rainIds, seconds: 60 });
  }

  // 12. Boss battle: today's mistakes + leeches. The client adds every word missed this session.
  const leeches = leechIds(d, 6).filter((id) => byId.has(id) && get(id).kind !== 'grammar');
  blocks.push({ id: bid(), kind: 'boss', title: 'Endgegner', teacher: 'Deine schwierigsten Wörter. Drei Leben. Kämpf!', itemIds: leeches, lives: 3 });

  // Collect every referenced item for the client.
  const ids = new Set<number>([...ignitionIds, ...due, ...fresh, ...leftovers, ...matchIds, ...grammar, ...listenPool.slice(0, 6), ...speakIds, ...leeches, ...rainIds]);
  for (const b of blocks) if ('itemIds' in b) b.itemIds.forEach((i) => ids.add(i));
  const items = itemsByIds([...ids], d);
  const extras: Record<number, Item> = {};
  for (const it of shuffle(pool.filter((p) => p.kind !== 'grammar')).slice(0, 60)) if (!items[it.id]) extras[it.id] = it;

  const parts: string[] = [];
  const partsEn: string[] = [];
  if (due.length) { parts.push(`${due.length} Wiederholungen`); partsEn.push(`${due.length} reviews`); }
  if (fresh.length) { parts.push(`${fresh.length} neue Wörter`); partsEn.push(`${fresh.length} new words`); }
  if (group) { parts.push(`Grammatik: ${get(grammar[0]).target.replace(/\s*\(\d+\)$/, '').split(':')[0]}`); partsEn.push('one grammar point'); }
  if (!parts.length) { parts.push('Wiederholung und Spiele'); partsEn.push('review games'); }

  return {
    id: randomUUID(),
    length,
    agenda: `Heute: ${parts.join(', ')}.`,
    agendaEn: `Today: ${partsEn.join(', ')}.`,
    blocks,
    items,
    extras,
    counts: { due: due.length, fresh: fresh.length, grammar: group },
  };
}
