import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignStory } from './campaignStory';
import { campaignBossDefeated, createState } from './state';

test('campaign reveals twenty distinct authored chapters at five-stage milestones', () => {
  const chapters = Array.from({ length: 20 }, (_, index) => campaignStory((index + 1) * 5)!);
  assert.equal(new Set(chapters.map((chapter) => chapter.title)).size, 20);
  assert.equal(chapters[0].chapter, 1);
  assert.equal(chapters[19].chapter, 20);
  for (const stage of [0, 1, 6, 99, 101]) assert.equal(campaignStory(stage), null);
});

test('a breached boss cannot clear or unlock a campaign stage', () => {
  const state = createState();
  state.waveTotal = 1;
  state.waveKilled = 0;
  state.waveLeaks = 1;
  assert.equal(campaignBossDefeated(state, true), false);
  state.waveKilled = 1;
  state.waveLeaks = 0;
  assert.equal(campaignBossDefeated(state, true), true);
  assert.equal(campaignBossDefeated(state, false), false);
});
