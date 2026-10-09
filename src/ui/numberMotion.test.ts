import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCountValue, parseCountValues } from './numberMotion';

test('shared number motion recognises currency, progress, and score displays', () => {
  assert.deepEqual(parseCountValue('10,074'), { prefix: '', suffix: '', value: 10074, decimals: 0, grouped: true });
  assert.deepEqual(parseCountValue('Wave 42'), { prefix: 'Wave ', suffix: '', value: 42, decimals: 0, grouped: false });
  assert.deepEqual(parseCountValue(' 207/224 XP'), null);
  assert.deepEqual(parseCountValue('06:30'), null);
  assert.deepEqual(parseCountValue('fruit-td.vercel.app'), null);
});

test('shared number motion counts every standalone value in composite progress labels', () => {
  assert.deepEqual(parseCountValues('Lv 11/100 · 1,250 XP'), [
    { value: 11, decimals: 0, grouped: false },
    { value: 100, decimals: 0, grouped: false },
    { value: 1250, decimals: 0, grouped: true },
  ]);
  assert.deepEqual(parseCountValues('06:30'), []);
  assert.deepEqual(parseCountValues('mode-arena'), []);
});

test('shared number motion ignores digits embedded in identifiers without lookbehind regex support', () => {
  assert.deepEqual(parseCountValues('Hero12 rank3 mode-arena 12 / 24'), [
    { value: 12, decimals: 0, grouped: false },
    { value: 24, decimals: 0, grouped: false },
  ]);
});
