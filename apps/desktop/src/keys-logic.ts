// Keyboard rules shared by screens: arrow keys inside one-tab-stop groups, and when a screen shortcut must
// leave a key to the focused control (WCAG 2.1.1, 3.2.1).

/**
 * Arrow-key movement in a radio group or tab list (one tab stop, arrows pick): the index that should take
 * focus, or null when the key is not for the group. Right to left, the left arrow moves forward.
 */
export function rovingIndex(index: number, count: number, key: string, rtl = false): number | null {
  if (count <= 0) return null;
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const back = rtl ? 'ArrowRight' : 'ArrowLeft';
  if (key === forward || key === 'ArrowDown') return (index + 1) % count;
  if (key === back || key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

const CONTROL_TAGS = new Set(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY']);
const CONTROL_ROLES = new Set(['button', 'link', 'radio', 'tab', 'switch', 'checkbox', 'menuitem', 'option']);

type Target = { tagName: string; getAttribute(name: string): string | null } | null;

/**
 * True when the focused control acts on Enter or Space itself. A screen-wide Enter/Space shortcut then
 * steps aside, so pressing Space on "Done" never starts another round.
 */
export function controlOwnsKey(key: string, target: Target): boolean {
  if (key !== 'Enter' && key !== ' ') return false;
  if (!target) return false;
  return CONTROL_TAGS.has(target.tagName) || CONTROL_ROLES.has(target.getAttribute('role') ?? '');
}
