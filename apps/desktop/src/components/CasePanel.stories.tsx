// CasePanel stories (#209): the case above a question of a case chain, and a long translation.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { CasePanel } from './CasePanel';
import { TELUGU_LONG } from './story-samples';

const t = i18next.t;

const meta = {
  component: CasePanel,
  args: { label: t('ex.case.label'), children: t('browse.editor.case.placeholder') },
} satisfies Meta<typeof CasePanel>;
export default meta;

type Story = StoryObj<typeof meta>;

export const AboveAQuestion: Story = {};
export const LongTelugu: Story = { args: { label: TELUGU_LONG, children: `${TELUGU_LONG} ${TELUGU_LONG}` } };
