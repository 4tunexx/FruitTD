import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  authoredWavesPerLevel,
  authoredWaveToPlan,
  ensureAuthoredLevel,
  expandSpawns,
  getLiveWavesConfig,
  normalizeCreatorWavesStore,
  previewSummary,
  resolveAuthoredLevel,
  setLiveWavesConfig,
  tryAuthoredPlanBossWave,
  tryAuthoredPlanWave,
  type CreatorWavesStore,
} from './creatorWaves';

function sampleStore(): CreatorWavesStore {
  return normalizeCreatorWavesStore({
    version: 1,
    levels: {
      '3': {
        level: 3,
        wavesCount: 5,
        waves: [
          {
            title: 'LEVEL 3  ·  WAVE 1/5',
            subtitle: 'Custom opener',
            gap: 0.55,
            hpScale: 1.4,
            spawns: [
              { fruit: 'lemon', enemy: 'normal', count: 2 },
              { fruit: 'bomb', enemy: 'explosive', count: 1 },
            ],
          },
          {
            title: 'LEVEL 3  ·  WAVE 2/5',
            spawns: [{ fruit: 'strawberry', enemy: 'swift', count: 4 }],
          },
          { spawns: [{ fruit: 'orange', enemy: 'normal', count: 3 }] },
          { spawns: [{ fruit: 'kiwi', enemy: 'normal', count: 3 }] },
          {
            boss: true,
            title: 'Mini boss pack',
            spawns: [{ fruit: 'watermelon', enemy: 'armored', count: 1, boss: true }],
          },
        ],
        bossWave: {
          title: 'LEVEL 3  ·  OVERLORD',
          subtitle: 'Authored overlord',
          gap: 1.1,
          spawns: [{ fruit: 'watermelon', enemy: 'armored', count: 1, boss: true }],
        },
      },
    },
  });
}

describe('creatorWaves helpers', () => {
  it('previewSummary matches Level N → waves + boss', () => {
    const level = ensureAuthoredLevel(3, { wavesCount: 5 });
    assert.equal(previewSummary(level), 'Level 3 → 5 waves + boss');
  });

  it('expandSpawns expands counts and boss flags', () => {
    const items = expandSpawns([
      { fruit: 'lemon', enemy: 'normal', count: 2 },
      { fruit: 'watermelon', enemy: 'armored', count: 1, boss: true },
    ]);
    assert.equal(items.length, 3);
    assert.equal(items[0].kind, 'lemon');
    assert.equal(items[2].boss, true);
    assert.equal(items[2].enemy, 'armored');
  });

  it('resolveAuthoredLevel prefers creator draft over live', () => {
    const creator = sampleStore();
    const live = normalizeCreatorWavesStore({
      version: 1,
      levels: {
        '3': ensureAuthoredLevel(3, {
          wavesCount: 7,
          waves: Array.from({ length: 7 }, () => ({
            spawns: [{ fruit: 'banana', enemy: 'normal', count: 1 }],
          })),
        }),
      },
    });
    const resolved = resolveAuthoredLevel(3, { creator, live });
    assert.ok(resolved);
    assert.equal(resolved!.wavesCount, 5);
    assert.equal(resolved!.waves[0].subtitle, 'Custom opener');
  });

  it('authoredWavesPerLevel falls back to procedural max(5,N)', () => {
    assert.equal(authoredWavesPerLevel(7, {}), 7);
    assert.equal(authoredWavesPerLevel(2, {}), 5);
    assert.equal(authoredWavesPerLevel(3, { creator: sampleStore() }), 5);
  });

  it('tryAuthoredPlanWave builds WavePlan from pack', () => {
    const plan = tryAuthoredPlanWave(10, 'casual', 3, 1, 5, { creator: sampleStore() });
    assert.ok(plan);
    assert.equal(plan!.items.length, 3);
    assert.equal(plan!.gap, 0.55);
    assert.equal(plan!.hpScale, 1.4);
    assert.equal(plan!.boss, false);
    assert.match(plan!.title, /LEVEL 3/);
    assert.equal(plan!.subtitle, 'Custom opener');
  });

  it('tryAuthoredPlanBossWave uses explicit boss slot', () => {
    const plan = tryAuthoredPlanBossWave(12, 'ranked', 3, { creator: sampleStore() });
    assert.ok(plan);
    assert.equal(plan!.boss, true);
    assert.equal(plan!.items.length, 1);
    assert.equal(plan!.items[0].boss, true);
    assert.equal(plan!.subtitle, 'Authored overlord');
    assert.equal(plan!.waveInLevel, 6);
  });

  it('authoredWaveToPlan returns null for empty spawns', () => {
    const plan = authoredWaveToPlan(
      { spawns: [] },
      { wave: 1, mode: 'casual', level: 1, waveInLevel: 1, wavesInLevel: 5 },
    );
    assert.equal(plan, null);
  });

  it('tryAuthoredPlanWave returns null when level missing (procedural fallback path)', () => {
    const plan = tryAuthoredPlanWave(1, 'casual', 99, 1, 5, { live: { version: 1, levels: {} } });
    assert.equal(plan, null);
  });

  it('setLiveWavesConfig feeds resolveAuthoredLevel live source', () => {
    setLiveWavesConfig(sampleStore());
    try {
      assert.ok(getLiveWavesConfig());
      const plan = tryAuthoredPlanWave(10, 'casual', 3, 2, 5, { live: getLiveWavesConfig() });
      assert.ok(plan);
      assert.equal(plan!.items.length, 4);
      assert.equal(plan!.items[0].enemy, 'swift');
    } finally {
      setLiveWavesConfig(null);
    }
  });

  it('ensureAuthoredLevel keeps max(5,N)-style counts editable', () => {
    const l1 = ensureAuthoredLevel(1);
    assert.equal(l1.wavesCount, 5);
    assert.equal(l1.waves.length, 5);
    assert.ok(l1.bossWave);
    const l8 = ensureAuthoredLevel(8, { wavesCount: 8 });
    assert.equal(l8.wavesCount, 8);
    assert.equal(previewSummary(l8), 'Level 8 → 8 waves + boss');
  });
});
