import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeSaves, defaultSave, type SaveData } from './save';

// Note: sanitiseSave is internal, tested via mergeSaves and other exported functions

test('save merge caps coins at 1M maximum', () => {
  const local: SaveData = { ...defaultSave(), coins: 500_000 };
  const remote: Partial<SaveData> = { coins: 800_000 };
  const merged = mergeSaves(local, remote);
  assert.ok(merged.coins <= 1_000_000, 'Merged coins should respect 1M cap');
  assert.equal(merged.coins, 800_000, 'Should take max of local/remote within cap');
});

test('save merge prevents coin inflation via absurd remote values', () => {
  const local: SaveData = { ...defaultSave(), coins: 10_000 };
  const remote: Partial<SaveData> = { coins: 999_999_999 };
  const merged = mergeSaves(local, remote);
  assert.ok(merged.coins <= 1_000_000, 'Merge should cap absurd remote coins at 1M');
});

test('save merge caps skill points', () => {
  const local: SaveData = { ...defaultSave(), skillPoints: 50 };
  const remote: Partial<SaveData> = { skillPoints: 999_999 };
  const merged = mergeSaves(local, remote);
  assert.ok(merged.skillPoints <= 10_000, 'Merge should cap absurd remote skill points at 10K');
});

test('save merge caps hero XP per hero', () => {
  const local: SaveData = {
    ...defaultSave(),
    xp: { jiju: 50_000, topfu: 0, lagen: 0, tripos: 0, ki: 0 },
  };
  const remote: Partial<SaveData> = {
    xp: { jiju: 999_999_999, topfu: 10_000, lagen: 0, tripos: 0, ki: 0 },
  };
  const merged = mergeSaves(local, remote);
  assert.ok(merged.xp.jiju <= 1_000_000, 'Hero XP should be capped at 1M after merge');
  assert.equal(merged.xp.topfu, 10_000, 'Valid hero XP should be preserved');
});

test('save merge handles missing remote gracefully', () => {
  const local: SaveData = { ...defaultSave(), coins: 5000 };
  const merged = mergeSaves(local, null);
  assert.equal(merged.coins, 5000, 'Should return sanitized local when remote is null');
});

test('save merge combines owned skins', () => {
  const local: SaveData = {
    ...defaultSave(),
    ownedSkins: ['blade-default', 'blade-gold'],
  };
  const remote: Partial<SaveData> = {
    ownedSkins: ['blade-default', 'blade-ink'],
  };
  const merged = mergeSaves(local, remote);
  assert.ok(merged.ownedSkins.includes('blade-default'), 'Should include default blade');
  assert.ok(merged.ownedSkins.includes('blade-gold'), 'Should include local blade');
  assert.ok(merged.ownedSkins.includes('blade-ink'), 'Should include remote blade');
});
