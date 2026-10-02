import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignStory, DEFAULT_CAMPAIGN_STORIES } from './campaignStory';
import { campaignStoriesError } from '../../server/routes/admin';
import { campaignBossDefeated, createState } from './state';

test('campaign reveals twenty distinct authored chapters at five-stage milestones', () => {
  const chapters = Array.from({ length: 20 }, (_, index) => campaignStory((index + 1) * 5)!);
  assert.equal(new Set(chapters.map((chapter) => chapter.title)).size, 20);
  assert.equal(chapters[0].chapter, 1);
  assert.equal(chapters[19].chapter, 20);
  for (const stage of [0, 1, 6, 99, 101]) assert.equal(campaignStory(stage), null);
  assert.ok(chapters.every((chapter) => chapter.text.length > 180));
  assert.equal(campaignStoriesError(DEFAULT_CAMPAIGN_STORIES), null);
  assert.equal(campaignStoriesError(DEFAULT_CAMPAIGN_STORIES.slice(1)), 'Provide exactly 20 campaign chapters.');
  const custom = DEFAULT_CAMPAIGN_STORIES.map((chapter) => ({ ...chapter }));
  custom[4].title = 'The Player’s Chapter';
  assert.equal(campaignStory(25, custom)?.title, 'The Player’s Chapter');
  assert.equal(campaignStory(30, custom)?.title, DEFAULT_CAMPAIGN_STORIES[5].title);
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
