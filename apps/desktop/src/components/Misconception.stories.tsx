// Misconception stories (#202): a wrong choice's correction inside wrong feedback, and a long translation.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createElement as h } from 'react';
import i18next from '../i18n';
import { Feedback } from './Feedback';
import { Misconception } from './Misconception';
import { TELUGU_LONG } from './story-samples';

const t = i18next.t;

const meta = {
  component: Misconception,
  args: {
    lead: t('ex.mcq.mixUp'),
    answer: t('common.correctIs', { answer: t('levels.apply') }),
    children: t('browse.editor.corrections.placeholder'),
  },
  decorators: [(Story) => h(Feedback, { tone: 'wrong', children: h(Story) })],
} satisfies Meta<typeof Misconception>;
export default meta;

type Story = StoryObj<typeof meta>;

export const InWrongFeedback: Story = {};
export const LongTelugu: Story = { args: { lead: TELUGU_LONG, children: TELUGU_LONG } };
