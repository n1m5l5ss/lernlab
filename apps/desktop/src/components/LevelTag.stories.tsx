// LevelTag stories (#198): the three question levels, and a long translation.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { LevelTag } from './LevelTag';
import { TELUGU_LONG } from './story-samples';

const t = i18next.t;

const meta = {
  component: LevelTag,
  args: { level: 'recall', children: t('levels.recall') },
} satisfies Meta<typeof LevelTag>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Recall: Story = {};
export const Apply: Story = { args: { level: 'apply', children: t('levels.apply') } };
export const Analyse: Story = { args: { level: 'analyse', children: t('levels.analyse') } };
export const LongTelugu: Story = { args: { level: 'apply', children: TELUGU_LONG } };
