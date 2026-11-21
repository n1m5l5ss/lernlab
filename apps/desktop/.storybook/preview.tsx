// Every story gets the app's fonts, tokens and styles, plus two toolbar switches: theme (light/dark)
// and direction (left to right / right to left). The visual test sets them through the URL.
import type { Preview } from '@storybook/react-vite';
import '../src/i18n';
import '@lernlab/ui/fonts.css';
import '@lernlab/ui/tokens.css';
import '../src/styles.css';

const preview: Preview = {
  globalTypes: {
    theme: { toolbar: { title: 'Theme', icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true } },
    dir: { toolbar: { title: 'Direction', icon: 'transfer', items: ['ltr', 'rtl'], dynamicTitle: true } },
  },
  initialGlobals: { theme: 'light', dir: 'ltr' },
  parameters: { layout: 'padded' },
  decorators: [
    (Story, { globals }) => {
      const root = document.documentElement;
      root.dataset.theme = globals.theme === 'dark' ? 'dark' : 'light';
      root.dir = globals.dir === 'rtl' ? 'rtl' : 'ltr';
      return <Story />;
    },
  ],
};

export default preview;
