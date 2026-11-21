// The optional daily reminder (a system notification; clicking it starts a session) and "open at
// login". Both are off by default and set in Settings → Reminders. The main process never opens the
// database: it asks the data process (`reminder.status`) whether you already studied today.
import { app, Notification } from 'electron';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { localDate, reminderDue } from '@lernlab/core/reminder';
import type { StudyPlan } from '@lernlab/core/studyplan';
import { HIDDEN_ARG, linuxAutostartEntry, REMINDER_TICK_MS, reminderText, type ReminderPrefs } from './reminder-policy';

export type ReminderStatus = ReminderPrefs & { language?: string; plan?: StudyPlan | null; studiedToday: boolean };

type Deps = {
  /** Reminder settings and whether you studied today, from the data process (null if it is down). */
  status: () => Promise<ReminderStatus | null>;
  /** Show the window and start a session. */
  startSession: () => void;
  lastShown: () => string | undefined;
  setLastShown: (date: string) => void;
};

let prefs: ReminderPrefs | null = null;
// Keep a reference: a notification that is garbage-collected loses its click handler.
let shown: Notification | null = null;

/** Look at the clock once a minute; show the reminder when its time has come and you have not studied yet. */
export async function setupReminders(deps: Deps) {
  const first = await deps.status();
  if (first) applyPrefs(first);

  const tick = async () => {
    const now = new Date();
    if (!prefs || !reminderDue({ ...prefs, lastShown: deps.lastShown() }, now)) return;
    const s = await deps.status();
    if (!s) return; // data process restarting: try again next minute
    applyPrefs(s);
    deps.setLastShown(localDate(now)); // checked once a day, shown or not
    if (!s.enabled || s.studiedToday || !Notification.isSupported()) return;
    const dayNumber = Math.floor(now.getTime() / 86_400_000);
    shown = new Notification(reminderText(s.language, dayNumber, s.plan));
    shown.on('click', () => {
      deps.startSession();
      shown = null;
    });
    shown.show();
  };
  setInterval(() => void tick(), REMINDER_TICK_MS).unref();
  void tick();
}

/** New settings were saved (or read): remember them and update the login item when it changed. */
export function applyPrefs(next: ReminderPrefs) {
  const changed = prefs?.launchAtLogin !== next.launchAtLogin;
  prefs = { enabled: next.enabled, time: next.time, launchAtLogin: next.launchAtLogin };
  if (changed) setLaunchAtLogin(next.launchAtLogin);
}

/**
 * Open LernLab at login, minimised. Only for the installed app (an unpackaged dev run would register
 * the Electron binary).
 * - Windows: a Run registry entry with --hidden.
 * - macOS: a login item; macOS 13+ cannot start an app hidden on request, so main.ts checks
 *   `wasOpenedAtLogin` and keeps the window hidden (the Dock icon opens it).
 * - Linux: Electron has no login-item API here, so we write ~/.config/autostart/lernlab.desktop.
 */
function setLaunchAtLogin(on: boolean) {
  if (!app.isPackaged) return;
  try {
    if (process.platform === 'linux') {
      const dir = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'autostart');
      const file = join(dir, 'lernlab.desktop');
      if (on) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, linuxAutostartEntry(process.env.APPIMAGE || process.execPath));
      } else if (existsSync(file)) rmSync(file);
    } else {
      app.setLoginItemSettings({ openAtLogin: on, ...(process.platform === 'win32' && { args: [HIDDEN_ARG] }) });
    }
  } catch (e) {
    console.error('Could not change the login item:', (e as Error)?.message ?? e);
  }
}
