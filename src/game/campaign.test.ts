import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignBoss, campaignWaves, defaultCampaignBoss, sanitizeCampaignProgress } from './campaign';
import { modeRules } from './modes';
import { wavesPerLevel } from './waves';

test('campaign wave schedule matches the stage milestones through stage 100', () => {
  assert.deepEqual([1, 9, 10, 19, 20, 29, 30, 100].map(campaignWaves), [5, 5, 10, 10, 20, 20, 30, 100]);
});

test('the 100 generated campaign bosses have distinct names and increasing threat/rewards', () => {
  const bosses = Array.from({ length: 100 }, (_, index) => defaultCampaignBoss(index + 1));
  assert.equal(new Set(bosses.map((boss) => boss.name)).size, 100);
  assert.ok(bosses[99].difficulty > bosses[0].difficulty);
  assert.ok(bosses[99].rewardCoins > bosses[0].rewardCoins);
  assert.ok(bosses[99].rewardGems > bosses[0].rewardGems);
});

test('campaign roster overrides and saved unlock progress are bounded', () => {
  const art = 'data:image/webp;base64,abc';
  const roster = Array.from({ length: 7 }, () => ({})); roster[6] = { name: 'Custom Boss', revealImage: art };
  assert.equal(campaignBoss(7, roster).name, 'Custom Boss');
  assert.equal(campaignBoss(7, roster).revealImage, art);
  assert.deepEqual(sanitizeCampaignProgress({ unlocked: 2, cleared: [1, 1, 101, -2, 4] }), { unlocked: 5, cleared: [1, 4] });
});

test('Horde and Campaign rules are playable modes, and Horde has no guest assist', () => {
  assert.equal(modeRules('horde').guest, false);
  assert.equal(modeRules('campaign').guest, false);
  assert.equal(modeRules('coop').guest, true);
  assert.equal(wavesPerLevel(100, 'horde'), 5);
  assert.equal(wavesPerLevel(100, 'campaign'), 100);
});
