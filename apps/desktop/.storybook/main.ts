// Storybook for the base components (issue #55; docs/TESTING.md, "A new button must not break other
// buttons"). The components live in apps/desktop/src/components, next to the screens that use them, so
// Storybook lives in this workspace too and reuses its Vite config. Run `npm run storybook`.
import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/components/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: {} },
  // Local and private (principle 4): no usage data, no "what's new" fetches.
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
};

export default config;
