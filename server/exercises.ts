// Exercise generators: turn one Anki note into many kinds of exercises.
import { acceptedAnswers, shuffle, splitBold, tokenize } from '../shared/text';
import type { Exercise, Item } from '../shared/types';

const ARTS = ['der', 'die', 'das'] as const;

function pickDistractors(item: Item, pool: Item[], n: number, key: (i: Item) => string): Item[] {
  const own = key(item).toLowerCase();
  const seen = new Set([own]);
  const candidates = shuffle(
    pool.filter((p) => p.id !== item.id && p.kind !== 'grammar' && key(p) && !seen.has(key(p).toLowerCase())),
  );
  // Prefer same kind and nearby frequency rank: more plausible, so the choice is a real discrimination.
  candidates.sort((a, b) => score(b) - score(a));
  function score(p: Item) {
    let s = 0;
    if (p.kind === item.kind) s += 3;
    if (item.rank && p.rank && Math.abs(p.rank - item.rank) < 150) s += 2;
    if (item.article && p.article === item.article) s += 1;
    return s + Math.random();
  }
  const out: Item[] = [];
  for (const c of candidates) {
    const k = key(c).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

export function mc(item: Item, pool: Item[], direction: 'de2en' | 'en2de'): Exercise {
  if (direction === 'de2en') {
    const ds = pickDistractors(item, pool, 3, (i) => i.meaning);
    const options = shuffle([item.meaning, ...ds.map((d) => d.meaning)]);
    return { type: 'mc', itemId: item.id, direction, prompt: item.target, options, answerIndex: options.indexOf(item.meaning) };
  }
  const opts: string[] = [item.target];
  // Gender trap: the same noun with a wrong article sits among the options.
  if (item.kind === 'noun' && item.article) {
    const wrong = ARTS.filter((a) => a !== item.article);
    opts.push(`${wrong[Math.floor(Math.random() * 2)]} ${item.word}`);
  }
  const ds = pickDistractors(item, pool, 4 - opts.length, (i) => i.target);
  opts.push(...ds.map((d) => d.target));
  const options = shuffle(opts);
  return { type: 'mc', itemId: item.id, direction, prompt: item.meaning, options, answerIndex: options.indexOf(item.target) };
}

export function typed(item: Item): Exercise {
  const accepted = acceptedAnswers(item.target);
  const first = accepted[0];
  const core = item.kind === 'noun' ? item.word : first;
  const hint = item.kind === 'noun'
    ? `${core[0]}${'_'.repeat(Math.max(0, core.length - 1))} (${core.length})`
    : `${core[0]}${core.slice(1).replace(/[^\s]/g, '_')} (${core.length})`;
  const kindLabel = item.kind === 'noun' ? ' · Nomen mit Artikel' : item.kind === 'verb' ? ' · Verb' : '';
  return { type: 'typed', itemId: item.id, prompt: item.meaning + kindLabel, accepted, requireArticle: item.kind === 'noun', hint };
}

export function cloze(item: Item): Exercise | null {
  const parts = splitBold(item.sentenceHtml);
  if (!parts || !parts.bold) return null;
  return {
    type: 'cloze',
    itemId: item.id,
    before: parts.before,
    after: parts.after,
    accepted: [parts.bold],
    translation: item.sentenceMeaning,
    hint: item.kind === 'grammar' ? item.target.replace(/\s*\(\d+\)\s*$/, '') : `${item.target} · ${item.meaning}`,
  };
}

export function unscramble(item: Item): Exercise | null {
  const answer = tokenize(item.sentenceHtml);
  if (answer.length < 3 || answer.length > 9) return null;
  let tiles = shuffle(answer);
  for (let i = 0; i < 5 && tiles.join(' ') === answer.join(' '); i++) tiles = shuffle(answer);
  return { type: 'unscramble', itemId: item.id, tiles, answer, translation: item.sentenceMeaning };
}

export function listen(item: Item, pool: Item[]): Exercise | null {
  if (!item.audio || !item.sentenceMeaning) return null;
  const ds = pickDistractors(item, pool, 3, (i) => i.sentenceMeaning);
  const options = shuffle([item.sentenceMeaning, ...ds.map((d) => d.sentenceMeaning)]);
  return { type: 'listen', itemId: item.id, options, answerIndex: options.indexOf(item.sentenceMeaning) };
}

export function dictation(item: Item): Exercise | null {
  if (!item.audio || !item.sentence) return null;
  if (tokenize(item.sentence).length > 8) return null;
  return { type: 'dictation', itemId: item.id, sentence: item.sentence, translation: item.sentenceMeaning };
}

export function speak(item: Item): Exercise {
  const words = tokenize(item.sentence).length;
  if (item.sentence && item.sentenceMeaning && words <= 7) {
    return { type: 'speak', itemId: item.id, prompt: item.sentenceMeaning, expected: item.sentence };
  }
  return { type: 'speak', itemId: item.id, prompt: item.meaning, expected: acceptedAnswers(item.target)[0] };
}

export function lesson(group: string, items: Item[]): Exercise {
  const first = items[0];
  return {
    type: 'lesson',
    group,
    title: first.target.replace(/\s*\(\d+\)\s*$/, ''),
    text: first.grammar,
    examples: items.slice(0, 3).map((i) => ({ de: i.sentence, en: i.sentenceMeaning })),
  };
}
