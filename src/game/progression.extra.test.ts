// Mock localStorage BEFORE any imports to prevent module initialization errors
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HERO_PERKS, heroPerkMultiplier, heroPerkRank } from './heroProgression';
import { heroCombatPerkMultiplier, heroPerkRank as spentPerkRank } from './heroPerkSave';
import { getTowerMilestoneBonuses, TOWER_MILESTONES } from './towerMilestones';
import { createState, addScore, awardPerfectWave, resetState } from './state';
import { MAX_HERO_LEVEL, heroXpForLevel } from './heroes';
import { enemyReward, enemyXpReward, specialEnemyForWave } from './enemies';
import { writeSave, loadSave } from './save';
import { vipCoinMultiplier, vipXpMultiplier, vipTierPrice } from './vipBonuses';

test('hero perks unlock and gain ranks through mastery', () => {
  const combo = HERO_PERKS.find((p) => p.id === 'combo')!;
  assert.equal(heroPerkRank(9, combo), 0);
  assert.equal(heroPerkRank(10, combo), 1);
  assert.equal(heroPerkRank(30, combo), 3);
  assert.equal(heroPerkMultiplier('combo', 3), 1.24);
  assert.equal(heroPerkMultiplier('combo', 0), 1);
  assert.equal(heroPerkMultiplier('tower', 0), 1);
});

test('combat perk multipliers use spent ranks, not auto level ranks', () => {
  localStorage.clear();
  const save = loadSave();
  save.heroPerkRanks = { jiju: {}, topfu: {}, lagen: {}, tripos: {}, ki: {} };
  writeSave(save);

  assert.equal(spentPerkRank('jiju', 'combo'), 0);
  assert.equal(heroCombatPerkMultiplier('jiju', 'combo'), 1, 'unspent perk must stay 1×');

  // Spend one combo rank via save
  save.heroPerkRanks!.jiju.combo = 2;
  writeSave(save);
  assert.equal(heroCombatPerkMultiplier('jiju', 'combo'), 1.16);
  assert.equal(heroCombatPerkMultiplier('jiju', 'juice'), 1, 'other unspent perks stay neutral');
});

test('Main Tower has progression milestones through level 10', () => {
  assert.equal(TOWER_MILESTONES.length, 9);
  assert.equal(TOWER_MILESTONES.at(-1)?.level, 10);
  assert.match(TOWER_MILESTONES.at(-1)?.reward ?? '', /Master Tower/);
});

test('tower milestone bonuses accumulate juice, fire rate, combo, last stand', () => {
  const low = getTowerMilestoneBonuses(1);
  assert.equal(low.juiceGainMultiplier, 1);
  assert.equal(low.defenceFireRateMultiplier, 1);
  assert.equal(low.comboRewardMultiplier, 1);
  assert.equal(low.lastStandRewardMultiplier, 1);
  assert.equal(low.startingLives, 0);

  const mid = getTowerMilestoneBonuses(7);
  assert.ok(mid.juiceGainMultiplier > 1);
  assert.ok(mid.defenceFireRateMultiplier > 1);
  assert.ok(mid.comboRewardMultiplier > 1);
  assert.ok(mid.lastStandRewardMultiplier > 1);
  assert.ok(mid.startingLives >= 1);
  assert.ok(mid.maxLives >= 1);
});

test('awardPerfectWave pays only when the wave is fully cleared', () => {
  localStorage.clear();
  const state = createState();
  state.wave = 3;
  state.waveTotal = 5;
  state.waveKilled = 4;
  assert.equal(awardPerfectWave(state), 0);

  state.waveKilled = 5;
  const before = state.currency;
  const reward = awardPerfectWave(state);
  assert.ok(reward > 0);
  assert.equal(state.currency, before + reward);
});

test('resetState applies starting/max lives from tower milestones', () => {
  localStorage.clear();
  // Seed account tower XP high enough for milestones (>= level 4)
  localStorage.setItem('fruit-td-main-tower-progression-v1', JSON.stringify({ xp: 1100, lifetimeXp: 1100 }));
  const state = createState();
  state.mode = 'ranked';
  resetState(state);
  // Ranked base 14 + startingLives from milestones
  assert.ok(state.lives >= 14);
  assert.ok(state.maxLives >= state.lives);
});

test('VIP helpers read live config prices and percent bonuses', () => {
  localStorage.clear();
  assert.equal(vipCoinMultiplier(), 1);
  assert.equal(vipXpMultiplier(), 1);
  assert.ok(vipTierPrice('bronze') > 0);

  const save = loadSave();
  save.vipStatus = 'bronze';
  writeSave(save);
  assert.ok(vipCoinMultiplier() > 1);
  assert.ok(vipXpMultiplier() > 1);
});

test('addScore applies combo + last-stand milestone reward multipliers', () => {
  localStorage.clear();
  localStorage.setItem('fruit-td-main-tower-progression-v1', JSON.stringify({ xp: 2500, lifetimeXp: 2500 }));
  const state = createState();
  state.combo = 5;
  state.lives = 1;
  state.maxLives = 10;
  const before = state.score;
  addScore(state, 100);
  assert.ok(state.score > before);
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
