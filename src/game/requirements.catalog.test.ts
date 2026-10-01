import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_BADGES,
  DEFAULT_MISSIONS,
  mergeRewardDefaults,
  requirementById,
} from './requirements';
import { mergeAdminConfig } from '../services/admin';

test('production content ships 50 main missions, 5 daily missions, 50 achievements and 20 badges', () => {
  assert.equal(DEFAULT_MISSIONS.filter((mission) => mission.type === 'main').length, 50);
  assert.equal(DEFAULT_MISSIONS.filter((mission) => mission.type === 'daily').length, 5);
  assert.equal(DEFAULT_MISSIONS.length, 55);
  assert.equal(DEFAULT_ACHIEVEMENTS.length, 50);
  assert.equal(DEFAULT_BADGES.length, 20);

  for (const [label, rows] of [
    ['mission', DEFAULT_MISSIONS],
    ['achievement', DEFAULT_ACHIEVEMENTS],
    ['badge', DEFAULT_BADGES],
  ] as const) {
    assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, `${label} IDs must be unique`);
    for (const row of rows) {
      assert.ok(row.icon.length > 2, `${row.id} must use a Lucide icon name`);
      assert.ok(!row.requirement || requirementById(row.requirement.type), `${row.id} has an unknown requirement`);
    }
  }
});

test('old Mongo content keeps edits and receives missing production defaults once', () => {
  const configured = [{ ...DEFAULT_MISSIONS[0], title: 'Admin edited title', rewardCoins: 999 }];
  const merged = mergeRewardDefaults(configured, DEFAULT_MISSIONS);
  assert.equal(merged.length, 55);
  assert.equal(merged[0].title, 'Admin edited title');
  assert.equal(merged[0].rewardCoins, 999);
  assert.equal(new Set(merged.map((row) => row.id)).size, 55);
});

test('Admin configuration preserves an intentionally shortened reward catalogue', () => {
  const oneMission = [{ ...DEFAULT_MISSIONS[0], title: 'Admin title' }];
  const config = mergeAdminConfig({ missions: oneMission, achievements: [], badges: [] });
  assert.deepEqual(config.missions, oneMission);
  assert.deepEqual(config.achievements, []);
  assert.deepEqual(config.badges, []);
});
