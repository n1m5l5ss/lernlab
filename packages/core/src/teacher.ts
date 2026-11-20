// The teacher's voice: short lines that rotate so they stay fresh.
// Core never returns interface text. A line is a key into locales/<code>.json ("teacher.<slot>.<n>"),
// which the UI shows in the interface language. For language decks with lines in the deck's own
// language (German so far), `target` carries that line; the UI shows it with the translation below.

export type Line = {
  /** Key into the locale files, e.g. "teacher.right.2" or "teacher.block.review". */
  key: string;
  /** Values for {{placeholders}} in the translation (e.g. { count: 3 }). */
  params?: Record<string, string | number>;
  /** The same line in the deck's language, when there is one. Learning content, not interface text. */
  target?: string;
};

type Slot =
  | 'start'
  | 'right'
  | 'rightStreak'
  | 'rightHot'
  | 'rightArticle'
  | 'near'
  | 'retry'
  | 'reveal'
  | 'kick'
  | 'idle'
  | 'bossWin'
  | 'bossLose'
  | 'done'
  | 'missedDay'
  | 'timeUp'
  | 'goalMet'
  | 'homework'
  | 'homeworkLanguage';

/** How many variants each slot has in locales/en.json (teacher.<slot>.0 … n-1). */
export const SLOT_VARIANTS: Record<Slot, number> = {
  start: 3,
  right: 5,
  rightStreak: 3,
  rightHot: 3,
  rightArticle: 2,
  near: 3,
  retry: 3,
  reveal: 3,
  kick: 3,
  idle: 2,
  bossWin: 2,
  bossLose: 2,
  done: 2,
  missedDay: 1,
  timeUp: 2,
  goalMet: 1,
  homework: 3,
  homeworkLanguage: 4,
};

/** German lines, index for index with the English variants in locales/en.json. */
const DE: Partial<Record<Slot, string[]>> = {
  start: ["Los geht's!", "Auf geht's – drei schnelle Fragen.", 'Hallo! Kurz aufwärmen.'],
  right: ['Richtig!', 'Genau!', 'Ja!', 'Sehr gut!', 'Perfekt!'],
  rightStreak: ['Super Serie!', 'Weiter so!', 'Stark!'],
  rightHot: ['Unaufhaltsam!', 'Wahnsinn!', 'Was für ein Lauf!'],
  rightArticle: ['Richtig – Artikel stimmt!', 'Genau, mit Artikel. Perfekt!'],
  near: ['Fast perfekt!', 'Gut – kleine Korrektur:', 'Okay, aber genau so:'],
  retry: ['Fast! Noch einmal.', 'Nicht ganz – noch ein Versuch.', 'Hmm. Probier nochmal.'],
  reveal: ['Schau genau hin – und schreib es ab.', 'So heißt es. Jetzt du:', 'Merk dir das – tipp es nochmal.'],
  kick: ['Kurze Action-Runde!', 'Tempo! Schnell, schnell!', 'Wach bleiben – Sprint!'],
  idle: ["Bist du noch da? Weiter geht's!", 'Hallo? Nur noch ein paar!'],
  bossWin: ['Endgegner besiegt!', 'Boss geschafft – stark!'],
  bossLose: ['Der Boss war stärker – morgen wieder!', 'Knapp! Nächstes Mal schaffst du ihn.'],
  done: ['Fertig für heute. Gut gemacht!', 'Session geschafft!'],
  missedDay: ["Gestern Pause. Kein Problem – heute geht's weiter."],
  timeUp: ['Zeit um!', 'Zu langsam – weiter!'],
  goalMet: ['Tagesziel geschafft! Noch eine Runde?'],
  homeworkLanguage: [
    'Schau eine Folge „Nicos Weg“ (A1).',
    'Schau ein „Easy German“-Video mit Untertiteln.',
    '3 Minuten Shadowing: sprich einen Satz 5× nach.',
    'Sag 5 Sätze über deinen Tag – laut!',
  ],
};

/** Planner lines that open a block: key teacher.block.<name>. German target where there is one. */
const BLOCK_DE: Record<string, string | ((n: number) => string)> = {
  warm: 'Drei schnelle Fragen. Los!',
  newCards: (n) => (n === 1 ? '1 neues Wort. Hör genau hin.' : `${n} neue Wörter. Hör genau hin.`),
  review: 'Schreib die Antwort.',
  recall: 'Jetzt ohne Hilfe!',
  boss: 'Deine schwierigsten Karten. Drei Leben. Kämpf!',
  sortGender: 'Der, die oder das? So schnell du kannst!',
  match: 'Finde die Paare – auf Zeit!',
  lesson: 'Eine Regel, dann sofort üben.',
  blitz: 'Blitzrunde: schnell antworten!',
  listen: 'Hör zu. Was bedeutet das?',
  cloze: 'Welches Wort fehlt?',
  speak: 'Sag es laut auf Deutsch!',
  rain: 'Tippe die Wörter, bevor sie landen!',
  rescue: 'Kurz zurück zu den schweren Wörtern.',
};

const rand = (n: number) => Math.floor(Math.random() * n);

/** The teacher for a deck language. Each method returns a Line for the UI to translate. */
export function teacherFor(lang: string | null | undefined, random: (n: number) => number = rand) {
  const de = lang === 'de';
  const line = (slot: Slot, i: number): Line => {
    const target = de ? DE[slot]?.[i] : undefined;
    return target ? { key: `teacher.${slot}.${i}`, target } : { key: `teacher.${slot}.${i}` };
  };
  const pick = (slot: Slot) => line(slot, random(SLOT_VARIANTS[slot]));
  return {
    start: () => pick('start'),
    right: (combo: number) => pick(combo >= 8 ? 'rightHot' : combo >= 4 ? 'rightStreak' : 'right'),
    rightArticle: () => pick('rightArticle'),
    near: () => pick('near'),
    retry: () => pick('retry'),
    reveal: () => pick('reveal'),
    kick: () => pick('kick'),
    idle: () => pick('idle'),
    bossWin: () => pick('bossWin'),
    bossLose: () => pick('bossLose'),
    done: () => pick('done'),
    missedDay: () => pick('missedDay'),
    timeUp: () => pick('timeUp'),
    goalMet: () => pick('goalMet'),
    /** A small task for after the session, rotating by day of the month. */
    homework: (day: number) =>
      de
        ? line('homeworkLanguage', day % SLOT_VARIANTS.homeworkLanguage)
        : line('homework', day % SLOT_VARIANTS.homework),
    /** The line that opens a planner block. */
    block: (name: string, count?: number): Line => {
      const params = count === undefined ? undefined : { count };
      const t = de ? BLOCK_DE[name] : undefined;
      const target = typeof t === 'function' ? t(count ?? 0) : t;
      return { key: `teacher.block.${name}`, ...(params && { params }), ...(target && { target }) };
    },
  };
}

export type Teacher = ReturnType<typeof teacherFor>;
