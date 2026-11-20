// Applies the theme setting. "system" leaves it to the computer (prefers-color-scheme in tokens.css).
import type { Theme } from '@lernlab/ui/tokens';

export function themeAttribute(theme: unknown): Theme | null {
  return theme === 'light' || theme === 'dark' ? theme : null;
}

export function applyTheme(theme: unknown, root: { dataset: DOMStringMap } = document.documentElement) {
  const value = themeAttribute(theme);
  if (value) root.dataset.theme = value;
  else delete root.dataset.theme;
}
