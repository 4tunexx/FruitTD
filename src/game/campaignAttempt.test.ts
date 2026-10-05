import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createState } from './state';
import { finishCampaignAttempt } from './campaignAttempt';

test('every campaign boss ends its own match and unlocks one stage without auto advancing combat', () => {
  let progress = { unlocked: 1, cleared: [] as number[] };
  for (let stage = 1; stage <= 100; stage++) {
    const state = createState();
    state.mode = 'campaign'; state.level = stage; state.running = true;
    state.waveSpawning = true; state.waveIsBoss = true; state.bossIntro = true;
    state.waveTotal = 4; state.waveKilled = 1; // boss killed, adds still alive
    const completion = finishCampaignAttempt(state, progress, true)!;
    assert.ok(completion);
    assert.equal(state.running, false);
    assert.equal(state.waveSpawning, false);
    assert.equal(state.waveIsBoss, false);
    assert.equal(state.bossIntro, false);
    assert.equal(state.level, stage, 'combat must not advance to the next stage');
    assert.equal(completion.chapter, stage % 5 === 0);
    assert.equal(completion.final, stage === 100);
    assert.equal(completion.progress.unlocked, Math.min(100, stage + 1));
    assert.equal(finishCampaignAttempt(state, completion.progress, true), null, 'duplicate boss callbacks cannot settle twice');
    progress = completion.progress;
  }
  assert.equal(progress.cleared.length, 100);
});

test('a breach, normal enemy death, or another game mode cannot complete Campaign', () => {
  const state = createState(); state.mode = 'campaign'; state.running = true;
  const progress = { unlocked: 1, cleared: [] };
  assert.equal(finishCampaignAttempt(state, progress, false), null);
  state.lives = 0;
  assert.equal(finishCampaignAttempt(state, progress, true), null);
  state.mode = 'horde'; state.lives = 10;
  assert.equal(finishCampaignAttempt(state, progress, true), null);
  assert.deepEqual(progress, { unlocked: 1, cleared: [] });
});
