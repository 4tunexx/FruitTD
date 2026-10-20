import assert from 'node:assert/strict';
import { test } from 'node:test';
import { questNotice } from './questNotices';

test('progress popups distinguish achievements, main missions, daily missions and badges from paid rewards', () => {
  const cases = [
    ['achievement', 'ACHIEVEMENT UNLOCKED', 'Achievements'],
    ['main', 'MAIN MISSION COMPLETE', 'Missions'],
    ['daily', 'DAILY MISSION COMPLETE', 'Missions'],
    ['badge', 'BADGE UNLOCKED', 'Badges'],
  ] as const;
  for (const [kind, label, destination] of cases) {
    const ready = questNotice(kind, 'ready', 'Fresh Cut', '80 Coins');
    assert.equal(ready.title, `${label} · Fresh Cut`);
    assert.equal(ready.message, `Open ${destination} to claim your reward.`);
    assert.equal(ready.meta, 'Reward available: 80 Coins');
    const paid = questNotice(kind, 'received', 'Fresh Cut', '80 Coins');
    assert.match(paid.title, /REWARD RECEIVED/);
    assert.equal(paid.message, 'Reward added to your account.');
    assert.equal(paid.meta, '+80 Coins');
  }
});

test('daily login and seasonal prizes have their own labels', () => {
  assert.equal(questNotice('daily-login', 'received', 'Daily supply').title, 'DAILY LOGIN REWARD RECEIVED · Daily supply');
  assert.equal(questNotice('season', 'received', 'Gold').title, 'SEASON PRIZE REWARD RECEIVED · Gold');
});
