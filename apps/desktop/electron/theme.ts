// The main process mirrors the theme setting, so the window frame, menus and the first paint match it.
import { THEMES, type Theme } from '@lernlab/ui/tokens';

/** The theme in a `state.get` or `settings.save` answer, or null when there is none. */
export function themeOf(channel: string, value: unknown): Theme | null {
  if (channel !== 'state.get' && channel !== 'settings.save') return null;
  const v = value as { theme?: unknown; settings?: { theme?: unknown } } | null;
  const theme = channel === 'state.get' ? v?.settings?.theme : v?.theme;
  return THEMES.includes(theme as Theme) ? (theme as Theme) : null;
}
