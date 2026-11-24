// The data process (Electron utilityProcess): the only place that opens the database.
// Main forwards each request from the window here and sends the result back.
// Keeping SQL out of the main process means a slow import never freezes the window.
//
// Messages (backend/data-protocol.ts): main sends { type: 'connect' } with one end of a MessageChannel on
// parentPort; every request and reply then goes over that port, checked on arrival.
import type { MessagePortMain } from 'electron';
import { optimizeDb } from '@lernlab/storage-sqlite';
import { dailyBackup } from '@lernlab/storage-sqlite/backups';
import { dailyLearnerBackups } from '@lernlab/storage-sqlite/learners';
import { handle } from './handlers';
import { getDb } from './storage';
import { isConnect, parseRequest, type DataMessage } from './data-protocol';

let port: MessagePortMain | null = null;
/** Messages written before main's port arrived (it is sent right after start, so this stays tiny). */
const outbox: DataMessage[] = [];
const send = (m: DataMessage) => (port ? port.postMessage(m) : outbox.push(m));

process.parentPort.on('message', (e) => {
  if (!isConnect(e.data) || !e.ports[0]) return;
  port = e.ports[0];
  port.on('message', async ({ data }) => {
    const req = parseRequest(data);
    if (!req) return console.error('Data process: dropped a malformed request.');
    send({ type: 'reply', id: req.id, result: await handle(req.channel, req.input) });
  });
  port.start();
  outbox.splice(0).forEach(send);
});

// Open the database now: this runs pending migrations (with a backup first). If one fails, the
// backup is already restored; tell main so it can explain and quit instead of half-working.
try {
  getDb();
  send({ type: 'ready' });
  // One automatic backup a day (the newest 7 are kept). Deferred so startup stays fast, and checked
  // every hour so an app left open for days still makes one. PRAGMA optimize keeps query plans fresh.
  const hourly = () => {
    try {
      dailyBackup();
    } catch (e) {
      console.error('Daily backup failed:', (e as Error).message);
    }
    try {
      dailyLearnerBackups(); // other learners' progress (#224); does nothing when there are none
    } catch (e) {
      console.error('Daily backup of other learners failed:', (e as Error).message);
    }
    try {
      optimizeDb(getDb());
    } catch (e) {
      console.error('PRAGMA optimize failed:', (e as Error).message);
    }
  };
  setTimeout(hourly, 10_000);
  setInterval(hourly, 60 * 60 * 1000).unref();
} catch (e) {
  send({ type: 'fatal', message: (e as Error).message });
}
