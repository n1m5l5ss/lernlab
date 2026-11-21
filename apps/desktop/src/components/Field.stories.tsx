// Input and Select stories (issue #55): plain, with a hint, with an error, disabled, and long text.
import type { Meta, StoryObj } from '@storybook/react-vite';
import i18next from '../i18n';
import { Input, Select } from './Field';
import { CJK_LONG, CJK_SHORT, TELUGU_LONG, TELUGU_SHORT } from './story-samples';

const t = i18next.t;

const meta = {
  component: Input,
  args: { id: 'story-input', label: t('settings.newPerDay'), type: 'number', defaultValue: 20 },
} satisfies Meta<typeof Input>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithHint: Story = { args: { hint: t('settings.newPerDayHint') } };
export const WithError: Story = { args: { defaultValue: 500, error: t('errors.invalid_input') } };
export const Disabled: Story = { args: { disabled: true } };
export const LongTelugu: Story = {
  args: { type: 'text', label: TELUGU_SHORT, hint: TELUGU_LONG, defaultValue: TELUGU_LONG },
};
export const LongCjk: Story = { args: { type: 'text', label: CJK_SHORT, hint: CJK_LONG, defaultValue: CJK_LONG } };

const themeOptions = (['system', 'light', 'dark'] as const).map((v) => (
  <option key={v} value={v}>
    {t(`settings.themeOption.${v}`)}
  </option>
));

export const SelectDefault: Story = {
  render: () => (
    <Select id="story-select" label={t('settings.theme')} hint={t('settings.languageHint')} defaultValue="light">
      {themeOptions}
    </Select>
  ),
};
export const SelectDisabled: Story = {
  render: () => (
    <Select id="story-select" label={t('settings.theme')} disabled defaultValue="light">
      {themeOptions}
    </Select>
  ),
};
