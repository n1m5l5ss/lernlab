// Image occlusion (#44): the picture with its boxes masked as a card asks it, and the box editor.
// The image is deck media (lernlab-media:// or https), shown as an <img> with its alt text; labels are text.
import { useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { imageAltOf } from '@lernlab/core/cards';
import { occlusionOf, type Box } from '@lernlab/core/occlusion';
import type { Item } from '@lernlab/core/types';
import { mediaUrl } from './bridge';
import { dragBox, MIN_DRAWN, NEW_BOX, nudge, spanBox, type Point, type Shape } from './occlusion-logic';

const src = (f: string) => (/^https?:\/\//.test(f) ? f : mediaUrl(f));
const place = (b: Box): CSSProperties => ({
  left: `${b.x * 100}%`, // rtl-ignore: a box is placed on the picture, which never flips
  top: `${b.y * 100}%`,
  width: `${b.w * 100}%`,
  height: `${b.h * 100}%`,
});

/** The card's picture: the asked box hidden and marked; in "hide all" every other box hidden too. */
export function OccludedImage({ item }: { item: Item }) {
  const { t } = useTranslation();
  const view = occlusionOf(item);
  if (!view || !item.image) return null;
  return (
    <figure className="occl">
      <div className="occl-frame">
        <img src={src(item.image)} alt={imageAltOf(item)} draggable={false} />
        {view.boxes.map((b, i) => {
          const asked = i === view.asked;
          const hidden = !asked && view.mode === 'all';
          return (
            <div
              key={b.id}
              className={`occl-box${asked ? ' asked' : hidden ? ' hidden' : ''}`}
              style={place(b.box)}
              aria-hidden={hidden || undefined}
            >
              {asked ? '?' : hidden ? null : <span className="occl-label">{b.label}</span>}
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">
        {t(view.mode === 'all' ? 'ex.occlusion.askedAll' : 'ex.occlusion.askedOne', {
          n: view.asked + 1,
          count: view.boxes.length,
        })}
      </figcaption>
    </figure>
  );
}

type Drag = { i: number; how: 'move' | 'resize' | 'draw'; from: Point; start: Box };

/**
 * Draw, move and resize boxes over the picture with the mouse or the keyboard. `own` limits editing to
 * one saved card's box (its siblings are drawn but stay as they are); without it boxes can be added and removed.
 */
export function OcclusionEditor({
  image,
  alt,
  shapes,
  own,
  selected,
  onSelect,
  onChange,
}: {
  image: string;
  alt: string;
  shapes: Shape[];
  own?: number;
  selected: number;
  onSelect: (i: number) => void;
  onChange: (shapes: Shape[]) => void;
}) {
  const { t } = useTranslation();
  const uid = useId();
  const frame = useRef<HTMLDivElement>(null);
  const boxRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const canAdd = own === undefined;
  const editable = (i: number) => canAdd || shapes[i]?.id === own;

  const point = (e: PointerEvent): Point => {
    const r = frame.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const setBox = (i: number, box: Box) => onChange(shapes.map((s, k) => (k === i ? { ...s, box } : s)));
  const add = (box: Box) => {
    onChange([...shapes, { box, label: '' }]);
    onSelect(shapes.length);
  };
  const remove = (i: number) => {
    onChange(shapes.filter((_, k) => k !== i));
    onSelect(Math.max(0, i - 1));
  };

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    const i = Number(target.closest<HTMLElement>('[data-box]')?.dataset.box ?? -1);
    const from = point(e);
    if (i >= 0 && editable(i)) {
      onSelect(i);
      setDrag({ i, how: target.dataset.handle ? 'resize' : 'move', from, start: shapes[i].box });
    } else if (i < 0 && canAdd) {
      setDrag({ i: shapes.length, how: 'draw', from, start: spanBox(from, from) });
    } else return;
    e.preventDefault();
    frame.current?.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const p = point(e);
    if (drag.how !== 'draw') return setBox(drag.i, dragBox(drag.start, drag.from, p, drag.how));
    const box = spanBox(drag.from, p);
    if (drag.i < shapes.length) setBox(drag.i, box);
    else if (box.w >= MIN_DRAWN && box.h >= MIN_DRAWN) add(box);
  };
  const up = () => {
    if (drag?.how === 'draw' && drag.i < shapes.length) boxRefs.current[drag.i]?.focus();
    setDrag(null);
  };

  return (
    <div className="occl-editor">
      <div
        ref={frame}
        className={`occl-frame${canAdd ? ' drawable' : ''}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <img src={src(image)} alt={alt} draggable={false} />
        {shapes.map((s, i) => (
          <button
            key={i}
            type="button"
            ref={(el) => {
              boxRefs.current[i] = el;
            }}
            data-box={i}
            className={`occl-box edit${i === selected ? ' selected' : ''}`}
            style={place(s.box)}
            disabled={!editable(i)}
            aria-label={t('browse.editor.occlusion.box', { n: i + 1, label: s.label || '…' })}
            onFocus={() => onSelect(i)}
            onKeyDown={(e) => {
              const box = nudge(s.box, e.key, e.shiftKey);
              if (box) setBox(i, box);
              // i18n-ignore: key names
              else if (canAdd && (e.key === 'Delete' || e.key === 'Backspace')) remove(i);
              else return;
              e.preventDefault();
            }}
          >
            <span className="occl-num" aria-hidden="true">
              {i + 1}
            </span>
            {editable(i) && <span className="occl-handle" data-handle="1" aria-hidden="true" />}
          </button>
        ))}
      </div>
      <p className="small muted">{t(canAdd ? 'browse.editor.occlusion.help' : 'browse.editor.occlusion.helpEdit')}</p>
      {canAdd && (
        <button type="button" className="btn ghost" onClick={() => add(NEW_BOX)}>
          {t('browse.editor.occlusion.add')}
        </button>
      )}
      <ol className="occl-labels">
        {shapes.map((s, i) =>
          editable(i) ? (
            <li key={i} className={i === selected ? 'selected' : undefined}>
              <label className="lbl" htmlFor={`${uid}-${i}`}>
                {t('browse.editor.occlusion.label', { n: i + 1 })}
              </label>
              <div className="row">
                <input
                  id={`${uid}-${i}`}
                  className="input grow"
                  value={s.label}
                  onFocus={() => onSelect(i)}
                  onChange={(e) => onChange(shapes.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))}
                  placeholder={t('browse.editor.occlusion.labelPlaceholder')}
                />
                {canAdd && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => remove(i)}
                    aria-label={t('browse.editor.occlusion.remove', { n: i + 1 })}
                  >
                    ✕
                  </button>
                )}
              </div>
            </li>
          ) : null,
        )}
      </ol>
    </div>
  );
}
