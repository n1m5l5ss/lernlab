import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { renderCardHtml } from './math-render';

test('card text without math is only sanitised', () => {
  assert.equal(renderCardHtml('<b>bold</b> <img src=x onerror=alert(1)> $5'), '<b>bold</b>  $5');
});

test('inline and display math render with KaTeX, keeping MathML for screen readers', () => {
  const html = renderCardHtml('Area: \\(\\pi r^2\\)');
  assert.match(html, /^Area: <span class="katex">/);
  assert.match(html, /<math xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML">/);
  assert.match(html, /<annotation encoding="application\/x-tex">\\pi r\^2<\/annotation>/);
  assert.match(renderCardHtml('$$E=mc^2$$'), /class="katex-display"/);
  assert.match(renderCardHtml('\\[a\\]'), /class="katex-display"/);
});

test('a broken formula shows inline as an error instead of crashing', () => {
  const html = renderCardHtml('Oops \\(\\frac{1}{\\)');
  assert.match(html, /class="katex-error"/);
  assert.match(html, /^Oops /);
});

test('links, HTML and other trusted-only commands never get through', () => {
  for (const tex of [
    '\\href{javascript:alert(1)}{x}',
    '\\url{javascript:alert(1)}',
    '\\htmlClass{x}{y}',
    '\\htmlData{onclick=alert(1)}{y}',
    '\\includegraphics{http://example.com/a.png}',
  ]) {
    const html = renderCardHtml(`\\(${tex}\\)`);
    // The source stays readable as text (in the MathML annotation), but never as a link, image or attribute.
    assert.doesNotMatch(html, /<a[\s>]|\shref=|<img|\sdata-|\sclass="(x|y)"/i, tex);
  }
  // Tags are removed by the sanitiser before KaTeX sees anything, even inside a formula.
  assert.doesNotMatch(renderCardHtml('\\(x <script>alert(1)</script> y\\)'), /<script|alert/);
  assert.doesNotMatch(renderCardHtml('\\(<img src=x onerror=alert(1)>\\)'), /<img|onerror/);
});

test('characters the sanitiser escapes reach KaTeX as themselves', () => {
  const html = renderCardHtml('\\(a < b \\& c > d\\)');
  assert.match(html, /<annotation encoding="application\/x-tex">a &lt; b \\&amp; c &gt; d<\/annotation>/);
});

test('huge or looping macros are cut off instead of freezing the window', () => {
  const html = renderCardHtml('\\(\\def\\a{\\a\\a}\\a\\)');
  assert.match(html, /katex-error/);
});

test('KaTeX fonts and styles are bundled, never loaded from the network', () => {
  const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
  assert.match(main, /import 'katex\/dist\/katex\.min\.css'/);
  const css = readFileSync(createRequire(import.meta.url).resolve('katex/dist/katex.min.css'), 'utf8');
  assert.doesNotMatch(css, /url\(["']?https?:/);
});
