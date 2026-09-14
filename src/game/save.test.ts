import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HERO_PERKS } from './heroProgression';
import { HEROES } from './heroes';

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

import { mergeSaves, sanitiseSave, defaultSave, type SaveData } from './save';

test('save validation prevents absurd economy values', () => {
  const save = defaultSave();
  save.coins = 99_999_999_999;
  save.highScore = 99_999_999_999;
  save.skillPoints = 99_999;
  save.games = 99_999_999;
  save.bestWave = 99_999;
  
  const clean = sanitiseSave(save);
  
  assert.ok(clean.coins <= 1_000_000, 'Coins should be capped at 1M');
  assert.ok(clean.highScore <= 100_000_000, 'High score should be capped at 100M');
  assert.ok(clean.skillPoints <= 10_000, 'Skill points should be capped at 10K');
  assert.ok(clean.games <= 1_000_000, 'Games should be capped at 1M');
  assert.ok(clean.bestWave <= 9999, 'Best wave should be capped at 9999');
});

test('hero perk ranks migrate from old localStorage key format', () => {
  const save = defaultSave();
  
  if (!save.heroPerkRanks) save.heroPerkRanks = { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} };
  save.heroPerkRanks.jiju.combo = 2;
  save.heroPerkRanks.topfu.critical = 1;
  
  const clean = sanitiseSave(save);
  
  assert.equal(clean.heroPerkRanks!.jiju.combo, 2, 'Jiju combo perk should be preserved');
  assert.equal(clean.heroPerkRanks!.topfu.critical, 1, 'Topfu critical perk should be preserved');
  
  for (const hero of HEROES) {
    assert.ok(clean.heroPerkRanks![hero.id], `Hero ${hero.id} should have perk ranks object`);
    for (const perk of HERO_PERKS) {
      const rank = Number(clean.heroPerkRanks![hero.id][perk.id]) || 0;
      assert.ok(rank >= 0 && rank <= perk.maxRank, `${hero.id} ${perk.id} rank should be valid`);
    }
  }
});

test('hero perk ranks respect max rank limits when sanitizing', () => {
  const save = defaultSave();
  
  if (!save.heroPerkRanks) save.heroPerkRanks = { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} };
  
  for (const hero of HEROES) {
    for (const perk of HERO_PERKS) {
      (save.heroPerkRanks[hero.id][perk.id] as any) = 999;
    }
  }
  
  const clean = sanitiseSave(save);
  
  for (const hero of HEROES) {
    for (const perk of HERO_PERKS) {
      const rank = Number(clean.heroPerkRanks![hero.id][perk.id]) || 0;
      assert.ok(rank <= perk.maxRank, `${hero.id} ${perk.id} rank ${rank} should not exceed max ${perk.maxRank}`);
    }
  }
});

test('cloud save merge preserves highest hero perk ranks', () => {
  const local = defaultSave();
  const remote: Partial<SaveData> = { ...defaultSave() };
  
  if (!local.heroPerkRanks) local.heroPerkRanks = { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} };
  if (!remote.heroPerkRanks) remote.heroPerkRanks = { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} };
  
  local.heroPerkRanks.jiju.combo = 2;
  remote.heroPerkRanks.jiju.combo = 3;
  local.heroPerkRanks.jiju.juice = 1;
  remote.heroPerkRanks.topfu.tower = 2;
  
  const merged = mergeSaves(local, remote);
  
  assert.equal(merged.heroPerkRanks!.jiju.combo, 3, 'Should take higher combo rank from remote');
  assert.equal(Number(merged.heroPerkRanks!.jiju.juice) || 0, 1, 'Should preserve local-only juice rank');
  assert.equal(Number(merged.heroPerkRanks!.topfu.tower) || 0, 2, 'Should preserve remote-only tower rank');
});

test('cloud save merge takes maximum of economy values', () => {
  const local = defaultSave();
  local.coins = 1000;
  local.highScore = 5000;
  local.skillPoints = 3;
  
  const remote: Partial<SaveData> = {
    coins: 800,
    highScore: 6000,
    skillPoints: 5,
  };
  
  const merged = mergeSaves(local, remote);
  
  assert.equal(merged.coins, 1000, 'Should take higher coins from local');
  assert.equal(merged.highScore, 6000, 'Should take higher score from remote');
  assert.equal(merged.skillPoints, 5, 'Should take higher skill points from remote');
});
