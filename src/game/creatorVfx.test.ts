import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SLICERS } from './slicers';
import {
  CREATOR_VFX_STORAGE_KEY,
  applySlicerPackOverrides,
  defaultPresets,
  fireCreatorSlicerVfx,
  invalidateCreatorVfxCache,
  mergeSlicerPacksIntoCatalog,
  normalizeCreatorVfxStore,
  previewVfxPayload,
  resolveSlicerBind,
  saveCreatorVfxStore,
  setCreatorVfxCallbacks,
  type CreatorVfxStore,
} from './creatorVfx';

function sampleStore(): CreatorVfxStore {
  return normalizeCreatorVfxStore({
    version: 1,
    presets: [
      ...defaultPresets(),
      {
        id: 'custom-crit',
        name: 'Crit Spark',
        kind: 'spark',
        intensity: 1.5,
        duration: 0.4,
        color: '#ff8800',
      },
    ],
    slicers: {
      'blade-default': {
        id: 'blade-default',
        color: '#00ffaa',
        damageMul: 1.25,
        juiceMul: 1.1,
        brittleBonus: 0.5,
        binds: {
          onSlash: 'slash-arc',
          onCrit: 'custom-crit',
          onKill: 'screen-shake',
        },
      },
    },
    selectedSlicerId: 'blade-default',
    selectedPresetId: 'slash-arc',
  });
}

function ensureMemoryLocalStorage(): void {
  try {
    if (typeof globalThis.localStorage !== 'undefined' && globalThis.localStorage.getItem('__probe__') === null) {
      // existing localStorage is usable
      return;
    }
  } catch {
    /* fall through to memory stub */
  }
  const data: Record<string, string> = {};
  (globalThis as { localStorage: Storage }).localStorage = {
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      for (const k of Object.keys(data)) delete data[k];
    },
    getItem(k: string) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k: string, v: string) {
      data[k] = String(v);
    },
    removeItem(k: string) {
      delete data[k];
    },
    key(i: number) {
      return Object.keys(data)[i] ?? null;
    },
  };
}

describe('creatorVfx helpers', () => {
  before(() => {
    ensureMemoryLocalStorage();
  });

  it('normalizes default presets and empty store', () => {
    const empty = normalizeCreatorVfxStore(null);
    assert.equal(empty.version, 1);
    assert.ok(empty.presets.length >= 5);
    assert.ok(empty.presets.some((p) => p.kind === 'slash-arc'));
    assert.ok(empty.presets.some((p) => p.kind === 'juice-burst'));
  });

  it('applySlicerPackOverrides overlays authored fields', () => {
    const base = DEFAULT_SLICERS[0];
    const store = sampleStore();
    const merged = applySlicerPackOverrides(base, store.slicers['blade-default']);
    assert.equal(merged.color, '#00ffaa');
    assert.equal(merged.damageMul, 1.25);
    assert.equal(merged.juiceMul, 1.1);
    assert.equal(merged.brittleBonus, 0.5);
    assert.equal(merged.id, base.id);
    assert.equal(merged.name, base.name);
  });

  it('mergeSlicerPacksIntoCatalog leaves unbound slicers intact', () => {
    const store = sampleStore();
    const list = mergeSlicerPacksIntoCatalog(DEFAULT_SLICERS, store);
    const def = list.find((s) => s.id === 'blade-default')!;
    const gold = list.find((s) => s.id === 'blade-gold')!;
    assert.equal(def.damageMul, 1.25);
    assert.equal(gold.damageMul, DEFAULT_SLICERS.find((s) => s.id === 'blade-gold')!.damageMul);
  });

  it('resolveSlicerBind maps events to presets', () => {
    const store = sampleStore();
    const slash = resolveSlicerBind('blade-default', 'onSlash', store);
    const crit = resolveSlicerBind('blade-default', 'onCrit', store);
    const miss = resolveSlicerBind('blade-gold', 'onSlash', store);
    assert.equal(slash?.kind, 'slash-arc');
    assert.equal(crit?.id, 'custom-crit');
    assert.equal(miss, null);
  });

  it('previewVfxPayload reports shake / juice / slash color', () => {
    const store = sampleStore();
    const slash = previewVfxPayload(store, 'blade-default', 'onSlash');
    const kill = previewVfxPayload(store, 'blade-default', 'onKill');
    assert.ok(slash);
    assert.equal(slash!.kind, 'slash-arc');
    assert.ok(slash!.slashColor != null);
    assert.ok(kill);
    assert.ok(kill!.shake > 0);
  });

  it('fireCreatorSlicerVfx is best-effort and invokes callbacks', () => {
    ensureMemoryLocalStorage();
    const store = sampleStore();
    localStorage.setItem(CREATOR_VFX_STORAGE_KEY, JSON.stringify(store));
    invalidateCreatorVfxCache();

    const shakes: number[] = [];
    const arcs: number[] = [];
    const bursts: number[] = [];
    setCreatorVfxCallbacks({
      shake: (a) => shakes.push(a),
      slashArc: (_x, _z, c) => arcs.push(c),
      juiceBurst: (_x, _y, _z, c) => bursts.push(c),
    });

    saveCreatorVfxStore(store);
    invalidateCreatorVfxCache();

    const slash = fireCreatorSlicerVfx('blade-default', 'onSlash', { x: 1, y: 1, z: 1 });
    const kill = fireCreatorSlicerVfx('blade-default', 'onKill', { x: 0, y: 0, z: 0 });
    const crit = fireCreatorSlicerVfx('blade-default', 'onCrit', { x: 2, y: 1, z: 0 });
    const none = fireCreatorSlicerVfx('missing', 'onSlash');

    assert.ok(slash);
    assert.equal(slash!.kind, 'slash-arc');
    assert.ok(arcs.length >= 1);
    assert.ok(kill);
    assert.ok(shakes.length >= 1);
    assert.ok(crit);
    assert.equal(crit!.kind, 'spark');
    assert.ok(bursts.length >= 1);
    assert.equal(none, null);
  });
});
