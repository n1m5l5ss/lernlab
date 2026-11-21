// Sidebar stories (issue #55): the app's navigation, with the current page marked.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { Sidebar, type SidebarItem } from './Sidebar';
import { CJK_LONG, TELUGU_LONG } from './story-samples';

const t = i18next.t;

const icon = <path d="M4 11l8-7 8 7v9H4z" />;
const link = (key: string, label: string, current = false): SidebarItem => ({
  key,
  href: `#/${key}`,
  label,
  icon,
  current,
});
const MAIN = (['home', 'decks', 'cards', 'progress'] as const).map((key, i) => link(key, t(`nav.${key}`), i === 0));

const meta = {
  component: Sidebar,
  args: { label: t('nav.label'), title: t('app.name'), items: MAIN, footer: [link('settings', t('nav.settings'))] },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', blockSize: '420px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LongTelugu: Story = { args: { items: [link('home', TELUGU_LONG, true), ...MAIN.slice(1)] } };
export const LongCjk: Story = { args: { items: [MAIN[0], link('decks', CJK_LONG), ...MAIN.slice(2)] } };
