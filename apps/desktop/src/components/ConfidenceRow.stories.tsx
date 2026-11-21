// ConfidenceRow stories (#205): a working "How sure were you?" row, so clicks, arrows and the keys 1–5 can be tried.
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Confidence } from '@lernlab/core/confidence';
import i18next from '../i18n';
import { ConfidenceRow } from './ConfidenceRow';
import { TELUGU_SHORT } from './story-samples';

const t = i18next.t;

function Demo({ initial, keys, label }: { initial: Confidence | null; keys: boolean; label?: string }) {
  const [value, setValue] = useState<Confidence | null>(initial);
  return (
    <ConfidenceRow
      id="story-confidence"
      label={label ?? t('ex.confidence.label')}
      low={t('ex.confidence.low')}
      high={t('ex.confidence.high')}
      names={[1, 2, 3, 4, 5].map((n) => t(`ex.confidence.level${n}`))}
      value={value}
      onPick={setValue}
      keys={keys}
    />
  );
}

const meta = {
  component: Demo,
  args: { initial: null, keys: true },
} satisfies Meta<typeof Demo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Chosen: Story = { args: { initial: 4 } };
export const ClickOnly: Story = { args: { keys: false } };
export const LongTelugu: Story = { args: { label: TELUGU_SHORT } };
