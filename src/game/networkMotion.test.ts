import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NetworkMotion } from './networkMotion';

test('900 ms fallback snapshots keep moving between updates without snapping', () => {
  const motion = new NetworkMotion();
  motion.update(0, 2, 0, 0);
  let last = 0;
  for (let now = 16; now < 5000; now += 16) {
    if (now % 912 === 0) {
      const before = motion.sample(now);
      motion.update(now / 1000 * 2, 2, now, now);
      assert.ok(Math.abs(motion.sample(now) - before) < 1e-9, 'snapshot arrival preserves visual position');
    }
    const value = motion.sample(now);
    assert.ok(value > last, `movement must not freeze at ${now} ms`);
    assert.ok(value - last < .05, 'no snapshot-sized jumps');
    last = value;
  }
});

test('UI rerenders and duplicate snapshots cannot restart the movement clock', () => {
  const motion = new NetworkMotion();
  motion.update(5, 1, 7, 0);
  motion.update(5, 1, 7, 400);
  assert.equal(motion.sample(900), 5.9);
  assert.equal(motion.sample(5000), 6.2, 'prediction stops during a disconnect');
});

test('combat stops and knockbacks reconcile smoothly to authoritative positions', () => {
  const motion = new NetworkMotion();
  motion.update(10, 1, 1, 0);
  const before = motion.sample(900);
  motion.update(10.5, 0, 2, 900);
  assert.equal(motion.sample(900), before);
  assert.ok(Math.abs(motion.sample(1900) - 10.5) < .001);
  motion.update(9, 1, 3, 2000);
  assert.ok(Math.abs(motion.sample(3000) - 10) < .004);
});
