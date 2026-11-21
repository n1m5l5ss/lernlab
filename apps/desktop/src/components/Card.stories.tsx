// Card stories (issue #55): a card is a surface, so its stories show a heading and text on it.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { Card } from './Card';
import { CJK_LONG, CJK_SHORT, TELUGU_LONG, TELUGU_SHORT } from './story-samples';

const t = i18next.t;

const body = (heading: string, text: string) => (
  <>
    <h2 id="story-card">{heading}</h2>
    <p>{text}</p>
  </>
);

const meta = {
  component: Card,
  args: {
    as: 'section',
    'aria-labelledby': 'story-card',
    children: body(t('home.sessionLabel'), t('home.welcomeBody')),
  },
} satisfies Meta<typeof Card>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongTelugu: Story = { args: { children: body(TELUGU_SHORT, TELUGU_LONG) } };
export const LongCjk: Story = { args: { children: body(CJK_SHORT, CJK_LONG) } };
