import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkNumeric, parseNumber, parseQuantity, parseTolerance, unitFactor, type NumericAnswer } from './numeric';

test('reads numbers the way people type them', () => {
  const v = (s: string) => parseNumber(s)?.value;
  assert.equal(v('9.81'), 9.81);
  assert.equal(v('9,81'), 9.81, 'a single comma is a decimal comma');
  assert.equal(v('1,234.5'), 1234.5);
  assert.equal(v('1.234,5'), 1234.5);
  assert.equal(v('1 000 000'.replace(/ /g, ' ')), 1e6, 'thin spaces group digits');
  assert.equal(v('−3'), -3);
  assert.equal(v('+.5'), 0.5);
  assert.equal(v('6.02e23'), 6.02e23);
  assert.equal(v('6.02E-3'), 6.02e-3);
  assert.equal(v('6.02 × 10^23'), 6.02e23);
  assert.equal(v('6.02*10^{-3}'), 6.02e-3);
  assert.equal(v('6.02·10⁻³'), 6.02e-3);
  assert.equal(v('abc'), undefined);
  assert.equal(parseNumber('9.81 m/s^2')?.rest, 'm/s^2');
});

test('reads tolerances: absolute or percent', () => {
  assert.deepEqual(parseTolerance('0.05'), { abs: 0.05 });
  assert.deepEqual(parseTolerance('± 0,05'), { abs: 0.05 });
  assert.deepEqual(parseTolerance('2%'), { rel: 0.02 });
  assert.deepEqual(parseTolerance('2 %'), { rel: 0.02 });
  assert.equal(parseTolerance('-1'), null);
  assert.equal(parseTolerance('lots'), null);
});

test('reads a card answer: number, optional ± tolerance, optional unit', () => {
  assert.deepEqual(parseQuantity('9.81 m/s²'), { value: 9.81, tolerance: null, unit: 'm/s^2' });
  assert.deepEqual(parseQuantity('9.81 ± 0.05 m/s^2'), { value: 9.81, tolerance: { abs: 0.05 }, unit: 'm/s^2' });
  assert.deepEqual(parseQuantity('300 000 km/s'.replace(' ', ' ')), { value: 3e5, tolerance: null, unit: 'km/s' });
  assert.deepEqual(parseQuantity('42'), { value: 42, tolerance: null, unit: '' });
  assert.equal(parseQuantity('about 42'), null);
});

const g: NumericAnswer = { value: 9.81, tolerance: { abs: 0.05 }, unit: 'm/s^2', text: '9.81 m/s^2' };

test('tolerance: inside is right, outside is wrong', () => {
  assert.equal(checkNumeric('9.81', g).correct, true);
  assert.equal(checkNumeric('9.8', g).correct, true);
  assert.equal(checkNumeric('9.86', g).correct, true, 'the edge counts (no float slip)');
  assert.equal(checkNumeric('9.87', g).correct, false);
  assert.equal(checkNumeric('9,8', g).correct, true);
  assert.equal(checkNumeric('ten', g).correct, false);
  assert.equal(checkNumeric('', g).correct, false);
  const pct: NumericAnswer = { value: 200, tolerance: { rel: 0.01 }, unit: '', text: '200' };
  assert.equal(checkNumeric('198', pct).correct, true);
  assert.equal(checkNumeric('197.9', pct).correct, false);
  const exact: NumericAnswer = { value: 0.1 + 0.2, tolerance: null, unit: '', text: '0.3' };
  assert.equal(checkNumeric('0.3', exact).correct, true, 'without a tolerance only float noise is forgiven');
  assert.equal(checkNumeric('0.31', exact).correct, false);
  assert.equal(checkNumeric('9.81', g).matched, '9.81 m/s^2');
});

test('units: optional to type, must match when typed, SI prefixes convert', () => {
  assert.equal(checkNumeric('9.81 m/s^2', g).correct, true);
  assert.equal(checkNumeric('9.81 m/s²', g).correct, true);
  assert.equal(checkNumeric('9.81 m / s^2', g).correct, true, 'spaces in a unit do not matter');
  assert.equal(checkNumeric('9.81 m/s', g).correct, false, 'a wrong unit is wrong');
  const km: NumericAnswer = { value: 1.5, tolerance: null, unit: 'km', text: '1.5 km' };
  assert.equal(checkNumeric('1500 m', km).correct, true);
  assert.equal(checkNumeric('150000 cm', km).correct, true);
  assert.equal(checkNumeric('1500 km', km).correct, false);
  assert.equal(checkNumeric('1.5 kg', km).correct, false);
  const ma: NumericAnswer = { value: 20, tolerance: null, unit: 'mA', text: '20 mA' };
  assert.equal(checkNumeric('0.02 A', ma).correct, true);
  assert.equal(checkNumeric('20000 µA', ma).correct, true);
  assert.equal(checkNumeric('20 MA', ma).correct, false, 'units are case-sensitive');
  const none: NumericAnswer = { value: 42, tolerance: null, unit: '', text: '42' };
  assert.equal(checkNumeric('42 apples', none).correct, true, 'a card without a unit ignores a typed one');
});

test('prefix factors only between a prefix and a known base unit', () => {
  assert.equal(unitFactor('km', 'm'), 1000);
  assert.equal(unitFactor('m', 'm'), 1);
  assert.equal(unitFactor('ms', 's'), 0.001);
  assert.equal(unitFactor('kPa', 'Pa'), 1000);
  assert.equal(unitFactor('in', 'min'), null, 'min is not milli-in');
  assert.equal(unitFactor('m/s', 'km/s'), null, 'compound units must match as written');
});
