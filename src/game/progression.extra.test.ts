import assert from 'node:assert/strict';
import { test } from 'node:test';

// Mock localStorage for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import { HERO_PERKS, heroPerkMultiplier, heroPerkRank } from './heroProgression';
import { TOWER_MILESTONES } from './towerMilestones';
import { createState } from './state';
import { MAX_HERO_LEVEL, heroXpForLevel } from './heroes';
import { enemyReward, enemyXpReward, specialEnemyForWave } from './enemies';

test('hero perks unlock and gain ranks through mastery', () => {
  const combo = HERO_PERKS.find((p) => p.id === 'combo')!;
  assert.equal(heroPerkRank(9, combo), 0);
  assert.equal(heroPerkRank(10, combo), 1);
  assert.equal(heroPerkRank(30, combo), 3);
  assert.equal(heroPerkMultiplier('combo', 30), 1.24);
});

test('Main Tower has progression milestones through level 10', () => {
  assert.equal(TOWER_MILESTONES.length, 9);
  assert.equal(TOWER_MILESTONES.at(-1)?.level, 10);
  assert.match(TOWER_MILESTONES.at(-1)?.reward ?? '', /Master Tower/);
});

test('hero runtime state derives level from XP and caps at level 100', () => {
  const state = createState();
  state.heroXp = heroXpForLevel(10);
  assert.equal(state.heroLevel, 10);
  state.heroXp += 999999999;
  assert.equal(state.heroLevel, MAX_HERO_LEVEL);
  assert.equal(state.heroXp, heroXpForLevel(MAX_HERO_LEVEL));
});

test('special enemies scale into the wave and pay meaningful rewards', () => {
  assert.equal(specialEnemyForWave(2, 0), 'normal');
  assert.equal(specialEnemyForWave(4, 0.2), 'explosive');
  assert.equal(specialEnemyForWave(5, 0.1), 'swift');
  assert.equal(specialEnemyForWave(8, 0.1), 'armored');
  assert.equal(specialEnemyForWave(12, 0.01), 'splitter');
  assert.ok(enemyReward('armored', 100) > 100);
  assert.ok(enemyXpReward('splitter', 10) > 10);
});

test('enemy multipliers scale rewards meaningfully above base', () => {
  const base = 100;
  const normalReward = enemyReward('normal', base);
  const explosiveReward = enemyReward('explosive', base);
  const armoredReward = enemyReward('armored', base);
  const splitterReward = enemyReward('splitter', base);
  const swiftReward = enemyReward('swift', base);
  
  assert.equal(normalReward, base, 'Normal enemy should have 1x multiplier');
  assert.ok(explosiveReward > base * 1.5, 'Explosive should give >1.5x reward');
  assert.ok(armoredReward > base * 2, 'Armored should give >2x reward');
  assert.ok(splitterReward > base * 1.8, 'Splitter should give >1.8x reward');
  assert.ok(swiftReward > base * 1.6, 'Swift should give >1.6x reward');
  
  const baseXp = 10;
  assert.equal(enemyXpReward('normal', baseXp), baseXp);
  assert.ok(enemyXpReward('explosive', baseXp) >= baseXp * 2, 'Explosive XP should be 2x+');
  assert.ok(enemyXpReward('armored', baseXp) >= baseXp * 2, 'Armored XP should be 2x+');
});
