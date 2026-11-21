import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCode, codeKey, codeTask, GAP, highlight, langName, normalizeCode } from './code';

const kinds = (code: string, lang: string) =>
  highlight(code, lang)
    .filter((t) => t.kind)
    .map((t) => `${t.kind}:${t.text}`);

test('highlights keywords, strings, comments and numbers, and keeps every character', () => {
  const py = 'def f(x):\n    # twice\n    return x * 2  # "not a string"\nprint(f("a#b"))';
  assert.deepEqual(kinds(py, 'python'), [
    'keyword:def',
    'comment:# twice',
    'keyword:return',
    'number:2',
    'comment:# "not a string"',
    'string:"a#b"',
  ]);
  assert.equal(
    highlight(py, 'python')
      .map((t) => t.text)
      .join(''),
    py,
    'the tokens are the code, nothing added or lost',
  );
  assert.deepEqual(kinds('const s = `a\nb`; /* x */ let n = 0x1F;', 'js'), [
    'keyword:const',
    'string:`a\nb`',
    'comment:/* x */',
    'keyword:let',
    'number:0x1F',
  ]);
  assert.deepEqual(kinds('SELECT name FROM t -- all', 'sql'), ['keyword:SELECT', 'keyword:FROM', 'comment:-- all']);
  assert.deepEqual(kinds('"""doc\nstring""" + \'x\'', 'py'), ['string:"""doc\nstring"""', "string:'x'"]);
  assert.deepEqual(kinds('x = "open', 'python'), ['string:"open'], 'an unclosed string ends at the line end');
});

test('unknown languages and card markup stay plain text', () => {
  assert.deepEqual(highlight('<script>alert(1)</script>', 'html'), [{ kind: null, text: '<script>alert(1)</script>' }]);
  assert.deepEqual(highlight('if x', ''), [{ kind: null, text: 'if x' }]);
  assert.equal(langName('PY'), 'Python');
  assert.equal(langName('cobol'), 'cobol');
  assert.equal(langName(''), '');
});

test('code keeps its indentation; only line ends and outer blank lines are tidied', () => {
  assert.equal(normalizeCode('\r\n\n  if x:\r\n\t  y()   \n\n'), '  if x:\n\t  y()');
});

test('typed code answers: whitespace rules, case and every character matter', () => {
  assert.equal(codeKey('[1,  2,\n 3]'), codeKey('[1, 2, 3]'), 'spaces next to punctuation do not matter');
  assert.equal(codeKey('1\n2\n3'), codeKey('1 2 3'), 'a line break counts as a space');
  assert.equal(codeKey(' hello world '), 'hello world');
  assert.notEqual(codeKey('hello world'), codeKey('helloworld'), 'a space between words matters');
  assert.notEqual(codeKey('True'), codeKey('true'), 'case matters');
  assert.equal(codeKey('“hi”'), codeKey('"hi"'), 'smart quotes from the keyboard are plain quotes');
  assert.equal(checkCode('[1, 2, 3]', ['[1,2,3]']).correct, true);
  assert.equal(checkCode('[1, 2, 4]', ['[1,2,3]']).correct, false, 'no typo forgiveness');
  assert.equal(checkCode('', ['x']).correct, false);
  assert.equal(checkCode('42', ['41', '42']).matched, '42');
});

const card = (code: string, back = '', codeLang = 'python') => ({
  kind: 'code' as const,
  meaning: back,
  extra: { code, codeLang },
});

test('a code card is asked one of three ways, chosen from its content', () => {
  const fill = codeTask(card('for i in {{c1::range}}(3):\n    print(i)'));
  assert.deepEqual(fill, {
    mode: 'fill',
    lang: 'python',
    code: `for i in ${GAP}(3):\n    print(i)`,
    answer: 'range',
    hint: '',
  });
  const hinted = codeTask(card('x {{c1::+=::operator}} 1; y = {{c2::2}}'));
  assert.ok(hinted?.mode === 'fill');
  assert.equal(hinted.hint, 'operator');
  assert.equal(hinted.code, `x ${GAP} 1; y = 2`, 'other gaps are filled in');
  assert.deepEqual(codeTask(card('print(1 + 1)', '2')), {
    mode: 'output',
    lang: 'python',
    code: 'print(1 + 1)',
    answer: '2',
  });
  assert.deepEqual(codeTask(card('a = 1\n\n    b = 2\nc = a + b')), {
    mode: 'order',
    lang: 'python',
    lines: ['a = 1', '    b = 2', 'c = a + b'],
  });
  assert.equal(codeTask(card('one line')), null, 'nothing to ask');
  assert.equal(codeTask({ kind: 'card', meaning: '', extra: {} }), null);
});
