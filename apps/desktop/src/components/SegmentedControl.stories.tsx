// SegmentedControl stories (issue #55): a working radio group, so arrow keys can be tried in Storybook.
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';
import { CJK_SHORT, TELUGU_SHORT } from './story-samples';

const t = i18next.t;

type Length = 'short' | 'medium' | 'long';
const minutes = (count: number) => t('home.lengthMinutes', { count });
const LENGTHS: SegmentedOption<Length>[] = [
  { value: 'short', label: minutes(5) },
  { value: 'medium', label: minutes(10) },
  { value: 'long', label: minutes(20) },
];

function Demo({ initial, options }: { initial: Length | null; options: SegmentedOption<Length>[] }) {
  const [value, setValue] = useState<Length | null>(initial);
  return <SegmentedControl value={value} options={options} onChange={setValue} label={t('home.sessionLength')} />;
}

const meta = {
  component: Demo,
  args: { initial: 'medium', options: LENGTHS },
} satisfies Meta<typeof Demo>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const NoneChosen: Story = { args: { initial: null } };
export const LongTelugu: Story = {
  args: { options: LENGTHS.map((o, i) => ({ ...o, label: `${TELUGU_SHORT} ${i + 1}` })) },
};
export const LongCjk: Story = {
  args: { options: LENGTHS.map((o, i) => ({ ...o, label: `${CJK_SHORT} ${i + 1}` })) },
};
