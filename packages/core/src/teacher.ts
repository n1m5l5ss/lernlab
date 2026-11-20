// The teacher's voice: short lines that rotate so they stay fresh. German for German decks, English otherwise.
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const rotate = <T>(n: number, a: T[]): T => a[n % a.length];

const DE = {
  start: () =>
    pick([
      ["Los geht's!", "Let's go!"],
      ["Auf geht's – drei schnelle Fragen.", 'Here we go – three quick ones.'],
      ['Hallo! Kurz aufwärmen.', 'Hi! Quick warm-up.'],
    ]),
  right: (combo: number) =>
    combo >= 8
      ? pick(['Unaufhaltsam!', 'Wahnsinn!', 'Was für ein Lauf!'])
      : combo >= 4
        ? pick(['Super Serie!', 'Weiter so!', 'Stark!'])
        : pick(['Richtig!', 'Genau!', 'Ja!', 'Sehr gut!', 'Perfekt!']),
  rightArticle: () => pick(['Richtig – Artikel stimmt!', 'Genau, mit Artikel. Perfekt!']),
  near: () => pick(['Fast perfekt!', 'Gut – kleine Korrektur:', 'Okay, aber genau so:']),
  retry: () => pick(['Fast! Noch einmal.', 'Nicht ganz – noch ein Versuch.', 'Hmm. Probier nochmal.']),
  reveal: () =>
    pick(['Schau genau hin – und schreib es ab.', 'So heißt es. Jetzt du:', 'Merk dir das – tipp es nochmal.']),
  kick: () =>
    pick([
      ['Kurze Action-Runde!', 'Quick action round!'],
      ['Tempo! Schnell, schnell!', 'Speed it up!'],
      ['Wach bleiben – Sprint!', 'Stay awake – sprint!'],
    ]),
  idle: () => pick(["Bist du noch da? Weiter geht's!", 'Hallo? Nur noch ein paar!']),
  bossWin: () => pick(['Endgegner besiegt!', 'Boss geschafft – stark!']),
  bossLose: () => pick(['Der Boss war stärker – morgen wieder!', 'Knapp! Nächstes Mal schaffst du ihn.']),
  done: () =>
    pick([
      ['Fertig für heute. Gut gemacht!', 'Done for today. Well done!'],
      ['Session geschafft!', 'Session complete!'],
    ]),
  missedDay: () => [
    "Gestern Pause. Kein Problem – heute geht's weiter.",
    "You took yesterday off. No problem – let's continue today.",
  ],
  timeUp: () => pick(['Zeit um!', 'Zu langsam – weiter!']),
  goalMet: () => ['Tagesziel geschafft! Noch eine Runde?', 'Daily goal done! One more round?'],
  /** A small task for after the session, rotating by day of the month. */
  homework: (day: number) =>
    rotate(day, [
      ['Schau eine Folge „Nicos Weg“ (A1).', 'Watch one episode of Nicos Weg (A1) on DW.'],
      ['Schau ein „Easy German“-Video mit Untertiteln.', 'Watch one Easy German video with subtitles.'],
      ['3 Minuten Shadowing: sprich einen Satz 5× nach.', '3 minutes of shadowing: repeat one sentence 5 times.'],
      ['Sag 5 Sätze über deinen Tag – laut!', 'Say 5 sentences about your day – out loud!'],
    ]),
};

const EN: typeof DE = {
  start: () =>
    pick([
      ["Let's go!", ''],
      ['Three quick ones to warm up.', ''],
      ['Ready? Quick warm-up first.', ''],
    ]),
  right: (combo: number) =>
    combo >= 8
      ? pick(['Unstoppable!', 'On fire!', 'What a run!'])
      : combo >= 4
        ? pick(['Great streak!', 'Keep going!', 'Strong!'])
        : pick(['Correct!', 'Yes!', 'Nice!', 'Exactly!', 'Perfect!']),
  rightArticle: () => pick(['Correct – article too!', 'Exactly right!']),
  near: () => pick(['Almost perfect!', 'Good – small fix:', 'Okay, but exactly like this:']),
  retry: () => pick(['Close! Try once more.', 'Not quite – one more try.', 'Hmm. Try again.']),
  reveal: () => pick(['Look closely – then type it out.', 'Here it is. Now you:', 'Remember this – type it once.']),
  kick: () =>
    pick([
      ['Quick action round!', ''],
      ['Speed round – go go go!', ''],
      ['Stay sharp – sprint!', ''],
    ]),
  idle: () => pick(["Still there? Let's keep going!", 'Hello? Just a few more!']),
  bossWin: () => pick(['Boss defeated!', 'You beat the boss!']),
  bossLose: () => pick(['The boss won this time – tomorrow!', 'So close! Next time.']),
  done: () =>
    pick([
      ['Done for today. Well done!', ''],
      ['Session complete!', ''],
    ]),
  missedDay: () => ["You took yesterday off. No problem – let's continue today.", ''],
  timeUp: () => pick(["Time's up!", 'Too slow – next!']),
  goalMet: () => ['Daily goal done! One more round?', ''],
  homework: (day: number) =>
    rotate(day, [
      ['Explain one card from today to someone – or out loud to yourself.', ''],
      ['Write 3 new cards about something you read today.', ''],
      ['Skim your weak cards in Stats before bed.', ''],
    ]),
};

export const teacherFor = (lang: string | null | undefined) => (lang === 'de' ? DE : EN);
/** v0.1 name, German lines. */
export const T = DE;
