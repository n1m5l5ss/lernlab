// Button stories (issue #55). Theme and direction are toolbar globals; hover and focus are driven by the
// visual test (apps/desktop/visual), so each story is one variant or one kind of text.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { Button } from './Button';
import { CJK_LONG, TELUGU_LONG } from './story-samples';

const t = i18next.t;

const meta = {
  component: Button,
  args: { children: t('common.continue') },
} satisfies Meta<typeof Button>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Primary: Story = { args: { variant: 'primary', children: t('home.startStudying') } };
export const Good: Story = { args: { variant: 'good', children: t('ex.typed.iWasRight') } };
export const Ghost: Story = { args: { variant: 'ghost', children: t('common.cancel') } };
export const Danger: Story = { args: { variant: 'danger', children: t('common.delete') } };
export const Disabled: Story = { args: { disabled: true } };
export const PrimaryDisabled: Story = { args: { variant: 'primary', disabled: true } };
export const LongTelugu: Story = { args: { variant: 'primary', children: TELUGU_LONG } };
export const LongCjk: Story = { args: { children: CJK_LONG } };
