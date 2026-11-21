// ProgressBar stories (issue #55). The bar has no visible text, so it has no long-text stories; its name
// is read out instead. The session bar is position: fixed, so its story pins it inside a small frame.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { ProgressBar } from './ProgressBar';

const t = i18next.t;

const meta = {
  component: ProgressBar,
  args: { value: 5, max: 12, label: t('session.blockProgress') },
} satisfies Meta<typeof ProgressBar>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Meter: Story = {};
export const MeterEmpty: Story = { args: { value: 0 } };
export const MeterFull: Story = { args: { value: 12 } };
export const Session: Story = {
  args: { variant: 'session' },
  decorators: [
    (Story) => (
      // A transform makes this frame the containing block of the fixed bar.
      <div style={{ transform: 'translateZ(0)', blockSize: 'var(--space-5)' }}>
        <Story />
      </div>
    ),
  ],
};
