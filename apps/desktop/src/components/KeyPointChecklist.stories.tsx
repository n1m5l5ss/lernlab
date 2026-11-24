// KeyPointChecklist stories (#199): an explain card's key points to tick, some ticked, and a long translation.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import i18next from '../i18n';
import { KeyPointChecklist, type KeyPointChecklistProps } from './KeyPointChecklist';
import { KEY_POINTS, TELUGU_LONG } from './story-samples';

const t = i18next.t;

/** The checklist with its own ticks, so the story can be clicked. */
function Interactive(props: KeyPointChecklistProps) {
  const [checked, setChecked] = useState(props.checked);
  return (
    <KeyPointChecklist
      {...props}
      checked={checked}
      onToggle={(i) => setChecked((c) => Object.assign([...c], { [i]: !c[i] }))}
    />
  );
}

const meta = {
  component: KeyPointChecklist,
  render: (args) => <Interactive {...args} />,
  args: {
    legend: t('ex.explain.pointsLegend'),
    points: KEY_POINTS,
    checked: [true, false, true],
    onToggle: () => {},
  },
} satisfies Meta<typeof KeyPointChecklist>;
export default meta;

type Story = StoryObj<typeof meta>;

export const SomeTicked: Story = {};
export const LongTelugu: Story = { args: { legend: TELUGU_LONG, points: [TELUGU_LONG, TELUGU_LONG] } };
