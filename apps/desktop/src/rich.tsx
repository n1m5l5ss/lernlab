// Safe rendering of card text (decks are shared files: only a few formatting tags survive) and media.
// Math (\( … \) and \[ … \]) is typeset with KaTeX after sanitising (math-render.ts).
import { useMemo } from 'react';
import { imageAltOf } from '@lernlab/core/cards';
import type { Item } from '@lernlab/core/types';
import { mediaUrl } from './bridge';
import { renderCardHtml } from './math-render';

export function Rich({ html, className }: { html: string; className?: string }) {
  const __html = useMemo(() => renderCardHtml(html), [html]);
  return <span className={className} dangerouslySetInnerHTML={{ __html }} />;
}

const src = (f: string) => (/^https?:\/\//.test(f) ? f : mediaUrl(f));

export function Media({ item, size = 'md' }: { item: Item; size?: 'sm' | 'md' | 'lg' }) {
  if (!item.image && !item.video) return null;
  const max = size === 'lg' ? 320 : size === 'md' ? 220 : 120;
  return (
    <div className="media" style={{ maxHeight: max }}>
      {item.video ? (
        // Controls let people pause the looping video (WCAG 2.2.2).
        <video src={src(item.video)} autoPlay muted loop playsInline controls style={{ maxHeight: max }} />
      ) : (
        // The card's image description, or alt="" (decorative) when it has none.
        <img src={src(item.image!)} alt={imageAltOf(item)} style={{ maxHeight: max }} />
      )}
    </div>
  );
}
