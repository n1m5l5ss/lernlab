import type { Attempt, SessionLength, SessionPlan } from '../shared/types';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body as T;
}

let chain = Promise.resolve();

export const api = {
  state: () => j<any>('/api/state'),
  importStatus: () => j<any>('/api/import'),
  startImport: () => j<any>('/api/import', { method: 'POST', body: '{}' }),
  session: (length: SessionLength) => j<SessionPlan>('/api/session', { method: 'POST', body: JSON.stringify({ length }) }),
  finish: (body: any) => j<any>('/api/session/finish', { method: 'POST', body: JSON.stringify(body) }),
  stats: () => j<any>('/api/stats'),
  summary: () => j<any>('/api/summary/today'),
  progress: () => j<any>('/api/progress'),
  saveSettings: (s: any) => j<any>('/api/settings', { method: 'PUT', body: JSON.stringify(s) }),
  createDeck: (b: any) => j<any>('/api/decks', { method: 'POST', body: JSON.stringify(b) }),
  updateDeck: (id: number, b: any) => j<any>(`/api/decks/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteDeck: (id: number) => j<any>(`/api/decks/${id}`, { method: 'DELETE' }),
  activate: (id: number) => j<any>(`/api/decks/${id}/activate`, { method: 'POST' }),
  cards: (id: number, q = '', offset = 0) => j<any>(`/api/decks/${id}/cards?q=${encodeURIComponent(q)}&offset=${offset}`),
  addCard: (deckId: number, b: any) => j<any>(`/api/decks/${deckId}/cards`, { method: 'POST', body: JSON.stringify(b) }),
  saveCard: (id: number, b: any) => j<any>(`/api/cards/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteCard: (id: number) => j<any>(`/api/cards/${id}`, { method: 'DELETE' }),
  importFile: async (file: File, opts: { deckName?: string; language?: string; deckId?: number }) => {
    const q = new URLSearchParams({ name: file.name });
    if (opts.deckName) q.set('deckName', opts.deckName);
    if (opts.language !== undefined) q.set('language', opts.language);
    if (opts.deckId) q.set('deckId', String(opts.deckId));
    return j<any>(`/api/import/file?${q}`, { method: 'POST', body: await file.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream' } });
  },
  importText: (b: any) => j<any>('/api/import/text', { method: 'POST', body: JSON.stringify(b) }),
  ankiInfo: () => j<any>('/api/import/anki'),
  ankiImport: (b: any) => j<any>('/api/import/anki', { method: 'POST', body: JSON.stringify(b) }),
  uploadMedia: async (file: File) => j<any>(`/api/media?name=${encodeURIComponent(file.name)}`, { method: 'POST', body: await file.arrayBuffer(), headers: { 'Content-Type': 'application/octet-stream' } }),
};

export function sendOverride(itemId: number) {
  chain = chain.then(() => j('/api/attempt/override', { method: 'POST', body: JSON.stringify({ itemId }) }).then(() => {}, () => {}));
}

// Attempts are sent in order in the background so answering never waits for the network.
export function sendAttempt(a: Attempt) {
  chain = chain.then(() => j('/api/attempt', { method: 'POST', body: JSON.stringify(a) }).then(() => {}, () => {}));
  return chain;
}
