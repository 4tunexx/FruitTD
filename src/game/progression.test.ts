import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HEROES, MAX_HERO_LEVEL, heroXpForLevel, heroXpToLevel } from './heroes';
import { ENEMY_RULES, specialEnemyForWave } from './enemies';

 test('hero progression reaches level 100 and keeps unlock milestones', () => {
  assert.equal(MAX_HERO_LEVEL, 100);
  assert.equal(heroXpToLevel(heroXpForLevel(10)), 10);
  assert.equal(heroXpToLevel(heroXpForLevel(50)), 50);
  assert.equal(heroXpToLevel(heroXpForLevel(100)), 100);
  assert.equal(HEROES.find((h) => h.id === 'topfu')?.unlockLevel, 10);
  assert.equal(HEROES.find((h) => h.id === 'lagen')?.unlockLevel, 25);
  assert.equal(HEROES.find((h) => h.id === 'tripos')?.purchaseOnly, true);
  assert.equal(HEROES.find((h) => h.id === 'ki')?.purchaseOnly, true);
});

test('special enemies become available in later waves', () => {
  assert.equal(specialEnemyForWave(1, 0), 'normal');
  assert.equal(specialEnemyForWave(4, 0.1), 'explosive');
  assert.equal(specialEnemyForWave(5, 0.15), 'swift');
  assert.equal(specialEnemyForWave(8, 0.08), 'armored');
  assert.equal(specialEnemyForWave(12, 0.01), 'splitter');
  assert.equal(ENEMY_RULES.explosive.towerDamageOnHit, 2);
  assert.equal(ENEMY_RULES.explosive.towerDamageOnLeak, 3);
});


test('enemy kinds stay stable with fruit-zombie fantasy labels', () => {
  const kinds = Object.keys(ENEMY_RULES).sort();
  assert.deepEqual(kinds, ['armored', 'explosive', 'normal', 'splitter', 'swift']);
  assert.equal(ENEMY_RULES.explosive.label, 'Chem-Burst');
  assert.match(ENEMY_RULES.explosive.warning, /CHEM-BURST/);
  assert.equal(ENEMY_RULES.armored.label, 'Rind-Plate');
  assert.equal(ENEMY_RULES.splitter.label, 'Pod-Spawner');
  assert.equal(ENEMY_RULES.swift.label, 'Juice-Runner');
  assert.equal(ENEMY_RULES.normal.label, 'Rot-Walker');
  for (const rule of Object.values(ENEMY_RULES)) {
    assert.ok(rule.flavor.length > 0, `${rule.kind} needs flavor`);
  }
});
