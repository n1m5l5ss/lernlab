// Minimal AnkiConnect client (Anki desktop + AnkiConnect add-on, http://127.0.0.1:8765).
// It only ever talks to this computer: ANKICONNECT_URL may change the port, never the host (principle 4).
import { getDb, type DB } from '@lernlab/core/db';
import { importFromAnki, type AnkiNote, type AnkiProgress, type AnkiSource } from '@lernlab/core/importer';

const DEFAULT_URL = 'http://127.0.0.1:8765';
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** The AnkiConnect address: ANKICONNECT_URL when it points at this computer, otherwise the default. */
export function ankiUrl(env = process.env.ANKICONNECT_URL): string {
  try {
    const url = new URL(env ?? DEFAULT_URL);
    return url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname) ? url.origin : DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}
export const ANKI_URL = ankiUrl();

/** Why AnkiConnect did not answer: nothing listens (Anki closed or add-on missing), or something else answered. */
export class AnkiUnavailable extends Error {
  constructor(readonly reason: 'not_running' | 'not_ankiconnect') {
    super(reason === 'not_running' ? 'Anki is not running' : 'Something other than AnkiConnect answered');
  }
}

export async function anki<T>(action: string, params: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ANKI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: 6, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new AnkiUnavailable('not_running');
  }
  const body = (await res.json().catch(() => null)) as { result: T; error: string | null } | null;
  if (!body || typeof body !== 'object' || !('result' in body)) throw new AnkiUnavailable('not_ankiconnect');
  if (body.error) throw new Error(`AnkiConnect ${action}: ${body.error}`);
  return body.result;
}

/** Whether AnkiConnect answers, and if not, why. */
export async function ankiProbe(): Promise<'ready' | AnkiUnavailable['reason']> {
  try {
    await anki<number>('version', {}, 3000);
    return 'ready';
  } catch (e) {
    return e instanceof AnkiUnavailable ? e.reason : 'not_ankiconnect';
  }
}

export const ankiAvailable = async () => (await ankiProbe()) === 'ready';

export type AnkiDeck = { name: string; cards: number | null };

/** Every Anki deck with its card count (null when Anki cannot tell). */
export async function ankiDecks(): Promise<AnkiDeck[]> {
  type Stats = Record<string, { name: string; total_in_deck: number }>;
  const names = await anki<string[]>('deckNames');
  const stats = await anki<Stats>('getDeckStats', { decks: names }).catch(() => ({}) as Stats);
  const counts = new Map(Object.values(stats).map((s) => [s.name, s.total_in_deck]));
  return names
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, cards: counts.get(name) ?? null }))
    .filter((d) => d.name !== 'Default' || d.cards !== 0); // Anki's empty starter deck
}

/** A deck name as an exact Anki search term. */
export const deckQuery = (deck: string) => `deck:"${deck.replace(/[\\"*_]/g, (c) => `\\${c}`)}"`;

/** Selected decks without the ones a selected parent deck already includes. */
export function topLevelDecks(sources: string[]): string[] {
  const unique = [...new Set(sources)];
  return unique.filter((s) => !unique.some((p) => p !== s && s.startsWith(`${p}::`)));
}

export async function notesInDeck(deck: string): Promise<AnkiNote[]> {
  const ids = await anki<number[]>('findNotes', { query: deckQuery(deck) });
  const out: AnkiNote[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    out.push(...(await anki<AnkiNote[]>('notesInfo', { notes: ids.slice(i, i + 200) })));
  }
  return out;
}

export async function cardDecks(cardIds: number[]): Promise<Record<number, string>> {
  const out: Record<number, string> = {};
  for (let i = 0; i < cardIds.length; i += 500) {
    const infos = await anki<{ cardId: number; note: number; deckName: string }[]>('cardsInfo', {
      cards: cardIds.slice(i, i + 500),
    });
    for (const c of infos) out[c.note] = c.deckName;
  }
  return out;
}

export async function mediaFile(filename: string): Promise<Buffer | null> {
  const b64 = await anki<string | false>('retrieveMediaFile', { filename });
  return b64 ? Buffer.from(b64, 'base64') : null;
}

/** The engine's view of Anki, served by AnkiConnect. */
export const ankiConnect: AnkiSource = { notesInDeck, cardDecks, mediaFile };

/** Progress as an English line, for the command line. */
export const progressLine = (source: string, p: AnkiProgress) =>
  p.step === 'notes' ? `Reading notes from "${source}"…` : `Copying media ${p.done + 1}/${p.total}…`;

/** Import a deck from the running Anki (the CLI and first-start auto-import). */
export const importDeck = (source: string, onProgress?: (m: string) => void, d: DB = getDb()) =>
  importFromAnki(ankiConnect, source, {}, onProgress && ((p) => onProgress(progressLine(source, p))), d);
