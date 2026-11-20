import type { Attempt, SessionLength, SessionPlan } from '../shared/types';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body as T;
}

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
};

// Attempts are sent in order in the background so answering never waits for the network.
let chain = Promise.resolve();
export function sendAttempt(a: Attempt) {
  chain = chain.then(() => j('/api/attempt', { method: 'POST', body: JSON.stringify(a) }).then(() => {}, () => {}));
  return chain;
}
