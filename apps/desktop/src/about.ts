// What the About section of Settings lists. Library names and licence ids are not translated.

/** The open-source libraries shipped inside the app, with their licences (checked in about.test.ts). */
export const LIBRARIES = [
  { name: 'Electron', pkg: 'electron', licence: 'MIT' },
  { name: 'React', pkg: 'react', licence: 'MIT' },
  { name: 'i18next', pkg: 'i18next', licence: 'MIT' },
  { name: 'react-i18next', pkg: 'react-i18next', licence: 'MIT' },
  { name: 'ts-fsrs', pkg: 'ts-fsrs', licence: 'MIT' },
  { name: 'fflate', pkg: 'fflate', licence: 'MIT' },
  { name: 'fzstd', pkg: 'fzstd', licence: 'MIT' },
  { name: 'canvas-confetti', pkg: 'canvas-confetti', licence: 'ISC' },
  { name: 'electron-updater', pkg: 'electron-updater', licence: 'MIT' },
] as const;

/** The only times the app goes online (CLAUDE.md principle 4); text in locales: settings.online.<case>. */
export const ONLINE_CASES = ['updates', 'gallery', 'aiKey'] as const;

export const REPO_URL = 'https://github.com/n1m5l5ss/lernlab';
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`;
/** Every release's notes ("Full changelog" on What's new). Opens in the browser only when clicked. */
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;
