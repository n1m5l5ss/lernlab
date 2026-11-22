// Exercise generators: turn one card into many kinds of exercises (works for any subject).
import { acceptedAnswers, shuffle, splitBold, stripHtml, tokenize } from './text';
import { clozeText, mcqOf, parseCloze, qa, stepsOf } from './cards';
import { hasMath, splitMath } from './math';
import { codeTask, GAP } from './code';
import { variantsOf } from './variants';
import { correctionHtml, correctionsOf, isMyth } from './misconceptions';
import { ownExercise, asksWhy, isExplain, keyPointHtml, keyPointsOf } from './explain';
import { isTwin } from './twin';
import { isWorked, stepHtml, workedStepsOf } from './worked';
import type { Exercise, Item } from './types';

const ARTS = ['der', 'die', 'das'] as const;
export const frontText = (i: Item) => (i.kind === 'cloze' ? clozeText(stripHtml(i.target)) : stripHtml(i.target));
export const backText = (i: Item) => stripHtml(i.meaning);

/** `confused`: cards the learner mixed this one up with (confusions.ts); they come first as wrong choices. */
function pickDistractors(
  item: Item,
  pool: Item[],
  n: number,
  key: (i: Item) => string,
  confused: number[] = [],
): Item[] {
  const own = key(item).toLowerCase();
  const seen = new Set([own]);
  const len = own.length;
  const score = (p: Item) => {
    let s = confused.includes(p.id) ? 100 : 0;
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
        p.id !== item.id &&
        !['grammar', 'mcq', 'order', 'code', 'occlusion'].includes(p.kind) &&
        !ownExercise(p) && // a case question's answer can still be a wrong choice
        key(p) &&
        !seen.has(key(p).toLowerCase()),
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
export function mc(item: Item, pool: Item[], direction: 'de2en' | 'en2de', confused?: number[]): Exercise {
  if (direction === 'de2en') {
    const ds = pickDistractors(item, pool, 3, backText, confused);
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
  opts.push(...pickDistractors(item, pool, 4 - opts.length, frontText, confused).map(frontText));
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

/** "S___ (4)": the first character, then a blank for every other one that is not a space. */
const hintOf = (core: string) => `${core[0]}${core.slice(1).replace(/[^\s]/g, '_')} (${core.length})`;

/** Plain text shown where card HTML is expected. */
export const asHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Question variant `k` (1-based) of a card that takes them, or null for the card's own question. */
function variantOf(item: Item, k: number) {
  const v = k > 0 ? variantsOf(item)[k - 1] : undefined;
  return v ? { prompt: asHtml(v.prompt), level: v.level } : null;
}

export function typed(item: Item, k = 0): Exercise {
  const q = qa(item);
  const v = variantOf(item, k);
  const hint = hintOf(hintSource(q.requireArticle ? item.word : q.accepted[0]));
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
    prompt: (v ? v.prompt : stripHtml(q.prompt)) + kindLabel,
    accepted: q.accepted,
    requireArticle: q.requireArticle,
    hint,
    ...(v && { level: v.level }),
  };
}

export function flip(item: Item, k = 0): Exercise {
  const q = qa(item);
  const v = variantOf(item, k);
  const reverse = q.prompt === item.meaning;
  return {
    type: 'flip',
    itemId: item.id,
    prompt: v?.prompt ?? q.prompt,
    answer: q.answer,
    reverse,
    ...(v && { level: v.level }),
  };
}

/**
 * Explain first (explain.ts): an explain card, with its key points to tick, or a basic card tagged why/how
 * (no points: the usual self-grade after the reveal). The model answer is the card's back ('' for none).
 */
export function explain(item: Item, k = 0): Exercise {
  const v = isExplain(item) ? null : variantOf(item, k);
  return {
    type: 'explain',
    itemId: item.id,
    prompt: v?.prompt ?? item.target, // never reversed: the question is the front
    answer: item.meaning,
    points: keyPointsOf(item).map(keyPointHtml),
    ...(v && { level: v.level }),
  };
}

/**
 * A worked example on its rung (worked.ts): the last `rung` steps are blank. Without a rung (the card was not
 * loaded for a session) it is the whole problem.
 */
export function worked(item: Item): Extract<Exercise, { type: 'worked' }> {
  const steps = workedStepsOf(item);
  return {
    type: 'worked',
    itemId: item.id,
    prompt: item.target,
    steps: steps.map((s) => ({ label: stepHtml(s.label), result: s.result, resultHtml: stepHtml(s.result) })),
    blanks: Math.min(steps.length, Math.max(0, item.rung ?? steps.length)),
    answer: item.meaning,
  };
}

/** A myth card's recall: reject the statement, then say why (the card's back). */
export const myth = (item: Item): Exercise => ({
  type: 'myth',
  itemId: item.id,
  statement: item.target,
  why: item.meaning,
});

/** A compare card's recall: both things side by side, then the answer to check against (its back). */
export const twin = (item: Item): Exercise => ({
  type: 'twin',
  itemId: item.id,
  left: asHtml(item.target),
  right: asHtml(item.extra.twin ?? ''),
  answer: item.meaning,
});

export function mcq(item: Item): Exercise | null {
  const m = mcqOf(item);
  if (!m) return null;
  const order = shuffle(m.choices.map((_, i) => i));
  const corrections = correctionsOf(item);
  return {
    type: 'mcq',
    itemId: item.id,
    stem: item.target,
    choices: order.map((i) => m.choices[i]),
    correct: m.correct.map((c) => order.indexOf(c)),
    explanation: item.grammar || item.notes,
    ...(corrections.some(Boolean) && {
      corrections: order.map((i) => corrections[i] && correctionHtml(corrections[i])),
    }),
  };
}

export function order(item: Item, steps = stepsOf(item), codeLang?: string): Exercise | null {
  if (steps.length < 2) return null;
  // Not already in order (compared by text: two lines of code can be the same, like two closing braces).
  const solved = (s: number[]) => s.every((v, i) => steps[v] === steps[i]);
  let shuffled = shuffle(steps.map((_, i) => i));
  for (let k = 0; k < 5 && solved(shuffled); k++) shuffled = shuffle(shuffled);
  return {
    type: 'order',
    itemId: item.id,
    prompt: item.target,
    steps,
    shuffled,
    ...(codeLang !== undefined && { codeLang }),
  };
}

/** A code card's exercise (see codeTask): fill the token, predict the output or order the lines. */
export function codeExercise(item: Item): Exercise | null {
  const task = codeTask(item);
  if (!task) return null;
  const accepted = (answer: string) => [...new Set([answer, ...qa(item).accepted])].filter(Boolean);
  if (task.mode === 'order') return order(item, task.lines, task.lang);
  if (task.mode === 'output') {
    const ex = { prompt: item.target, accepted: accepted(task.answer), requireArticle: false };
    return { type: 'typed', itemId: item.id, ...ex, hint: hintOf(task.answer), code: task.code, codeLang: task.lang };
  }
  const [before, after] = task.code.split(GAP);
  return {
    type: 'cloze',
    itemId: item.id,
    before,
    after,
    accepted: accepted(task.answer),
    translation: item.target,
    hint: task.hint || `${task.answer[0]}…`,
    codeLang: task.lang,
  };
}

/**
 * Recall exercise for any card: question cards ask their question; short answers are typed; long ones flip.
 * `variant` asks one of the card's other wordings instead (variants.ts); 0 is the card's own question.
 */
export const recall = (item: Item, variant = 0): Exercise =>
  (isMyth(item)
    ? myth(item)
    : isExplain(item)
      ? explain(item)
      : isTwin(item)
        ? twin(item)
        : isWorked(item)
          ? worked(item)
          : item.kind === 'mcq'
            ? mcq(item)
            : item.kind === 'order'
              ? order(item)
              : item.kind === 'code'
                ? codeExercise(item)
                : item.kind === 'occlusion'
                  ? typed(item)
                  : null) ?? recallBasic(item, variant);

/** A basic card: typed when the answer is short, explained first when tagged why/how, otherwise flipped. */
function recallBasic(item: Item, variant: number): Exercise {
  const q = qa(item);
  const why = asksWhy(item);
  if (q.typeable && !(why && q.prompt !== item.target)) return typed(item, variant);
  return why ? explain(item, variant) : flip(item, variant);
}

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

export function truefalse(item: Item, pool: Item[], confused?: number[]): Exercise {
  const isTrue = Math.random() < 0.5;
  const other = isTrue ? null : pickDistractors(item, pool, 1, backText, confused)[0];
  return {
    type: 'truefalse',
    itemId: item.id,
    front: frontText(item),
    shown: other ? backText(other) : backText(item),
    isTrue: !other,
  };
}

export function imagemc(item: Item, pool: Item[]): Exercise | null {
  // An occlusion picture is asked box by box (recall), never as a picture quiz.
  if (!item.image || item.kind === 'occlusion') return null;
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
export const hearable = (item: Item) => item.kind !== 'occlusion' && (!!item.audio || !!item.lang);

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
