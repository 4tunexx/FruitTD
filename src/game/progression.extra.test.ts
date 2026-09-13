import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HERO_PERKS, heroPerkMultiplier, heroPerkRank } from './heroProgression';
import { TOWER_MILESTONES } from './towerMilestones';

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
