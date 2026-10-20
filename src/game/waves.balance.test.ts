import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planWave, planBossWave, wavesPerLevel } from './waves';
import { MODE_INFO } from './modes';
import { frutsForEvent, fruitLoot } from './matchEconomy';
import { TURRETS } from './turrets';
import { getLiveWavesConfig, setLiveWavesConfig } from './creatorWaves';

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

test('every solo opening provides a safe path to a turret before bomb enemies', () => {
  const cheapest = Math.min(...TURRETS.map((tower) => tower.cost));
  for (const mode of MODE_INFO) {
    let fruts = 0;
    let kills = 0;
    for (const wave of [1, 2]) {
      const plan = planWave(wave, mode.id, 1, wave, wavesPerLevel(1, mode.id));
      assert.ok(plan.items.every((item) => item.enemy !== 'explosive' && item.kind !== 'bomb'), `${mode.id} wave ${wave} is safe without a turret`);
      // Conservative opening: slice 60% of each wave, allow the others to leak.
      const sliced = Math.floor(plan.items.length * .6);
      for (let i = 0; i < sliced; i++) {
        fruts += frutsForEvent({ type: 'fruit_sliced' }, mode.currencyMul);
        fruts += fruitLoot(++kills).fruts;
      }
      fruts += frutsForEvent({ type: 'wave_cleared', wave }, mode.currencyMul);
    }
    assert.ok(fruts >= cheapest, `${mode.id}: ${fruts} Fruts must afford a defence costing ${cheapest}`);
  }
});

test('admin-authored bombs cannot block a zero-Frut opening', () => {
  const previous = getLiveWavesConfig();
  setLiveWavesConfig({ version: 1, levels: {
    '1': { level: 1, wavesCount: 5, waves: [
      { spawns: [{ fruit: 'bomb', enemy: 'explosive', count: 3 }] },
      { spawns: [{ fruit: 'bomb', enemy: 'explosive', count: 3 }] },
      { spawns: [{ fruit: 'bomb', enemy: 'explosive', count: 3 }] },
    ] },
  } });
  try {
    for (const wave of [1, 2]) {
      assert.ok(planWave(wave, 'arena', 1, wave, 5).items.every((item) => item.kind !== 'bomb' && item.enemy !== 'explosive'));
    }
    assert.ok(planWave(3, 'arena', 1, 3, 5).items.some((item) => item.enemy === 'explosive'));
  } finally { setLiveWavesConfig(previous); }
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
  assert.deepEqual(firstFive.map((wave) => wave.items[0].enemy), ['normal', 'swift', 'armored', 'splitter', 'bladebound']);
  assert.deepEqual(firstFive.map((wave) => wave.items[0].bossStage), [1, 2, 3, 4, 5]);
});

test('early waves teach safe chain explosions alongside turret-only hazards', () => {
  const fourth = planWave(4, 'campaign', 1, 4, 5);
  assert.ok(fourth.items.some((enemy) => enemy.enemy === 'chainburst'));
  assert.ok(fourth.items.some((enemy) => enemy.enemy === 'explosive'));
});
