/**
 * FruitTD Creator Hub v2 — sprite sheet editor, clip timeline, event hooks, sound bank.
 * Storage: fruittd-creator-v2 (read-fallback from admin-media-studio-v1).
 * Live clip playback / hooks: src/game/studioRuntime.ts.
 */

export const MEDIA_STUDIO_STORAGE_KEY = 'admin-media-studio-v1';
export const CREATOR_STORAGE_KEY = 'fruittd-creator-v2';
export const SOUND_BANK_STORAGE_KEY = 'admin-media-studio-sfx-v1';

export type StudioDirection = 'down' | 'left' | 'right' | 'up';
export type StudioState = 'idle' | 'walk' | 'run' | 'hit' | 'death';
export type FxPreset = 'none' | 'juice-burst' | 'spark' | 'dark-pulse' | 'screen-shake';
export type StudioHookKind = 'onSpawn' | 'onHit' | 'onDeath';

export interface ClipDef {
  startFrame: number;
  frameCount: number;
  /** Per-clip FPS override; runtime falls back to global default when omitted. */
  fps?: number;
  fx?: FxPreset;
}

export interface StudioEventHook {
  sfxSlot?: string;
  flash?: boolean;
  shake?: number;
  fx?: FxPreset;
}

export interface StudioEntityEvents {
  onSpawn?: StudioEventHook;
  onHit?: StudioEventHook;
  onDeath?: StudioEventHook;
}

export interface EntityStudioData {
  sheetDataUrl: string | null;
  cols: number;
  rows: number;
  frameW: number;
  frameH: number;
  clips: Record<string, ClipDef>;
  /** Display label override (pack browser rename). */
  label?: string;
  events?: StudioEntityEvents;
}

export interface MediaStudioStore {
  version: 1 | 2;
  entities: Record<string, EntityStudioData>;
  selectedEntity: string;
}

export interface SoundBankStore {
  version: 1;
  replacements: Record<string, string>; // slotId -> dataURL
}

export const FX_PRESETS: FxPreset[] = ['none', 'juice-burst', 'spark', 'dark-pulse', 'screen-shake'];

export const STUDIO_ENTITY_OPTIONS: { key: string; label: string }[] = [
  { key: 'enemy-normal', label: 'Rot-Walker (enemy-normal)' },
  { key: 'enemy-explosive', label: 'Chem-Burst (enemy-explosive)' },
  { key: 'enemy-armored', label: 'Rind-Plate (enemy-armored)' },
  { key: 'enemy-splitter', label: 'Pod-Spawner (enemy-splitter)' },
  { key: 'enemy-swift', label: 'Juice-Runner (enemy-swift)' },
  { key: 'tower-main', label: 'Main Tower (tower-main)' },
  { key: 'hero-jiju', label: 'Master Jiju (hero-jiju)' },
  { key: 'hero-topfu', label: 'Topfu (hero-topfu)' },
  { key: 'hero-lagen', label: 'Lagen (hero-lagen)' },
  { key: 'hero-tripos', label: 'Tripos (hero-tripos)' },
  { key: 'hero-ki', label: 'Master Ki (hero-ki)' },
];

export const STUDIO_STATES: StudioState[] = ['idle', 'walk', 'run', 'hit', 'death'];
export const STUDIO_DIRECTIONS: StudioDirection[] = ['down', 'left', 'right', 'up'];

/** Key SFX slots from src/audio/sfx.ts BANKS (+ a few one-shots). */
export const SOUND_BANK_SLOTS: { id: string; label: string; file: string }[] = [
  { id: 'swipe', label: 'Swipe', file: 'Sword-swipe-1.wav' },
  { id: 'swipeBlitz', label: 'Swipe Blitz', file: 'blade-rainbow-1.wav' },
  { id: 'cleanSlice', label: 'Clean Slice', file: 'Clean-Slice-1.wav' },
  { id: 'lemonImpact', label: 'Lemon/Citrus Impact', file: 'Impact-Orange.wav' },
  { id: 'berryImpact', label: 'Berry Impact', file: 'Impact-Strawberry.wav' },
  { id: 'melonImpact', label: 'Melon Impact', file: 'Impact-Watermelon.wav' },
  { id: 'bombExplode', label: 'Bomb Explode', file: 'Bomb-explode.wav' },
  { id: 'combo', label: 'Combo', file: 'Combo.wav' },
  { id: 'comboBlitzHit', label: 'Combo Blitz Hit', file: 'combo-blitz-1.wav' },
  { id: 'weaponLaunch', label: 'Weapon Launch', file: 'Bonus-Firework-Launch.wav' },
  { id: 'weaponBoom', label: 'Weapon Boom', file: 'Bonus-Firework-Explode.wav' },
  { id: 'shopTap', label: 'Shop Tap', file: 'ui-button-push.wav' },
  { id: 'shopEnter', label: 'Shop Enter', file: 'ui-screen-whoosh.wav' },
  { id: 'tick', label: 'Tick', file: 'Time-tick.wav' },
  { id: 'gameStart', label: 'Game Start', file: 'Game-start.wav' },
  { id: 'gameOver', label: 'Game Over', file: 'Game-over.wav' },
  { id: 'critical', label: 'Critical', file: 'Critical.wav' },
  { id: 'splatterMed', label: 'Splatter Medium', file: 'Splatter-Medium-1.wav' },
];

export function clipKey(state: StudioState, dir: StudioDirection): string {
  if (state === 'idle' || state === 'hit' || state === 'death') return state;
  return `${state}_${dir}`;
}

/** All checklist keys: idle/hit/death once + walk/run × 4 dirs. */
export function allCoverageKeys(): string[] {
  const keys: string[] = ['idle', 'hit', 'death'];
  for (const state of ['walk', 'run'] as StudioState[]) {
    for (const dir of STUDIO_DIRECTIONS) keys.push(clipKey(state, dir));
  }
  return keys;
}

export function entityLabel(key: string, ent?: EntityStudioData | null): string {
  if (ent?.label && ent.label.trim()) return ent.label.trim();
  const opt = STUDIO_ENTITY_OPTIONS.find((o) => o.key === key);
  return opt?.label ?? key;
}

/** Row-major frame index → pixel rect in the sheet. */
export function frameRect(
  index: number,
  cols: number,
  rows: number,
  sheetW: number,
  sheetH: number,
  frameW?: number,
  frameH?: number,
): { sx: number; sy: number; sw: number; sh: number; col: number; row: number } {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  const total = c * r;
  const i = ((index % total) + total) % total;
  const col = i % c;
  const row = Math.floor(i / c);
  const sw = frameW && frameW > 0 ? frameW : sheetW / c;
  const sh = frameH && frameH > 0 ? frameH : sheetH / r;
  return { sx: col * sw, sy: row * sh, sw, sh, col, row };
}

export function indexFromCell(col: number, row: number, cols: number): number {
  return row * Math.max(1, Math.floor(cols)) + col;
}

/** Inclusive start/end frame → ClipDef startFrame + frameCount. */
export function clipDefFromRange(start: number, end: number): ClipDef {
  const a = Math.max(0, Math.floor(start));
  const b = Math.max(0, Math.floor(end));
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { startFrame: lo, frameCount: Math.max(1, hi - lo + 1) };
}

/** ClipDef → inclusive end frame index. */
export function clipEndFrame(clip: ClipDef): number {
  return clip.startFrame + Math.max(1, clip.frameCount) - 1;
}

/** Clamp a drag/click range into valid frame indices for a sheet. */
export function clampClipRange(
  start: number,
  end: number,
  totalFrames: number,
): { startFrame: number; endFrame: number; frameCount: number } {
  const maxIdx = Math.max(0, Math.floor(totalFrames) - 1);
  const a = Math.max(0, Math.min(maxIdx, Math.floor(start)));
  const b = Math.max(0, Math.min(maxIdx, Math.floor(end)));
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return { startFrame: lo, endFrame: hi, frameCount: hi - lo + 1 };
}

export function defaultEventHook(): StudioEventHook {
  return { flash: false, shake: 0, fx: 'none' };
}

export function defaultEvents(): StudioEntityEvents {
  return {
    onSpawn: defaultEventHook(),
    onHit: { sfxSlot: 'lemonImpact', flash: true, shake: 0.35, fx: 'spark' },
    onDeath: { sfxSlot: 'splatterMed', flash: true, shake: 0.7, fx: 'juice-burst' },
  };
}

export function emptyEntityData(): EntityStudioData {
  return {
    sheetDataUrl: null,
    cols: 4,
    rows: 4,
    frameW: 0,
    frameH: 0,
    clips: {},
    events: defaultEvents(),
  };
}

export function normalizeClip(raw: unknown): ClipDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const startFrame = Math.max(0, Math.floor(Number(c.startFrame) || 0));
  const frameCount = Math.max(1, Math.floor(Number(c.frameCount) || 1));
  const out: ClipDef = { startFrame, frameCount };
  if (c.fps != null && Number.isFinite(Number(c.fps))) {
    out.fps = Math.max(1, Math.min(60, Number(c.fps)));
  }
  if (typeof c.fx === 'string' && FX_PRESETS.includes(c.fx as FxPreset)) {
    out.fx = c.fx as FxPreset;
  }
  return out;
}

export function normalizeEventHook(raw: unknown): StudioEventHook {
  const base = defaultEventHook();
  if (!raw || typeof raw !== 'object') return base;
  const h = raw as Record<string, unknown>;
  if (typeof h.sfxSlot === 'string' && h.sfxSlot) base.sfxSlot = h.sfxSlot;
  if (typeof h.flash === 'boolean') base.flash = h.flash;
  if (h.shake != null && Number.isFinite(Number(h.shake))) {
    base.shake = Math.max(0, Math.min(4, Number(h.shake)));
  }
  if (typeof h.fx === 'string' && FX_PRESETS.includes(h.fx as FxPreset)) {
    base.fx = h.fx as FxPreset;
  }
  return base;
}

export function normalizeEvents(raw: unknown): StudioEntityEvents {
  const d = defaultEvents();
  if (!raw || typeof raw !== 'object') return d;
  const e = raw as Record<string, unknown>;
  return {
    onSpawn: e.onSpawn !== undefined ? normalizeEventHook(e.onSpawn) : d.onSpawn,
    onHit: e.onHit !== undefined ? normalizeEventHook(e.onHit) : d.onHit,
    onDeath: e.onDeath !== undefined ? normalizeEventHook(e.onDeath) : d.onDeath,
  };
}

export function normalizeEntityData(raw: unknown): EntityStudioData {
  const empty = emptyEntityData();
  if (!raw || typeof raw !== 'object') return empty;
  const e = raw as Record<string, unknown>;
  const clips: Record<string, ClipDef> = {};
  if (e.clips && typeof e.clips === 'object') {
    for (const [k, v] of Object.entries(e.clips as Record<string, unknown>)) {
      const clip = normalizeClip(v);
      if (clip) clips[k] = clip;
    }
  }
  return {
    sheetDataUrl: typeof e.sheetDataUrl === 'string' ? e.sheetDataUrl : null,
    cols: Math.max(1, Math.floor(Number(e.cols) || 4)),
    rows: Math.max(1, Math.floor(Number(e.rows) || 4)),
    frameW: Math.max(0, Math.floor(Number(e.frameW) || 0)),
    frameH: Math.max(0, Math.floor(Number(e.frameH) || 0)),
    clips,
    label: typeof e.label === 'string' ? e.label : undefined,
    events: normalizeEvents(e.events),
  };
}

export function defaultStore(): MediaStudioStore {
  return { version: 2, entities: {}, selectedEntity: 'enemy-normal' };
}

/** Migrate any parsed store (v1 or partial) into a normalized v2 Creator store. */
export function migrateStoreToV2(raw: unknown): MediaStudioStore {
  const base = defaultStore();
  if (!raw || typeof raw !== 'object') return base;
  const s = raw as Record<string, unknown>;
  const entitiesIn = s.entities && typeof s.entities === 'object' ? (s.entities as Record<string, unknown>) : {};
  const entities: Record<string, EntityStudioData> = {};
  for (const [key, val] of Object.entries(entitiesIn)) {
    entities[key] = normalizeEntityData(val);
  }
  const selected =
    typeof s.selectedEntity === 'string' && s.selectedEntity
      ? s.selectedEntity
      : 'enemy-normal';
  return { version: 2, entities, selectedEntity: selected };
}

export function coverageForEntity(ent: EntityStudioData): { key: string; ok: boolean }[] {
  return allCoverageKeys().map((key) => {
    const clip = ent.clips[key];
    return { key, ok: Boolean(clip && clip.frameCount > 0) };
  });
}

export function coverageSummary(ent: EntityStudioData): { filled: number; total: number; hasSheet: boolean } {
  const cov = coverageForEntity(ent);
  return {
    filled: cov.filter((c) => c.ok).length,
    total: cov.length,
    hasSheet: Boolean(ent.sheetDataUrl),
  };
}

export function loadStudioStore(): MediaStudioStore {
  try {
    const rawV2 =
      typeof localStorage !== 'undefined' ? localStorage.getItem(CREATOR_STORAGE_KEY) : null;
    if (rawV2) {
      return migrateStoreToV2(JSON.parse(rawV2));
    }
    const rawV1 =
      typeof localStorage !== 'undefined' ? localStorage.getItem(MEDIA_STUDIO_STORAGE_KEY) : null;
    if (rawV1) {
      return migrateStoreToV2(JSON.parse(rawV1));
    }
    return defaultStore();
  } catch {
    return defaultStore();
  }
}

export function saveStudioStore(store: MediaStudioStore): void {
  const v2 = migrateStoreToV2(store);
  localStorage.setItem(CREATOR_STORAGE_KEY, JSON.stringify(v2));
}

export function loadSoundBank(): SoundBankStore {
  try {
    const raw = localStorage.getItem(SOUND_BANK_STORAGE_KEY);
    if (!raw) return { version: 1, replacements: {} };
    const parsed = JSON.parse(raw) as SoundBankStore;
    if (!parsed || parsed.version !== 1) return { version: 1, replacements: {} };
    return parsed;
  } catch {
    return { version: 1, replacements: {} };
  }
}

export function saveSoundBank(store: SoundBankStore): void {
  localStorage.setItem(SOUND_BANK_STORAGE_KEY, JSON.stringify(store));
}

/** Pack JSON for a single entity (meta + clips + events + sheet dataURL). */
export interface EntityPackJson {
  version: 2;
  kind: 'fruittd-creator-entity';
  entityKey: string;
  entity: EntityStudioData;
}

export function buildEntityPack(entityKey: string, ent: EntityStudioData): EntityPackJson {
  return {
    version: 2,
    kind: 'fruittd-creator-entity',
    entityKey,
    entity: normalizeEntityData(ent),
  };
}

export function parseEntityPack(raw: unknown): EntityPackJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (p.kind !== 'fruittd-creator-entity') return null;
  if (typeof p.entityKey !== 'string' || !p.entityKey) return null;
  return {
    version: 2,
    kind: 'fruittd-creator-entity',
    entityKey: p.entityKey,
    entity: normalizeEntityData(p.entity),
  };
}

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function approxDataUrlKb(dataUrl: string | null | undefined): number {
  if (!dataUrl) return 0;
  return Math.round((dataUrl.length * 0.75) / 1024);
}

let installed = false;
let store: MediaStudioStore = defaultStore();
let soundStore: SoundBankStore = { version: 1, replacements: {} };
let sheetImg: HTMLImageElement | null = null;
let selectedFrame = 0;
let previewState: StudioState = 'walk';
let previewDir: StudioDirection = 'down';
let previewFps = 8;
let previewPlaying = false;
let previewFrameCursor = 0;
let previewRaf = 0;
let previewLastTs = 0;
let previewAudio: HTMLAudioElement | null = null;
let onionSkin = false;
let timelineDrag: 'start' | 'end' | 'set' | null = null;
let eventLog: string[] = [];
let playAllActive = false;
let playAllQueue: StudioState[] = [];

function currentEntity(): EntityStudioData {
  const key = store.selectedEntity;
  if (!store.entities[key]) store.entities[key] = emptyEntityData();
  return store.entities[key];
}

function totalFrames(): number {
  const ent = currentEntity();
  return Math.max(1, ent.cols * ent.rows);
}

function setStatus(msg: string, ok = true): void {
  const el = $('studio-status');
  if (!el) return;
  el.textContent = msg;
  el.className = ok ? 'studio-status studio-status--ok' : 'studio-status studio-status--err';
}

function pushEventLog(line: string): void {
  eventLog.unshift(line);
  if (eventLog.length > 8) eventLog.length = 8;
  const el = $('studio-event-log');
  if (el) el.textContent = eventLog.join(' · ') || 'Hooks idle';
}

function knownEntityKeys(): string[] {
  const keys = new Set<string>();
  for (const o of STUDIO_ENTITY_OPTIONS) keys.add(o.key);
  for (const k of Object.keys(store.entities)) keys.add(k);
  return [...keys];
}

function fillEntitySelect(): void {
  const sel = $('studio-entity') as HTMLSelectElement | null;
  if (!sel) return;
  const keys = knownEntityKeys();
  sel.innerHTML = keys
    .map((key) => {
      const ent = store.entities[key];
      return `<option value="${key}">${entityLabel(key, ent)}</option>`;
    })
    .join('');
  if (!keys.includes(store.selectedEntity)) store.selectedEntity = keys[0] || 'enemy-normal';
  sel.value = store.selectedEntity;
}

function renderEntityRail(): void {
  const list = $('studio-entity-rail');
  if (!list) return;
  const keys = knownEntityKeys();
  list.innerHTML = '';
  for (const key of keys) {
    const ent = store.entities[key] ?? emptyEntityData();
    const cov = coverageSummary(ent);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'studio-rail-item' + (key === store.selectedEntity ? ' is-on' : '');
    row.dataset.entityKey = key;
    const dots = coverageForEntity(ent)
      .slice(0, 11)
      .map((c) => `<span class="studio-cov-dot${c.ok ? ' is-ok' : ''}" title="${c.key}"></span>`)
      .join('');
    row.innerHTML = `
      <span class="studio-rail-title">${entityLabel(key, ent)}</span>
      <span class="studio-rail-meta">${cov.hasSheet ? 'sheet' : 'no sheet'} · ${cov.filled}/${cov.total}</span>
      <span class="studio-rail-cov">${dots}</span>
    `;
    row.addEventListener('click', () => {
      store.selectedEntity = key;
      fillEntitySelect();
      void onEntityChange();
      renderEntityRail();
    });
    list.appendChild(row);
  }
}

function syncGridInputs(): void {
  const ent = currentEntity();
  const cols = $('studio-cols') as HTMLInputElement | null;
  const rows = $('studio-rows') as HTMLInputElement | null;
  const fw = $('studio-frame-w') as HTMLInputElement | null;
  const fh = $('studio-frame-h') as HTMLInputElement | null;
  const label = $('studio-entity-label') as HTMLInputElement | null;
  if (cols) cols.value = String(ent.cols);
  if (rows) rows.value = String(ent.rows);
  if (fw) fw.value = ent.frameW ? String(ent.frameW) : '';
  if (fh) fh.value = ent.frameH ? String(ent.frameH) : '';
  if (label) label.value = ent.label ?? '';
}

function activeClipKey(): string {
  const state = ($('studio-clip-state') as HTMLSelectElement | null)?.value as StudioState | undefined;
  const dir = ($('studio-clip-dir') as HTMLSelectElement | null)?.value as StudioDirection | undefined;
  return clipKey(state || previewState, dir || previewDir);
}

function syncClipInputs(): void {
  const ent = currentEntity();
  const key = activeClipKey();
  const clip = ent.clips[key] ?? { startFrame: selectedFrame, frameCount: 1 };
  const start = $('studio-clip-start') as HTMLInputElement | null;
  const count = $('studio-clip-count') as HTMLInputElement | null;
  const end = $('studio-clip-end') as HTMLInputElement | null;
  const fps = $('studio-clip-fps') as HTMLInputElement | null;
  const fx = $('studio-clip-fx') as HTMLSelectElement | null;
  const label = $('studio-clip-key');
  if (start) start.value = String(clip.startFrame);
  if (count) count.value = String(clip.frameCount);
  if (end) end.value = String(clipEndFrame(clip));
  if (fps) fps.value = clip.fps != null ? String(clip.fps) : '';
  if (fx) fx.value = clip.fx || 'none';
  if (label) label.textContent = key;
  drawTimeline();
}

function syncEventInputs(): void {
  const ent = currentEntity();
  if (!ent.events) ent.events = defaultEvents();
  for (const kind of ['onSpawn', 'onHit', 'onDeath'] as StudioHookKind[]) {
    const hook = ent.events[kind] ?? defaultEventHook();
    const sfx = $(`studio-evt-${kind}-sfx`) as HTMLSelectElement | null;
    const flash = $(`studio-evt-${kind}-flash`) as HTMLInputElement | null;
    const shake = $(`studio-evt-${kind}-shake`) as HTMLInputElement | null;
    const fx = $(`studio-evt-${kind}-fx`) as HTMLSelectElement | null;
    if (sfx) sfx.value = hook.sfxSlot || '';
    if (flash) flash.checked = Boolean(hook.flash);
    if (shake) shake.value = String(hook.shake ?? 0);
    if (fx) fx.value = hook.fx || 'none';
  }
}

function readEventInputsIntoEntity(): void {
  const ent = currentEntity();
  const events: StudioEntityEvents = {};
  for (const kind of ['onSpawn', 'onHit', 'onDeath'] as StudioHookKind[]) {
    const sfx = ($(`studio-evt-${kind}-sfx`) as HTMLSelectElement | null)?.value || undefined;
    const flash = Boolean(($(`studio-evt-${kind}-flash`) as HTMLInputElement | null)?.checked);
    const shake = Number(($(`studio-evt-${kind}-shake`) as HTMLInputElement | null)?.value || 0);
    const fx = (($(`studio-evt-${kind}-fx`) as HTMLSelectElement | null)?.value || 'none') as FxPreset;
    events[kind] = normalizeEventHook({ sfxSlot: sfx, flash, shake, fx });
  }
  ent.events = events;
}

function loadSheetImage(dataUrl: string | null): Promise<void> {
  return new Promise((resolve) => {
    if (!dataUrl) {
      sheetImg = null;
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => {
      sheetImg = img;
      resolve();
    };
    img.onerror = () => {
      sheetImg = null;
      resolve();
    };
    img.src = dataUrl;
  });
}

function drawSheet(): void {
  const canvas = $('studio-sheet-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ent = currentEntity();
  const maxW = 640;
  const maxH = 400;

  if (!sheetImg) {
    canvas.width = maxW;
    canvas.height = 220;
    ctx.fillStyle = '#0c120a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px monospace';
    ctx.fillText('Upload a PNG sprite sheet to begin', 16, 28);
    drawTimeline();
    return;
  }

  const scale = Math.min(maxW / sheetImg.width, maxH / sheetImg.height, 1);
  canvas.width = Math.max(1, Math.floor(sheetImg.width * scale));
  canvas.height = Math.max(1, Math.floor(sheetImg.height * scale));
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sheetImg, 0, 0, canvas.width, canvas.height);

  const cols = Math.max(1, ent.cols);
  const rows = Math.max(1, ent.rows);
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  ctx.strokeStyle = 'rgba(163, 230, 53, 0.45)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= cols; c++) {
    const x = Math.round(c * cellW) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = Math.round(r * cellH) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Highlight active clip range on the sheet grid.
  const clip = ent.clips[activeClipKey()];
  if (clip) {
    for (let i = 0; i < clip.frameCount; i++) {
      const fr = frameRect(clip.startFrame + i, cols, rows, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
      ctx.fillRect(fr.sx, fr.sy, fr.sw, fr.sh);
    }
  }

  const sel = frameRect(selectedFrame, cols, rows, canvas.width, canvas.height);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.strokeRect(sel.sx + 1, sel.sy + 1, sel.sw - 2, sel.sh - 2);

  const info = $('studio-sheet-info');
  if (info) {
    info.textContent = `${sheetImg.width}×${sheetImg.height}px · ${cols}×${rows} · frame ${selectedFrame} (${sel.col},${sel.row}) · ~${approxDataUrlKb(ent.sheetDataUrl)} KB`;
  }
  drawTimeline();
}

function drawTimeline(): void {
  const canvas = $('studio-timeline-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ent = currentEntity();
  const total = totalFrames();
  const h = 56;
  const w = Math.max(320, Math.min(720, total * 28));
  canvas.width = w;
  canvas.height = h;
  ctx.fillStyle = '#050805';
  ctx.fillRect(0, 0, w, h);

  const key = activeClipKey();
  const clip = ent.clips[key] ?? { startFrame: selectedFrame, frameCount: 1 };
  const cellW = w / total;

  for (let i = 0; i < total; i++) {
    const x = i * cellW;
    const inClip = i >= clip.startFrame && i <= clipEndFrame(clip);
    ctx.fillStyle = inClip ? 'rgba(251, 191, 36, 0.35)' : 'rgba(163, 230, 53, 0.08)';
    ctx.fillRect(x, 4, cellW - 1, h - 8);
    if (sheetImg) {
      const rect = frameRect(
        i,
        ent.cols,
        ent.rows,
        sheetImg.width,
        sheetImg.height,
        ent.frameW || undefined,
        ent.frameH || undefined,
      );
      const thumb = Math.min(cellW - 2, h - 16);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sheetImg,
        rect.sx,
        rect.sy,
        rect.sw,
        rect.sh,
        x + 1,
        (h - thumb) / 2,
        thumb,
        thumb,
      );
    }
    if (i === selectedFrame) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, 3.5, cellW - 2, h - 8);
    }
  }

  // Start/end handles
  const sx = clip.startFrame * cellW;
  const ex = (clipEndFrame(clip) + 1) * cellW;
  ctx.fillStyle = '#a3e635';
  ctx.fillRect(sx, 0, 3, h);
  ctx.fillRect(ex - 3, 0, 3, h);

  const meta = $('studio-timeline-meta');
  if (meta) {
    meta.textContent = `${key}: frames ${clip.startFrame}–${clipEndFrame(clip)} (${clip.frameCount}) · ${clip.fps ?? 'global'} FPS`;
  }
}

function activeClip(): ClipDef {
  const ent = currentEntity();
  const key = clipKey(previewState, previewDir);
  return ent.clips[key] ?? { startFrame: selectedFrame, frameCount: 1 };
}

function effectivePreviewFps(clip: ClipDef): number {
  return Math.max(1, clip.fps ?? previewFps);
}

function drawPreviewFrame(frameIndex: number): void {
  const canvas = $('studio-preview-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = 240;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#0b1208';
  ctx.fillRect(0, 0, size, size);

  if (!sheetImg) {
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.fillText('No sheet', 16, 24);
    return;
  }

  const ent = currentEntity();
  const drawOne = (idx: number, alpha: number) => {
    const rect = frameRect(
      idx,
      ent.cols,
      ent.rows,
      sheetImg!.width,
      sheetImg!.height,
      ent.frameW || undefined,
      ent.frameH || undefined,
    );
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.imageSmoothingEnabled = false;
    const scale = Math.min(size / rect.sw, size / rect.sh);
    const dw = rect.sw * scale;
    const dh = rect.sh * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;
    ctx.drawImage(sheetImg!, rect.sx, rect.sy, rect.sw, rect.sh, dx, dy, dw, dh);
    ctx.restore();
  };

  if (onionSkin && frameIndex > 0) {
    drawOne(frameIndex - 1, 0.28);
  }
  drawOne(frameIndex, 1);
}

function stopPreviewLoop(): void {
  previewPlaying = false;
  playAllActive = false;
  if (previewRaf) cancelAnimationFrame(previewRaf);
  previewRaf = 0;
}

function tickPreview(ts: number): void {
  if (!previewPlaying) return;
  const clip = activeClip();
  const interval = 1000 / effectivePreviewFps(clip);
  if (!previewLastTs) previewLastTs = ts;
  if (ts - previewLastTs >= interval) {
    previewLastTs = ts;
    const count = Math.max(1, clip.frameCount);
    previewFrameCursor += 1;
    if (previewFrameCursor >= count) {
      if (previewState === 'hit' || previewState === 'death' || playAllActive) {
        previewFrameCursor = count - 1;
        drawPreviewFrame(clip.startFrame + previewFrameCursor);
        if (playAllActive) {
          advancePlayAll();
          return;
        }
        stopPreviewLoop();
        return;
      }
      previewFrameCursor = 0;
    }
    drawPreviewFrame(clip.startFrame + previewFrameCursor);
  }
  previewRaf = requestAnimationFrame(tickPreview);
}

function playPreview(): void {
  const clip = activeClip();
  previewFrameCursor = 0;
  previewLastTs = 0;
  drawPreviewFrame(clip.startFrame);
  stopPreviewLoop();
  previewPlaying = true;
  previewRaf = requestAnimationFrame(tickPreview);
}

function advancePlayAll(): void {
  if (!playAllQueue.length) {
    stopPreviewLoop();
    pushEventLog('Play All done');
    return;
  }
  const next = playAllQueue.shift()!;
  previewState = next;
  document.querySelectorAll('[data-studio-state]').forEach((b) =>
    b.classList.toggle('is-on', (b as HTMLElement).dataset.studioState === next),
  );
  firePreviewHook(next === 'hit' ? 'onHit' : next === 'death' ? 'onDeath' : next === 'idle' ? 'onSpawn' : null);
  previewFrameCursor = 0;
  previewLastTs = 0;
  previewPlaying = true;
  playAllActive = true;
  drawPreviewFrame(activeClip().startFrame);
  previewRaf = requestAnimationFrame(tickPreview);
}

function playAllStates(): void {
  playAllQueue = ['idle', 'walk', 'run', 'hit', 'death'];
  playAllActive = true;
  pushEventLog('Play All States');
  advancePlayAll();
}

function firePreviewHook(kind: StudioHookKind | null): void {
  if (!kind) return;
  const ent = currentEntity();
  const hook = ent.events?.[kind];
  if (!hook) return;
  const parts: string[] = [kind];
  if (hook.sfxSlot) {
    parts.push(`sfx:${hook.sfxSlot}`);
    const slot = SOUND_BANK_SLOTS.find((s) => s.id === hook.sfxSlot);
    const src = (hook.sfxSlot && soundStore.replacements[hook.sfxSlot]) || (slot ? `/Sound/${slot.file}` : '');
    if (src) {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
      }
      previewAudio = new Audio(src);
      void previewAudio.play().catch(() => undefined);
    }
  }
  if (hook.flash) parts.push('flash');
  if (hook.shake && hook.shake > 0) parts.push(`shake:${hook.shake}`);
  if (hook.fx && hook.fx !== 'none') parts.push(`fx:${hook.fx}`);
  pushEventLog(parts.join(' '));
}

function applyClipFromInputs(): void {
  const state = ($('studio-clip-state') as HTMLSelectElement | null)?.value as StudioState;
  const dir = ($('studio-clip-dir') as HTMLSelectElement | null)?.value as StudioDirection;
  const start = Number(($('studio-clip-start') as HTMLInputElement | null)?.value || 0);
  const count = Number(($('studio-clip-count') as HTMLInputElement | null)?.value || 1);
  const endRaw = ($('studio-clip-end') as HTMLInputElement | null)?.value;
  const fpsRaw = ($('studio-clip-fps') as HTMLInputElement | null)?.value;
  const fx = (($('studio-clip-fx') as HTMLSelectElement | null)?.value || 'none') as FxPreset;
  const key = clipKey(state, dir);
  let def: ClipDef;
  if (endRaw != null && endRaw !== '') {
    const ranged = clampClipRange(start, Number(endRaw), totalFrames());
    def = { startFrame: ranged.startFrame, frameCount: ranged.frameCount };
  } else {
    def = {
      startFrame: Math.max(0, Math.floor(start)),
      frameCount: Math.max(1, Math.floor(count)),
    };
  }
  if (fpsRaw != null && fpsRaw !== '') {
    def.fps = Math.max(1, Math.min(60, Number(fpsRaw) || previewFps));
  }
  if (fx && fx !== 'none') def.fx = fx;
  else delete def.fx;
  currentEntity().clips[key] = def;
  syncClipInputs();
  drawSheet();
  setStatus(`Clip ${key} set (${def.startFrame}+${def.frameCount})`);
}

function setClipRangeFromFrames(a: number, b: number): void {
  const ranged = clampClipRange(a, b, totalFrames());
  const state = ($('studio-clip-state') as HTMLSelectElement | null)?.value as StudioState;
  const dir = ($('studio-clip-dir') as HTMLSelectElement | null)?.value as StudioDirection;
  const key = clipKey(state, dir);
  const prev = currentEntity().clips[key];
  const def: ClipDef = {
    startFrame: ranged.startFrame,
    frameCount: ranged.frameCount,
  };
  if (prev?.fps != null) def.fps = prev.fps;
  if (prev?.fx) def.fx = prev.fx;
  currentEntity().clips[key] = def;
  selectedFrame = ranged.startFrame;
  syncClipInputs();
  drawSheet();
  drawPreviewFrame(selectedFrame);
}

function persistAll(): void {
  readEventInputsIntoEntity();
  const labelEl = $('studio-entity-label') as HTMLInputElement | null;
  if (labelEl) {
    const v = labelEl.value.trim();
    if (v) currentEntity().label = v;
    else delete currentEntity().label;
  }
  saveStudioStore(store);
  try {
    // Soft-invalidate runtime cache if present.
    void import('../game/studioRuntime').then((m) => m.invalidateStudioRuntimeCache?.());
  } catch {
    /* optional */
  }
  const kb = approxDataUrlKb(currentEntity().sheetDataUrl);
  if (kb > 2500) {
    setStatus(`Saved to ${CREATOR_STORAGE_KEY} (~${kb} KB). Warning: localStorage often caps ~5MB.`, false);
  } else {
    setStatus(`Saved Creator Hub data to ${CREATOR_STORAGE_KEY} (~${kb} KB sheet).`);
  }
  renderEntityRail();
}

function exportSelectedFrame(): void {
  if (!sheetImg) {
    setStatus('No sheet loaded', false);
    return;
  }
  const ent = currentEntity();
  const rect = frameRect(
    selectedFrame,
    ent.cols,
    ent.rows,
    sheetImg.width,
    sheetImg.height,
    ent.frameW || undefined,
    ent.frameH || undefined,
  );
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(rect.sw));
  out.height = Math.max(1, Math.round(rect.sh));
  const ctx = out.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheetImg, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, out.width, out.height);
  const a = document.createElement('a');
  a.href = out.toDataURL('image/png');
  a.download = `${store.selectedEntity}-frame-${selectedFrame}.png`;
  a.click();
  setStatus(`Exported frame ${selectedFrame}`);
}

function exportEntityPack(): void {
  const pack = buildEntityPack(store.selectedEntity, currentEntity());
  const json = JSON.stringify(pack);
  const kb = Math.round(json.length / 1024);
  if (kb > 4000) {
    setStatus(`Pack is ~${kb} KB — may exceed localStorage if re-imported. Exporting anyway.`, false);
  }
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${store.selectedEntity}-creator-pack.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus(`Exported pack JSON (~${kb} KB). Sheets as dataURL can be large.`);
}

function importEntityPackFile(file: File): void {
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = parseEntityPack(JSON.parse(String(reader.result)));
      if (!parsed) {
        setStatus('Invalid Creator pack JSON', false);
        return;
      }
      const key = parsed.entityKey;
      store.entities[key] = parsed.entity;
      store.selectedEntity = key;
      fillEntitySelect();
      await onEntityChange();
      renderEntityRail();
      const kb = approxDataUrlKb(parsed.entity.sheetDataUrl);
      setStatus(`Imported ${key} (~${kb} KB sheet). Save to persist. Watch localStorage ~5MB limit.`, kb > 2500 ? false : true);
    } catch {
      setStatus('Failed to parse pack JSON', false);
    }
  };
  reader.readAsText(file);
}

function duplicateEntity(): void {
  const srcKey = store.selectedEntity;
  const src = currentEntity();
  let n = 2;
  let key = `${srcKey}-copy`;
  while (store.entities[key] || STUDIO_ENTITY_OPTIONS.some((o) => o.key === key)) {
    key = `${srcKey}-copy${n++}`;
  }
  const copy = normalizeEntityData(JSON.parse(JSON.stringify(src)));
  copy.label = `${entityLabel(srcKey, src)} (copy)`;
  store.entities[key] = copy;
  store.selectedEntity = key;
  fillEntitySelect();
  void onEntityChange();
  renderEntityRail();
  setStatus(`Duplicated → ${key}`);
}

async function onEntityChange(): Promise<void> {
  stopPreviewLoop();
  selectedFrame = 0;
  syncGridInputs();
  syncClipInputs();
  syncEventInputs();
  await loadSheetImage(currentEntity().sheetDataUrl);
  drawSheet();
  drawPreviewFrame(selectedFrame);
  renderEntityRail();
}

function bindSheetCanvasClick(): void {
  const canvas = $('studio-sheet-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  canvas.addEventListener('click', (e) => {
    const ent = currentEntity();
    if (!sheetImg) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const col = Math.min(ent.cols - 1, Math.max(0, Math.floor(x / (canvas.width / ent.cols))));
    const row = Math.min(ent.rows - 1, Math.max(0, Math.floor(y / (canvas.height / ent.rows))));
    selectedFrame = indexFromCell(col, row, ent.cols);
    const start = $('studio-clip-start') as HTMLInputElement | null;
    if (start) start.value = String(selectedFrame);
    drawSheet();
    drawPreviewFrame(selectedFrame);
  });
}

function frameFromTimelineX(clientX: number, canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const total = totalFrames();
  const cellW = canvas.width / total;
  return Math.max(0, Math.min(total - 1, Math.floor(x / cellW)));
}

function bindTimeline(): void {
  const canvas = $('studio-timeline-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;

  canvas.addEventListener('mousedown', (e) => {
    const frame = frameFromTimelineX(e.clientX, canvas);
    const ent = currentEntity();
    const key = activeClipKey();
    const clip = ent.clips[key] ?? { startFrame: frame, frameCount: 1 };
    const end = clipEndFrame(clip);
    if (Math.abs(frame - clip.startFrame) <= 1) timelineDrag = 'start';
    else if (Math.abs(frame - end) <= 1) timelineDrag = 'end';
    else {
      timelineDrag = 'set';
      setClipRangeFromFrames(frame, frame);
    }
    selectedFrame = frame;
  });

  window.addEventListener('mousemove', (e) => {
    if (!timelineDrag) return;
    const frame = frameFromTimelineX(e.clientX, canvas);
    const ent = currentEntity();
    const key = activeClipKey();
    const clip = ent.clips[key] ?? { startFrame: frame, frameCount: 1 };
    if (timelineDrag === 'start') setClipRangeFromFrames(frame, clipEndFrame(clip));
    else if (timelineDrag === 'end') setClipRangeFromFrames(clip.startFrame, frame);
    else setClipRangeFromFrames(clip.startFrame, frame);
    selectedFrame = frame;
  });

  window.addEventListener('mouseup', () => {
    timelineDrag = null;
  });

  canvas.addEventListener('click', (e) => {
    if (timelineDrag) return;
    selectedFrame = frameFromTimelineX(e.clientX, canvas);
    drawSheet();
    drawPreviewFrame(selectedFrame);
  });
}

function fillSfxSelects(): void {
  const opts =
    `<option value="">(none)</option>` +
    SOUND_BANK_SLOTS.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
  for (const kind of ['onSpawn', 'onHit', 'onDeath']) {
    const sel = $(`studio-evt-${kind}-sfx`) as HTMLSelectElement | null;
    if (sel && !sel.dataset.filled) {
      sel.innerHTML = opts;
      sel.dataset.filled = '1';
    }
  }
  const fxOpts = FX_PRESETS.map((f) => `<option value="${f}">${f}</option>`).join('');
  const clipFx = $('studio-clip-fx') as HTMLSelectElement | null;
  if (clipFx && !clipFx.dataset.filled) {
    clipFx.innerHTML = fxOpts;
    clipFx.dataset.filled = '1';
  }
  for (const kind of ['onSpawn', 'onHit', 'onDeath']) {
    const fx = $(`studio-evt-${kind}-fx`) as HTMLSelectElement | null;
    if (fx && !fx.dataset.filled) {
      fx.innerHTML = fxOpts;
      fx.dataset.filled = '1';
    }
  }
}

function renderSoundBank(): void {
  const list = $('studio-sound-list');
  if (!list) return;
  list.innerHTML = '';
  for (const slot of SOUND_BANK_SLOTS) {
    const row = document.createElement('div');
    row.className = 'studio-sfx-row';
    const hasCustom = Boolean(soundStore.replacements[slot.id]);
    row.innerHTML = `
      <div class="studio-sfx-meta">
        <strong>${slot.label}</strong>
        <span class="studio-sfx-file">${slot.file}${hasCustom ? ' · custom' : ''}</span>
      </div>
      <div class="studio-sfx-actions">
        <button type="button" class="studio-btn studio-btn--sm" data-sfx-play="${slot.id}">Play</button>
        <label class="studio-btn studio-btn--sm studio-btn--file">
          Upload
          <input type="file" accept="audio/*,.wav,.mp3,.ogg" data-sfx-upload="${slot.id}" hidden />
        </label>
        <button type="button" class="studio-btn studio-btn--sm studio-btn--danger" data-sfx-clear="${slot.id}" ${hasCustom ? '' : 'disabled'}>Clear</button>
      </div>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll<HTMLButtonElement>('[data-sfx-play]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.sfxPlay!;
      const slot = SOUND_BANK_SLOTS.find((s) => s.id === id);
      if (!slot) return;
      const src = soundStore.replacements[id] || `/Sound/${slot.file}`;
      if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
      }
      previewAudio = new Audio(src);
      void previewAudio.play().catch(() => setStatus(`Could not play ${slot.file}`, false));
    });
  });

  list.querySelectorAll<HTMLInputElement>('[data-sfx-upload]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = input.dataset.sfxUpload!;
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        soundStore.replacements[id] = dataUrl;
        saveSoundBank(soundStore);
        renderSoundBank();
        setStatus(`SFX ${id} replaced locally (~${approxDataUrlKb(dataUrl)} KB)`);
      };
      reader.readAsDataURL(file);
    });
  });

  list.querySelectorAll<HTMLButtonElement>('[data-sfx-clear]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.sfxClear!;
      delete soundStore.replacements[id];
      saveSoundBank(soundStore);
      renderSoundBank();
      setStatus(`Cleared custom SFX for ${id}`);
    });
  });
}

function bindControls(): void {
  $('studio-entity')?.addEventListener('change', (e) => {
    store.selectedEntity = (e.target as HTMLSelectElement).value;
    void onEntityChange();
  });

  const onGrid = () => {
    const ent = currentEntity();
    ent.cols = Math.max(1, Number(($('studio-cols') as HTMLInputElement).value) || 1);
    ent.rows = Math.max(1, Number(($('studio-rows') as HTMLInputElement).value) || 1);
    ent.frameW = Math.max(0, Number(($('studio-frame-w') as HTMLInputElement).value) || 0);
    ent.frameH = Math.max(0, Number(($('studio-frame-h') as HTMLInputElement).value) || 0);
    drawSheet();
    drawPreviewFrame(selectedFrame);
    renderEntityRail();
  };
  ['studio-cols', 'studio-rows', 'studio-frame-w', 'studio-frame-h'].forEach((id) => {
    $(id)?.addEventListener('input', onGrid);
  });

  $('studio-entity-label')?.addEventListener('change', () => {
    const v = (($('studio-entity-label') as HTMLInputElement).value || '').trim();
    if (v) currentEntity().label = v;
    else delete currentEntity().label;
    fillEntitySelect();
    renderEntityRail();
  });

  $('studio-sheet-upload')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      currentEntity().sheetDataUrl = dataUrl;
      await loadSheetImage(dataUrl);
      selectedFrame = 0;
      drawSheet();
      drawPreviewFrame(0);
      renderEntityRail();
      setStatus(`Sheet loaded (~${approxDataUrlKb(dataUrl)} KB). Remember localStorage ~5MB limit.`);
    };
    reader.readAsDataURL(file);
  });

  $('studio-clip-state')?.addEventListener('change', () => syncClipInputs());
  $('studio-clip-dir')?.addEventListener('change', () => syncClipInputs());
  $('studio-apply-clip')?.addEventListener('click', () => applyClipFromInputs());
  $('studio-use-selected-start')?.addEventListener('click', () => {
    const start = $('studio-clip-start') as HTMLInputElement | null;
    if (start) start.value = String(selectedFrame);
    applyClipFromInputs();
  });
  $('studio-set-range-end')?.addEventListener('click', () => {
    const start = Number(($('studio-clip-start') as HTMLInputElement | null)?.value || 0);
    setClipRangeFromFrames(start, selectedFrame);
    setStatus(`Range set ${start}–${selectedFrame}`);
  });

  document.querySelectorAll<HTMLButtonElement>('[data-studio-state]').forEach((btn) => {
    btn.addEventListener('click', () => {
      previewState = btn.dataset.studioState as StudioState;
      document.querySelectorAll('[data-studio-state]').forEach((b) => b.classList.toggle('is-on', b === btn));
      playPreview();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-studio-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      previewDir = btn.dataset.studioDir as StudioDirection;
      document.querySelectorAll('[data-studio-dir]').forEach((b) => b.classList.toggle('is-on', b === btn));
      playPreview();
    });
  });

  $('studio-fps')?.addEventListener('input', (e) => {
    previewFps = Math.max(1, Number((e.target as HTMLInputElement).value) || 8);
    const label = $('studio-fps-label');
    if (label) label.textContent = `${previewFps} FPS`;
  });
  $('studio-play')?.addEventListener('click', () => playPreview());
  $('studio-stop')?.addEventListener('click', () => {
    stopPreviewLoop();
    drawPreviewFrame(activeClip().startFrame);
  });
  $('studio-play-all')?.addEventListener('click', () => playAllStates());
  $('studio-sim-hit')?.addEventListener('click', () => {
    previewState = 'hit';
    document.querySelectorAll('[data-studio-state]').forEach((b) =>
      b.classList.toggle('is-on', (b as HTMLElement).dataset.studioState === 'hit'),
    );
    firePreviewHook('onHit');
    playPreview();
  });
  $('studio-sim-death')?.addEventListener('click', () => {
    previewState = 'death';
    document.querySelectorAll('[data-studio-state]').forEach((b) =>
      b.classList.toggle('is-on', (b as HTMLElement).dataset.studioState === 'death'),
    );
    firePreviewHook('onDeath');
    playPreview();
  });
  $('studio-sim-spawn')?.addEventListener('click', () => {
    previewState = 'idle';
    document.querySelectorAll('[data-studio-state]').forEach((b) =>
      b.classList.toggle('is-on', (b as HTMLElement).dataset.studioState === 'idle'),
    );
    firePreviewHook('onSpawn');
    playPreview();
  });
  $('studio-onion')?.addEventListener('change', (e) => {
    onionSkin = Boolean((e.target as HTMLInputElement).checked);
    drawPreviewFrame(selectedFrame);
  });

  $('studio-save')?.addEventListener('click', () => persistAll());
  $('studio-export-frame')?.addEventListener('click', () => exportSelectedFrame());
  $('studio-export-pack')?.addEventListener('click', () => exportEntityPack());
  $('studio-import-pack')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) importEntityPackFile(file);
  });
  $('studio-duplicate')?.addEventListener('click', () => duplicateEntity());
  $('studio-clear-entity')?.addEventListener('click', async () => {
    store.entities[store.selectedEntity] = emptyEntityData();
    await onEntityChange();
    setStatus(`Cleared Creator data for ${store.selectedEntity}`);
  });

  for (const kind of ['onSpawn', 'onHit', 'onDeath']) {
    for (const suffix of ['sfx', 'flash', 'shake', 'fx']) {
      $(`studio-evt-${kind}-${suffix}`)?.addEventListener('change', () => readEventInputsIntoEntity());
    }
  }

  bindSheetCanvasClick();
  bindTimeline();
}

export function installMediaStudio(): void {
  if (!$('admin-media-studio')) return;
  store = loadStudioStore();
  soundStore = loadSoundBank();
  fillSfxSelects();
  if (!installed) {
    fillEntitySelect();
    bindControls();
    installed = true;
  } else {
    fillEntitySelect();
  }
  syncGridInputs();
  syncClipInputs();
  syncEventInputs();
  renderSoundBank();
  renderEntityRail();
  void loadSheetImage(currentEntity().sheetDataUrl).then(() => {
    drawSheet();
    drawPreviewFrame(selectedFrame);
  });
  const fps = $('studio-fps') as HTMLInputElement | null;
  if (fps) {
    previewFps = Number(fps.value) || 8;
    const label = $('studio-fps-label');
    if (label) label.textContent = `${previewFps} FPS`;
  }
  document.querySelectorAll('[data-studio-state]').forEach((b) =>
    b.classList.toggle('is-on', (b as HTMLElement).dataset.studioState === previewState),
  );
  document.querySelectorAll('[data-studio-dir]').forEach((b) =>
    b.classList.toggle('is-on', (b as HTMLElement).dataset.studioDir === previewDir),
  );
  pushEventLog('Creator Hub ready');
}
