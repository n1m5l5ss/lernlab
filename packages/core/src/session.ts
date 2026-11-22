// Session planner: builds a varied, never-monotonous session out of short blocks (about 60–90 s each)
// for ANY deck. Rules: formats rotate (never the same twice in a row); easy win first; new cards are
// met, recognised, then recalled in the same session; a boss fight at the end recycles today's mistakes.
import { teacherFor } from './teacher';
import { getDb, type DB } from './db';
import { host } from './host';
import {
  allItems,
  currentSource,
  freshPerDeck,
  scopeFor,
  type StudySource,
  dueItemIds,
  getSettings,
  grammarItemIds,
  itemsByIds,
  learnedIds,
  learningTodayIds,
  leechIds,
  newItemIds,
  nextGrammarGroup,
  srsInfo,
  withRungs,
} from './learn';
import { getDeck } from './library';
import * as gen from './exercises';
import { qa } from './cards';
import { GUESS_MAX, pickGuessRound, topicIsNew, topicName } from './guess';
import { variantIndex, variantsOf } from './variants';
import { askedOwnWay } from './explain';
import { isWorked } from './worked';
import { arcadeSeconds, dayKey } from './game';
import { shuffle, stripHtml } from './text';
import { tomorrowUnsure } from './tomorrow';
import { confusionMap, keepClose } from './confusions';
import { recentlyAnswered, RELATED_MAX, restOfFamilies } from './family';
import { categoryLabels, confusableLabels, labelMisses, ROUND_MAX, themedFirst } from './discriminate';
import type { Block, Exercise, Item, SessionLength, SessionPlan } from './types';

const SIZES: Record<
  SessionLength,
  { due: number; fresh: number; sprint: number; extras: boolean; speak: number; listen: number; blitz: number }
> = {
  mini: { due: 6, fresh: 3, sprint: 0, extras: false, speak: 2, listen: 0, blitz: 0 },
  standard: { due: 14, fresh: 5, sprint: 40, extras: true, speak: 3, listen: 3, blitz: 8 },
  long: { due: 30, fresh: 8, sprint: 45, extras: true, speak: 5, listen: 4, blitz: 12 },
};

let blockN = 0;
const bid = () => `b${++blockN}`;
const blockKey = (b: Block) => (b.kind === 'drill' ? b.format : b.kind);

/** Never the same format twice in a row: merge neighbouring drills of one format, otherwise swap. */
function rotate(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const last = out[out.length - 1];
    if (last && blockKey(last) === blockKey(b) && 'exercises' in last && 'exercises' in b && last.kind === b.kind) {
      (last as { exercises: Exercise[] }).exercises = [...last.exercises, ...b.exercises];
    } else out.push(b);
  }
  for (let i = 1; i < out.length - 1; i++) {
    if (blockKey(out[i]) === blockKey(out[i - 1])) [out[i], out[i + 1]] = [out[i + 1], out[i]];
  }
  return out;
}

export function planSession(
  length: SessionLength,
  d: DB = getDb(),
  now = new Date(),
  sourceArg?: number | null | StudySource,
  { practice = false }: { practice?: boolean } = {},
): SessionPlan {
  const source: StudySource =
    sourceArg === undefined
      ? currentSource(d)
      : sourceArg === null
        ? { kind: 'all' }
        : typeof sourceArg === 'number'
          ? { kind: 'deck', deckId: sourceArg }
          : sourceArg;
  const scope = scopeFor(source, d);
  const deckId = source.kind === 'deck' ? source.deckId : null;
  const deck = deckId ? getDeck(deckId, d) : null;
  const settings = getSettings(d);
  const size = SIZES[length];
  const pool = withRungs(allItems(d, scope), d); // worked examples are asked on their rung of the ladder
  const deckIds = [...new Set(pool.map((i) => i.deckId))];
  // Several decks in one language still get that language's voice and teacher; mixed languages get neither.
  const poolDecks = deckIds.map((id) => getDeck(id, d));
  const langs = new Set(poolDecks.map((x) => x?.language ?? null));
  const lang = deck ? (deck.language ?? null) : langs.size === 1 ? [...langs][0] : null;
  const byId = new Map(pool.map((i) => [i.id, i]));
  const get = (id: number) => byId.get(id)!;
  const has = (id: number) => byId.has(id);
  const notGrammar = (id: number) => get(id).kind !== 'grammar';
  /** Plain front/back cards (question cards with their own format, myth and explain cards are excluded from pair games). */
  const plain = (id: number) =>
    !['grammar', 'mcq', 'order', 'code', 'occlusion'].includes(get(id).kind) && !askedOwnWay(get(id));
  /** Myth and explain cards are only asked in their own way (explain.ts): no sprints, listening, pictures or speaking. */
  const notOwnWay = (id: number) => !askedOwnWay(get(id));

  // Practice (cramming) draws on every card in the source, due or not, and teaches nothing new.
  // Cards the learner mixed up (#200) are each other's wrong choice and are asked next to each other.
  const mixups = confusionMap(d);
  const mc = (id: number, direction: 'de2en' | 'en2de') => gen.mc(get(id), pool, direction, mixups.get(id));
  const truefalse = (id: number) => gen.truefalse(get(id), pool, mixups.get(id));
  const due = keepClose(
    practice
      ? shuffle(pool.filter((i) => i.kind !== 'grammar').map((i) => i.id)).slice(0, size.due + size.fresh)
      : dueItemIds(d, now, size.due, scope).filter(has),
    mixups,
  );
  const leftovers = practice ? [] : learningTodayIds(d, now, scope).filter((id) => has(id) && notGrammar(id));
  // New vocabulary is met in themed groups (#211): the next new word's theme first, then the deck's order.
  const fresh = practice
    ? []
    : freshPerDeck(
        d,
        now,
        scope,
        size.fresh,
        (id) => get(id).deckId,
        (ids) => themedFirst(ids.filter(has).map(get)),
      );
  const learned = learnedIds(d, 300, scope).filter((id) => has(id) && notGrammar(id));
  const upcoming = newItemIds(d, 40, undefined, scope).filter(has);
  const group = length === 'mini' || practice ? null : nextGrammarGroup(d, now, scope);
  const grammar = group ? grammarItemIds(group, d, scope).slice(0, 4).filter(has) : [];
  const info = srsInfo([...due, ...learned], d);
  const known = [...new Set([...learned, ...leftovers])];
  /** A review asks the card's next wording (its own question, or one of its variants), in turn per review. */
  const review = (id: number) => gen.recall(get(id), variantIndex(id, info[id]?.reps ?? 0, variantsOf(get(id)).length));

  const blocks: Block[] = [];
  const say = teacherFor(lang).block;

  // 1. Ignition: three near-certain wins (easiest known cards; on day one, guess common ones).
  const easy = [...learned].sort((a, b) => (info[b]?.mastery ?? 0) - (info[a]?.mastery ?? 0)).slice(0, 12);
  // Cards you were unsure you would know today (the tomorrow check, #205) come first. Recognition only: the warm-up
  // never grades a card, so their first real recall later in the session still counts.
  const unsure = practice ? [] : tomorrowUnsure(d, now).filter((id) => has(id) && plain(id));
  const ignitionIds = [
    ...unsure,
    ...shuffle(easy.length >= 3 ? easy : [...easy, ...upcoming.slice(0, 6)]).filter(
      (id) => plain(id) && !unsure.includes(id),
    ),
  ].slice(0, 3);
  if (ignitionIds.length && pool.length >= 4) {
    blocks.push({
      id: bid(),
      kind: 'ignition',
      title: 'Warm-up',
      teacher: say('warm'),
      exercises: ignitionIds.map((id) => mc(id, 'de2en')),
    });
  }

  // 2. Category sprint: sort cards into their category (der/die/das, IaaS/PaaS/SaaS…) on the clock.
  //    It takes the categories (or category-like tags) the learner mixes up most (#211). Tags: no clock.
  if (size.sprint) {
    const labels = categoryLabels([...new Set([...known, ...fresh, ...upcoming])].map(get));
    const cats = confusableLabels(labels, mixups, labels.size ? labelMisses(d, now) : []);
    const byTag = [...labels].some(([id, l]) => cats.includes(l) && get(id).category !== l);
    const sprintIds = shuffle([...labels.keys()].filter((id) => cats.includes(labels.get(id)!))).slice(
      0,
      byTag ? ROUND_MAX : 30,
    );
    if (cats.length >= 2 && sprintIds.length >= 4) {
      const label =
        lang === 'de' && cats.every((c) => ['der', 'die', 'das'].includes(c)) ? say('sortGender') : say('sort');
      blocks.push({
        id: bid(),
        kind: 'gender',
        title: 'Category sprint',
        teacher: byTag ? { key: 'teacher.block.tellApart' } : label,
        itemIds: sprintIds,
        seconds: byTag ? 0 : arcadeSeconds(size.sprint, settings), // 0: timers off, one untimed pass
        choices: cats,
        labels: Object.fromEntries(sprintIds.map((id) => [id, labels.get(id)!])),
      });
    }
  }

  // 3. Due reviews, first half: recall (typed, or flip and self-grade for long answers).
  let half = Math.ceil(due.length / 2);
  if (mixups.get(due[half - 1])?.includes(due[half])) half++; // a mixed-up pair stays in one block
  const dueA = due.slice(0, half);
  const dueB = due.slice(half);
  if (dueA.length)
    blocks.push({
      id: bid(),
      kind: 'drill',
      format: 'typed',
      title: 'Review',
      teacher: say('review'),
      exercises: dueA.map(review),
    });

  // 3a. The rest of a closely related group (#223): when some cards of a family ("Capital of …" with one tag)
  //     are reviewed now or were in the last day or two, its other learned cards get one recognition question.
  //     Recognition never grades: their real reviews stay on their own days.
  if (!practice && learned.length && pool.filter((p) => plain(p.id)).length >= 4) {
    const answered = recentlyAnswered(d, now);
    const practised = [
      ...new Set([...due, ...[...answered].filter(([id, a]) => a.graded && has(id)).map(([id]) => id)]),
    ];
    const taken = new Set([...due, ...leftovers, ...fresh]);
    const eligible = new Set(learned.filter((id) => plain(id) && !taken.has(id) && !answered.has(id)));
    const related = shuffle(restOfFamilies(practised.map(get), pool).filter((id) => eligible.has(id))).slice(
      0,
      RELATED_MAX[length],
    );
    if (related.length)
      blocks.push({
        id: bid(),
        kind: 'drill',
        format: 'mc',
        title: 'Related cards',
        teacher: { key: 'teacher.block.related' },
        exercises: related.map((id) => mc(id, 'de2en')),
      });
  }

  // 4a. Guess first: the first new cards of a new topic (concepts, facts, maths) are asked before they are met.
  const guess = fresh.length ? pickGuessRound(fresh.map(get), pool, (t) => topicIsNew(t, d), GUESS_MAX[length]) : null;
  if (guess) {
    const topic = topicName(guess.topic, getDeck(guess.topic.deckId, d)?.name ?? '');
    blocks.push({
      id: bid(),
      kind: 'guess',
      title: 'Guess first',
      teacher: { key: 'teacher.block.guess', params: { topic } },
      topic,
      itemIds: guess.ids,
    });
  }

  // 4. New cards: meet each one, then recognise it right away.
  if (fresh.length) {
    const ex: Exercise[] = [];
    for (const id of fresh) {
      if (!plain(id)) {
        ex.push(gen.recall(get(id)));
        continue;
      } // question cards: answer first, learn from the explanation
      ex.push({ type: 'intro', itemId: id });
      if (pool.filter((p) => plain(p.id)).length >= 4) ex.push(mc(id, Math.random() < 0.5 ? 'de2en' : 'en2de'));
    }
    blocks.push({
      id: bid(),
      kind: 'learn',
      title: 'New cards',
      teacher: say('newCards', fresh.length),
      exercises: ex,
    });
  }

  // 5. Match pairs (short cards) — or true/false for long ones.
  const shortPair = (id: number) =>
    plain(id) && gen.frontText(get(id)).length <= 40 && gen.backText(get(id)).length <= 50;
  const matchIds = shuffle([...new Set([...fresh, ...leftovers, ...learned.slice(0, 20)])].filter(shortPair)).slice(
    0,
    5,
  );
  if (matchIds.length >= 4) {
    blocks.push({
      id: bid(),
      kind: 'match',
      title: 'Match pairs',
      teacher: say('match'),
      itemIds: matchIds,
    });
  } else if (pool.filter((p) => plain(p.id)).length >= 4 && [...fresh, ...known].filter(plain).length >= 3) {
    const ids = shuffle([...fresh, ...known].filter(plain)).slice(0, 6);
    blocks.push({
      id: bid(),
      kind: 'drill',
      format: 'truefalse',
      title: 'True or false',
      teacher: say('trueFalse'),
      exercises: ids.map(truefalse),
    });
  }

  // 6. Mini-lesson for a group of cards (grammar rule, concept), then drill it immediately.
  if (group && grammar.length) {
    const gi = grammar.map(get);
    const ex: Exercise[] = [gen.lesson(group, gi)];
    gi.forEach((it, i) => {
      const e = i % 2 === 0 ? (gen.cloze(it) ?? gen.unscramble(it)) : (gen.unscramble(it) ?? gen.cloze(it));
      if (e) ex.push(e);
    });
    blocks.push({
      id: bid(),
      kind: 'learn',
      title: 'Lesson',
      teacher: say('lesson'),
      exercises: ex,
    });
  }

  // 7. Blitz: rapid-fire true/false and multiple choice with a per-question timer — only on cards you already
  //    know (time pressure on new material hurts encoding), and never when timers are switched off.
  const blitzPool = shuffle(known.filter(plain));
  const blitzOn = (settings.blitzSeconds ?? 8) > 0;
  if (size.blitz && blitzOn && blitzPool.length >= 4 && pool.filter((p) => plain(p.id)).length >= 4) {
    const ex = blitzPool.slice(0, size.blitz).map((id, i) => (i % 2 ? truefalse(id) : mc(id, 'de2en')));
    blocks.push({
      id: bid(),
      kind: 'blitz',
      title: 'Blitz',
      teacher: say('blitz'),
      exercises: ex,
      secondsPerQuestion: settings.blitzSeconds ?? 8,
    });
  }

  // 8. Listening: the card's recording, or the system voice on a language deck. Known cards with a short
  //    sentence also get dictation (recall). The window skips any it can't play (no voice installed).
  const listenEx = shuffle([...fresh, ...learned.slice(0, 40)].filter((id) => notOwnWay(id) && gen.hearable(get(id))))
    .map((id) => gen.listen(get(id), pool))
    .filter(Boolean)
    .slice(0, size.listen) as Exercise[];
  const dictationEx = shuffle(known.filter(notOwnWay))
    .map((id) => gen.dictation(get(id)))
    .filter(Boolean)
    .slice(0, size.listen ? 2 : 0) as Exercise[];
  listenEx.push(...dictationEx);
  if (listenEx.length >= 2)
    blocks.push({
      id: bid(),
      kind: 'drill',
      format: 'listen',
      title: 'Listen',
      teacher: say('listen'),
      exercises: listenEx,
    });

  // 9. Picture quiz (cards with images).
  const picEx = shuffle([...fresh, ...known].filter((id) => get(id).image && notOwnWay(id)))
    .map((id) => gen.imagemc(get(id), pool))
    .filter(Boolean)
    .slice(0, 5) as Exercise[];
  if (picEx.length >= 2)
    blocks.push({
      id: bid(),
      kind: 'drill',
      format: 'mc',
      title: 'Picture quiz',
      teacher: say('picture'),
      exercises: picEx,
    });

  // 10. Due reviews, second half: fill the gap where possible.
  if (dueB.length)
    blocks.push({
      id: bid(),
      kind: 'drill',
      format: 'cloze',
      title: 'Fill the gap',
      teacher: say('cloze'),
      exercises: dueB.map((id) => (notOwnWay(id) && gen.cloze(get(id))) || review(id)),
    });

  // 11. Speak aloud (language decks): production effect on a subset.
  if (lang) {
    const speakIds = shuffle(
      [...fresh, ...due, ...leftovers].filter((id) => notGrammar(id) && notOwnWay(id) && get(id).kind !== 'occlusion'),
    ).slice(0, size.speak);
    if (speakIds.length)
      blocks.push({
        id: bid(),
        kind: 'drill',
        format: 'speak',
        title: 'Speak',
        teacher: say('speak'),
        exercises: speakIds.map((id) => gen.speak(get(id))),
      });
  }

  // 12. Recall today's new cards: first real test, writes their first grade.
  // A worked example is asked once a session (above), except right after it was studied: then its last step.
  const nextRung = (id: number) => (get(id).rung === 0 ? gen.worked({ ...get(id), rung: 1 }) : null);
  const recallIds = [...new Set([...fresh, ...leftovers])].filter((id) => !isWorked(get(id)) || get(id).rung === 0);
  if (recallIds.length) {
    blocks.push({
      id: bid(),
      kind: 'drill',
      format: 'typed',
      title: 'Recall',
      teacher: say('recall'),
      exercises: keepClose(shuffle(recallIds), mixups).map(
        (id, i) =>
          nextRung(id) ??
          (i % 3 === 2 && notOwnWay(id) ? (gen.cloze(get(id)) ?? gen.recall(get(id))) : gen.recall(get(id))),
      ),
    });
  }

  // 13. Word rain arcade (short prompts and typeable answers). Every other day, always in long sessions.
  const rainIds = shuffle(
    [...new Set([...learned, ...fresh])].filter(
      (id) => plain(id) && qa(get(id)).typeable && stripHtml(qa(get(id)).prompt).length <= 32,
    ),
  ).slice(0, 24);
  const rainDay = Number(dayKey(now).slice(-2)) % 2 === 0;
  const rainSeconds = arcadeSeconds(60, settings); // rain is a race against the clock: none when timers are off
  if (size.extras && rainSeconds && rainIds.length >= 6 && (length === 'long' || rainDay)) {
    blocks.splice(Math.max(2, blocks.length - 1), 0, {
      id: bid(),
      kind: 'rain',
      title: 'Word rain',
      teacher: say('rain'),
      itemIds: rainIds,
      seconds: rainSeconds,
    });
  }

  // 14. Boss battle: today's mistakes + leeches (the client adds every card missed this session).
  const leeches = leechIds(d, 6, scope).filter((id) => has(id) && notGrammar(id));
  blocks.push({ id: bid(), kind: 'boss', title: 'Boss', teacher: say('boss'), itemIds: leeches, lives: 3 });

  const finalBlocks = rotate(blocks);
  const ids = new Set<number>([
    ...ignitionIds,
    ...due,
    ...fresh,
    ...leftovers,
    ...matchIds,
    ...grammar,
    ...leeches,
    ...rainIds,
    ...blitzPool.slice(0, 12),
  ]);
  for (const b of finalBlocks) {
    if ('itemIds' in b) b.itemIds.forEach((i) => ids.add(i));
    if ('exercises' in b) b.exercises.forEach((e) => 'itemId' in e && ids.add(e.itemId));
  }
  const items = itemsByIds([...ids], d);
  for (const it of Object.values(items)) if (byId.has(it.id)) it.rung = byId.get(it.id)!.rung;
  const extras: Record<number, Item> = {};
  for (const it of shuffle(pool.filter((p) => p.kind !== 'grammar')).slice(0, 60))
    if (!items[it.id]) extras[it.id] = it;

  // German decks get the agenda in German too; the UI builds the translated agenda from `counts`.
  const parts: string[] = [];
  if (due.length) parts.push(`${due.length} Wiederholungen`);
  if (fresh.length) parts.push(fresh.length === 1 ? '1 neues Wort' : `${fresh.length} neue Wörter`);
  if (group)
    parts.push(
      `Lektion: ${
        get(grammar[0])
          .target.replace(/\s*\(\d+\)$/, '')
          .split(':')[0]
      }`,
    );
  if (!parts.length) parts.push('Wiederholung und Spiele');

  return {
    id: host().randomId(),
    deckId: deckId ?? null,
    practice,
    lang,
    length,
    agendaTarget: lang === 'de' ? `Heute: ${parts.join(', ')}.` : null,
    deckName: deck?.name ?? null,
    blocks: finalBlocks,
    items,
    extras,
    counts: { due: due.length, fresh: fresh.length, grammar: group },
    speech: Object.fromEntries(
      poolDecks.flatMap((x) => {
        if (!x) return [];
        const { voice, rate } = x.settings;
        return [[x.id, { ...(voice ? { voice } : {}), ...(rate ? { rate } : {}) }]];
      }),
    ),
  };
}
