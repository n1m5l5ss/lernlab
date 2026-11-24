// Safe rendering of card text (decks are shared files: only a few formatting tags survive) and media.
// Math (\( … \) and \[ … \]) is typeset with KaTeX after sanitising (math-render.ts).
import { useMemo } from 'react';
import { imageAltOf } from '@lernlab/core/cards';
import type { Item } from '@lernlab/core/types';
import { renderCardHtml } from './math-render';
import { OccludedImage } from './occlusion';
import { BlockedMedia, mediaSrc } from './remote-media-view';
import { GraphFor } from './graph-view';

export function Rich({ html, className }: { html: string; className?: string }) {
  const __html = useMemo(() => renderCardHtml(html), [html]);
  return <span className={className} dangerouslySetInnerHTML={{ __html }} />;
}

export function Media({ item, size = 'md' }: { item: Item; size?: 'sm' | 'md' | 'lg' }) {
  // A card's graph (core/graph.ts) belongs to its front like an image, so it shows wherever the image would.
  const graph = item.extra?.graph ? <GraphFor item={item} small={size === 'sm'} /> : null;
  if (!item.image && !item.video) return graph;
  // An occlusion card's picture is always shown with its boxes masked.
  if (item.kind === 'occlusion') return <OccludedImage item={item} />;
  const max = size === 'lg' ? 320 : size === 'md' ? 220 : 120;
  const url = mediaSrc((item.video ?? item.image)!);
  if (!url)
    return (
      <>
        {graph}
        <BlockedMedia kind={item.video ? 'video' : 'image'} />
      </>
    );
  return (
    <>
      {graph}
      <MediaFile item={item} url={url} max={max} />
    </>
  );
}

function MediaFile({ item, url, max }: { item: Item; url: string; max: number }) {
  return (
    <div className="media" style={{ maxHeight: max }}>
      {item.video ? (
        // Controls let people pause the looping video (WCAG 2.2.2).
        <video src={url} autoPlay muted loop playsInline controls style={{ maxHeight: max }} />
      ) : (
        // The card's image description, or alt="" (decorative) when it has none.
        <img src={url} alt={imageAltOf(item)} style={{ maxHeight: max }} />
      )}
    </div>
  );
}
