// Feedback stories (issue #55): each tone shows colour, icon and word together.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { Feedback } from './Feedback';
import { CJK_LONG, TELUGU_LONG } from './story-samples';

const t = i18next.t;
const near = t('teacher.near.0');

const meta = {
  component: Feedback,
  args: { tone: 'right', children: t('ex.choice.right') },
} satisfies Meta<typeof Feedback>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Right: Story = {};
export const Wrong: Story = { args: { tone: 'wrong', children: t('ex.choice.wrong', { answer: 'der Hund' }) } };
export const Near: Story = { args: { tone: 'near', children: near } };
export const LongTelugu: Story = { args: { tone: 'wrong', children: t('common.correctIs', { answer: TELUGU_LONG }) } };
export const LongCjk: Story = { args: { tone: 'near', children: t('common.correctIs', { answer: CJK_LONG }) } };
