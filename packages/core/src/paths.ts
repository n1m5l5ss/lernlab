// File-name helpers without node:path, so the engine runs on any platform.
// Both / and \ count as separators, because names inside deck files may come from any OS.

/** Last part of a path, optionally without the given extension (like node's path.basename). */
export function basename(p: string, ext?: string): string {
  const parts = p.replace(/[/\\]+$/, '').split(/[/\\]/);
  const base = parts[parts.length - 1] ?? '';
  return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
}

/** Extension including the dot, or '' (like node's path.extname). */
export function extname(p: string): string {
  const base = basename(p);
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i);
}
