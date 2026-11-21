// The base components' roles, ARIA wiring and classes, rendered to HTML (no DOM needed).
// Written without JSX so the hard-coded-text check in i18n.test.ts never mistakes test strings for UI text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Button,
  Card,
  ConfidenceRow,
  Feedback,
  Input,
  KeyPointChecklist,
  LevelTag,
  Misconception,
  ProgressBar,
  SegmentedControl,
  Select,
  Sidebar,
} from './index';

const html = (el: ReactElement) => renderToStaticMarkup(el);

test('Button adds its variant to the shared .btn style', () => {
  assert.equal(html(h(Button, null, 'Go')), '<button class="btn">Go</button>');
  assert.equal(
    html(h(Button, { variant: 'primary', className: 'home-start', disabled: true }, 'Go')),
    '<button disabled="" class="btn primary home-start">Go</button>',
  );
  assert.match(html(h(Button, { variant: 'danger' }, 'x')), /class="btn danger"/);
});

test('Card renders a div or a labelled section', () => {
  assert.equal(html(h(Card, null, 'x')), '<div class="card">x</div>');
  assert.equal(
    html(h(Card, { as: 'section', className: 'wide', 'aria-labelledby': 'h' }, 'x')),
    '<section aria-labelledby="h" class="card wide">x</section>',
  );
});

test('ProgressBar is a named progressbar with its range and value', () => {
  const out = html(h(ProgressBar, { value: 3, max: 12, label: 'Block progress', variant: 'session' }));
  assert.match(out, /^<div class="session-bar" role="progressbar"/);
  assert.match(out, /aria-label="Block progress"/);
  assert.match(out, /aria-valuemin="0" aria-valuemax="12" aria-valuenow="3"/);
  assert.match(out, /<i style="width:25%"><\/i>/);
});

test('ProgressBar can be named by a heading and clamps its value', () => {
  const out = html(h(ProgressBar, { value: 30, max: 20, labelledBy: 'home-level', valueText: '30 of 20' }));
  assert.match(out, /class="meter"/);
  assert.match(out, /aria-labelledby="home-level"/);
  assert.doesNotMatch(out, /aria-label=/);
  assert.match(out, /aria-valuenow="20"/);
  assert.match(out, /aria-valuetext="30 of 20"/);
  assert.match(out, /width:100%/);
});

test('Feedback is announced and carries its tone (the CSS adds colour and icon)', () => {
  assert.equal(
    html(h(Feedback, { tone: 'right', children: 'Correct!' })),
    '<div role="status" class="feedback right">Correct!</div>',
  );
  assert.match(
    html(h(Feedback, { tone: 'wrong', urgent: true, children: 'Not quite' })),
    /role="alert" class="feedback wrong"/,
  );
  assert.match(html(h(Feedback, { tone: 'near', children: 'Almost' })), /class="feedback near"/);
});

test('Input ties its label, hint and error to the control', () => {
  const plain = html(h(Input, { id: 'goal', label: 'Daily goal', type: 'number' }));
  assert.match(plain, /<label for="goal">Daily goal<\/label>/);
  assert.match(plain, /<input type="number" id="goal" class="input"\/>/);
  assert.doesNotMatch(plain, /aria-describedby|aria-invalid/);

  const full = html(h(Input, { id: 'goal', label: 'Daily goal', hint: '1 to 5', error: 'Too many' }));
  assert.match(full, /<span id="goal-hint" class="field-hint">1 to 5<\/span>/);
  assert.match(full, /aria-describedby="goal-hint goal-error" aria-invalid="true"/);
  assert.match(full, /<span id="goal-error" class="field-error" role="alert">Too many<\/span>/);
});

test('Select takes a label, a hint, a layout class and its options', () => {
  const out = html(
    h(
      Select,
      { id: 'theme', label: 'Theme', hint: 'Follows the system', className: 'field settings-row', defaultValue: 'b' },
      h('option', { value: 'a' }, 'A'),
      h('option', { value: 'b' }, 'B'),
    ),
  );
  assert.match(out, /^<div class="field-control field settings-row"><span class="field-text"><label for="theme">/);
  assert.match(out, /<select id="theme" class="input" aria-describedby="theme-hint">/);
  assert.match(out, /<option value="b" selected="">B<\/option>/);
});

test('SegmentedControl is a radio group with one tab stop', () => {
  const options = [
    { value: 'short', label: '5 min' },
    { value: 'medium', label: '10 min' },
    { value: 'long', label: '20 min' },
  ];
  const out = html(h(SegmentedControl, { value: 'medium', options, onChange: () => {}, labelledBy: 'len' }));
  assert.match(out, /^<div class="segmented" role="radiogroup" aria-labelledby="len">/);
  assert.equal(out.match(/role="radio"/g)?.length, 3);
  assert.match(out, /aria-checked="true" tabindex="0">10 min</);
  assert.equal(out.match(/tabindex="-1"/g)?.length, 2);
  assert.match(
    html(h(SegmentedControl, { value: null, options, onChange: () => {}, label: 'Length' })),
    /aria-label="Length"/,
  );
});

test('Sidebar is a named navigation landmark that marks the current page', () => {
  const item = (key: string, current = false) => ({
    key,
    href: `#/${key}`,
    label: key,
    icon: h('path', { d: 'M0 0' }),
    current,
  });
  const out = html(
    h(Sidebar, {
      label: 'Main',
      title: 'LernLab',
      items: [item('home', true), item('decks')],
      footer: [item('settings')],
    }),
  );
  assert.match(out, /^<nav class="sidebar" aria-label="Main"><div class="sidebar-name">LernLab<\/div>/);
  assert.match(out, /<a class="nav-link" href="#\/home" aria-current="page"><svg aria-hidden="true"/);
  assert.match(out, /<a class="nav-link" href="#\/decks"><svg/);
  assert.match(out, /<div class="grow"><\/div><a class="nav-link footer" href="#\/settings">/);
});

test('ConfidenceRow is a labelled radio group of 1 to 5 with one tab stop, named for screen readers', () => {
  const names = ['1 guess', '2', '3', '4', '5 certain'];
  const props = { id: 'cf', label: 'How sure?', low: 'Guess', high: 'Certain', names, onPick: () => {} };
  const none = html(h(ConfidenceRow, { ...props, value: null }));
  assert.match(none, /<span id="cf" class="confidenceLabel">How sure\?<\/span>/);
  assert.match(none, /role="radiogroup" aria-labelledby="cf"/);
  assert.equal(none.match(/role="radio"/g)?.length, 5);
  assert.match(none, /aria-checked="false" aria-label="1 guess" tabindex="0"[^>]*>1</);
  assert.equal(none.match(/tabindex="0"/g)?.length, 1);
  assert.match(none, />Guess<.*>Certain</);
  const four = html(h(ConfidenceRow, { ...props, value: 4 }));
  assert.match(four, /aria-checked="true" aria-label="4" tabindex="0"/);
  assert.match(four, /aria-label="1 guess" tabindex="-1"/);
});

test('LevelTag shows the level word with a class per level', () => {
  assert.equal(
    html(h(LevelTag, { level: 'apply', children: 'Apply' })),
    '<span class="level-tag level-apply">Apply</span>',
  );
});

test('Misconception shows the lead, the correction and then the right answer', () => {
  assert.equal(
    html(h(Misconception, { lead: 'A common mix-up', answer: 'Correct: B', children: 'Many people think A.' })),
    '<span class="misconception-lead">A common mix-up</span><div class="misconception">Many people think A.</div>' +
      '<div class="misconception-answer">Correct: B</div>',
  );
});

test('KeyPointChecklist is a fieldset of labelled checkboxes, one per key point', () => {
  const out = html(
    h(KeyPointChecklist, {
      legend: 'Tick what you covered',
      points: ['Tilt', 'Angle'],
      checked: [true],
      onToggle: () => {},
    }),
  );
  assert.match(out, /^<fieldset class="keypoints"><legend>Tick what you covered<\/legend><ul>/);
  const boxes = [
    ...out.matchAll(/<input type="checkbox" id="([^"]+)"( checked="")?\/><label for="([^"]+)">(\w+)<\/label>/g),
  ];
  assert.deepEqual(
    boxes.map((m) => [!!m[2], m[1] === m[3], m[4]]),
    [
      [true, true, 'Tilt'],
      [false, true, 'Angle'],
    ],
  );
});
