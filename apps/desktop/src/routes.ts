// The screens behind the sidebar. The address is the hash (#/decks), so Back/Forward and reloads keep the screen.
export const ROUTES = ['home', 'decks', 'cards', 'progress', 'requests', 'settings'] as const;
export type Route = (typeof ROUTES)[number];

/** The screen for a location hash. Unknown or empty hashes open Home. */
export function routeFromHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'home';
}

export const hashFor = (route: Route) => (route === 'home' ? '#/' : `#/${route}`);

/** `#start` (desktop shortcut, menu) opens straight into a session. */
export const isStartHash = (hash: string) => hash.replace(/[#/]/g, '') === 'start';

type Focused = { tagName?: string; type?: string; isContentEditable?: boolean } | null | undefined;
const NOT_TEXT = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color', 'image'];

/** Is the focused element one you type text into (an answer box, a search box, an editor)? */
export const isTextField = (el: Focused): boolean =>
  !!el &&
  (el.tagName === 'TEXTAREA' ||
    el.isContentEditable === true ||
    (el.tagName === 'INPUT' && !NOT_TEXT.includes((el.type ?? 'text').toLowerCase())));

/**
 * May the start shortcut (File → Start session, Ctrl/Cmd+Enter; the global shortcut; a reminder) open a new
 * session now? Only from the main screens and the summary: not over a running session, a Study together
 * session, a mock exam, a teach-back or a concept map (or any screen added later), which it would throw away, and not
 * while you type: Ctrl/Cmd+Enter in an answer box checks an explanation or shows a worked solution.
 */
export const mayStartFromShortcut = (open: string | null, focused: Focused): boolean =>
  (open === null || open === 'summary') && !isTextField(focused);
