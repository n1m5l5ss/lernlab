// The teacher's voice: short German lines with English glosses. Templates rotate so they stay fresh.
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export const T = {
  start: () => pick([
    ['Los geht\'s!', 'Let\'s go!'],
    ['Auf geht\'s – drei schnelle Wörter.', 'Here we go – three quick words.'],
    ['Hallo! Kurz aufwärmen.', 'Hi! Quick warm-up.'],
  ]),
  right: (combo: number) =>
    combo >= 8 ? pick(['Unaufhaltsam!', 'Wahnsinn!', 'Was für ein Lauf!'])
    : combo >= 4 ? pick(['Super Serie!', 'Weiter so!', 'Stark!'])
    : pick(['Richtig!', 'Genau!', 'Ja!', 'Sehr gut!', 'Perfekt!']),
  rightArticle: () => pick(['Richtig – Artikel stimmt!', 'Genau, mit Artikel. Perfekt!']),
  near: () => pick(['Fast perfekt!', 'Gut – kleine Korrektur:', 'Okay, aber genau so:']),
  retry: () => pick(['Fast! Noch einmal.', 'Nicht ganz – noch ein Versuch.', 'Hmm. Probier nochmal.']),
  reveal: () => pick(['Schau genau hin – und schreib es ab.', 'So heißt es. Jetzt du:', 'Merk dir das – tipp es nochmal.']),
  articleWrong: (art: string) => `Achtung, Artikel: ${art}!`,
  kick: () => pick([
    ['Kurze Action-Runde!', 'Quick action round!'],
    ['Tempo! Schnell, schnell!', 'Speed it up!'],
    ['Wach bleiben – Sprint!', 'Stay awake – sprint!'],
  ]),
  idle: () => pick(['Bist du noch da? Weiter geht\'s!', 'Hallo? Nur noch ein paar!']),
  bossWin: () => pick(['Endgegner besiegt!', 'Boss geschafft – stark!']),
  bossLose: () => pick(['Der Boss war stärker – morgen wieder!', 'Knapp! Nächstes Mal schaffst du ihn.']),
  done: () => pick([
    ['Fertig für heute. Gut gemacht!', 'Done for today. Well done!'],
    ['Session geschafft!', 'Session complete!'],
  ]),
  missedDay: () => ['Gestern Pause. Kein Problem – heute geht\'s weiter.', 'You took yesterday off. No problem – let\'s continue today.'],
};
