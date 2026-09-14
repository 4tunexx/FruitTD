/**
 * Runtime bridge: Creator Hub / Media Studio sheets/clips → live fruit textures + event hooks.
 * Pure loaders/helpers come from adminMediaStudio; no DOM install code is invoked here.
 */
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import {
  CREATOR_STORAGE_KEY,
  MEDIA_STUDIO_STORAGE_KEY,
  clipKey,
  frameRect,
  loadStudioStore,
  normalizeEvents,
  type ClipDef,
  type EntityStudioData,
  type FxPreset,
  type StudioDirection,
  type StudioEventHook,
  type StudioHookKind,
  type StudioState,
} from '../ui/adminMediaStudio';
import type { EnemyKind } from './enemies';

export const STUDIO_DEFAULT_FPS = 10;
export const STUDIO_HIT_SECONDS = 0.22;
export const STUDIO_DEATH_MAX_SECONDS = 0.45;
export const STUDIO_FLASH_SECONDS = 0.12;

const sheetImages = new Map<string, HTMLImageElement | null | 'loading'>();
const frameTextures = new Map<string, CanvasTexture>();
let cachedStoreSig: string | null = null;
let cachedEntities: Record<string, EntityStudioData> = {};

export interface StudioFxCallbacks {
  shake?: (amount: number) => void;
  playSfxSlot?: (slotId: string) => void;
  /** Best-effort particle / juice call. */
  juiceBurst?: (x: number, y: number, z: number, preset: FxPreset) => void;
}

let fxCallbacks: StudioFxCallbacks = {};

export function setStudioFxCallbacks(cb: StudioFxCallbacks): void {
  fxCallbacks = cb || {};
}

/** Map gameplay enemyKind → Media Studio entity key. */
export function enemyKindToStudioKey(kind: EnemyKind): string {
  switch (kind) {
    case 'normal':
      return 'enemy-normal';
    case 'explosive':
      return 'enemy-explosive';
    case 'armored':
      return 'enemy-armored';
    case 'splitter':
      return 'enemy-splitter';
    case 'swift':
      return 'enemy-swift';
    default:
      return 'enemy-normal';
  }
}

/** Approximate facing from movement (impulse + approach velocity). */
export function directionFromVelocity(vx: number, vz: number): StudioDirection {
  const ax = Math.abs(vx);
  const az = Math.abs(vz);
  if (ax < 0.0001 && az < 0.0001) return 'down';
  if (ax > az) return vx < 0 ? 'left' : 'right';
  // Toward the tower is typically -Z (down the lane).
  return vz < 0 ? 'down' : 'up';
}

/** Advance a clip cursor by dt at the given FPS; returns new cursor and local frame index. */
export function advanceFrameCursor(
  cursor: number,
  dt: number,
  fps: number,
  frameCount: number,
): { cursor: number; frameIndex: number } {
  const count = Math.max(1, Math.floor(frameCount) || 1);
  const rate = Math.max(1, fps || STUDIO_DEFAULT_FPS);
  let next = cursor + Math.max(0, dt) * rate;
  // Keep cursor bounded so long-lived fruits don't grow forever.
  if (next >= count * 1024) next = next % count;
  const frameIndex = ((Math.floor(next) % count) + count) % count;
  return { cursor: next, frameIndex };
}

function storeSignature(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const v2 = localStorage.getItem(CREATOR_STORAGE_KEY);
    if (v2 != null) return `v2:${v2.length}:${v2.slice(0, 64)}`;
    const v1 = localStorage.getItem(MEDIA_STUDIO_STORAGE_KEY);
    if (v1 != null) return `v1:${v1.length}:${v1.slice(0, 64)}`;
    return null;
  } catch {
    return null;
  }
}

function refreshStoreCache(): Record<string, EntityStudioData> {
  try {
    const sig = storeSignature();
    if (sig === cachedStoreSig) return cachedEntities;
    cachedStoreSig = sig;
    const store = loadStudioStore();
    cachedEntities = store.entities || {};
    return cachedEntities;
  } catch {
    cachedEntities = {};
    cachedStoreSig = null;
    return cachedEntities;
  }
}

/** Invalidate localStorage cache (e.g. after admin save). */
export function invalidateStudioRuntimeCache(): void {
  cachedStoreSig = null;
  cachedEntities = {};
}

/** Entity data even without a sheet (for event hooks). */
export function getStudioEntityData(entityKey: string): EntityStudioData | null {
  const entities = refreshStoreCache();
  return entities[entityKey] || null;
}

export function getStudioEntity(entityKey: string): EntityStudioData | null {
  const ent = getStudioEntityData(entityKey);
  if (!ent || !ent.sheetDataUrl) return null;
  return ent;
}

export function hasStudioWalkClip(entityKey: string): boolean {
  const ent = getStudioEntity(entityKey);
  if (!ent) return false;
  return Boolean(resolveClip(ent, 'walk', 'down'));
}

function resolveClip(
  ent: EntityStudioData,
  state: StudioState,
  dir: StudioDirection,
): { key: string; clip: ClipDef } | null {
  const preferred = clipKey(state, dir);
  const clips = ent.clips || {};
  if (clips[preferred] && clips[preferred].frameCount > 0) {
    return { key: preferred, clip: clips[preferred] };
  }
  // Directional fallbacks for walk/run.
  if (state === 'walk' || state === 'run') {
    for (const d of ['down', 'left', 'right', 'up'] as StudioDirection[]) {
      const k = clipKey(state, d);
      if (clips[k] && clips[k].frameCount > 0) return { key: k, clip: clips[k] };
    }
  }
  // Non-directional states may be stored as walk_down style by mistake — also try bare state.
  if (clips[state] && clips[state].frameCount > 0) {
    return { key: state, clip: clips[state] };
  }
  return null;
}

function clipFps(clip: ClipDef): number {
  return Math.max(1, clip.fps || STUDIO_DEFAULT_FPS);
}

function ensureSheet(entityKey: string, dataUrl: string): HTMLImageElement | null {
  const hit = sheetImages.get(entityKey);
  if (hit && hit !== 'loading') return hit;
  if (hit === 'loading') return null;
  sheetImages.set(entityKey, 'loading');
  const img = new Image();
  img.onload = () => {
    sheetImages.set(entityKey, img);
    // Drop frame cache for this entity so sizes refresh.
    for (const key of [...frameTextures.keys()]) {
      if (key.startsWith(`${entityKey}|`)) {
        frameTextures.get(key)?.dispose();
        frameTextures.delete(key);
      }
    }
  };
  img.onerror = () => {
    sheetImages.set(entityKey, null);
  };
  img.src = dataUrl;
  return null;
}

function frameTexture(
  entityKey: string,
  ent: EntityStudioData,
  img: HTMLImageElement,
  absoluteFrame: number,
): CanvasTexture | null {
  const cacheKey = `${entityKey}|${absoluteFrame}|${ent.cols}x${ent.rows}`;
  const cached = frameTextures.get(cacheKey);
  if (cached) return cached;
  const rect = frameRect(
    absoluteFrame,
    ent.cols,
    ent.rows,
    img.width,
    img.height,
    ent.frameW || undefined,
    ent.frameH || undefined,
  );
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 256, 256);
  ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, 256, 256);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.needsUpdate = true;
  frameTextures.set(cacheKey, tex);
  return tex;
}

export interface StudioAnimState {
  entityKey: string;
  phase: 'walk' | 'hit' | 'death';
  phaseT: number;
  dir: StudioDirection;
  cursor: number;
  lastClipKey: string;
  lastFrame: number;
  active: boolean;
  /** Brief body tint after hit/spawn flash hooks. */
  flashT: number;
}

export function createStudioAnimState(enemyKind: EnemyKind): StudioAnimState {
  const entityKey = enemyKindToStudioKey(enemyKind);
  return {
    entityKey,
    phase: 'walk',
    phaseT: 0,
    dir: 'down',
    cursor: 0,
    lastClipKey: '',
    lastFrame: -1,
    active: hasStudioWalkClip(entityKey),
    flashT: 0,
  };
}

export function resetStudioAnimState(anim: StudioAnimState, enemyKind: EnemyKind): void {
  anim.entityKey = enemyKindToStudioKey(enemyKind);
  anim.phase = 'walk';
  anim.phaseT = 0;
  anim.dir = 'down';
  anim.cursor = 0;
  anim.lastClipKey = '';
  anim.lastFrame = -1;
  anim.active = hasStudioWalkClip(anim.entityKey);
  anim.flashT = 0;
}

export interface StudioHookFireResult {
  kind: StudioHookKind;
  sfxSlot?: string;
  flash: boolean;
  shake: number;
  fx: FxPreset;
}

export function resolveStudioHook(entityKey: string, kind: StudioHookKind): StudioEventHook | null {
  const ent = getStudioEntityData(entityKey);
  if (!ent) return null;
  const events = normalizeEvents(ent.events);
  return events[kind] || null;
}

/**
 * Fire entity event hooks (SFX / flash / shake / FX presets).
 * Returns the resolved payload; also invokes registered FX callbacks.
 */
export function fireStudioEvent(
  entityKey: string,
  kind: StudioHookKind,
  pos?: { x: number; y: number; z: number },
): StudioHookFireResult | null {
  const hook = resolveStudioHook(entityKey, kind);
  if (!hook) return null;
  const fx = (hook.fx || 'none') as FxPreset;
  const result: StudioHookFireResult = {
    kind,
    sfxSlot: hook.sfxSlot,
    flash: Boolean(hook.flash),
    shake: Math.max(0, Number(hook.shake) || 0),
    fx,
  };

  if (result.sfxSlot) fxCallbacks.playSfxSlot?.(result.sfxSlot);
  if (result.shake > 0) fxCallbacks.shake?.(result.shake);
  else if (fx === 'screen-shake') fxCallbacks.shake?.(0.55);

  if (pos && (fx === 'juice-burst' || fx === 'spark' || fx === 'dark-pulse')) {
    fxCallbacks.juiceBurst?.(pos.x, pos.y, pos.z, fx);
  }

  return result;
}

/** Begin a short hit flash if a hit clip exists; always tries event hooks. */
export function triggerStudioHit(anim: StudioAnimState, pos?: { x: number; y: number; z: number }): void {
  const fired = fireStudioEvent(anim.entityKey, 'onHit', pos);
  if (fired?.flash) anim.flashT = STUDIO_FLASH_SECONDS;
  if (!anim.active) return;
  const ent = getStudioEntity(anim.entityKey);
  if (!ent) return;
  if (!resolveClip(ent, 'hit', anim.dir)) return;
  anim.phase = 'hit';
  anim.phaseT = STUDIO_HIT_SECONDS;
  anim.cursor = 0;
}

/**
 * Begin death clip if defined. Returns duration seconds to keep the mesh visible,
 * or 0 if no death clip (caller should hide immediately).
 */
export function triggerStudioDeath(
  anim: StudioAnimState,
  pos?: { x: number; y: number; z: number },
): number {
  const fired = fireStudioEvent(anim.entityKey, 'onDeath', pos);
  if (fired?.flash) anim.flashT = STUDIO_FLASH_SECONDS;
  if (!anim.active) return 0;
  const ent = getStudioEntity(anim.entityKey);
  if (!ent) return 0;
  const resolved = resolveClip(ent, 'death', anim.dir);
  if (!resolved) return 0;
  const fps = clipFps(resolved.clip);
  const dur = Math.min(STUDIO_DEATH_MAX_SECONDS, Math.max(0.12, resolved.clip.frameCount / fps));
  anim.phase = 'death';
  anim.phaseT = dur;
  anim.cursor = 0;
  return dur;
}

export function triggerStudioSpawn(
  anim: StudioAnimState,
  pos?: { x: number; y: number; z: number },
): void {
  const fired = fireStudioEvent(anim.entityKey, 'onSpawn', pos);
  if (fired?.flash) anim.flashT = STUDIO_FLASH_SECONDS;
}

/**
 * Advance animation and return a texture when the displayed frame changed
 * (or when first binding). Returns null if studio data unavailable / still loading.
 */
export function updateStudioAnim(
  anim: StudioAnimState,
  dt: number,
  vx: number,
  vz: number,
): CanvasTexture | null {
  if (anim.flashT > 0) anim.flashT = Math.max(0, anim.flashT - dt);
  if (!anim.active) return null;
  const ent = getStudioEntity(anim.entityKey);
  if (!ent || !ent.sheetDataUrl) {
    anim.active = false;
    return null;
  }
  const img = ensureSheet(anim.entityKey, ent.sheetDataUrl);
  if (!img) return null;

  if (anim.phase === 'hit' || anim.phase === 'death') {
    anim.phaseT = Math.max(0, anim.phaseT - dt);
    if (anim.phase === 'hit' && anim.phaseT <= 0) {
      anim.phase = 'walk';
      anim.cursor = 0;
    }
  } else {
    anim.dir = directionFromVelocity(vx, vz);
  }

  const state: StudioState =
    anim.phase === 'hit' ? 'hit' : anim.phase === 'death' ? 'death' : 'walk';
  const resolved = resolveClip(ent, state, anim.dir);
  if (!resolved) {
    // Walk missing mid-run — disable quietly.
    if (state === 'walk') anim.active = false;
    return null;
  }

  if (resolved.key !== anim.lastClipKey) {
    anim.cursor = 0;
    anim.lastClipKey = resolved.key;
    anim.lastFrame = -1;
  }

  const fps = clipFps(resolved.clip);
  const advanced = advanceFrameCursor(anim.cursor, dt, fps, resolved.clip.frameCount);
  anim.cursor = advanced.cursor;
  const absolute = resolved.clip.startFrame + advanced.frameIndex;
  if (absolute === anim.lastFrame) {
    // Still return texture so callers that (re)paint can bind it.
    const tex = frameTexture(anim.entityKey, ent, img, absolute);
    return tex;
  }
  anim.lastFrame = absolute;
  return frameTexture(anim.entityKey, ent, img, absolute);
}

export function clearStudioRuntimeTextures(): void {
  for (const tex of frameTextures.values()) tex.dispose();
  frameTextures.clear();
  sheetImages.clear();
  invalidateStudioRuntimeCache();
}
