// The screens behind the sidebar. The address is the hash (#/decks), so Back/Forward and reloads keep the screen.
export const ROUTES = ['home', 'decks', 'cards', 'progress', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

/** The screen for a location hash. Unknown or empty hashes open Home. */
export function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'home';
}

export const hashFor = (route: Route) => (route === 'home' ? '#/' : `#/${route}`);

/** `#start` (desktop shortcut, menu) opens straight into a session. */
export const isStartHash = (hash: string) => hash.replace(/[#/]/g, '') === 'start';
