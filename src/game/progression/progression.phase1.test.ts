// Mock localStorage BEFORE any imports so module initialisation succeeds.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HEROES,
  MAX_HERO_LEVEL,
  heroXpForLevel,
  heroXpToLevel,
  type HeroId,
} from '../heroes';
import { defaultSave, loadSave, mergeSaves, sanitiseSave, syncHeroUnlocks, writeSave, type SaveData } from '../save';
import { MAX_TOWER_LEVEL } from '../world';
import {
  getTowerXpState,
  grantTowerXp,
  resetTowerProgression,
  towerLevelFromXp,
} from '../towerProgression';
import { TOWER_MILESTONES, getTowerMilestoneBonuses, towerMilestone } from '../towerMilestones';
import {
  HERO_MILESTONES,
  applyRewards,
  calculateReward,
  comboTierAt,
  comboTiersBetween,
  defaultModifiers,
  getHeroXpState,
  heroMilestoneAt,
  heroMilestonesBetween,
  heroesUnlockedByJijuLevel,
  nextHeroMilestone,
  perkPointsFromLevel,
} from './index';
import { canEquipHero, getAllHeroStatuses, purchaseHeroAtomic } from './heroStatus';
import { heroPrice } from './heroEconomy';

function freshSave(): SaveData {
  localStorage.clear();
  resetTowerProgression();
  return defaultSave();
}

/* ───────────────────────── Hero XP & levels (§1) ───────────────────────── */

test('hero level 1 is the floor and costs no XP', () => {
  assert.equal(heroXpForLevel(1), 0);
  assert.equal(heroXpToLevel(0), 1);
  assert.equal(heroXpToLevel(-500), 1);
});

test('hero levels 10, 25, 50 and 100 resolve exactly', () => {
  for (const level of [10, 25, 50, 100]) {
    const xp = heroXpForLevel(level);
    assert.equal(heroXpToLevel(xp), level, `level ${level} round-trip`);
    assert.equal(heroXpToLevel(xp - 1), level - 1, `just below level ${level}`);
  }
});

test('hero XP is monotonic and caps at level 100', () => {
  let previous = -1;
  for (let level = 1; level <= MAX_HERO_LEVEL; level++) {
    const xp = heroXpForLevel(level);
    assert.ok(xp > previous, `level ${level} must cost more than ${level - 1}`);
    previous = xp;
  }
  assert.equal(heroXpToLevel(heroXpForLevel(MAX_HERO_LEVEL) * 10), MAX_HERO_LEVEL);
});

test('hero XP overflow clamps instead of wrapping or resetting', () => {
  const save = freshSave();
  applyRewards(save, { score: 0, coins: 0, heroXp: 999_999_999, towerXp: 0, reason: 'fruit_sliced' });
  const state = getHeroXpState(save, 'jiju');
  assert.equal(state.level, MAX_HERO_LEVEL);
  assert.equal(state.maxed, true);
  assert.equal(state.progress, 1);
  assert.ok(state.xp <= heroXpForLevel(MAX_HERO_LEVEL));
});

test('XP is assigned to the correct hero and never transfers', () => {
  const save = freshSave();
  save.ownedHeroes = ['jiju', 'topfu'];
  applyRewards(save, { score: 0, coins: 0, heroXp: 500, towerXp: 0, reason: 'fruit_sliced' }, { heroId: 'jiju' });
  applyRewards(save, { score: 0, coins: 0, heroXp: 120, towerXp: 0, reason: 'fruit_sliced' }, { heroId: 'topfu' });
  assert.equal(save.xp.jiju, 500);
  assert.equal(save.xp.topfu, 120);
  assert.equal(save.xp.lagen, 0);
  assert.equal(save.xp.tripos, 0);
  assert.equal(save.xp.ki, 0);
});

test('hero XP state exposes progress toward the next level', () => {
  const save = freshSave();
  save.xp.jiju = heroXpForLevel(20);
  const atBoundary = getHeroXpState(save, 'jiju');
  assert.equal(atBoundary.level, 20);
  assert.equal(atBoundary.xpIntoLevel, 0);
  assert.equal(atBoundary.progress, 0);
  assert.equal(atBoundary.maxed, false);
  assert.equal(atBoundary.nextLevelXp, heroXpForLevel(21));

  save.xp.jiju = heroXpForLevel(20) + Math.floor(atBoundary.xpForLevel / 2);
  const halfway = getHeroXpState(save, 'jiju');
  assert.ok(halfway.progress > 0.4 && halfway.progress < 0.6);
});

test('no hero is capped at level 5 anywhere in the progression system', () => {
  assert.equal(MAX_HERO_LEVEL, 100);
  const save = freshSave();
  save.xp.jiju = heroXpForLevel(60);
  assert.equal(getHeroXpState(save, 'jiju').level, 60);
  // Sanitisation must not clamp a legitimately high XP value down.
  sanitiseSave(save);
  assert.equal(heroXpToLevel(save.xp.jiju), 60);
});

/* ───────────────────────── Milestones (§2) ───────────────────────── */

test('hero milestones cover every required level', () => {
  const levels = HERO_MILESTONES.map((m) => m.level);
  assert.deepEqual(levels, [5, 10, 20, 25, 30, 40, 50, 60, 75, 90, 100]);
  assert.equal(heroMilestoneAt(10)?.unlocksHero, 'topfu');
  assert.equal(heroMilestoneAt(25)?.unlocksHero, 'lagen');
  assert.equal(heroMilestoneAt(100)?.kind, 'mastery');
  assert.equal(heroMilestoneAt(11), null);
});

test('milestones are reported exactly once when crossed', () => {
  assert.deepEqual(heroMilestonesBetween(9, 10).map((m) => m.level), [10]);
  assert.deepEqual(heroMilestonesBetween(4, 26).map((m) => m.level), [5, 10, 20, 25]);
  assert.deepEqual(heroMilestonesBetween(10, 10), []);
  assert.deepEqual(heroMilestonesBetween(30, 20), []);
});

test('next milestone advances with level', () => {
  assert.equal(nextHeroMilestone(1)?.level, 5);
  assert.equal(nextHeroMilestone(25)?.level, 30);
  assert.equal(nextHeroMilestone(100), null);
});

test('milestones never auto-unlock the purchase-only heroes', () => {
  const unlocked = heroesUnlockedByJijuLevel(MAX_HERO_LEVEL);
  assert.deepEqual(unlocked, ['topfu', 'lagen']);
  assert.equal(unlocked.includes('tripos' as HeroId), false);
  assert.equal(unlocked.includes('ki' as HeroId), false);
});

/* ───────────────────────── Perk points (§3) ───────────────────────── */

test('perk points accrue from levels and milestones and never go negative', () => {
  assert.equal(perkPointsFromLevel(1), 0);
  assert.equal(perkPointsFromLevel(9), 0);
  assert.ok(perkPointsFromLevel(10) >= 1);
  assert.ok(perkPointsFromLevel(50) > perkPointsFromLevel(30));
  assert.ok(perkPointsFromLevel(100) > perkPointsFromLevel(75));
  for (let lv = 1; lv <= MAX_HERO_LEVEL; lv++) {
    assert.ok(perkPointsFromLevel(lv) >= 0);
    if (lv > 1) assert.ok(perkPointsFromLevel(lv) >= perkPointsFromLevel(lv - 1), `lv ${lv} regressed`);
  }
});

test('levelling grants perk points through the reward pipeline', () => {
  const save = freshSave();
  const result = applyRewards(save, {
    score: 0,
    coins: 0,
    heroXp: heroXpForLevel(10),
    towerXp: 0,
    reason: 'fruit_sliced',
  });
  assert.equal(result.heroLevelAfter, 10);
  assert.ok(result.perkPointsGained >= 1);
  assert.equal(save.skillPoints, result.perkPointsGained);
  assert.ok(result.heroMilestones.some((m) => m.level === 10));
});

/* ───────────────────────── Hero unlock & purchase (§4) ───────────────── */

test('topfu unlocks at Jiju level 10 and lagen at 25', () => {
  const save = freshSave();
  save.xp.jiju = heroXpForLevel(9);
  syncHeroUnlocks(save);
  assert.deepEqual(save.ownedHeroes, ['jiju']);

  save.xp.jiju = heroXpForLevel(10);
  syncHeroUnlocks(save);
  assert.ok(save.ownedHeroes.includes('topfu'));
  assert.equal(save.ownedHeroes.includes('lagen'), false);

  save.xp.jiju = heroXpForLevel(25);
  syncHeroUnlocks(save);
  assert.ok(save.ownedHeroes.includes('lagen'));
});

test('purchase-only heroes never unlock from levelling', () => {
  const save = freshSave();
  save.xp.jiju = heroXpForLevel(MAX_HERO_LEVEL);
  syncHeroUnlocks(save);
  assert.equal(save.ownedHeroes.includes('tripos'), false);
  assert.equal(save.ownedHeroes.includes('ki'), false);
});

test('hero prices come from one central configurable value', () => {
  assert.equal(heroPrice('tripos'), 1800);
  assert.equal(heroPrice('ki'), 3000);
  assert.equal(heroPrice('jiju'), null);
  assert.equal(HEROES.find((h) => h.id === 'tripos')?.purchaseCost, heroPrice('tripos'));
  assert.equal(HEROES.find((h) => h.id === 'ki')?.purchaseCost, heroPrice('ki'));
});

test('hero status reports owned / locked / purchasable correctly', () => {
  const save = freshSave();
  const statuses = getAllHeroStatuses(save);
  const byId = Object.fromEntries(statuses.map((s) => [s.heroId, s]));

  assert.equal(byId.jiju.availability, 'owned');
  assert.equal(byId.topfu.availability, 'locked');
  assert.match(byId.topfu.requirement, /Master Jiju Lv 10/);
  assert.equal(byId.lagen.availability, 'locked');
  assert.match(byId.lagen.requirement, /Master Jiju Lv 25/);
  assert.equal(byId.tripos.availability, 'purchasable');
  assert.match(byId.tripos.requirement, /1,800 Coins/);
  assert.equal(byId.ki.availability, 'purchasable');
  assert.match(byId.ki.requirement, /3,000 Coins/);
});

test('a locked hero can never be equipped', () => {
  const save = freshSave();
  assert.equal(canEquipHero(save, 'jiju'), true);
  assert.equal(canEquipHero(save, 'topfu'), false);
  assert.equal(canEquipHero(save, 'tripos'), false);

  save.xp.jiju = heroXpForLevel(10);
  syncHeroUnlocks(save);
  assert.equal(canEquipHero(save, 'topfu'), true);
});

test('hero purchase is atomic: coins out, hero in, exactly once', () => {
  const save = freshSave();
  save.coins = 2000;
  const result = purchaseHeroAtomic(save, 'tripos');
  assert.equal(result.ok, true);
  assert.equal(result.coinsSpent, 1800);
  assert.equal(save.coins, 200);
  assert.ok(save.ownedHeroes.includes('tripos'));

  // Buying again must not double-charge.
  const again = purchaseHeroAtomic(save, 'tripos');
  assert.equal(again.ok, false);
  assert.equal(again.error, 'already-owned');
  assert.equal(save.coins, 200);
});

test('a failed purchase leaves the save completely untouched', () => {
  const save = freshSave();
  save.coins = 100;
  const before = JSON.stringify(save);
  const result = purchaseHeroAtomic(save, 'ki');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'insufficient-coins');
  assert.equal(JSON.stringify(save), before, 'save must not be mutated on failure');
});

test('non-purchasable heroes are rejected by the purchase path', () => {
  const save = freshSave();
  save.coins = 999_999;
  const result = purchaseHeroAtomic(save, 'topfu');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'not-purchasable');
  assert.equal(save.coins, 999_999);
});

test('purchased heroes survive an unlock re-sync', () => {
  const save = freshSave();
  save.coins = 5000;
  purchaseHeroAtomic(save, 'ki');
  syncHeroUnlocks(save);
  assert.ok(save.ownedHeroes.includes('ki'), 'a purchased hero must never be revoked');
});

/* ───────────────────────── Main Tower (§5) ───────────────────────── */

test('tower levels span 1 to 10', () => {
  freshSave();
  assert.equal(MAX_TOWER_LEVEL, 10);
  assert.equal(towerLevelFromXp(0), 1);
  assert.equal(towerLevelFromXp(-10), 1);
  assert.equal(towerLevelFromXp(100), 2);
  assert.equal(towerLevelFromXp(6400), 10);
  assert.equal(towerLevelFromXp(999_999), 10, 'tower must cap at 10, never 5');
});

test('every tower level from 2 to 10 has a milestone reward', () => {
  for (let level = 2; level <= MAX_TOWER_LEVEL; level++) {
    const milestone = towerMilestone(level);
    assert.ok(milestone, `level ${level} needs a milestone`);
    assert.ok(milestone!.reward.length > 0, `level ${level} needs a reward`);
  }
  assert.equal(TOWER_MILESTONES.length, 9);
});

test('tower milestone bonuses accumulate and reach gameplay values', () => {
  const base = getTowerMilestoneBonuses(1);
  assert.equal(base.startingLives, 0);
  assert.equal(base.juiceGainMultiplier, 1);
  assert.equal(base.masterFortressBadge, false);

  const maxed = getTowerMilestoneBonuses(10);
  assert.ok(maxed.startingLives >= 1);
  assert.ok(maxed.maxLives >= 2);
  assert.ok(maxed.juiceGainMultiplier > 1);
  assert.ok(maxed.defenceFireRateMultiplier > 1);
  assert.ok(maxed.comboRewardMultiplier > 1);
  assert.ok(maxed.lastStandRewardMultiplier > 1);
  assert.ok(maxed.perfectWaveXpMultiplier > 1);
  assert.equal(maxed.masterFortressBadge, true);
});

test('tower XP persists and levels up through the pipeline', () => {
  const save = freshSave();
  const result = applyRewards(save, { score: 0, coins: 0, heroXp: 0, towerXp: 350, reason: 'wave_cleared' });
  assert.equal(result.towerLeveledUp, true);
  assert.equal(result.towerLevelAfter, towerLevelFromXp(350));
  assert.ok(result.towerMilestoneNames.length >= 1);
  assert.equal(save.towerXp, 350);
  assert.equal(getTowerXpState().xp, 350);
});

test('tower XP never exceeds the level 10 requirement', () => {
  freshSave();
  grantTowerXp(1_000_000);
  const state = getTowerXpState();
  assert.equal(state.level, MAX_TOWER_LEVEL);
  assert.equal(state.maxed, true);
  assert.equal(state.progress, 1);
});

/* ───────────────────────── Reward pipeline (§6) ───────────────────────── */

test('reward calculation is pure and produces no negative values', () => {
  const reward = calculateReward({ type: 'fruit_sliced', baseScore: 10, combo: 3 });
  const again = calculateReward({ type: 'fruit_sliced', baseScore: 10, combo: 3 });
  assert.deepEqual(reward, again, 'same input must give the same output');
  for (const value of [reward.score, reward.coins, reward.heroXp, reward.towerXp]) {
    assert.ok(value >= 0 && Number.isInteger(value));
  }
});

test('special enemy multipliers actually reach the reward system', () => {
  const normal = calculateReward({ type: 'fruit_sliced', baseScore: 10, enemyKind: 'normal' });
  const armored = calculateReward({ type: 'special_enemy_killed', baseScore: 10, enemyKind: 'armored' });
  const explosive = calculateReward({ type: 'special_enemy_killed', baseScore: 10, enemyKind: 'explosive' });
  const swift = calculateReward({ type: 'special_enemy_killed', baseScore: 10, enemyKind: 'swift' });
  const splitter = calculateReward({ type: 'special_enemy_killed', baseScore: 10, enemyKind: 'splitter' });

  assert.ok(armored.score > normal.score, 'armored must score more');
  assert.ok(armored.heroXp > normal.heroXp, 'armored must give more XP');
  assert.ok(explosive.score > normal.score);
  assert.ok(explosive.heroXp > normal.heroXp);
  assert.ok(swift.score > normal.score);
  assert.ok(splitter.score > normal.score);
});

test('combo increases rewards up to a fair cap', () => {
  const none = calculateReward({ type: 'fruit_sliced', baseScore: 100, combo: 0 });
  const some = calculateReward({ type: 'fruit_sliced', baseScore: 100, combo: 10 });
  const huge = calculateReward({ type: 'fruit_sliced', baseScore: 100, combo: 10_000 });
  assert.ok(some.score > none.score);
  assert.ok(huge.score > some.score);
  assert.ok(huge.score <= none.score * 3.6, 'combo scaling must stay capped');
});

test('modifiers scale rewards without being applied twice', () => {
  const base = calculateReward({ type: 'fruit_sliced', baseScore: 100 }, defaultModifiers());
  const doubled = calculateReward(
    { type: 'fruit_sliced', baseScore: 100 },
    { ...defaultModifiers(), scoreMultiplier: 2 },
  );
  assert.equal(doubled.score, base.score * 2);
  // Coins derive from pre-multiplier score, so a score multiplier must not
  // silently double coins as well.
  assert.equal(doubled.coins, base.coins);
});

test('applying rewards updates hero XP, tower XP and coins together', () => {
  const save = freshSave();
  const result = applyRewards(save, { score: 50, coins: 30, heroXp: 40, towerXp: 20, reason: 'wave_cleared' });
  assert.equal(save.coins, 30);
  assert.equal(save.xp.jiju, 40);
  assert.equal(save.towerXp, 20);
  assert.equal(result.coinsGained, 30);
  assert.equal(result.heroXpGained, 40);
  assert.equal(result.towerXpGained, 20);
  assert.equal(result.scoreGained, 50);
});

test('an empty reward changes nothing', () => {
  const save = freshSave();
  save.coins = 100;
  save.xp.jiju = 50;
  const result = applyRewards(save, { score: 0, coins: 0, heroXp: 0, towerXp: 0, reason: 'fruit_sliced' });
  assert.equal(save.coins, 100);
  assert.equal(save.xp.jiju, 50);
  assert.equal(result.heroLeveledUp, false);
  assert.equal(result.towerLeveledUp, false);
});

test('coins are capped so rewards cannot overflow the economy', () => {
  const save = freshSave();
  applyRewards(save, { score: 0, coins: 50_000_000, heroXp: 0, towerXp: 0, reason: 'game_over' });
  assert.ok(save.coins <= 1_000_000);
});

test('game over converts final score into coins exactly once', () => {
  const save = freshSave();
  const reward = calculateReward({ type: 'game_over', score: 1800 });
  assert.equal(reward.coins, 100);
  applyRewards(save, reward);
  assert.equal(save.coins, 100);
});

/* ───────────────────────── Combo (§8) ───────────────────────── */

test('combo tiers are data-driven and ordered', () => {
  assert.equal(comboTierAt(0), null);
  assert.equal(comboTierAt(4), null);
  assert.equal(comboTierAt(5)?.label, 'Nice');
  assert.equal(comboTierAt(21)?.label, 'Brutal');
  assert.equal(comboTierAt(999)?.label, 'Unstoppable');
});

test('combo tier bonuses are awarded once per crossing', () => {
  assert.deepEqual(comboTiersBetween(4, 5).map((t) => t.combo), [5]);
  assert.deepEqual(comboTiersBetween(0, 20).map((t) => t.combo), [5, 10, 20]);
  assert.deepEqual(comboTiersBetween(5, 5), []);
  assert.deepEqual(comboTiersBetween(20, 10), []);
});

test('combo milestone rewards scale with the tier', () => {
  const small = calculateReward({ type: 'combo_milestone', combo: 5 });
  const large = calculateReward({ type: 'combo_milestone', combo: 50 });
  assert.ok(large.score > small.score);
  assert.ok(large.heroXp > small.heroXp);
});

/* ───────────────────────── Save integrity (§9) ───────────────────────── */

test('full play → save → reload keeps every progression value', () => {
  const save = freshSave();
  applyRewards(save, { score: 500, coins: 250, heroXp: heroXpForLevel(12), towerXp: 400, reason: 'match_completed' });
  save.coins += 2000;
  assert.equal(purchaseHeroAtomic(save, 'tripos').ok, true);
  writeSave(save);

  const reloaded = loadSave();
  assert.equal(heroXpToLevel(reloaded.xp.jiju), 12);
  assert.ok(reloaded.ownedHeroes.includes('topfu'), 'level 10 unlock must persist');
  assert.ok(reloaded.ownedHeroes.includes('tripos'), 'purchased hero must persist');
  assert.equal(reloaded.coins, save.coins);
  assert.equal(reloaded.towerXp, 400);
  assert.equal(towerLevelFromXp(reloaded.towerXp), towerLevelFromXp(400));
});

test('hero XP never silently resets across a reload', () => {
  const save = freshSave();
  save.xp.jiju = heroXpForLevel(42);
  writeSave(save);
  for (let i = 0; i < 5; i++) {
    const reloaded = loadSave();
    assert.equal(heroXpToLevel(reloaded.xp.jiju), 42);
    writeSave(reloaded);
  }
});

test('cloud merge keeps the highest progression but not stale balances', () => {
  const local = freshSave();
  local.xp.jiju = heroXpForLevel(30);
  local.coins = 100;
  local.saveRevision = 5;
  local.savedAt = 2000;

  const remote: Partial<SaveData> = {
    xp: { jiju: heroXpForLevel(20), topfu: 400, lagen: 0, tripos: 0, ki: 0 },
    coins: 9999,
    saveRevision: 2,
    savedAt: 1000,
  };

  const merged = mergeSaves(local, remote);
  // Progression is monotonic: keep the best of each.
  assert.equal(heroXpToLevel(merged.xp.jiju), 30);
  assert.equal(merged.xp.topfu, 400);
  // Spendable balances follow the newer save, so spending cannot be undone.
  assert.equal(merged.coins, 100, 'stale remote coins must not be restored');
});

test('a newer cloud save wins for spendable balances', () => {
  const local = freshSave();
  local.coins = 100;
  local.saveRevision = 1;
  local.savedAt = 1000;

  const merged = mergeSaves(local, { coins: 4000, saveRevision: 9, savedAt: 5000 });
  assert.equal(merged.coins, 4000);
});

test('legacy saves without revisions fall back to the player-friendly maximum', () => {
  const local = freshSave();
  local.coins = 100;
  local.saveRevision = 0;
  local.savedAt = 0;
  const merged = mergeSaves(local, { coins: 800 });
  assert.equal(merged.coins, 800);
});

test('merging a null remote is a safe no-op', () => {
  const local = freshSave();
  local.xp.jiju = 1234;
  const merged = mergeSaves(local, null);
  assert.equal(merged.xp.jiju, 1234);
});

test('writeSave bumps the revision so merges can order writes', () => {
  const save = freshSave();
  writeSave(save);
  const first = loadSave().saveRevision ?? 0;
  writeSave(save);
  const second = loadSave().saveRevision ?? 0;
  assert.ok(second > first, 'each write must advance the revision');
});

test('corrupt or hostile save data is sanitised, not trusted', () => {
  localStorage.clear();
  localStorage.setItem('fruit-td-save-v1', JSON.stringify({
    hero: 'not-a-hero',
    xp: { jiju: 'lots', topfu: -50, lagen: 1e18 },
    coins: Number.MAX_SAFE_INTEGER,
    skillPoints: -10,
    ownedHeroes: ['jiju', 'ki', 'fake-hero'],
  }));
  const save = loadSave();
  assert.equal(save.hero, 'jiju');
  assert.equal(save.xp.jiju, 0);
  assert.equal(save.xp.topfu, 0);
  assert.ok(save.coins <= 1_000_000);
  assert.ok(save.skillPoints >= 0);
  assert.equal(save.ownedHeroes.includes('fake-hero' as HeroId), false);
});

test('unparseable save data falls back to a clean default', () => {
  localStorage.clear();
  localStorage.setItem('fruit-td-save-v1', '{{{not json');
  const save = loadSave();
  assert.equal(save.hero, 'jiju');
  assert.equal(save.coins, 0);
  assert.deepEqual(save.ownedHeroes, ['jiju']);
});

test('migration: an old save with no perk ranks or revision still loads', () => {
  localStorage.clear();
  localStorage.setItem('fruit-td-save-v1', JSON.stringify({
    hero: 'jiju',
    xp: { jiju: 5000 },
    coins: 300,
    ownedHeroes: ['jiju'],
  }));
  const save = loadSave();
  assert.equal(save.coins, 300);
  assert.ok(save.heroPerkRanks, 'perk ranks must be backfilled');
  assert.equal(heroXpToLevel(save.xp.jiju), heroXpToLevel(5000));
  // Level-based unlocks are reapplied on load.
  if (heroXpToLevel(5000) >= 10) assert.ok(save.ownedHeroes.includes('topfu'));
});

test('rewards granted repeatedly accumulate without duplication', () => {
  const save = freshSave();
  const reward = calculateReward({ type: 'fruit_sliced', baseScore: 10 });
  for (let i = 0; i < 10; i++) applyRewards(save, reward);
  assert.equal(save.coins, reward.coins * 10);
  assert.equal(save.xp.jiju, reward.heroXp * 10);
});
