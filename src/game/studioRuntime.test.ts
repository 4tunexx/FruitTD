import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceFrameCursor,
  bossStudioCandidates,
  bossStudioKey,
  BOSS_OVERLORD_STUDIO_KEY,
  directionFromVelocity,
  enemyKindToStudioKey,
  fireStudioEvent,
  heroIdToStudioKey,
  invalidateStudioRuntimeCache,
  resolveFruitStudioKey,
  resolveStudioHook,
  setStudioFxCallbacks,
  STUDIO_DEFAULT_FPS,
  TOWER_STUDIO_KEY,
} from './studioRuntime';

test('enemyKindToStudioKey maps all enemy kinds', () => {
  assert.equal(enemyKindToStudioKey('normal'), 'enemy-normal');
  assert.equal(enemyKindToStudioKey('explosive'), 'enemy-explosive');
  assert.equal(enemyKindToStudioKey('armored'), 'enemy-armored');
  assert.equal(enemyKindToStudioKey('splitter'), 'enemy-splitter');
  assert.equal(enemyKindToStudioKey('swift'), 'enemy-swift');
});

test('directionFromVelocity picks dominant axis', () => {
  assert.equal(directionFromVelocity(-2, 0.1), 'left');
  assert.equal(directionFromVelocity(2, 0.1), 'right');
  assert.equal(directionFromVelocity(0.1, -2), 'down');
  assert.equal(directionFromVelocity(0.1, 2), 'up');
  assert.equal(directionFromVelocity(0, 0), 'down');
});

test('advanceFrameCursor steps by fps and wraps', () => {
  const a = advanceFrameCursor(0, 0.1, 10, 4);
  assert.equal(a.frameIndex, 1);
  assert.ok(Math.abs(a.cursor - 1) < 1e-9);

  const b = advanceFrameCursor(3.9, 0.05, 10, 4);
  assert.equal(b.frameIndex, 0); // floor(4.4) % 4 === 0
  assert.ok(b.cursor > 3.9);

  const c = advanceFrameCursor(0, 1 / STUDIO_DEFAULT_FPS, STUDIO_DEFAULT_FPS, 1);
  assert.equal(c.frameIndex, 0);

  const d = advanceFrameCursor(0, 0, 8, 6);
  assert.equal(d.frameIndex, 0);
  assert.equal(d.cursor, 0);
});

test('fireStudioEvent invokes callbacks for hooks in localStorage store', () => {
  // Minimal localStorage polyfill for node tests.
  const mem = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k, v) => {
      mem.set(k, String(v));
    },
    removeItem: (k) => {
      mem.delete(k);
    },
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;

  const store = {
    version: 2,
    selectedEntity: 'enemy-normal',
    entities: {
      'enemy-normal': {
        sheetDataUrl: null,
        cols: 4,
        rows: 4,
        frameW: 0,
        frameH: 0,
        clips: {},
        events: {
          onHit: { sfxSlot: 'lemonImpact', flash: true, shake: 0.4, fx: 'screen-shake' },
          onSpawn: { flash: false, shake: 0, fx: 'none' },
          onDeath: { sfxSlot: 'splatterMed', flash: true, shake: 0.8, fx: 'juice-burst' },
        },
      },
    },
  };
  mem.set('fruittd-creator-v2', JSON.stringify(store));
  invalidateStudioRuntimeCache();

  const shakes: number[] = [];
  const sfx: string[] = [];
  const bursts: string[] = [];
  setStudioFxCallbacks({
    shake: (a) => shakes.push(a),
    playSfxSlot: (id) => sfx.push(id),
    juiceBurst: (_x, _y, _z, preset) => bursts.push(preset),
  });

  const hit = fireStudioEvent('enemy-normal', 'onHit', { x: 0, y: 1, z: 0 });
  assert.ok(hit);
  assert.equal(hit!.flash, true);
  assert.equal(hit!.sfxSlot, 'lemonImpact');
  assert.ok(shakes.includes(0.4));
  assert.ok(sfx.includes('lemonImpact'));

  const death = fireStudioEvent('enemy-normal', 'onDeath', { x: 1, y: 1, z: 1 });
  assert.ok(death);
  assert.ok(sfx.includes('splatterMed'));
  assert.ok(bursts.includes('juice-burst'));

  const hook = resolveStudioHook('enemy-normal', 'onHit');
  assert.equal(hook?.sfxSlot, 'lemonImpact');

  setStudioFxCallbacks({});
});


test('heroIdToStudioKey maps hero ids', () => {
  assert.equal(heroIdToStudioKey('jiju'), 'hero-jiju');
  assert.equal(heroIdToStudioKey('topfu'), 'hero-topfu');
  assert.equal(heroIdToStudioKey('ki'), 'hero-ki');
  assert.equal(heroIdToStudioKey('TRIPOS'), 'hero-tripos');
});

test('tower and boss studio key helpers', () => {
  assert.equal(TOWER_STUDIO_KEY, 'tower-main');
  assert.equal(BOSS_OVERLORD_STUDIO_KEY, 'boss-overlord');
  assert.equal(bossStudioKey(), 'boss-overlord');
  assert.equal(bossStudioKey(null), 'boss-overlord');
  assert.equal(bossStudioKey('watermelon'), 'boss-watermelon');
  assert.deepEqual(bossStudioCandidates('watermelon'), ['boss-watermelon', 'boss-overlord']);
  assert.deepEqual(bossStudioCandidates(), ['boss-overlord']);
});

test('enemyKindToStudioKey and resolveFruitStudioKey fallbacks without store', () => {
  assert.equal(enemyKindToStudioKey('normal'), 'enemy-normal');
  assert.equal(enemyKindToStudioKey('armored'), 'enemy-armored');
  // No Creator packs in store → boss falls back to enemy key.
  assert.equal(resolveFruitStudioKey('armored', true, 'watermelon'), 'enemy-armored');
  assert.equal(resolveFruitStudioKey('swift', false), 'enemy-swift');
  assert.equal(resolveFruitStudioKey('normal', false, 'lemon'), 'enemy-normal');
});

test('resolveFruitStudioKey prefers boss-overlord when pack has clips', () => {
  const mem = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k, v) => {
      mem.set(k, String(v));
    },
    removeItem: (k) => {
      mem.delete(k);
    },
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;

  const entities: Record<string, unknown> = {
    'boss-overlord': {
      sheetDataUrl: 'data:image/png;base64,xxx',
      cols: 4,
      rows: 4,
      frameW: 0,
      frameH: 0,
      clips: {
        walk_down: { startFrame: 0, frameCount: 4, fps: 10 },
      },
      events: {},
    },
  };
  const store = {
    version: 2,
    selectedEntity: 'boss-overlord',
    entities,
  };
  mem.set('fruittd-creator-v2', JSON.stringify(store));
  invalidateStudioRuntimeCache();

  assert.equal(resolveFruitStudioKey('armored', true, 'watermelon'), 'boss-overlord');
  assert.equal(resolveFruitStudioKey('normal', false), 'enemy-normal');

  // Specific boss fruit pack wins when present.
  entities['boss-watermelon'] = {
    sheetDataUrl: 'data:image/png;base64,yyy',
    cols: 2,
    rows: 2,
    frameW: 0,
    frameH: 0,
    clips: { idle: { startFrame: 0, frameCount: 2, fps: 8 } },
    events: {},
  };
  mem.set('fruittd-creator-v2', JSON.stringify(store));
  invalidateStudioRuntimeCache();
  assert.equal(resolveFruitStudioKey('armored', true, 'watermelon'), 'boss-watermelon');

  invalidateStudioRuntimeCache();
});
