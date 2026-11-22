// SketchPad stories (#220): a working pad, so drawing, Undo, Clear and the description can be tried.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SKETCH } from '@lernlab/core/sketch';
import i18next from '../i18n';
import type { Stroke } from '../sketch-logic';
import { SketchPad } from './SketchPad';

const t = i18next.t;

/** A little house, so Undo and Clear have something to work on. */
const HOUSE: Stroke[] = [
  [
    [140, 260],
    [140, 150],
    [340, 150],
    [340, 260],
    [140, 260],
  ],
  [
    [120, 150],
    [240, 60],
    [360, 150],
  ],
  [
    [220, 260],
    [220, 200],
    [260, 200],
    [260, 260],
  ],
];

function Demo({ drawn, busy, failed }: { drawn: boolean; busy: boolean; failed: boolean }) {
  return (
    <SketchPad
      id="story-sketch"
      width={SKETCH.width}
      height={SKETCH.height}
      maxText={SKETCH.maxText}
      busy={busy}
      error={failed ? t('errors.sketch_too_big', { kb: Math.round(SKETCH.maxBytes / 1024) }) : undefined}
      initial={drawn ? HOUSE : undefined}
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
      onSave={() => undefined}
      onCancel={() => undefined}
    />
  );
}

const meta = {
  component: Demo,
  args: { drawn: false, busy: false, failed: false },
} satisfies Meta<typeof Demo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const Drawn: Story = { args: { drawn: true } };
export const Saving: Story = { args: { drawn: true, busy: true } };
export const Failed: Story = { args: { drawn: true, failed: true } };
