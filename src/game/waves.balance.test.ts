import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planWave, planBossWave } from './waves';

test('late Casual and Horde waves retain ordinary targets instead of becoming all bombs', () => {
  const random = Math.random;
  try {
    // This roll became a bomb with the previous unbounded wave-78 threshold.
    Math.random = () => 0.5;
    for (const mode of ['casual', 'horde'] as const) {
      const plan = planWave(100, mode, 20, 1, 5);
      assert.ok(plan.items.length > 0);
      assert.ok(plan.items.some((item) => item.kind !== 'bomb'));
      assert.ok(plan.items.filter((item) => item.kind === 'bomb').length < plan.items.length / 2);
    }
  } finally {
    Math.random = random;
  }
});

test('late-wave HP keeps increasing at a readable rate in Casual and boss waves', () => {
  const early = planWave(20, 'casual', 4, 1, 5);
  const later = planWave(100, 'casual', 20, 1, 5);
  assert.ok(later.hpScale > early.hpScale);
  assert.ok(later.hpScale < early.hpScale * 2);
  const boss = planBossWave(100, 'casual', 20);
  assert.ok(boss.hpScale > later.hpScale);
  assert.ok(boss.hpScale < 15);
});
