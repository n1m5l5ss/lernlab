// GraphPlot stories (#210): a line, a curve with poles, and a line through points.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { parseGraph, plotGraph } from '@lernlab/core/graph';
import i18next, { formatNumber } from '../i18n';
import { GraphPlot } from './GraphPlot';

const t = i18next.t;
const plot = (line: string) => plotGraph(parseGraph(line)!);

const meta = {
  component: GraphPlot,
  args: {
    plot: plot('y = 2x + 1'),
    label: t('ex.graph.alt', { from: formatNumber(-5), to: formatNumber(5), points: '(0, 1), (2.5, 6)' }),
    formatTick: (n: number) => formatNumber(n),
  },
} satisfies Meta<typeof GraphPlot>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Line: Story = {};
export const Parabola: Story = { args: { plot: plot('y = x^2 - 1; x = -3..3') } };
export const WithPoles: Story = { args: { plot: plot('y = tan(x)') } };
export const Points: Story = { args: { plot: plot('(0,1) (1,3) (2,2) (3,5)') } };
