// The messages between the main process and the data process (#56). Main hands the data process one end of a
// MessageChannel at start ("connect"); after that every request and reply goes over that port. Both sides
// check what arrives, so a malformed message is dropped instead of crashing either process.
// Pure: no Electron, no database. Main imports this file (electron/no-sql.test.ts keeps it that way).

/** The handlers' result: never thrown across processes. Same shape as Result in handlers.ts. */
export type DataResult =
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string; params?: Record<string, string | number> } };

/** Main → data process, sent once over parentPort with the port to use. */
export type ConnectMessage = { type: 'connect' };
/** Main → data process: run one handler. */
export type DataRequest = { id: number; channel: string; input: unknown };
/** Data process → main. */
export type DataMessage =
  /** The database is open (and migrated): requests can be answered. */
  | { type: 'ready' }
  | { type: 'reply'; id: number; result: DataResult }
  /** The data could not be opened (a migration failed and its backup was put back). Main explains and quits. */
  | { type: 'fatal'; message: string };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isId = (x: unknown): x is number => Number.isSafeInteger(x) && (x as number) > 0;

export const isConnect = (x: unknown): x is ConnectMessage => isObject(x) && x.type === 'connect';

export function parseRequest(x: unknown): DataRequest | null {
  if (!isObject(x) || !isId(x.id) || typeof x.channel !== 'string') return null;
  return { id: x.id, channel: x.channel, input: x.input };
}

function isResult(x: unknown): x is DataResult {
  if (!isObject(x)) return false;
  if (x.ok === true) return 'value' in x;
  return (
    x.ok === false &&
    isObject(x.error) &&
    typeof x.error.code === 'string' &&
    typeof x.error.message === 'string' &&
    (x.error.params === undefined || isObject(x.error.params))
  );
}

export function parseDataMessage(x: unknown): DataMessage | null {
  if (!isObject(x)) return null;
  if (x.type === 'ready') return { type: 'ready' };
  if (x.type === 'fatal' && typeof x.message === 'string') return { type: 'fatal', message: x.message };
  if (x.type === 'reply' && isId(x.id) && isResult(x.result)) return { type: 'reply', id: x.id, result: x.result };
  return null;
}

/** What the window is told about the data process: working, restarting after a crash, or given up. */
export type DataStatus = 'ok' | 'reconnecting' | 'failed';
export const DATA_STATUSES: readonly DataStatus[] = ['ok', 'reconnecting', 'failed'];
export const isDataStatus = (x: unknown): x is DataStatus => DATA_STATUSES.includes(x as DataStatus);
