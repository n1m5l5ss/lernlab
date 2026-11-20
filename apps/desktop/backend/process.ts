// The data process (Electron utilityProcess): the only place that opens the database.
// Main forwards each request from the window here and sends the result back.
// Keeping SQL out of the main process means a slow import never freezes the window.
import { handle } from './handlers';
import { getDb } from './storage';

type Request = { id: number; channel: unknown; input: unknown };

process.parentPort.on('message', async (e: { data: Request }) => {
  const { id, channel, input } = e.data;
  process.parentPort.postMessage({ id, result: await handle(channel, input) });
});

// Open the database now: this runs pending migrations (with a backup first). If one fails, the
// backup is already restored; tell main so it can explain and quit instead of half-working.
try {
  getDb();
} catch (e) {
  process.parentPort.postMessage({ fatal: (e as Error).message });
}
