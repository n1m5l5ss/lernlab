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
    // The v0.2 prototype uses `any` in many places. It is tightened as the code moves into
    // packages/core (#6) and behind the typed IPC bridge (#7); new packages keep the error.
    files: ['apps/desktop/**'],
    rules: { '@typescript-eslint/no-explicit-any': 'warn' },
  },
  prettier,
);
