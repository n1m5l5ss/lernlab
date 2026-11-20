// Row types for the database schema. The schema itself is built by the numbered migrations in migrations/.

/** A row of `items` as SQLite returns it (plus the deck's language when joined as `lang`). */
export type ItemRow = {
  id: number;
  deck_id: number;
  deck: string;
  kind: string;
  target: string;
  article: string | null;
  word: string;
  meaning: string;
  sentence_html: string;
  sentence: string;
  sentence_meaning: string;
  grammar: string;
  notes: string;
  audio: string | null;
  image: string | null;
  video: string | null;
  category: string | null;
  extra: string | null;
  rank: number;
  tags: string;
  grp: string | null;
  lang?: string | null;
};

/** A row of `decks`. */
export type DeckRow = {
  id: number;
  name: string;
  language: string | null;
  description: string;
  settings: string;
  created_at: string;
};
