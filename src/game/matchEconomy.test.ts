import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateReward } from './progression/rewards';
import { fruitLoot, frutsForEvent } from './matchEconomy';
import { planWave } from './waves';

test('Fruts pay for artillery independently of score, coins, gems and combos', () => {
  const kill = { type: 'fruit_sliced' as const, baseScore: 100 };
  assert.equal(frutsForEvent(kill), 2);
  assert.equal(frutsForEvent({ ...kill, combo: 500 }), 2);
  assert.equal(frutsForEvent({ type: 'special_enemy_killed' }), 4);
  assert.equal(frutsForEvent({ type: 'wave_cleared', wave: 1 }), 12);
  assert.equal(frutsForEvent({ type: 'combo_milestone', combo: 500 }), 0);
  assert.equal(calculateReward(kill).coins, 0);
  assert.equal(calculateReward({ type: 'special_enemy_killed', baseScore: 100 }).coins, 0);
});

test('rare fruit drops grant separate bounded Fruts, shop coins and gems', () => {
  assert.deepEqual(fruitLoot(7), { fruts: 0, coins: 0, gems: 0 });
  assert.deepEqual(fruitLoot(8), { fruts: 8, coins: 0, gems: 0 });
  assert.deepEqual(fruitLoot(20), { fruts: 0, coins: 3, gems: 0 });
  assert.deepEqual(fruitLoot(100), { fruts: 0, coins: 3, gems: 1 });
  assert.deepEqual(fruitLoot(0), { fruts: 0, coins: 0, gems: 0 });
  const drop = { type: 'loot_drop' as const, lootFruts: 8, lootCoins: 3, lootGems: 1 };
  assert.equal(frutsForEvent(drop), 8);
  assert.deepEqual({ coins: calculateReward(drop).coins, gems: calculateReward(drop).gems }, { coins: 3, gems: 1 });
  assert.equal(calculateReward({ ...drop, lootCoins: 999, lootGems: 999 }).gems, 1);
});

test('a clean first sector can afford a few defenses but not a fully built wall', () => {
  const random = Math.random;
  let fruts = 140;
  let kills = 0;
  try {
    Math.random = () => 0.5;
    for (let wave = 1; wave <= 5; wave++) {
      for (const item of planWave(wave, 'campaign', 1, wave, 5).items) {
        fruts += frutsForEvent({ type: item.enemy && item.enemy !== 'normal' ? 'special_enemy_killed' : 'fruit_sliced' });
        fruts += fruitLoot(++kills).fruts;
      }
      fruts += frutsForEvent({ type: 'wave_cleared', wave });
      fruts += frutsForEvent({ type: 'perfect_wave', wave });
    }
  } finally { Math.random = random; }
  assert.ok(fruts >= 3 * 80, 'three useful turrets must be affordable');
  assert.ok(fruts < 5 * 80, 'the first sector cannot immediately fill the wall with premium turrets');
});
