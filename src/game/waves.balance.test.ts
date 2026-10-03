import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planWave, planBossWave, wavesPerLevel } from './waves';
import { MODE_INFO } from './modes';

test('every selectable mode generates a playable opening wave', () => {
  for (const mode of MODE_INFO) {
    const plan = planWave(1, mode.id, 1, 1, wavesPerLevel(1, mode.id));
    assert.ok(plan.items.length > 0, `${mode.name} has enemies`);
    assert.ok(plan.items.every((item) => item.kind), `${mode.name} has valid enemies`);
    assert.ok(Number.isFinite(plan.gap) && plan.gap > 0, `${mode.name} spawn timing`);
    assert.ok(Number.isFinite(plan.hpScale) && plan.hpScale > 0, `${mode.name} enemy health`);
  }
  assert.equal(planWave(1, 'horde', 1, 1, 5).boss, false);
  assert.ok(planWave(1, 'arena', 1, 1, 5).gap < planWave(1, 'casual', 1, 1, 5).gap);
});

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
