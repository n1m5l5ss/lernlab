// The two sample decks the first-run welcome offers, bundled so they import offline. They are copies of
// examples/decks/german-a1-starter and examples/decks/biology-the-cell (CC0); samples.test.ts keeps them in step.
import type { WelcomeChoice } from '@lernlab/core/welcome';

export type Sample = { file: string; deckName: string; language: string | null; csv: string };

export const SAMPLES: Record<Extract<WelcomeChoice, 'language' | 'subject'>, Sample> = {
  language: {
    file: 'german-a1-starter.csv',
    deckName: 'German A1 starter',
    language: 'de',
    csv: `front,back,example,example translation,category,tags
der Mann,man,Der <b>Mann</b> ist groß.,The man is tall.,der,noun a1
die Frau,woman,Die <b>Frau</b> liest.,The woman is reading.,die,noun a1
das Kind,child,Das <b>Kind</b> spielt.,The child is playing.,das,noun a1
das Haus,house,Das <b>Haus</b> ist alt.,The house is old.,das,noun a1
die Stadt,city,Die <b>Stadt</b> ist schön.,The city is beautiful.,die,noun a1
der Tag,day,Guten <b>Tag</b>!,Good day!,der,noun a1
sein,to be,Ich <b>bin</b> müde.,I am tired.,,verb a1
haben,to have,Wir <b>haben</b> Zeit.,We have time.,,verb a1
gehen,to go,Ich <b>gehe</b> nach Hause.,I'm going home.,,verb a1
Guten Morgen,good morning,<b>Guten Morgen</b>!,Good morning!,,phrase a1
`,
  },
  subject: {
    file: 'biology-the-cell.csv',
    deckName: 'Biology: the cell',
    language: null,
    csv: `term,definition,category,notes
Mitochondrion,Organelle that produces most of the cell's ATP,Organelle,Has its own DNA
Ribosome,Builds proteins from amino acids,Organelle,Free or on rough ER
Nucleus,Holds the cell's DNA,Organelle,Surrounded by a double membrane
Golgi apparatus,"Modifies, sorts and packages proteins",Organelle
Lysosome,Breaks down waste with enzymes,Organelle
Chloroplast,Site of photosynthesis in plant cells,Organelle,Plants and algae only
Cell membrane,Controls what enters and leaves the cell,Structure
Cell wall,Rigid outer layer of plant cells,Structure
Cytoplasm,Gel-like fluid inside the cell,Structure
The {{c1::mitochondrion}} is called the powerhouse of the cell,Biology basics,Cloze
`,
  },
};
