// Exercise generators: turn one card into many kinds of exercises (works for any subject).
import { acceptedAnswers, shuffle, splitBold, stripHtml, tokenize } from './text';
import { clozeText, mcqOf, parseCloze, qa, stepsOf } from './cards';
import { hasMath, splitMath } from './math';
import type { Exercise, Item } from './types';

const ARTS = ['der', 'die', 'das'] as const;
export const frontText = (i: Item) => (i.kind === 'cloze' ? clozeText(stripHtml(i.target)) : stripHtml(i.target));
export const backText = (i: Item) => stripHtml(i.meaning);

function pickDistractors(item: Item, pool: Item[], n: number, key: (i: Item) => string): Item[] {
  const own = key(item).toLowerCase();
  const seen = new Set([own]);
  const len = own.length;
  const score = (p: Item) => {
    let s = 0;
    if (p.kind === item.kind) s += 3;
    if (item.category && p.category === item.category) s += 2;
    if (item.rank && p.rank && Math.abs(p.rank - item.rank) < 150) s += 2;
    if (p.tags.some((t) => item.tags.includes(t))) s += 1;
    s -= Math.abs(key(p).length - len) / 40; // similar length looks more plausible
    return s + Math.random() * 1.5;
  };
  const candidates = pool
    .filter(
      (p) =>
        p.id !== item.id && !['grammar', 'mcq', 'order'].includes(p.kind) && key(p) && !seen.has(key(p).toLowerCase()),
    )
    .map((p) => ({ p, s: score(p) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.p);
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

/** de2en = front → choose back; en2de = back → choose front (with a gender trap for German nouns). */
export function mc(item: Item, pool: Item[], direction: 'de2en' | 'en2de'): Exercise {
  if (direction === 'de2en') {
    const ds = pickDistractors(item, pool, 3, backText);
    const options = shuffle([backText(item), ...ds.map(backText)]);
    return {
      type: 'mc',
      itemId: item.id,
      direction,
      prompt: frontText(item),
      options,
      answerIndex: options.indexOf(backText(item)),
    };
  }
  const opts: string[] = [frontText(item)];
  if (item.kind === 'noun' && item.article) {
    const wrong = ARTS.filter((a) => a !== item.article);
    opts.push(`${wrong[Math.floor(Math.random() * 2)]} ${item.word}`);
  }
  opts.push(...pickDistractors(item, pool, 4 - opts.length, frontText).map(frontText));
  const options = shuffle(opts);
  return {
    type: 'mc',
    itemId: item.id,
    direction,
    prompt: backText(item),
    options,
    answerIndex: options.indexOf(frontText(item)),
  };
}

/** What a typed hint is built from: a formula without its \( \) delimiters. */
export const hintSource = (answer: string) =>
  hasMath(answer)
    ? splitMath(answer)
        .map((p) => ('tex' in p ? p.tex : p.text))
        .join('')
        .trim()
    : answer;

export function typed(item: Item): Exercise {
  const q = qa(item);
  const core = hintSource(q.requireArticle ? item.word : q.accepted[0]);
  const hint = `${core[0]}${core.slice(1).replace(/[^\s]/g, '_')} (${core.length})`;
  const kindLabel = item.lang
    ? item.kind === 'noun'
      ? ' · noun + article'
      : item.kind === 'verb'
        ? ' · verb'
        : ''
    : '';
  return {
    type: 'typed',
    itemId: item.id,
    prompt: stripHtml(q.prompt) + kindLabel,
    accepted: q.accepted,
    requireArticle: q.requireArticle,
    hint,
  };
}

export function flip(item: Item): Exercise {
  const q = qa(item);
  return { type: 'flip', itemId: item.id, prompt: q.prompt, answer: q.answer, reverse: q.prompt === item.meaning };
}

export function mcq(item: Item): Exercise | null {
  const m = mcqOf(item);
  if (!m) return null;
  const order = shuffle(m.choices.map((_, i) => i));
  return {
    type: 'mcq',
    itemId: item.id,
    stem: item.target,
    choices: order.map((i) => m.choices[i]),
    correct: m.correct.map((c) => order.indexOf(c)),
    explanation: item.grammar || item.notes,
  };
}

export function order(item: Item): Exercise | null {
  const steps = stepsOf(item);
  if (steps.length < 2) return null;
  let shuffled = shuffle(steps.map((_, i) => i));
  for (let k = 0; k < 5 && shuffled.every((v, i) => v === i); k++) shuffled = shuffle(shuffled);
  return { type: 'order', itemId: item.id, prompt: item.target, steps, shuffled };
}

/** Recall exercise for any card: question cards ask their question; short answers are typed; long ones flip. */
export const recall = (item: Item): Exercise =>
  (item.kind === 'mcq' ? mcq(item) : item.kind === 'order' ? order(item) : null) ??
  (qa(item).typeable ? typed(item) : flip(item));

export function cloze(item: Item): Exercise | null {
  if (item.kind === 'cloze') {
    const c = parseCloze(item.target);
    if (!c) return null;
    return {
      type: 'cloze',
      itemId: item.id,
      before: c.before,
      after: c.after,
      accepted: acceptedAnswers(c.answer),
      translation: backText(item),
      hint: c.hint || `${c.answer[0]}…`,
    };
  }
  const parts = splitBold(item.sentenceHtml);
  if (!parts || !parts.bold) return null;
  return {
    type: 'cloze',
    itemId: item.id,
    before: parts.before,
    after: parts.after,
    accepted: [parts.bold],
    translation: item.sentenceMeaning,
    hint:
      item.kind === 'grammar' ? item.target.replace(/\s*\(\d+\)\s*$/, '') : `${frontText(item)} · ${backText(item)}`,
  };
}

export function truefalse(item: Item, pool: Item[]): Exercise {
  const isTrue = Math.random() < 0.5;
  const other = isTrue ? null : pickDistractors(item, pool, 1, backText)[0];
  return {
    type: 'truefalse',
    itemId: item.id,
    front: frontText(item),
    shown: other ? backText(other) : backText(item),
    isTrue: !other,
  };
}

export function imagemc(item: Item, pool: Item[]): Exercise | null {
  if (!item.image) return null;
  const ds = pickDistractors(item, pool, 3, frontText);
  if (ds.length < 2) return null;
  const options = shuffle([frontText(item), ...ds.map(frontText)]);
  return { type: 'imagemc', itemId: item.id, options, answerIndex: options.indexOf(frontText(item)) };
}

export function unscramble(item: Item): Exercise | null {
  const answer = tokenize(item.sentenceHtml);
  if (answer.length < 3 || answer.length > 9) return null;
  let tiles = shuffle(answer);
  for (let i = 0; i < 5 && tiles.join(' ') === answer.join(' '); i++) tiles = shuffle(answer);
  return { type: 'unscramble', itemId: item.id, tiles, answer, translation: item.sentenceMeaning };
}

/** Can the app play this card aloud: its own recording, or the system voice for a language deck. */
export const hearable = (item: Item) => !!item.audio || !!item.lang;

export function listen(item: Item, pool: Item[]): Exercise | null {
  if (!hearable(item)) return null;
  const key = item.sentenceMeaning ? (i: Item) => i.sentenceMeaning : backText;
  const ds = pickDistractors(item, pool, 3, key);
  if (ds.length < 2) return null;
  const options = shuffle([key(item), ...ds.map(key)]);
  return { type: 'listen', itemId: item.id, options, answerIndex: options.indexOf(key(item)) };
}

export function dictation(item: Item): Exercise | null {
  if (!hearable(item) || !item.sentence || tokenize(item.sentence).length > 8) return null;
  return { type: 'dictation', itemId: item.id, sentence: item.sentence, translation: item.sentenceMeaning };
}

export function speak(item: Item): Exercise {
  if (item.sentence && item.sentenceMeaning && tokenize(item.sentence).length <= 7) {
    return { type: 'speak', itemId: item.id, prompt: item.sentenceMeaning, expected: item.sentence };
  }
  return { type: 'speak', itemId: item.id, prompt: backText(item), expected: acceptedAnswers(item.target)[0] };
}

export function lesson(group: string, items: Item[]): Exercise {
  const first = items[0];
  return {
    type: 'lesson',
    group,
    title: first.target.replace(/\s*\(\d+\)\s*$/, ''),
    text: stripHtml(first.grammar),
    examples: items.slice(0, 3).map((i) => ({ de: i.sentence || frontText(i), en: i.sentenceMeaning || backText(i) })),
  };
}
