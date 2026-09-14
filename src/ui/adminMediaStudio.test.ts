import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clampClipRange,
  clipDefFromRange,
  clipEndFrame,
  clipKey,
  coverageForEntity,
  coverageSummary,
  defaultEvents,
  emptyEntityData,
  frameRect,
  indexFromCell,
  migrateStoreToV2,
  normalizeEntityData,
  normalizeEventHook,
  parseEntityPack,
  buildEntityPack,
} from './adminMediaStudio';

test('frameRect maps row-major indices to cells', () => {
  const a = frameRect(0, 4, 3, 128, 96);
  assert.equal(a.col, 0);
  assert.equal(a.row, 0);
  assert.equal(a.sx, 0);
  assert.equal(a.sy, 0);
  assert.equal(a.sw, 32);
  assert.equal(a.sh, 32);

  const b = frameRect(5, 4, 3, 128, 96);
  assert.equal(b.col, 1);
  assert.equal(b.row, 1);
  assert.equal(b.sx, 32);
  assert.equal(b.sy, 32);

  const c = frameRect(11, 4, 3, 128, 96);
  assert.equal(c.col, 3);
  assert.equal(c.row, 2);
});

test('frameRect wraps and honors explicit frame size', () => {
  const wrapped = frameRect(12, 4, 3, 128, 96);
  assert.equal(wrapped.col, 0);
  assert.equal(wrapped.row, 0);

  const custom = frameRect(1, 8, 8, 256, 256, 16, 24);
  assert.equal(custom.sw, 16);
  assert.equal(custom.sh, 24);
  assert.equal(custom.sx, 16);
  assert.equal(custom.sy, 0);
});

test('indexFromCell and clipKey helpers', () => {
  assert.equal(indexFromCell(2, 1, 4), 6);
  assert.equal(clipKey('idle', 'left'), 'idle');
  assert.equal(clipKey('hit', 'up'), 'hit');
  assert.equal(clipKey('death', 'down'), 'death');
  assert.equal(clipKey('walk', 'left'), 'walk_left');
  assert.equal(clipKey('run', 'up'), 'run_up');
});

test('timeline range math: clipDefFromRange / clipEndFrame / clampClipRange', () => {
  const def = clipDefFromRange(3, 7);
  assert.equal(def.startFrame, 3);
  assert.equal(def.frameCount, 5);
  assert.equal(clipEndFrame(def), 7);

  const reversed = clipDefFromRange(7, 3);
  assert.equal(reversed.startFrame, 3);
  assert.equal(reversed.frameCount, 5);

  const clamped = clampClipRange(-2, 99, 16);
  assert.equal(clamped.startFrame, 0);
  assert.equal(clamped.endFrame, 15);
  assert.equal(clamped.frameCount, 16);

  const single = clampClipRange(4, 4, 8);
  assert.equal(single.startFrame, 4);
  assert.equal(single.endFrame, 4);
  assert.equal(single.frameCount, 1);
});

test('migrateStoreToV2 upgrades v1 entities and fills event defaults', () => {
  const v1 = {
    version: 1,
    selectedEntity: 'enemy-swift',
    entities: {
      'enemy-swift': {
        sheetDataUrl: null,
        cols: 4,
        rows: 2,
        frameW: 0,
        frameH: 0,
        clips: { walk_down: { startFrame: 0, frameCount: 4 } },
      },
    },
  };
  const v2 = migrateStoreToV2(v1);
  assert.equal(v2.version, 2);
  assert.equal(v2.selectedEntity, 'enemy-swift');
  const ent = v2.entities['enemy-swift'];
  assert.ok(ent);
  assert.equal(ent.clips.walk_down.frameCount, 4);
  assert.ok(ent.events);
  assert.equal(ent.events!.onHit!.flash, true);
  assert.equal(ent.events!.onDeath!.sfxSlot, 'splatterMed');
});

test('normalizeEntityData preserves clip fps/fx and event hooks', () => {
  const ent = normalizeEntityData({
    sheetDataUrl: 'data:image/png;base64,xx',
    cols: 8,
    rows: 4,
    clips: {
      walk_down: { startFrame: 1, frameCount: 3, fps: 12, fx: 'spark' },
    },
    label: 'Swift Copy',
    events: {
      onSpawn: { sfxSlot: 'gameStart', flash: true, shake: 0.2, fx: 'none' },
    },
  });
  assert.equal(ent.label, 'Swift Copy');
  assert.equal(ent.clips.walk_down.fps, 12);
  assert.equal(ent.clips.walk_down.fx, 'spark');
  assert.equal(ent.events!.onSpawn!.sfxSlot, 'gameStart');
  // Missing onHit/onDeath filled from defaults
  assert.equal(ent.events!.onHit!.flash, true);
});

test('defaultEvents and normalizeEventHook defaults', () => {
  const d = defaultEvents();
  assert.equal(d.onHit!.flash, true);
  assert.ok((d.onHit!.shake ?? 0) > 0);
  const empty = normalizeEventHook(undefined);
  assert.equal(empty.flash, false);
  assert.equal(empty.shake, 0);
  assert.equal(empty.fx, 'none');
});

test('coverage checklist counts clip keys', () => {
  const ent = emptyEntityData();
  ent.clips.idle = { startFrame: 0, frameCount: 1 };
  ent.clips.walk_down = { startFrame: 0, frameCount: 2 };
  ent.sheetDataUrl = 'data:x';
  const cov = coverageForEntity(ent);
  assert.ok(cov.find((c) => c.key === 'idle')!.ok);
  assert.ok(cov.find((c) => c.key === 'walk_down')!.ok);
  assert.equal(cov.find((c) => c.key === 'death')!.ok, false);
  const summary = coverageSummary(ent);
  assert.equal(summary.hasSheet, true);
  assert.equal(summary.filled, 2);
  assert.ok(summary.total >= 11);
});

test('entity pack import/export round-trip', () => {
  const ent = emptyEntityData();
  ent.clips.hit = { startFrame: 2, frameCount: 2, fps: 14 };
  ent.label = 'Pack Test';
  const pack = buildEntityPack('enemy-normal', ent);
  const parsed = parseEntityPack(pack);
  assert.ok(parsed);
  assert.equal(parsed!.entityKey, 'enemy-normal');
  assert.equal(parsed!.entity.label, 'Pack Test');
  assert.equal(parsed!.entity.clips.hit.fps, 14);
  assert.equal(parseEntityPack({ kind: 'nope' }), null);
});
