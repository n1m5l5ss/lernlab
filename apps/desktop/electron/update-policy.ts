// When and how LernLab looks for updates. Pure functions, so they can be tested without Electron.

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
