// The "What to study" picker stores its choice as a short string: deck:3, decks:1,2, all, starred, hardest, tag:exam.
import type { StudySource } from '@lernlab/core/learn';

export function sourceValue(s: StudySource): string {
  switch (s.kind) {
    case 'deck':
      return `deck:${s.deckId}`;
    case 'decks':
      return `decks:${s.deckIds.join(',')}`;
    case 'tag':
      return `tag:${s.tag}`;
    default:
      return s.kind;
  }
}

export function parseSourceValue(value: string): StudySource | null {
  const [kind, ...rest] = value.split(':');
  const arg = rest.join(':');
  if (kind === 'deck' && Number(arg) > 0) return { kind: 'deck', deckId: Number(arg) };
  if (kind === 'decks') {
    const deckIds = arg.split(',').map(Number);
    return deckIds.length && deckIds.every((n) => n > 0) ? { kind: 'decks', deckIds } : null;
  }
  if (kind === 'tag' && arg.trim()) return { kind: 'tag', tag: arg };
  if (kind === 'all' || kind === 'starred' || kind === 'hardest') return { kind };
  return null;
}
