// SideBySide stories (#200): the two sides of a compare card, and a long translation.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { SideBySide } from './SideBySide';
import { TELUGU_LONG } from './story-samples';

const t = i18next.t;

const meta = {
  component: SideBySide,
  args: { label: t('ex.twin.sides'), left: t('levels.apply'), right: t('levels.analyse') },
} satisfies Meta<typeof SideBySide>;
export default meta;

type Story = StoryObj<typeof meta>;

export const TwoSides: Story = {};
export const LongTelugu: Story = { args: { left: TELUGU_LONG, right: TELUGU_LONG } };
