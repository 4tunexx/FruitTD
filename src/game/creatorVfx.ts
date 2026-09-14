/**
 * Creator Slicer + VFX authoring — draft store + runtime helpers.
 * Storage: fruittd-creator-vfx-v1
 * Publish merges slicer field overrides into AdminConfig.slicers / liveConfig.
 */
import { DEFAULT_SLICERS, hexToNumber, type CatalogSlicer } from './slicers';

export const CREATOR_VFX_STORAGE_KEY = 'fruittd-creator-vfx-v1';

/** Built-in effect kinds available in the VFX library. */
export const CREATOR_VFX_KINDS = [
  'juice-burst',
  'spark',
  'dark-pulse',
  'slash-arc',
  'screen-shake',
] as const;

export type CreatorVfxKind = (typeof CREATOR_VFX_KINDS)[number];

export type SlicerVfxEvent = 'onSlash' | 'onCrit' | 'onKill';

export interface CreatorVfxPreset {
  id: string;
  name: string;
  kind: CreatorVfxKind;
  intensity: number;
  duration: number;
  /** #rrggbb */
  color: string;
}

export interface SlicerVfxBinds {
  onSlash?: string;
  onCrit?: string;
  onKill?: string;
}

export interface CreatorSlicerPack {
  id: string;
  /** Trail / glint color override */
  color?: string;
  glowColor?: string;
  damageMul?: number;
  juiceMul?: number;
  brittleBonus?: number;
  /** Optional blade icon / trail sprite (data URL) */
  iconDataUrl?: string;
  trailDataUrl?: string;
  binds: SlicerVfxBinds;
}

export interface CreatorVfxStore {
  version: 1;
  presets: CreatorVfxPreset[];
  slicers: Record<string, CreatorSlicerPack>;
  selectedSlicerId: string;
  selectedPresetId: string;
}

export interface CreatorVfxFireResult {
  event: SlicerVfxEvent;
  preset: CreatorVfxPreset;
  shake: number;
  juiceMul: number;
  slashColor: number | null;
  kind: CreatorVfxKind;
}

export interface CreatorVfxCallbacks {
  shake?: (amount: number) => void;
  juiceBurst?: (x: number, y: number, z: number, colorHex: number, intensity: number) => void;
  slashArc?: (x: number, z: number, colorHex: number) => void;
}

let fxCallbacks: CreatorVfxCallbacks = {};
let cachedSig: string | null = null;
let cachedStore: CreatorVfxStore | null = null;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function asNum(v: unknown, fallback: number, min?: number, max?: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  if (min != null || max != null) return clamp(n, min ?? -Infinity, max ?? Infinity);
  return n;
}

export function defaultPresets(): CreatorVfxPreset[] {
  return [
    { id: 'juice-burst', name: 'Juice Burst', kind: 'juice-burst', intensity: 1, duration: 0.35, color: '#f472b6' },
    { id: 'spark', name: 'Spark', kind: 'spark', intensity: 0.85, duration: 0.25, color: '#fbbf24' },
    { id: 'dark-pulse', name: 'Dark Pulse', kind: 'dark-pulse', intensity: 1.1, duration: 0.4, color: '#a78bfa' },
    { id: 'slash-arc', name: 'Slash Arc', kind: 'slash-arc', intensity: 1, duration: 0.22, color: '#38bdf8' },
    { id: 'screen-shake', name: 'Screen Shake', kind: 'screen-shake', intensity: 0.7, duration: 0.3, color: '#ffffff' },
  ];
}

export function emptyCreatorVfxStore(): CreatorVfxStore {
  const presets = defaultPresets();
  return {
    version: 1,
    presets,
    slicers: {},
    selectedSlicerId: DEFAULT_SLICERS[0]?.id || 'blade-default',
    selectedPresetId: presets[0]?.id || 'juice-burst',
  };
}

export function normalizePreset(raw: unknown): CreatorVfxPreset | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const kindRaw = asStr(p.kind, asStr(p.id, 'juice-burst'));
  const kind = (CREATOR_VFX_KINDS.includes(kindRaw as CreatorVfxKind)
    ? kindRaw
    : 'juice-burst') as CreatorVfxKind;
  const id = asStr(p.id, kind).trim() || kind;
  return {
    id,
    name: asStr(p.name, id).trim() || id,
    kind,
    intensity: asNum(p.intensity, 1, 0, 4),
    duration: asNum(p.duration, 0.3, 0.05, 3),
    color: normalizeHex(asStr(p.color, '#ffffff')),
  };
}

function normalizeHex(hex: string): string {
  const cleaned = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) return cleaned.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toLowerCase()}`;
  return '#ffffff';
}

export function normalizeBinds(raw: unknown): SlicerVfxBinds {
  if (!raw || typeof raw !== 'object') return {};
  const b = raw as Record<string, unknown>;
  const out: SlicerVfxBinds = {};
  for (const key of ['onSlash', 'onCrit', 'onKill'] as const) {
    const v = asStr(b[key]).trim();
    if (v) out[key] = v;
  }
  return out;
}

export function normalizeSlicerPack(raw: unknown, fallbackId = 'blade-default'): CreatorSlicerPack {
  const p = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pack: CreatorSlicerPack = {
    id: asStr(p.id, fallbackId).trim() || fallbackId,
    binds: normalizeBinds(p.binds),
  };
  if (typeof p.color === 'string' && p.color.trim()) pack.color = normalizeHex(p.color);
  if (typeof p.glowColor === 'string' && p.glowColor.trim()) pack.glowColor = normalizeHex(p.glowColor);
  if (p.damageMul != null) pack.damageMul = asNum(p.damageMul, 1, 0.1, 5);
  if (p.juiceMul != null) pack.juiceMul = asNum(p.juiceMul, 1, 0.1, 5);
  if (p.brittleBonus != null) pack.brittleBonus = asNum(p.brittleBonus, 0, 0, 10);
  if (typeof p.iconDataUrl === 'string' && p.iconDataUrl.startsWith('data:')) pack.iconDataUrl = p.iconDataUrl;
  if (typeof p.trailDataUrl === 'string' && p.trailDataUrl.startsWith('data:')) pack.trailDataUrl = p.trailDataUrl;
  return pack;
}

export function normalizeCreatorVfxStore(raw: unknown): CreatorVfxStore {
  const base = emptyCreatorVfxStore();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Record<string, unknown>;
  const presetsRaw = Array.isArray(s.presets) ? s.presets : [];
  const presets = presetsRaw.map(normalizePreset).filter((p): p is CreatorVfxPreset => Boolean(p));
  if (presets.length) base.presets = presets;
  else base.presets = defaultPresets();

  const slicers: Record<string, CreatorSlicerPack> = {};
  if (s.slicers && typeof s.slicers === 'object') {
    for (const [id, pack] of Object.entries(s.slicers as Record<string, unknown>)) {
      slicers[id] = normalizeSlicerPack(pack, id);
      slicers[id].id = id;
    }
  }
  base.slicers = slicers;
  base.selectedSlicerId = asStr(s.selectedSlicerId, base.selectedSlicerId) || base.selectedSlicerId;
  base.selectedPresetId = asStr(s.selectedPresetId, base.presets[0]?.id || 'juice-burst');
  if (!base.presets.some((p) => p.id === base.selectedPresetId)) {
    base.selectedPresetId = base.presets[0]?.id || 'juice-burst';
  }
  return base;
}

export function loadCreatorVfxStore(): CreatorVfxStore {
  try {
    if (typeof localStorage === 'undefined') return emptyCreatorVfxStore();
    const raw = localStorage.getItem(CREATOR_VFX_STORAGE_KEY);
    if (!raw) return emptyCreatorVfxStore();
    return normalizeCreatorVfxStore(JSON.parse(raw));
  } catch {
    return emptyCreatorVfxStore();
  }
}

export function saveCreatorVfxStore(store: CreatorVfxStore): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const normalized = normalizeCreatorVfxStore(store);
    localStorage.setItem(CREATOR_VFX_STORAGE_KEY, JSON.stringify(normalized));
    invalidateCreatorVfxCache();
    return true;
  } catch {
    return false;
  }
}

export function ensureSlicerPack(store: CreatorVfxStore, slicerId: string): CreatorSlicerPack {
  if (!store.slicers[slicerId]) {
    store.slicers[slicerId] = { id: slicerId, binds: {} };
  }
  return store.slicers[slicerId];
}

/** Merge Creator slicer pack overrides onto a CatalogSlicer clone. */
export function applySlicerPackOverrides(
  base: CatalogSlicer,
  pack: CreatorSlicerPack | null | undefined,
): CatalogSlicer {
  if (!pack) return { ...base };
  const out = { ...base };
  if (pack.color) out.color = pack.color;
  if (pack.glowColor) out.glowColor = pack.glowColor;
  if (pack.damageMul != null) out.damageMul = pack.damageMul;
  if (pack.juiceMul != null) out.juiceMul = pack.juiceMul;
  if (pack.brittleBonus != null) out.brittleBonus = pack.brittleBonus;
  return out;
}

/**
 * Publish path: merge creator slicer packs into a slicers catalog list.
 * Does not remove admin-only fields; only overlays authored overrides.
 */
export function mergeSlicerPacksIntoCatalog(
  catalog: CatalogSlicer[],
  store: CreatorVfxStore,
): CatalogSlicer[] {
  return catalog.map((s) => applySlicerPackOverrides(s, store.slicers[s.id]));
}

function storeSignature(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CREATOR_VFX_STORAGE_KEY);
    if (raw == null) return null;
    return `${raw.length}:${raw.slice(0, 64)}`;
  } catch {
    return null;
  }
}

function refreshCache(): CreatorVfxStore {
  const sig = storeSignature();
  if (sig === cachedSig && cachedStore) return cachedStore;
  cachedSig = sig;
  cachedStore = loadCreatorVfxStore();
  return cachedStore;
}

export function invalidateCreatorVfxCache(): void {
  cachedSig = null;
  cachedStore = null;
}

export function setCreatorVfxCallbacks(cb: CreatorVfxCallbacks): void {
  fxCallbacks = cb || {};
}

export function getCreatorVfxCallbacks(): CreatorVfxCallbacks {
  return fxCallbacks;
}

export function findPreset(store: CreatorVfxStore, id: string | undefined | null): CreatorVfxPreset | null {
  if (!id) return null;
  return store.presets.find((p) => p.id === id) || null;
}

export function resolveSlicerBind(
  slicerId: string | undefined | null,
  event: SlicerVfxEvent,
  store?: CreatorVfxStore,
): CreatorVfxPreset | null {
  const s = store || refreshCache();
  if (!slicerId) return null;
  const pack = s.slicers[slicerId];
  if (!pack) return null;
  const presetId = pack.binds?.[event];
  return findPreset(s, presetId);
}

/**
 * Best-effort fire of a Creator VFX preset for a slicer event.
 * Safe no-op when unbound or store missing.
 */
export function fireCreatorSlicerVfx(
  slicerId: string | undefined | null,
  event: SlicerVfxEvent,
  pos?: { x: number; y: number; z: number },
): CreatorVfxFireResult | null {
  try {
    const preset = resolveSlicerBind(slicerId, event);
    if (!preset) return null;
    const intensity = clamp(preset.intensity, 0, 4);
    const colorHex = hexToNumber(preset.color, 0xffffff);
    const result: CreatorVfxFireResult = {
      event,
      preset,
      shake: 0,
      juiceMul: 0,
      slashColor: null,
      kind: preset.kind,
    };

    switch (preset.kind) {
      case 'screen-shake':
        result.shake = 0.35 + intensity * 0.55;
        fxCallbacks.shake?.(result.shake);
        break;
      case 'juice-burst':
      case 'spark':
      case 'dark-pulse':
        result.juiceMul = intensity;
        if (pos) fxCallbacks.juiceBurst?.(pos.x, pos.y, pos.z, colorHex, intensity);
        break;
      case 'slash-arc':
        result.slashColor = colorHex;
        if (pos) fxCallbacks.slashArc?.(pos.x, pos.z, colorHex);
        break;
      default:
        break;
    }
    return result;
  } catch {
    return null;
  }
}

/** Preview helper: resolve what Simulate Slash/Crit would fire for UI canvas. */
export function previewVfxPayload(
  store: CreatorVfxStore,
  slicerId: string,
  event: SlicerVfxEvent,
): CreatorVfxFireResult | null {
  const preset = resolveSlicerBind(slicerId, event, store);
  if (!preset) return null;
  const intensity = clamp(preset.intensity, 0, 4);
  return {
    event,
    preset,
    shake: preset.kind === 'screen-shake' ? 0.35 + intensity * 0.55 : 0,
    juiceMul: preset.kind === 'juice-burst' || preset.kind === 'spark' || preset.kind === 'dark-pulse' ? intensity : 0,
    slashColor: preset.kind === 'slash-arc' ? hexToNumber(preset.color, 0xffffff) : null,
    kind: preset.kind,
  };
}

export function newPresetId(kind: CreatorVfxKind): string {
  return `${kind}-${Math.random().toString(36).slice(2, 7)}`;
}
