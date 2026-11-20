// The daily reminder and "open at login" in the main process. Pure functions, so they can be tested
// without Electron; reminders.ts does the Electron calls.
import en from '../../../locales/en.json';

/** Passed when LernLab starts at login (Windows and Linux), so it opens minimised. */
export const HIDDEN_ARG = '--hidden';
/** How often the main process looks at the clock. Cheap: no database call unless a reminder is due. */
export const REMINDER_TICK_MS = 60_000;

export type ReminderPrefs = { enabled: boolean; time: string; launchAtLogin: boolean };

/** Reminder settings in a `state.get` or `settings.save` answer, or null when there are none. */
export function reminderPrefsOf(channel: string, value: unknown): ReminderPrefs | null {
  if (channel !== 'state.get' && channel !== 'settings.save') return null;
  const v = value as { settings?: Record<string, unknown> } & Record<string, unknown>;
  const s = channel === 'state.get' ? v?.settings : v;
  if (!s || typeof s.reminderTime !== 'string') return null;
  return { enabled: s.reminder === true, time: s.reminderTime, launchAtLogin: s.launchAtLogin === true };
}

/**
 * Was this start an automatic one at login? Then the window opens minimised instead of in front.
 * Windows and Linux: our login entry passes --hidden. macOS: the system says so (wasOpenedAtLogin);
 * Electron can no longer ask macOS to start an app hidden, so we just don't show the window.
 */
export const startedAtLogin = (argv: readonly string[], wasOpenedAtLogin = false) =>
  wasOpenedAtLogin || argv.includes(HIDDEN_ARG);

/**
 * Linux has no login-item API in Electron, so we write a freedesktop autostart entry
 * (~/.config/autostart/lernlab.desktop), which GNOME, KDE, Xfce and most desktops follow.
 * `exec` is the AppImage path when running from one, otherwise the installed binary.
 */
export function linuxAutostartEntry(exec: string): string {
  const quoted = `"${exec.replace(/(["`$\\])/g, '\\$1')}"`;
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=LernLab',
    `Exec=${quoted} ${HIDDEN_ARG}`,
    'X-GNOME-Autostart-enabled=true',
    'Terminal=false',
    '',
  ].join('\n');
}

type Strings = { settings: { reminders: { notification: { title: string; bodies: string[] } } } };
const LOCALES: Record<string, Strings> = { en };

/**
 * The notification's words, in the interface language (English until more locales land). Several
 * friendly lines take turns by date, so it never reads like a nag; none of them mention streaks or loss.
 */
export function reminderText(language: string | undefined, dayNumber: number): { title: string; body: string } {
  const n = (LOCALES[language ?? 'en'] ?? LOCALES.en).settings.reminders.notification;
  return { title: n.title, body: n.bodies[Math.abs(Math.trunc(dayNumber)) % n.bodies.length] };
}
