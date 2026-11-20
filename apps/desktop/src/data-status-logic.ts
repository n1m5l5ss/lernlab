// What the window says about the data process (#56). Main restarts it after a crash; meanwhile requests wait
// and a small notice says LernLab is reconnecting. If it cannot be restarted, the notice says to restart.
import { isDataStatus, type DataStatus } from '../backend/data-protocol';

/** The locales/en.json key to show for a status from the bridge, or null when all is well (or unknown). */
export function dataStatusKey(status: unknown): string | null {
  if (!isDataStatus(status)) return null;
  const keys: Record<DataStatus, string | null> = {
    ok: null,
    reconnecting: 'app.reconnecting',
    failed: 'app.dataFailed',
  };
  return keys[status];
}
