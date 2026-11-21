// One shared ESLint config for every package. Formatting is Prettier's job, so style rules are off.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/** A hex, rgb() or hsl() colour inside a string (an esquery regex). */
const RAW_COLOUR = '/#[0-9a-fA-F]{3,8}\\b|rgba?\\(|hsla?\\(/';
const NO_RAW_COLOUR = 'No raw colours: use a design token, e.g. var(--color-accent).';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/dist/',
      '**/dist-electron/',
      'release/',
      'data/',
      'examples/',
      '**/storybook-static/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-irregular-whitespace': ['error', { skipRegExps: true }],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      '@typescript-eslint/no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
    },
  },
  {
    // The engine runs anywhere (desktop now, phone later): no platform, UI, HTTP or storage imports.
    // Platform services come in through the Host port (packages/core/src/host.ts).
    files: ['packages/core/src/**'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['node:*'], message: 'Core is platform-free. Add what you need to the Host port.' },
            { group: ['react', 'react-dom', 'react/*'], message: 'Core has no UI code.' },
            { group: ['electron'], message: 'Core has no Electron code.' },
            { group: ['hono', 'hono/*', '@hono/*'], message: 'Core has no HTTP code.' },
            { group: ['@lernlab/*'], message: 'Core imports nothing internal.' },
          ],
        },
      ],
    },
  },
  {
    // Colours come only from the design tokens (docs/design/tokens.json → packages/ui/tokens.css), so a
    // theme change reaches every screen. CSS files have the same check in packages/ui/src/raw-colours.test.ts.
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    ignores: ['**/*.test.ts', 'packages/ui/src/tokens.ts', 'packages/ui/src/build-tokens.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${RAW_COLOUR}]`, message: NO_RAW_COLOUR },
        { selector: `TemplateElement[value.raw=${RAW_COLOUR}]`, message: NO_RAW_COLOUR },
      ],
    },
  },
  {
    // Tests build partial fixtures and poke at results; `any` is fine there.
    files: ['**/*.test.ts', '**/test/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    // The v0.2 prototype uses `any` in many places. It is tightened as the code moves into
    // packages/core (#6) and behind the typed IPC bridge (#7); new packages keep the error.
    files: ['apps/desktop/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  },
  prettier,
);
