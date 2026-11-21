// Card text as safe HTML, with math (\( … \), \[ … \], $$ … $$) typeset by KaTeX.
// Order matters: the shared-deck sanitiser runs first on the whole text, then only the formulas go to KaTeX,
// which escapes everything it outputs. KaTeX runs untrusted (no \href, \url, \html…, \includegraphics).
import katex from 'katex';
import { sanitizeHtml } from '@lernlab/core/cards';
import { hasMath, splitMath } from '@lernlab/core/math';
import { stripHtml } from '@lernlab/core/text';

const OPTIONS = {
  throwOnError: false, // a broken formula shows inline, in the error colour, with the message as its title
  errorColor: 'var(--color-incorrect)',
  trust: false,
  output: 'htmlAndMathml', // the MathML is what screen readers read
  strict: 'ignore',
  maxSize: 20, // em: no formula bigger than the screen
  maxExpand: 500, // stops macros that expand forever
} as const;

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function tex(source: string, displayMode: boolean): string {
  try {
    return katex.renderToString(source, { ...OPTIONS, displayMode });
  } catch {
    return `<span class="katex-error">${escape(source)}</span>`;
  }
}

/** Sanitised card HTML with its formulas rendered. Text without math is returned exactly as sanitised. */
export function renderCardHtml(html: string): string {
  const safe = sanitizeHtml(html);
  if (!hasMath(safe)) return safe;
  // Inside a formula, the sanitiser's &lt; and any leftover safe tag (<br> from the editor) are TeX source again.
  return splitMath(safe)
    .map((p) => ('tex' in p ? tex(stripHtml(p.tex), p.display) : p.text))
    .join('');
}
