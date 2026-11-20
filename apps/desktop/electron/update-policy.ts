// When and how LernLab looks for updates. Pure functions, so they can be tested without Electron.
import { notesFromReleaseHtml } from '@lernlab/core/whatsnew';

export const DAY_MS = 24 * 60 * 60 * 1000;
/** First check this long after startup, so it never slows the start (docs/ARCHITECTURE.md). */
export const FIRST_CHECK_DELAY_MS = 30_000;

export type UpdatePrefs = { autoUpdate: boolean; betaUpdates: boolean };

/** At most one check a day, and none when the user turned updates off. */
export function shouldCheck(prefs: UpdatePrefs, lastCheck: number | undefined, now: number): boolean {
  if (!prefs.autoUpdate) return false;
  return lastCheck === undefined || !(now - lastCheck < DAY_MS && now >= lastCheck);
}

/**
 * Updater settings. Every build, beta or stable, publishes latest*.yml (detectUpdateChannel is off in
 * package.json). Beta testers take the newest GitHub release, pre-releases included; everyone else
 * only the newest stable one. Turning beta off never downgrades: the app stays on its beta until a
 * newer stable release comes out. (Don't set `channel`: electron-updater then allows downgrades.)
 */
export function updaterOptions(prefs: UpdatePrefs) {
  return {
    allowPrerelease: prefs.betaUpdates,
    allowDowngrade: false,
    autoDownload: true,
    autoInstallOnAppQuit: true,
  };
}

/** A downloaded update and its notes for the "Update ready" note on Home (issue #58). */
export type ReadyUpdate = { version: string; notes: { added: string[]; fixed: string[] } };
type ReleaseNotes = string | readonly { version: string; note?: string | null }[] | null | undefined;

/**
 * The GitHub Release notes as plain New and Fixed items. electron-updater gives the release body as HTML,
 * or a list (newest first) when several releases were skipped; the HTML is never shown as HTML.
 */
export function readyUpdate(info: { version: string; releaseNotes?: ReleaseNotes }): ReadyUpdate {
  const n = info.releaseNotes;
  const html = typeof n === 'string' ? n : (n ?? []).map((r) => r.note ?? '').join('\n');
  return { version: info.version, notes: notesFromReleaseHtml(html) };
}
