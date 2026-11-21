// Changes an AI assistant proposes (#148) wait here, one JSON file each in <data>/ai-requests/, until the user
// accepts or declines them in the app. The assistant's process writes them (it never writes the database);
// the data process reads them, applies an accepted one and removes it. Whoever reads a file checks its shape.
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UserError } from '@lernlab/core/errors';
import { dataDir } from './index';

/** At most this many requests wait at once, and each file is at most this big. */
export const AI_REQUESTS_MAX = 100;
export const AI_REQUEST_BYTES = 2 * 1024 * 1024;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isRequestId = (id: unknown): id is string => typeof id === 'string' && ID.test(id);

export const aiRequestsDir = () => join(dataDir(), 'ai-requests');
const fileOf = (id: string) => join(aiRequestsDir(), `${id}.json`);
const ids = () =>
  existsSync(aiRequestsDir())
    ? readdirSync(aiRequestsDir())
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.slice(0, -5))
        .filter(isRequestId)
    : [];

export const countAiRequests = () => ids().length;

/** Save a proposal. Returns its id and time. Written to a temporary file first, so a reader never sees half of it. */
export function addAiRequest(request: Record<string, unknown>, now = new Date()): { id: string; createdAt: string } {
  if (countAiRequests() >= AI_REQUESTS_MAX)
    throw new UserError(
      'too_many_requests',
      `${AI_REQUESTS_MAX} requests are already waiting. Ask the user to review them in LernLab → AI requests first.`,
    );
  const id = randomUUID();
  const createdAt = now.toISOString();
  const json = JSON.stringify({ ...request, id, createdAt });
  if (Buffer.byteLength(json) > AI_REQUEST_BYTES) throw new UserError('request_too_big', 'This request is too big.');
  mkdirSync(aiRequestsDir(), { recursive: true });
  const tmp = join(aiRequestsDir(), `.${id}.tmp`);
  writeFileSync(tmp, json, { mode: 0o600 });
  renameSync(tmp, fileOf(id));
  return { id, createdAt };
}

/** One waiting request as stored (unchecked JSON), or null. */
export function getAiRequest(id: string): unknown {
  if (!isRequestId(id) || !existsSync(fileOf(id))) return null;
  if (statSync(fileOf(id)).size > AI_REQUEST_BYTES) return null;
  try {
    return JSON.parse(readFileSync(fileOf(id), 'utf8'));
  } catch {
    return null;
  }
}

/** Every waiting request (unchecked JSON), oldest first. Unreadable files are left out. */
export function listAiRequests(): unknown[] {
  return ids()
    .map(getAiRequest)
    .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

/** Remove a request once the user has accepted or declined it. */
export function removeAiRequest(id: string): boolean {
  if (!isRequestId(id) || !existsSync(fileOf(id))) return false;
  rmSync(fileOf(id), { force: true });
  return true;
}
