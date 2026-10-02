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

test('five boss archetypes rotate through campaign stages with distinct traits', () => {
  const firstFive = [1, 2, 3, 4, 5].map((stage) => planBossWave(stage * 5, 'campaign', stage));
  assert.deepEqual(firstFive.map((wave) => wave.items[0].kind), ['watermelon', 'strawberry', 'pineapple', 'apple', 'orange']);
  assert.deepEqual(firstFive.map((wave) => wave.items[0].enemy), ['normal', 'swift', 'armored', 'splitter', 'normal']);
  assert.deepEqual(firstFive.map((wave) => wave.items[0].bossStage), [1, 2, 3, 4, 5]);
});

test('early waves teach safe chain explosions alongside turret-only hazards', () => {
  const fourth = planWave(4, 'campaign', 1, 4, 5);
  assert.ok(fourth.items.some((enemy) => enemy.enemy === 'chainburst'));
  assert.ok(fourth.items.some((enemy) => enemy.enemy === 'explosive'));
});
