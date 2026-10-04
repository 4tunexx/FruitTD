import assert from 'node:assert/strict';
import { test } from 'node:test';
import { advanceLocalCoop } from './localCoop';

test('local co-op does not slash without player two input', () => {
  const result = advanceLocalCoop({ x: 0, z: 1, cooldown: 0 }, new Set(), false, 1);
  assert.equal(result.slash, false);
  assert.equal(result.state.x, 0);
  assert.equal(result.state.z, 1);
});

test('player two moves diagonally at normalized speed and can slash repeatedly', () => {
  const keys = new Set(['ArrowRight', 'ArrowUp']);
  const moved = advanceLocalCoop({ x: 0, z: 1, cooldown: 0 }, keys, true, 0.1);
  assert.ok(moved.state.x > 0 && moved.state.z > 1);
  assert.ok(moved.state.x < 0.9);
  assert.equal(moved.slash, true);
  const cooling = advanceLocalCoop(moved.state, keys, true, 0.1);
  assert.equal(cooling.slash, false);
  const ready = advanceLocalCoop(cooling.state, keys, true, 0.3);
  assert.equal(ready.slash, true);
});

test('player two stays within the battlefield', () => {
  const result = advanceLocalCoop({ x: 0, z: 1, cooldown: 0 }, new Set(['ArrowLeft', 'ArrowDown']), false, 100);
  assert.ok(result.state.x > -11);
  assert.equal(result.state.z, -6.7);
});
