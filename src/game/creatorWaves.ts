/**
 * Creator Wave/Level Board — authored packs + planner override helpers.
 * Storage: fruittd-creator-waves-v1 (draft). Publish → AdminConfig.waves / liveConfig.
 */
import type { FruitKind } from './fruits';
import type { EnemyKind } from './enemies';
import { modeRules } from './modes';
import type { GameMode } from './save';
import type { SpawnItem, WavePlan } from './waves';

export const CREATOR_WAVES_STORAGE_KEY = 'fruittd-creator-waves-v1';

export const FRUIT_KIND_OPTIONS: FruitKind[] = [
  'lemon', 'orange', 'banana', 'strawberry', 'kiwi', 'pineapple', 'watermelon', 'bomb', 'apple',
];

export const ENEMY_KIND_OPTIONS: { kind: EnemyKind; label: string }[] = [
  { kind: 'normal', label: 'Rot-Walker' },
  { kind: 'explosive', label: 'Chem-Burst' },
  { kind: 'armored', label: 'Rind-Plate' },
  { kind: 'splitter', label: 'Pod-Spawner' },
  { kind: 'swift', label: 'Juice-Runner' },
];

export interface AuthoredSpawnRow {
  fruit: FruitKind;
  enemy: EnemyKind;
  count: number;
  boss?: boolean;
}

export interface AuthoredWave {
  title?: string;
  subtitle?: string;
  gap?: number;
  hpScale?: number;
  /** When true, treat this slot as a boss wave (items.boss forced). */
  boss?: boolean;
  spawns: AuthoredSpawnRow[];
}

export interface AuthoredLevel {
  level: number;
  /** Regular waves before the overlord boss slot (aligns with max(5,N) hoard). */
  wavesCount: number;
  waves: AuthoredWave[];
  bossWave?: AuthoredWave;
}

export interface CreatorWavesStore {
  version: 1;
  levels: Record<string, AuthoredLevel>;
}

/** Shape stored on AdminConfig.waves / liveConfig. */
export type AdminWavesConfig = CreatorWavesStore;

/** Published AdminConfig.waves holder (set by liveConfig; read by waves planner). */
let liveWavesConfig: AdminWavesConfig | null = null;

export function setLiveWavesConfig(waves: AdminWavesConfig | null | undefined): void {
  liveWavesConfig = waves && typeof waves === 'object' ? waves : null;
}

export function getLiveWavesConfig(): AdminWavesConfig | null {
  return liveWavesConfig;
}

const FRUIT_SET = new Set<string>(FRUIT_KIND_OPTIONS);
const ENEMY_SET = new Set<string>(ENEMY_KIND_OPTIONS.map((e) => e.kind));

function asFruit(v: unknown, fallback: FruitKind = 'lemon'): FruitKind {
  return typeof v === 'string' && FRUIT_SET.has(v) ? (v as FruitKind) : fallback;
}

function asEnemy(v: unknown, fallback: EnemyKind = 'normal'): EnemyKind {
  return typeof v === 'string' && ENEMY_SET.has(v) ? (v as EnemyKind) : fallback;
}

function asNum(v: unknown, fallback: number, min?: number, max?: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  let out = n;
  if (min != null) out = Math.max(min, out);
  if (max != null) out = Math.min(max, out);
  return out;
}

export function defaultWavesCount(level: number): number {
  return Math.max(5, Math.max(1, Math.floor(level) || 1));
}

export function emptySpawnRow(): AuthoredSpawnRow {
  return { fruit: 'lemon', enemy: 'normal', count: 3, boss: false };
}

export function emptyWave(level: number, waveInLevel: number, total: number, boss = false): AuthoredWave {
  if (boss) {
    return {
      title: `LEVEL ${level}  ·  OVERLORD`,
      subtitle: 'Fruit-zombie overlord approaches',
      gap: 1.2,
      hpScale: undefined,
      boss: true,
      spawns: [{ fruit: 'watermelon', enemy: level >= 2 ? 'armored' : 'normal', count: 1, boss: true }],
    };
  }
  return {
    title: `LEVEL ${level}  ·  WAVE ${waveInLevel}/${total}`,
    subtitle: waveInLevel === 1 ? 'Rot-Walkers stir in the orchard' : undefined,
    gap: undefined,
    hpScale: undefined,
    boss: false,
    spawns: [emptySpawnRow()],
  };
}

export function ensureAuthoredLevel(level: number, partial?: Partial<AuthoredLevel> | null): AuthoredLevel {
  const lvl = Math.max(1, Math.floor(level) || 1);
  const wavesCount = Math.max(1, Math.floor(asNum(partial?.wavesCount, defaultWavesCount(lvl), 1, 40)));
  const waves: AuthoredWave[] = [];
  const srcWaves = Array.isArray(partial?.waves) ? partial!.waves! : [];
  for (let i = 0; i < wavesCount; i++) {
    waves.push(normalizeWave(srcWaves[i] ?? emptyWave(lvl, i + 1, wavesCount), lvl, i + 1, wavesCount, false));
  }
  const bossSrc = partial?.bossWave ?? emptyWave(lvl, wavesCount + 1, wavesCount, true);
  return {
    level: lvl,
    wavesCount,
    waves,
    bossWave: normalizeWave(bossSrc, lvl, wavesCount + 1, wavesCount, true),
  };
}

function normalizeSpawn(raw: unknown): AuthoredSpawnRow {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    fruit: asFruit(row.fruit ?? row.kind),
    enemy: asEnemy(row.enemy),
    count: Math.max(1, Math.min(64, Math.floor(asNum(row.count, 1, 1, 64)))),
    boss: Boolean(row.boss),
  };
}

function normalizeWave(
  raw: unknown,
  level: number,
  waveInLevel: number,
  total: number,
  forceBoss: boolean,
): AuthoredWave {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const spawnsRaw = Array.isArray(row.spawns) ? row.spawns : Array.isArray(row.items) ? row.items : null;
  const spawns = spawnsRaw && spawnsRaw.length
    ? spawnsRaw.map(normalizeSpawn)
    : emptyWave(level, waveInLevel, total, forceBoss).spawns;
  const gap = row.gap == null || row.gap === '' ? undefined : asNum(row.gap, 0.5, 0.05, 5);
  const hpScale = row.hpScale == null || row.hpScale === '' ? undefined : asNum(row.hpScale, 1, 0.1, 50);
  return {
    title: typeof row.title === 'string' ? row.title : undefined,
    subtitle: typeof row.subtitle === 'string' ? row.subtitle : undefined,
    gap,
    hpScale,
    boss: forceBoss || Boolean(row.boss),
    spawns,
  };
}

export function normalizeCreatorWavesStore(raw: unknown): CreatorWavesStore {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const levelsIn = src.levels && typeof src.levels === 'object' ? (src.levels as Record<string, unknown>) : {};
  const levels: Record<string, AuthoredLevel> = {};
  for (const [key, value] of Object.entries(levelsIn)) {
    const lvlNum = Math.max(1, Math.floor(Number(key)) || 1);
    const partial = value && typeof value === 'object' ? (value as Partial<AuthoredLevel>) : null;
    levels[String(lvlNum)] = ensureAuthoredLevel(lvlNum, {
      ...partial,
      level: lvlNum,
    });
  }
  return { version: 1, levels };
}

export function emptyCreatorWavesStore(): CreatorWavesStore {
  return { version: 1, levels: {} };
}

export function loadCreatorWavesStore(
  storage: Pick<Storage, 'getItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null,
): CreatorWavesStore {
  if (!storage) return emptyCreatorWavesStore();
  try {
    const raw = storage.getItem(CREATOR_WAVES_STORAGE_KEY);
    if (!raw) return emptyCreatorWavesStore();
    return normalizeCreatorWavesStore(JSON.parse(raw));
  } catch {
    return emptyCreatorWavesStore();
  }
}

export function saveCreatorWavesStore(
  store: CreatorWavesStore,
  storage: Pick<Storage, 'setItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CREATOR_WAVES_STORAGE_KEY, JSON.stringify(normalizeCreatorWavesStore(store)));
    return true;
  } catch {
    return false;
  }
}

export function previewSummary(level: AuthoredLevel): string {
  const n = level.wavesCount;
  const hasBoss = Boolean(level.bossWave);
  return `Level ${level.level} → ${n} wave${n === 1 ? '' : 's'}${hasBoss ? ' + boss' : ''}`;
}

export function expandSpawns(rows: AuthoredSpawnRow[], forceBoss = false): SpawnItem[] {
  const items: SpawnItem[] = [];
  for (const row of rows) {
    const n = Math.max(1, Math.min(64, Math.floor(row.count) || 1));
    const boss = forceBoss || Boolean(row.boss);
    for (let i = 0; i < n; i++) {
      items.push({
        kind: asFruit(row.fruit),
        boss,
        enemy: asEnemy(row.enemy),
      });
    }
  }
  return items;
}

export interface WaveOverrideSources {
  /** Draft board (localStorage). */
  creator?: CreatorWavesStore | null;
  /** Published admin / liveConfig.waves. */
  live?: CreatorWavesStore | AdminWavesConfig | null;
}

/** Local draft wins over published live for the same level (playtest without re-publish). */
export function resolveAuthoredLevel(
  level: number,
  sources: WaveOverrideSources = {},
): AuthoredLevel | null {
  const key = String(Math.max(1, Math.floor(level) || 1));
  const creator = sources.creator ? normalizeCreatorWavesStore(sources.creator) : null;
  const live = sources.live ? normalizeCreatorWavesStore(sources.live) : null;
  if (creator?.levels[key]) return creator.levels[key];
  if (live?.levels[key]) return live.levels[key];
  return null;
}

export function authoredWavesPerLevel(
  level: number,
  sources: WaveOverrideSources = {},
  procedural: (lvl: number) => number = defaultWavesCount,
): number {
  const authored = resolveAuthoredLevel(level, sources);
  if (authored && authored.wavesCount >= 1) return authored.wavesCount;
  return procedural(level);
}

function proceduralGapHp(wave: number, mode: GameMode, boss: boolean): { gap: number; hpScale: number } {
  const rules = modeRules(mode);
  const w = Math.max(1, wave + rules.waveOffset);
  const gap = boss
    ? 1.2
    : Math.max(0.28, (0.82 - w * 0.035) * rules.spawnGapMul);
  const hpScale = boss
    ? (1 + (w - 1) * 0.2) * rules.hpMul * 1.5
    : (1 + (w - 1) * 0.2) * rules.hpMul;
  return { gap, hpScale };
}

/** Build a WavePlan from an authored wave, or null if empty/invalid. */
export function authoredWaveToPlan(
  authored: AuthoredWave,
  opts: {
    wave: number;
    mode: GameMode;
    level: number;
    waveInLevel: number;
    wavesInLevel: number;
    forceBoss?: boolean;
  },
): WavePlan | null {
  const forceBoss = Boolean(opts.forceBoss || authored.boss);
  const items = expandSpawns(authored.spawns, forceBoss);
  if (!items.length) return null;
  const proc = proceduralGapHp(opts.wave, opts.mode, forceBoss);
  const title =
    (authored.title && authored.title.trim()) ||
    (forceBoss
      ? `LEVEL ${opts.level}  ·  OVERLORD`
      : `LEVEL ${opts.level}  ·  WAVE ${opts.waveInLevel}/${opts.wavesInLevel}`);
  return {
    items,
    gap: authored.gap != null ? authored.gap : proc.gap,
    hpScale: authored.hpScale != null ? authored.hpScale : proc.hpScale,
    boss: forceBoss,
    title,
    subtitle: authored.subtitle,
    level: opts.level,
    waveInLevel: opts.waveInLevel,
    wavesInLevel: opts.wavesInLevel,
  };
}

export function tryAuthoredPlanWave(
  wave: number,
  mode: GameMode,
  level: number,
  waveInLevel: number,
  totalWavesInLevel: number,
  sources: WaveOverrideSources = {},
): WavePlan | null {
  const authoredLevel = resolveAuthoredLevel(level, sources);
  if (!authoredLevel) return null;
  const idx = Math.max(0, Math.min(authoredLevel.waves.length - 1, waveInLevel - 1));
  const authored = authoredLevel.waves[idx];
  if (!authored) return null;
  return authoredWaveToPlan(authored, {
    wave,
    mode,
    level,
    waveInLevel,
    wavesInLevel: authoredLevel.wavesCount || totalWavesInLevel,
    forceBoss: Boolean(authored.boss),
  });
}

export function tryAuthoredPlanBossWave(
  wave: number,
  mode: GameMode,
  level: number,
  sources: WaveOverrideSources = {},
): WavePlan | null {
  const authoredLevel = resolveAuthoredLevel(level, sources);
  if (!authoredLevel?.bossWave) return null;
  const wavesInLevel = authoredLevel.wavesCount || defaultWavesCount(level);
  return authoredWaveToPlan(authoredLevel.bossWave, {
    wave,
    mode,
    level,
    waveInLevel: wavesInLevel + 1,
    wavesInLevel,
    forceBoss: true,
  });
}

/** Convert board store → admin config payload (waves field). */
export function storeToAdminWaves(store: CreatorWavesStore): AdminWavesConfig {
  return normalizeCreatorWavesStore(store);
}
