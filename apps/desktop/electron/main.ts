// LernLab desktop: runs the local server inside the app and shows the UI in a window.
// Everything stays on this computer (no accounts, no cloud).
import { app, BrowserWindow, dialog, globalShortcut, Menu, session, shell } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const configFile = () => join(app.getPath('userData'), 'config.json');
const readConfig = (): { dataDir?: string } => {
  try {
    return JSON.parse(readFileSync(configFile(), 'utf8'));
  } catch {
    return {};
  }
};
const dataDir = () => readConfig().dataDir || join(app.getPath('userData'), 'data');

let win: BrowserWindow | null = null;
let base = '';
const pendingFiles: string[] = [];

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
  if (base) importDeckFile(path);
  else pendingFiles.push(path);
});

function isDeckFile(p: string) {
  return /\.(lernpack|apkg|colpkg|csv|tsv)$/i.test(p) && existsSync(p);
}

async function importDeckFile(path: string) {
  try {
    const res = await fetch(`${base}/api/import/file?name=${encodeURIComponent(basename(path))}`, {
      method: 'POST',
      body: readFileSync(path),
    });
    const body: any = await res.json();
    if (!res.ok) throw new Error(body.error);
    win?.webContents.reload();
    dialog.showMessageBox(win!, {
      message: `Imported “${body.deck.name}”`,
      detail: `${body.added} new, ${body.updated} updated cards.`,
    });
  } catch (e: any) {
    dialog.showErrorBox('Import failed', e.message);
  }
}

function startSession() {
  if (!win) return;
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
              writeFileSync(configFile(), JSON.stringify({ ...readConfig(), dataDir: r.filePaths[0] }, null, 2));
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

async function main() {
  await app.whenReady();
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  process.env.LERNLAB_DATA = dir;
  process.env.LERNLAB_AUTO_ANKI = '0';

  const { startServer } = await import('../server/server');
  const { port } = await startServer({ port: 0, distDir: join(__dirname, '..', 'dist') });
  base = `http://127.0.0.1:${port}`;

  // Microphone for speaking rounds; nothing else.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media'));

  buildMenu();
  win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: '#12142a',
    title: 'LernLab',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once('ready-to-show', () => win!.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(base)) return { action: 'allow' };
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(base)) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  await win.loadURL(`${base}/`);

  // One shortcut from anywhere straight into a session: the "zero friction" start.
  globalShortcut.register('CommandOrControl+Shift+L', startSession);

  [...pendingFiles, ...process.argv.slice(1).filter(isDeckFile)].forEach(importDeckFile);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (win) win.show();
});
app.on('will-quit', () => globalShortcut.unregisterAll());

main().catch((e) => {
  dialog.showErrorBox('LernLab could not start', String(e?.stack ?? e));
  app.exit(1);
});
