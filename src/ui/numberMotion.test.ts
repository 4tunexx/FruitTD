import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCountValue } from './numberMotion';

test('shared number motion recognises currency, progress, and score displays', () => {
  assert.deepEqual(parseCountValue('10,074'), { prefix: '', suffix: '', value: 10074, decimals: 0, grouped: true });
  assert.deepEqual(parseCountValue('Wave 42'), { prefix: 'Wave ', suffix: '', value: 42, decimals: 0, grouped: false });
  assert.deepEqual(parseCountValue(' 207/224 XP'), null);
  assert.deepEqual(parseCountValue('06:30'), null);
  assert.deepEqual(parseCountValue('fruit-td.vercel.app'), null);
});
