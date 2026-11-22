// ConceptMapView stories (#219): a learner's map, a compared map with the three link tones, and long terms.
import type { Meta, StoryObj } from '@storybook/react-vite';
import { layoutTerms, parseMaps, termsOf } from '@lernlab/core/conceptmap';
import i18next from '../i18n';
import { ConceptMapView } from './ConceptMapView';
import { TELUGU_LONG } from './story-samples';

const t = i18next.t;
// The sample map is the one the deck editor shows as its placeholder.
const sample = parseMaps(t('decks.editor.mapsPlaceholder'))[0].links;
const terms = termsOf(sample);
const tones = ['matched', 'missing', 'extra'] as const;

const meta = {
  component: ConceptMapView,
  args: { nodes: layoutTerms(terms), label: t('cmap.yourMapAlt', { count: sample.length }), links: sample },
} satisfies Meta<typeof ConceptMapView>;
export default meta;

type Story = StoryObj<typeof meta>;

export const YourMap: Story = {};
export const Compared: Story = { args: { links: sample.map((l, i) => ({ ...l, tone: tones[i % 3] })) } };
export const LongTelugu: Story = {
  args: {
    nodes: layoutTerms([TELUGU_LONG, ...terms.slice(0, 2)]),
    links: [{ from: TELUGU_LONG, to: terms[0], label: TELUGU_LONG }],
  },
};
