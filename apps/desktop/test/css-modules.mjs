// Lets `npm test` (Node, no bundler) import a component that imports its CSS Module: every class name
// maps to itself, so `styles.segmented` is "segmented" in the rendered HTML. Vite does the real work in
// the app and in Storybook. Loaded with `--import ./test/css-modules.mjs` (the test script in package.json).
import { register } from 'node:module';

const hooks = `
export async function load(url, context, next) {
  if (url.endsWith('.module.css')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default new Proxy({}, { get: (_, key) => (typeof key === "string" ? key : undefined) });',
    };
  }
  return next(url, context);
}`;

register('data:text/javascript,' + encodeURIComponent(hooks));
