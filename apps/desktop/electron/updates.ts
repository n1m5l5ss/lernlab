// Auto-update from GitHub Releases (electron-updater). Checks at most once a day, downloads in the
// background, and installs when the app quits. The window shows a calm "Restart to update" note on
// Home, never during a session. A backup of the database is taken before an update is installed.
import { app, ipcMain, type BrowserWindow, type WebFrameMain } from 'electron';
// Deep imports on purpose: the package's main entry also bundles MacUpdater, which runs a local HTTP
// server. macOS updates need a signed app first (#39), so the Mac build doesn't update itself yet.
import type { AppUpdater } from 'electron-updater/out/AppUpdater';
import { AppImageUpdater } from 'electron-updater/out/AppImageUpdater';
import { DebUpdater } from 'electron-updater/out/DebUpdater';
import { NsisUpdater } from 'electron-updater/out/NsisUpdater';
import { DAY_MS, FIRST_CHECK_DELAY_MS, shouldCheck, updaterOptions, type UpdatePrefs } from './update-policy';

function createUpdater(): AppUpdater | null {
  if (process.platform === 'win32') return new NsisUpdater();
  if (process.platform === 'linux') return process.env.APPIMAGE ? new AppImageUpdater() : new DebUpdater();
  return null;
}

type Deps = {
  /** Only LernLab's own page may ask about or install updates. */
  trusted: (frame: WebFrameMain | null) => boolean;
  window: () => BrowserWindow | null;
  /** The user's update settings, read from the data process. */
  prefs: () => Promise<UpdatePrefs>;
  /** Back up the database; resolves when the copy is written. */
  backup: () => Promise<unknown>;
  lastCheck: () => number | undefined;
  setLastCheck: (time: number) => void;
};

let ready: { version: string } | null = null;
let autoUpdater: AppUpdater | null = null;

export function setupUpdates(deps: Deps) {
  ipcMain.handle('lernlab:update-status', (e) => (deps.trusted(e.senderFrame) ? ready : null));
  ipcMain.handle('lernlab:update-install', async (e) => {
    if (!ready || !deps.trusted(e.senderFrame)) return false;
    await deps.backup();
    autoUpdater?.quitAndInstall();
    return true;
  });

  // Unpackaged (npm run desktop) there is nothing to update.
  if (!app.isPackaged) return;
  const updater = createUpdater();
  if (!updater) return;
  autoUpdater = updater;

  updater.logger = null;
  updater.on('error', (e) => console.error('Update check failed:', e?.message ?? e));
  updater.on('update-downloaded', async (info) => {
    // Installing also happens on a normal quit, so take the backup now as well.
    await deps.backup().catch(() => {});
    ready = { version: info.version };
    deps.window()?.webContents.send('lernlab:update-ready', ready);
  });

  const check = async () => {
    try {
      const prefs = await deps.prefs();
      const now = Date.now();
      if (ready || !shouldCheck(prefs, deps.lastCheck(), now)) return;
      Object.assign(updater, updaterOptions(prefs));
      deps.setLastCheck(now);
      await updater.checkForUpdates();
    } catch (e) {
      console.error('Update check failed:', (e as Error)?.message ?? e);
    }
  };
  setTimeout(check, FIRST_CHECK_DELAY_MS);
  // Apps left open for days still look once a day.
  setInterval(check, DAY_MS / 4).unref();
}
