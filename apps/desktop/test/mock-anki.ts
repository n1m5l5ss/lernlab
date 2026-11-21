// A tiny fake AnkiConnect for tests and demos (no Anki needed).
import { createServer, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const notes = JSON.parse(readFileSync(resolve(import.meta.dirname, 'fixture-notes.json'), 'utf8'));
// 0.1 s of silence as an MP3 frame is overkill for tests; any bytes will do.
const FAKE_MP3 = Buffer.from('ID3fake-audio').toString('base64');

/** Every deck the notes use, with its parent decks, as Anki lists them. */
const deckNames = [
  ...new Set(
    notes.flatMap((n: { deck: string }) => n.deck.split('::').map((_, i, parts) => parts.slice(0, i + 1).join('::'))),
  ),
] as string[];
const inDeck = (deck: string) => (n: { deck: string }) => n.deck === deck || n.deck.startsWith(`${deck}::`);
/** The deck name in a query like deck:"Lang::German", with Anki's backslash escapes undone. */
const queryDeck = (q: string) => (q.match(/deck:"((?:[^"\\]|\\.)*)"/)?.[1] ?? '').replace(/\\(.)/g, '$1');

export function startMockAnki(port = 8799): Promise<Server> {
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { action, params } = JSON.parse(body || '{}');
      let result: any = null;
      if (action === 'version') result = 6;
      else if (action === 'findNotes') result = notes.filter(inDeck(queryDeck(params.query))).map((n: any) => n.noteId);
      else if (action === 'deckNames') result = deckNames;
      else if (action === 'getDeckStats')
        result = Object.fromEntries(
          (params.decks as string[]).map((name, i) => [
            i + 1,
            { name, total_in_deck: notes.filter(inDeck(name)).length },
          ]),
        );
      else if (action === 'notesInfo')
        result = notes.filter((n: any) => params.notes.includes(n.noteId)).map(({ deck, ...n }: any) => n);
      else if (action === 'cardsInfo')
        result = notes
          .filter((n: any) => params.cards.includes(n.cards[0]))
          .map((n: any) => ({ cardId: n.cards[0], note: n.noteId, deckName: n.deck }));
      else if (action === 'retrieveMediaFile') result = FAKE_MP3;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result, error: null }));
    });
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

if (process.argv[1]?.endsWith('mock-anki.ts')) {
  startMockAnki(Number(process.env.PORT ?? 8765)).then(() => console.log('Mock AnkiConnect running'));
}
