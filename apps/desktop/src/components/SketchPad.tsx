// SketchPad (#220): a small canvas to draw a card's meaning with a mouse, a finger or a pen, with Undo and
// Clear. Drawing needs a pointer, so the pad always comes with a text field: a learner who can't or doesn't
// want to draw describes the picture in words instead, and either one (or both) can be saved (WCAG 2.1.1).
// Plain <canvas>, no library. It holds no text of its own and saves nothing itself: the caller gets a PNG.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from './Button';
import { Input } from './Field';
import { addPoint, canSaveSketch, drawStrokes, padPoint, startStroke, undoStroke, type Stroke } from '../sketch-logic';
import styles from './SketchPad.module.css';

export type SketchPadLabels = {
  /** Names the drawing area for screen readers. */
  canvas: string;
  /** How to draw, and that words work too. */
  hint: string;
  undo: string;
  clear: string;
  /** The description field and its hint. */
  text: string;
  textHint: string;
  save: string;
  cancel: string;
};

export type SketchPadProps = {
  id: string;
  /** The drawing's size in pixels; the saved PNG has this size. */
  width: number;
  height: number;
  labels: SketchPadLabels;
  maxText: number;
  /** True while the caller is saving: the buttons wait. */
  busy?: boolean;
  /** Shown under the pad and announced. */
  error?: string;
  /** Strokes to start with (stories). */
  initial?: Stroke[];
  /** The drawing as a PNG (null when nothing was drawn) and the description. */
  onSave: (picture: Blob | null, text: string) => void;
  onCancel: () => void;
};

export function SketchPad(props: SketchPadProps) {
  const { id, width, height, labels, maxText, busy = false, error, initial, onSave, onCancel } = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(initial ?? []);
  const [text, setText] = useState('');
  const drawing = useRef<number | null>(null); // the pointer that is drawing
  // Twice the pixels on sharp screens; the saved picture stays `width` × `height`.
  const scale = typeof window === 'undefined' ? 1 : Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1)));

  // The ink is the page's text colour, so the pad is drawn again when the theme switches between light and
  // dark (the system's setting, or the app's own on <html>): at once, and again when the colours have settled.
  const [look, setLook] = useState(0);
  useEffect(() => {
    let timer = 0;
    const again = () => {
      setLook((n) => n + 1);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLook((n) => n + 1), 400);
    };
    const dark = window.matchMedia?.('(prefers-color-scheme: dark)');
    dark?.addEventListener('change', again);
    const theme = new MutationObserver(again);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      window.clearTimeout(timer);
      dark?.removeEventListener('change', again);
      theme.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawStrokes(ctx, strokes, { width, height, ink: getComputedStyle(el).color });
  }, [strokes, width, height, scale, look]);

  const at = (e: PointerEvent<HTMLCanvasElement>) =>
    padPoint(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), width, height);
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    if (busy || drawing.current !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    drawing.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = at(e);
    setStrokes((s) => startStroke(s, p));
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current !== e.pointerId) return;
    const p = at(e);
    setStrokes((s) => addPoint(s, p));
  };
  const up = (e: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current === e.pointerId) drawing.current = null;
  };

  const save = () => {
    if (!strokes.length) return onSave(null, text);
    const el = canvas.current;
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!el || !ctx) return onSave(null, text);
    const look = getComputedStyle(el);
    drawStrokes(ctx, strokes, { width, height, ink: look.color, paper: look.backgroundColor });
    out.toBlob((png) => onSave(png, text), 'image/png');
  };

  return (
    <div className={styles.pad}>
      <p id={`${id}-hint`} className={styles.hint}>
        {labels.hint}
      </p>
      <canvas
        ref={canvas}
        className={styles.canvas}
        width={width * scale}
        height={height * scale}
        style={{ aspectRatio: `${width} / ${height}`, maxWidth: width }}
        role="img"
        aria-label={labels.canvas}
        aria-describedby={`${id}-hint`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className={styles.tools}>
        <Button type="button" disabled={busy || !strokes.length} onClick={() => setStrokes(undoStroke)}>
          {labels.undo}
        </Button>
        <Button type="button" disabled={busy || !strokes.length} onClick={() => setStrokes([])}>
          {labels.clear}
        </Button>
      </div>
      <Input
        id={`${id}-text`}
        className={styles.text}
        label={labels.text}
        hint={labels.textHint}
        error={error}
        value={text}
        maxLength={maxText}
        autoFocus
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !busy && canSaveSketch(strokes, text)) save();
        }}
      />
      <div className={styles.actions}>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          {labels.cancel}
        </Button>
        <Button type="button" variant="primary" disabled={busy || !canSaveSketch(strokes, text)} onClick={save}>
          {labels.save}
        </Button>
      </div>
    </div>
  );
}
