import type {
  ClipDef,
  EntityStudioData,
  FxPreset,
  MediaStudioStore,
  StudioDirection,
  StudioEntityEvents,
  StudioEventHook,
  StudioState,
} from '../ui/adminMediaStudio';

export const MEDIA_STUDIO_STORAGE_KEY = 'admin-media-studio-v1';
export const CREATOR_STORAGE_KEY = 'fruittd-creator-v2';
const FX_PRESETS: FxPreset[] = ['none', 'juice-burst', 'spark', 'dark-pulse', 'screen-shake'];
const SAFE_ENTITY_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const BLOCKED_ENTITY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isSafeEntityKey(key: string): boolean {
  return SAFE_ENTITY_KEY.test(key) && !BLOCKED_ENTITY_KEYS.has(key.toLowerCase());
}

export function clipKey(state: StudioState, direction: StudioDirection): string {
  return state === 'idle' || state === 'hit' || state === 'death' ? state : `${state}_${direction}`;
}

export function frameRect(index: number, cols: number, rows: number, sheetW: number, sheetH: number, frameW?: number, frameH?: number) {
  const columnCount = Math.max(1, Math.floor(cols));
  const rowCount = Math.max(1, Math.floor(rows));
  const total = columnCount * rowCount;
  const frame = ((index % total) + total) % total;
  const col = frame % columnCount;
  const row = Math.floor(frame / columnCount);
  const sw = frameW && frameW > 0 ? frameW : sheetW / columnCount;
  const sh = frameH && frameH > 0 ? frameH : sheetH / rowCount;
  return { sx: col * sw, sy: row * sh, sw, sh, col, row };
}

function defaultEventHook(): StudioEventHook {
  return { flash: false, shake: 0, fx: 'none' };
}

function defaultEvents(): StudioEntityEvents {
  return {
    onSpawn: defaultEventHook(),
    onHit: { sfxSlot: 'lemonImpact', flash: true, shake: 0.35, fx: 'spark' },
    onDeath: { sfxSlot: 'splatterMed', flash: true, shake: 0.7, fx: 'juice-burst' },
  };
}

function normalizeEventHook(raw: unknown): StudioEventHook {
  const base = defaultEventHook();
  if (!raw || typeof raw !== 'object') return base;
  const hook = raw as Record<string, unknown>;
  if (typeof hook.sfxSlot === 'string' && hook.sfxSlot) base.sfxSlot = hook.sfxSlot;
  if (typeof hook.flash === 'boolean') base.flash = hook.flash;
  if (hook.shake != null && Number.isFinite(Number(hook.shake))) base.shake = Math.max(0, Math.min(4, Number(hook.shake)));
  if (typeof hook.fx === 'string' && FX_PRESETS.includes(hook.fx as FxPreset)) base.fx = hook.fx as FxPreset;
  return base;
}

export function normalizeEvents(raw: unknown): StudioEntityEvents {
  const defaults = defaultEvents();
  if (!raw || typeof raw !== 'object') return defaults;
  const events = raw as Record<string, unknown>;
  return {
    onSpawn: events.onSpawn !== undefined ? normalizeEventHook(events.onSpawn) : defaults.onSpawn,
    onHit: events.onHit !== undefined ? normalizeEventHook(events.onHit) : defaults.onHit,
    onDeath: events.onDeath !== undefined ? normalizeEventHook(events.onDeath) : defaults.onDeath,
  };
}

function normalizeClip(raw: unknown): ClipDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const clip = raw as Record<string, unknown>;
  const normalized: ClipDef = {
    startFrame: Math.max(0, Math.floor(Number(clip.startFrame) || 0)),
    frameCount: Math.max(1, Math.floor(Number(clip.frameCount) || 1)),
  };
  if (clip.fps != null && Number.isFinite(Number(clip.fps))) normalized.fps = Math.max(1, Math.min(60, Number(clip.fps)));
  if (typeof clip.fx === 'string' && FX_PRESETS.includes(clip.fx as FxPreset)) normalized.fx = clip.fx as FxPreset;
  return normalized;
}

function normalizeEntityData(raw: unknown): EntityStudioData {
  if (!raw || typeof raw !== 'object') return { sheetDataUrl: null, cols: 4, rows: 4, frameW: 0, frameH: 0, clips: {}, events: defaultEvents() };
  const entity = raw as Record<string, unknown>;
  const clips: Record<string, ClipDef> = {};
  if (entity.clips && typeof entity.clips === 'object') {
    for (const [key, value] of Object.entries(entity.clips as Record<string, unknown>)) {
      const clip = normalizeClip(value);
      if (clip) clips[key] = clip;
    }
  }
  return {
    sheetDataUrl: typeof entity.sheetDataUrl === 'string' ? entity.sheetDataUrl : null,
    cols: Math.max(1, Math.floor(Number(entity.cols) || 4)),
    rows: Math.max(1, Math.floor(Number(entity.rows) || 4)),
    frameW: Math.max(0, Math.floor(Number(entity.frameW) || 0)),
    frameH: Math.max(0, Math.floor(Number(entity.frameH) || 0)),
    clips,
    label: typeof entity.label === 'string' ? entity.label : undefined,
    events: normalizeEvents(entity.events),
  };
}

function migrateStoreToV2(raw: unknown): MediaStudioStore {
  if (!raw || typeof raw !== 'object') return { version: 2, entities: {}, selectedEntity: 'enemy-normal' };
  const source = raw as Record<string, unknown>;
  const sourceEntities = source.entities && typeof source.entities === 'object' ? source.entities as Record<string, unknown> : {};
  const entities: Record<string, EntityStudioData> = {};
  for (const [key, value] of Object.entries(sourceEntities)) {
    if (isSafeEntityKey(key)) entities[key] = normalizeEntityData(value);
  }
  const selectedEntity = typeof source.selectedEntity === 'string' && isSafeEntityKey(source.selectedEntity)
    ? source.selectedEntity
    : 'enemy-normal';
  return { version: 2, entities, selectedEntity };
}

export function loadStudioStore(): MediaStudioStore {
  try {
    const v2 = typeof localStorage !== 'undefined' ? localStorage.getItem(CREATOR_STORAGE_KEY) : null;
    if (v2) return migrateStoreToV2(JSON.parse(v2));
    const v1 = typeof localStorage !== 'undefined' ? localStorage.getItem(MEDIA_STUDIO_STORAGE_KEY) : null;
    return v1 ? migrateStoreToV2(JSON.parse(v1)) : { version: 2, entities: {}, selectedEntity: 'enemy-normal' };
  } catch {
    return { version: 2, entities: {}, selectedEntity: 'enemy-normal' };
  }
}
