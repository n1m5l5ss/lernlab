// Safe rendering of card text (decks are shared files: only a few formatting tags survive) and media.
import { sanitizeHtml } from '../shared/cards';
import type { Item } from '../shared/types';

export function Rich({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />;
}

const src = (f: string) => (/^https?:\/\//.test(f) ? f : `/media/${encodeURIComponent(f)}`);

export function Media({ item, size = 'md' }: { item: Item; size?: 'sm' | 'md' | 'lg' }) {
  if (!item.image && !item.video) return null;
  const max = size === 'lg' ? 320 : size === 'md' ? 220 : 120;
  return (
    <div className="media" style={{ maxHeight: max }}>
      {item.video ? <video src={src(item.video)} autoPlay muted loop playsInline style={{ maxHeight: max }} />
        : <img src={src(item.image!)} alt="" style={{ maxHeight: max }} />}
    </div>
  );
}
