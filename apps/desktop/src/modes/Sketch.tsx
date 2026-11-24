// The learner's own sketch for a card (#220). `SketchOffer` sits on the "new card" screen: an optional
// "Draw it" that opens the pad; skipping it costs nothing. `SketchCue` shows the saved picture (or the
// description) with the answer on later reviews, with a way to remove it. Neither logs an answer or changes
// a grade. Keys pressed inside either stay there, so typing a description never answers the exercise.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Item } from '@lernlab/core/types';
import { SKETCH } from '@lernlab/core/sketch';
import { mediaUrl } from '../bridge';
import { Button, SketchPad } from '../components';
import { controlOwnsKey } from '../keys-logic';
import type { Ctx } from '../ctx';

type SketchCtx = Pick<Ctx, 'sketches'>;

/** Keys typed in the pad or pressed on a focused button are not the exercise's shortcuts. Escape still leaves. */
const keepKeys = (all: boolean) => (e: KeyboardEvent) => {
  if (e.key === 'Escape') return;
  if (all || controlOwnsKey(e.key, e.target as Element | null)) e.stopPropagation();
};

export function SketchCue({ ctx, item, attempted }: { ctx: SketchCtx; item: Item; attempted: boolean }) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const sketch = ctx.sketches?.of(item.id);
  if (!sketch || !attempted) return null;
  return (
    <figure className="sketchcue" onKeyDown={keepKeys(false)}>
      <figcaption className="sketchcue-lead small">{t('ex.sketch.lead')}</figcaption>
      {sketch.file && (
        <img src={mediaUrl(sketch.file)} alt={t('ex.sketch.alt')} width={SKETCH.width / 2} height={SKETCH.height / 2} />
      )}
      {sketch.text && <div className="sketchcue-text">{sketch.text}</div>}
      {asking ? (
        <div className="sketchcue-remove small" role="group" aria-label={t('ex.sketch.removeAsk')}>
          <span>{t('ex.sketch.removeAsk')}</span>
          <Button type="button" variant="danger" onClick={() => void ctx.sketches?.remove(item.id)}>
            {t('ex.sketch.removeYes')}
          </Button>
          <Button type="button" autoFocus onClick={() => setAsking(false)}>
            {t('ex.sketch.removeNo')}
          </Button>
        </div>
      ) : (
        <button type="button" className="btn sketch-btn" onClick={() => setAsking(true)}>
          {t('ex.sketch.remove')}
        </button>
      )}
    </figure>
  );
}

export function SketchOffer({
  ctx,
  item,
  open,
  onOpen,
}: {
  ctx: SketchCtx;
  item: Item;
  open: boolean;
  onOpen: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus(); // back to where the pad was opened from
    wasOpen.current = open;
  }, [open]);
  const sketches = ctx.sketches;
  if (!sketches) return null;
  const has = !!sketches.of(item.id);

  const save = async (picture: Blob | null, text: string) => {
    setBusy(true);
    setError('');
    try {
      await sketches.save(item.id, picture ? new Uint8Array(await picture.arrayBuffer()) : null, text);
      onOpen(false);
    } catch (e) {
      setError((e as Error).message || t('errors.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <div className="sketchoffer" onKeyDown={keepKeys(false)}>
        <SketchCue ctx={ctx} item={item} attempted />
        <button ref={button} type="button" className="btn sketch-btn" onClick={() => onOpen(true)}>
          {t(has ? 'ex.sketch.again' : 'ex.sketch.draw')}
        </button>
        {!has && <div className="small muted">{t('ex.sketch.why')}</div>}
      </div>
    );
  return (
    <section className="sketchoffer" aria-label={t('ex.sketch.title')} onKeyDown={keepKeys(true)}>
      <SketchPad
        id={`sketch-${item.id}`}
        width={SKETCH.width}
        height={SKETCH.height}
        maxText={SKETCH.maxText}
        busy={busy}
        error={error}
        labels={{
          canvas: t('ex.sketch.canvas'),
          hint: t('ex.sketch.hint'),
          undo: t('ex.sketch.undo'),
          clear: t('ex.sketch.clear'),
          text: t('ex.sketch.text'),
          textHint: t('ex.sketch.textHint'),
          save: t('ex.sketch.save'),
          cancel: t('ex.sketch.cancel'),
        }}
        onSave={(picture, text) => void save(picture, text)}
        onCancel={() => onOpen(false)}
      />
    </section>
  );
}
