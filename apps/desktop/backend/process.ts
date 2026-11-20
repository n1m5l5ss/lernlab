// The data process (Electron utilityProcess): the only place that opens the database.
// Main forwards each request from the window here and sends the result back.
// Keeping SQL out of the main process means a slow import never freezes the window.
import { handle } from './handlers';

type Request = { id: number; channel: unknown; input: unknown };

process.parentPort.on('message', async (e: { data: Request }) => {
  const { id, channel, input } = e.data;
  process.parentPort.postMessage({ id, result: await handle(channel, input) });
});
