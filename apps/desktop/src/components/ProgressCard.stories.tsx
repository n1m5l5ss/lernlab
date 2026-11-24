// ProgressCard stories (#214): a usual week, a first week with nothing yet, and long deck names.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next, { formatNumber, formatPercent } from '../i18n';
import type { CardText } from '../progress-card';
import { ProgressCard } from './ProgressCard';
import { CJK_LONG, DECK_NAMES, TELUGU_LONG } from './story-samples';

const t = i18next.t;
const of = (done: number, target: number) => t('progress.week.of', { done, target });

const week: CardText = {
  title: t('progress.card.heading'),
  subtitle: t('progress.card.weekOf', { date: '23 November 2026' }),
  stats: [
    { value: formatNumber(246), label: t('progress.card.learned', { count: 246 }) },
    { value: t('progress.card.daysValue', { count: 4 }), label: t('progress.card.days') },
    { value: formatNumber(55), label: t('progress.card.minutes', { count: 55 }) },
    { value: formatPercent(0.9), label: t('progress.card.recalled') },
  ],
  goalsTitle: t('progress.week.title'),
  goals: [
    { label: t('progress.week.cards'), value: of(28, 40), share: 0.7 },
    { label: t('progress.week.sessions'), value: of(5, 5), share: 1 },
  ],
  note: t('progress.week.exam', { deck: DECK_NAMES[0], date: '20 December', count: 25 }),
  decksTitle: t('progress.card.decks'),
  decks: [
    { name: DECK_NAMES[0], detail: t('progress.card.deckLearned', { learned: 180, count: 240 }), share: 0.75 },
    { name: DECK_NAMES[1], detail: t('progress.card.deckLearned', { learned: 66, count: 300 }), share: 0.22 },
  ],
  footer: t('progress.card.footer', { date: '25 November 2026' }),
};

const meta = { component: ProgressCard, args: { text: week } } satisfies Meta<typeof ProgressCard>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Week: Story = {};
export const FirstWeek: Story = {
  args: {
    text: {
      ...week,
      stats: week.stats.map((s, i) =>
        i === 3 ? { ...s, value: t('common.noDate') } : { ...s, value: formatNumber(0) },
      ),
      goals: [{ label: t('progress.week.sessions'), value: of(0, 3), share: 0 }],
      note: '',
      decks: [],
    },
  },
};
export const LongNames: Story = {
  args: {
    text: {
      ...week,
      decks: [
        { name: TELUGU_LONG, detail: t('progress.card.deckLearned', { learned: 12, count: 40 }), share: 0.3 },
        { name: CJK_LONG, detail: t('progress.card.deckLearned', { learned: 3, count: 900 }), share: 0.01 },
      ],
    },
  },
};
