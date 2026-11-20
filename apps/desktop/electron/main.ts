// LernLab desktop: the window talks to the data process through a typed bridge (preload + IPC).
// No network port is opened. Everything stays on this computer (no accounts, no cloud).
import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  protocol,
  screen,
  session,
  shell,
  utilityProcess,
  type UtilityProcess,
  type WebFrameMain,
} from 'electron';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { windowBackground, type Theme } from '@lernlab/ui/tokens';
import { setupUpdates } from './updates';
import { themeOf } from './theme';
import { applyPrefs, setupReminders, type ReminderStatus } from './reminders';
import { reminderPrefsOf, startedAtLogin } from './reminder-policy';
import { MIN_SIZE, restoreWindow, type WindowState } from './window-state';
import { HOME_SELECTOR, isSmokeTest, SMOKE_FAIL, SMOKE_OK, waitFor } from './smoke';

// Installer smoke test (see smoke.ts): a fresh, throw-away profile, so it never touches real data.
const smoke = isSmokeTest(process.argv);
if (smoke) app.setPath('userData', mkdtempSync(join(tmpdir(), 'lernlab-smoke-')));

const configFile = () => join(app.getPath('userData'), 'config.json');
type Config = {
  dataDir?: string;
  lastUpdateCheck?: number;
  /** The local date the daily reminder was last checked, so it shows at most once a day. */
  lastReminder?: string;
  theme?: Theme;
  window?: WindowState;
};
const readConfig = (): Config => {
  try {
    return JSON.parse(readFileSync(configFile(), 'utf8'));
  } catch {
    return {};
  }
};
const writeConfig = (patch: Partial<Config>) =>
  writeFileSync(configFile(), JSON.stringify({ ...readConfig(), ...patch }, null, 2));
const dataDir = () => readConfig().dataDir || join(app.getPath('userData'), 'data');

let win: BrowserWindow | null = null;
let ready = false;
const pendingFiles: string[] = [];

const distDir = join(__dirname, '..', 'dist');
// Compare file URLs without query/hash, decoded, and case-insensitively on Windows (drive letters).
const normalizeUrl = (url: string) => {
  const u = decodeURIComponent(url.split('#')[0].split('?')[0]);
  return process.platform === 'win32' ? u.toLowerCase() : u;
};
const appUrl = normalizeUrl(pathToFileURL(join(distDir, 'index.html')).href);
const isAppUrl = (url: string) => normalizeUrl(url) === appUrl;

/* ── Data process: the only place with the database ── */

type Result = { ok: true; value: unknown } | { ok: false; error: { code: string; message: string } };
let data: UtilityProcess | null = null;
let nextId = 1;
let restarts = 0;
const pending = new Map<number, (r: Result) => void>();

function startDataProcess() {
  const child = utilityProcess.fork(join(__dirname, 'data.cjs'), [], {
    serviceName: 'LernLab data',
    env: { ...process.env, LERNLAB_DATA: dataDir(), LERNLAB_AUTO_ANKI: '0' },
  });
  child.on('message', (msg: { id: number; result: Result } | { fatal: string }) => {
    if ('fatal' in msg) return fatal(msg.fatal);
    pending.get(msg.id)?.(msg.result);
    pending.delete(msg.id);
  });
  child.on('exit', (code) => {
    data = null;
    for (const done of pending.values())
      done({ ok: false, error: { code: 'data_process_exit', message: 'Please try again.' } });
    pending.clear();
    if (app.isReady() && !quitting && restarts < 5) {
      console.error(`Data process exited (${code}); restarting.`);
      setTimeout(startDataProcess, 500 * 2 ** restarts++);
    }
  });
  child.once('spawn', () => (restarts = 0));
  data = child;
}

/** The data could not be opened (e.g. a failed update, already rolled back). Explain and quit. */
function fatal(message: string) {
  quitting = true;
  if (smoke) {
    console.error(`${SMOKE_FAIL} ${message}`);
    return app.exit(1);
  }
  dialog.showErrorBox('LernLab could not open your data', message);
  app.exit(1);
}

/** Send one request to the data process. Never throws. */
function callData(channel: string, input: unknown): Promise<Result> {
  return new Promise((resolve) => {
    if (!data) return resolve({ ok: false, error: { code: 'data_process_down', message: 'Please try again.' } });
    const id = nextId++;
    pending.set(id, resolve);
    data.postMessage({ id, channel, input });
  });
}

/** Only LernLab's own page may use the bridge. */
const trusted = (frame: WebFrameMain | null) => !!frame && isAppUrl(frame.url);

let quitting = false;
app.on('before-quit', () => (quitting = true));

// Media is served from the data folder by a private scheme, never over HTTP or file://.
protocol.registerSchemesAsPrivileged([
  { scheme: 'lernlab-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

if (!app.requestSingleInstanceLock()) app.quit();

app.on('second-instance', (_e, argv) => {
  argv.filter(isDeckFile).forEach(importDeckFile);
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
});
app.on('open-file', (e, path) => {
  e.preventDefault();
  if (ready) importDeckFile(path);
  else pendingFiles.push(path);
});

function isDeckFile(p: string) {
  return /\.(lernpack|apkg|colpkg|csv|tsv)$/i.test(p) && existsSync(p);
}

async function importDeckFile(path: string) {
  try {
    const res = await callData('import.file', { name: basename(path), data: new Uint8Array(await readFile(path)) });
    if (!res.ok) throw new Error(res.error.message);
    const body = res.value as { deck: { name: string }; added: number; updated: number };
    win?.webContents.reload();
    dialog.showMessageBox(win!, {
      message: `Imported “${body.deck.name}”`,
      detail: `${body.added} new, ${body.updated} updated cards.`,
    });
  } catch (e) {
    dialog.showErrorBox('Import failed', (e as Error).message);
  }
}

function startSession() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.executeJavaScript("location.hash = 'start'");
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' as const }] : []),
      {
        label: 'File',
        submenu: [
          { label: 'Start session', accelerator: 'CmdOrCtrl+Return', click: startSession },
          {
            label: 'Import deck…',
            accelerator: 'CmdOrCtrl+O',
            click: async () => {
              const r = await dialog.showOpenDialog(win!, {
                properties: ['openFile', 'multiSelections'],
                filters: [
                  { name: 'Decks', extensions: ['lernpack', 'apkg', 'colpkg', 'csv', 'tsv', 'txt', 'json', 'zip'] },
                ],
              });
              r.filePaths.forEach(importDeckFile);
            },
          },
          { type: 'separator' },
          { label: 'Open data folder', click: () => shell.openPath(dataDir()) },
          {
            label: 'Use a different data folder…',
            click: async () => {
              const r = await dialog.showOpenDialog(win!, {
                properties: ['openDirectory', 'createDirectory'],
                message: 'Choose where LernLab keeps your decks and progress (e.g. a synced folder).',
              });
              if (r.canceled || !r.filePaths[0]) return;
              writeConfig({ dataDir: r.filePaths[0] });
              app.relaunch();
              app.exit(0);
            },
          },
          { type: 'separator' },
          isMac ? { role: 'close' } : { role: 'quit' },
        ],
      },
      { role: 'editMenu' },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      { role: 'windowMenu' },
      {
        role: 'help',
        submenu: [{ label: 'LernLab on GitHub', click: () => shell.openExternal('https://github.com/') }],
      },
    ]),
  );
}

/** Follow the theme setting; remembered in config.json so the next start opens in the right colours. */
function applyTheme(theme: Theme | null) {
  if (!theme || theme === nativeTheme.themeSource) return;
  nativeTheme.themeSource = theme;
  win?.setBackgroundColor(windowBackground(nativeTheme.shouldUseDarkColors));
  writeConfig({ theme });
}

// Windows shows notifications only for an app with an AppUserModelID (the installer's appId).
if (process.platform === 'win32') app.setAppUserModelId('dev.lernlab.app');

async function main() {
  await app.whenReady();
  nativeTheme.themeSource = readConfig().theme ?? 'system';
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  startDataProcess();

  ipcMain.handle('lernlab:invoke', async (e, channel: unknown, input: unknown): Promise<Result> => {
    if (!trusted(e.senderFrame) || typeof channel !== 'string')
      return { ok: false, error: { code: 'forbidden', message: 'Not allowed' } };
    const result = await callData(channel, input);
    if (result.ok) {
      applyTheme(themeOf(channel, result.value));
      const reminder = reminderPrefsOf(channel, result.value);
      if (reminder) applyPrefs(reminder);
    }
    return result;
  });

  const mediaDir = join(dir, 'media');
  protocol.handle('lernlab-media', (req) => {
    const name = basename(decodeURIComponent(new URL(req.url).pathname));
    if (!name || name.startsWith('.')) return new Response(null, { status: 404 });
    return net.fetch(pathToFileURL(join(mediaDir, name)).href);
  });

  // Microphone for speaking rounds; nothing else.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));

  buildMenu();
  const place = restoreWindow(
    readConfig().window,
    screen.getAllDisplays().map((d) => d.workArea),
  );
  win = new BrowserWindow({
    x: place.x,
    y: place.y,
    width: place.width,
    height: place.height,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    backgroundColor: windowBackground(nativeTheme.shouldUseDarkColors),
    title: 'LernLab',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: join(__dirname, 'preload.cjs'),
    },
  });
  // Opened automatically at login: stay out of the way. Windows and Linux show the window minimised
  // in the taskbar; macOS keeps it hidden and the Dock icon opens it (see reminders.ts).
  const atLogin = startedAtLogin(
    process.argv,
    process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin,
  );
  win.once('ready-to-show', () => {
    if (place.maximized) win!.maximize();
    if (!atLogin) win!.show();
    else if (process.platform !== 'darwin') {
      win!.showInactive();
      win!.minimize();
    }
  });
  // Remember size and position for the next start (normal bounds, so un-maximizing restores them too).
  win.on('close', () => {
    if (win && !win.isFullScreen())
      writeConfig({ window: { bounds: win.getNormalBounds(), maximized: win.isMaximized() } });
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAppUrl(url)) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  await win.loadFile(join(distDir, 'index.html'));
  ready = true;
  if (smoke) return runSmokeTest(win);

  // One shortcut from anywhere straight into a session: the "zero friction" start.
  globalShortcut.register('CommandOrControl+Shift+L', startSession);

  [...pendingFiles, ...process.argv.slice(1).filter(isDeckFile)].forEach(importDeckFile);

  setupUpdates({
    trusted,
    window: () => win,
    prefs: async () => {
      const res = await callData('state.get', undefined);
      const s = res.ok ? (res.value as { settings?: { autoUpdate?: boolean; betaUpdates?: boolean } }).settings : {};
      return { autoUpdate: s?.autoUpdate !== false, betaUpdates: s?.betaUpdates === true };
    },
    backup: () => callData('backup.create', { reason: 'update' }),
    lastCheck: () => readConfig().lastUpdateCheck,
    setLastCheck: (time) => writeConfig({ lastUpdateCheck: time }),
  });

  void setupReminders({
    status: async () => {
      const res = await callData('reminder.status', undefined);
      return res.ok ? (res.value as ReminderStatus) : null;
    },
    startSession,
    lastShown: () => readConfig().lastReminder,
    setLastShown: (date) => writeConfig({ lastReminder: date }),
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (win) win.show();
});
app.on('will-quit', () => globalShortcut.unregisterAll());

/** Skip the welcome (it adds the sample deck), reload, and pass once Home is on screen. */
async function runSmokeTest(w: BrowserWindow) {
  const finished = await callData('welcome.finish', { choice: 'language' });
  if (!finished.ok) return fatal(finished.error.message);
  w.webContents.reload();
  const shown = await waitFor(
    () => w.webContents.executeJavaScript(`!!document.querySelector(${JSON.stringify(HOME_SELECTOR)})`),
    { timeoutMs: 60_000, intervalMs: 250 },
  );
  console.log(shown ? `${SMOKE_OK} ${app.getVersion()}` : `${SMOKE_FAIL} Home did not appear within 60 s`);
  quitting = true;
  app.exit(shown ? 0 : 1);
}

main().catch((e) => {
  if (smoke) {
    console.error(`${SMOKE_FAIL} ${String(e?.stack ?? e)}`);
    return app.exit(1);
  }
  dialog.showErrorBox('LernLab could not start', String(e?.stack ?? e));
  app.exit(1);
});
