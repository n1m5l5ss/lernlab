import { test } from 'node:test';
import assert from 'node:assert/strict';
import { qa, parseCloze, sanitizeHtml, markdownLite, SAFE_TAGS } from './cards';

const base = {
  id: 1,
  deckId: 1,
  deck: 'x',
  image: null,
  video: null,
  category: null,
  article: null,
  word: '',
  sentenceHtml: '',
  sentence: '',
  sentenceMeaning: '',
  grammar: '',
  notes: '',
  audio: null,
  rank: 0,
  tags: [],
  group: null,
} as const;

test('language deck: meaning → foreign word', () => {
  const r = qa({
    ...base,
    lang: 'de',
    kind: 'noun',
    target: 'der Sohn',
    meaning: 'son',
    article: 'der',
    word: 'Sohn',
  } as any);
  assert.equal(r.prompt, 'son');
  assert.equal(r.answer, 'der Sohn');
  assert.equal(r.requireArticle, true);
});

test('Q→A when the back is short (AWS style)', () => {
  const r = qa({
    ...base,
    lang: null,
    kind: 'card',
    target: 'Which service provides object storage?',
    meaning: 'Amazon S3',
  } as any);
  assert.equal(r.answer, 'Amazon S3');
  assert.equal(r.typeable, true);
});

test('definition → term when only the front is short', () => {
  const r = qa({
    ...base,
    lang: null,
    kind: 'card',
    target: 'Mitochondrion',
    meaning: "The organelle that produces most of the cell's ATP through oxidative phosphorylation",
  } as any);
  assert.equal(r.answer, 'Mitochondrion');
});

test('both long → self-graded flip', () => {
  const r = qa({
    ...base,
    lang: null,
    kind: 'card',
    target: 'Explain the difference between TCP and UDP in detail please',
    meaning: 'TCP is connection-oriented and reliable; UDP is connectionless and faster but unreliable',
  } as any);
  assert.equal(r.typeable, false);
});

test('cloze parsing', () => {
  assert.deepEqual(parseCloze('The {{c1::mitochondria}} is the {{c2::powerhouse}} of the cell'), {
    before: 'The',
    answer: 'mitochondria',
    hint: '',
    after: 'is the powerhouse of the cell',
  });
  assert.equal(parseCloze('{{c1::Paris::capital}} is in France')!.hint, 'capital');
  assert.equal(parseCloze('no gaps'), null);
});

test('sanitizer strips scripts and attributes', () => {
  assert.equal(sanitizeHtml('<b onclick="x()">hi</b><script>alert(1)</script><img src=x onerror=y>'), '<b>hi</b>');
  assert.equal(sanitizeHtml('<a href="javascript:x">link</a>'), 'link');
});

test('sanitizer keeps only the safe list, bare, and never lets a tag rebuild itself', () => {
  for (const tag of SAFE_TAGS) {
    const out = sanitizeHtml(`<${tag} class="x" style="color:red">t</${tag}>`);
    assert.equal(out, tag === 'br' ? '<br>t</br>' : `<${tag}>t</${tag}>`, tag);
  }
  for (const bad of ['a', 'img', 'svg', 'iframe', 'form', 'input', 'video', 'style', 'math', 'table'])
    assert.ok(!sanitizeHtml(`<${bad}>x</${bad}>`).includes(`<${bad}`), bad);
  assert.equal(sanitizeHtml('<svg/onload=alert(1)>hi'), 'hi', 'a slash right after the name is still a tag');
  assert.equal(sanitizeHtml('<b/onclick=x()>hi</b>'), '<b>hi</b>');
  const rebuilt = sanitizeHtml('<<x>img src=x onerror=alert(1)>');
  assert.ok(!/<img/i.test(rebuilt), `no tag can be rebuilt from the pieces: ${rebuilt}`);
  assert.equal(sanitizeHtml('a < b and c > d'), 'a &lt; b and c > d', 'a stray < is text');
  const once = sanitizeHtml('<p>x <b>y</b></p> 1 < 2');
  assert.equal(sanitizeHtml(once), once, 'cleaning twice changes nothing');
});

test('markdown lite', () => {
  assert.equal(
    markdownLite('**S3** is *object* storage, see `aws s3 ls`'),
    '<b>S3</b> is <i>object</i> storage, see <code>aws s3 ls</code>',
  );
});
