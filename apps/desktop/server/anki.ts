// Minimal AnkiConnect client (Anki desktop + AnkiConnect add-on, http://127.0.0.1:8765).
export const ANKI_URL = process.env.ANKICONNECT_URL ?? 'http://127.0.0.1:8765';

export async function anki<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(ANKI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json()) as { result: T; error: string | null };
  if (body.error) throw new Error(`AnkiConnect ${action}: ${body.error}`);
  return body.result;
}

export async function ankiAvailable(): Promise<boolean> {
  try {
    await anki('version');
    return true;
  } catch {
    return false;
  }
}

export type AnkiNote = {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
  cards: number[];
};

export async function notesInDeck(deck: string): Promise<AnkiNote[]> {
  const ids = await anki<number[]>('findNotes', { query: `deck:"${deck}"` });
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
