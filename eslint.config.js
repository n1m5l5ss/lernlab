// One shared ESLint config for every package. Formatting is Prettier's job, so style rules are off.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/node_modules/', '**/dist/', '**/dist-electron/', 'release/', 'data/', 'examples/'] },
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
