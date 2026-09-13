import { MAX_TOWER_LEVEL } from './world';

const KEY = 'fruit-td-main-tower-progression-v1';

export interface TowerProgression {
  xp: number;
  lifetimeXp: number;
}

export interface TowerXpState extends TowerProgression {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  maxed: boolean;
}

// Main tower XP is intentionally separate from hero XP, coins, score and the
// in-match tower upgrade level. It is account progression, not combat stats.
const LEVEL_XP = [0, 100, 300, 650, 1100, 1700];

export function defaultTowerProgression(): TowerProgression {
  return { xp: 0, lifetimeXp: 0 };
}

function read(): TowerProgression {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultTowerProgression();
    const parsed = JSON.parse(raw) as Partial<TowerProgression>;
    return {
      xp: Math.max(0, Number(parsed.xp) || 0),
      lifetimeXp: Math.max(0, Number(parsed.lifetimeXp) || 0),
    };
  } catch {
    return defaultTowerProgression();
  }
}

function write(value: TowerProgression): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Local progression is best-effort until the server-authoritative save layer.
  }
}

export function towerLevelFromXp(xp: number): number {
  const safe = Math.max(0, xp);
  let level = 1;
  for (let i = 1; i < LEVEL_XP.length; i++) {
    if (safe >= LEVEL_XP[i]) level = i + 1;
    else break;
  }
  return Math.min(MAX_TOWER_LEVEL, level);
}

export function towerXpForLevel(level: number): number {
  const index = Math.max(0, Math.min(MAX_TOWER_LEVEL - 1, Math.floor(level) - 1));
  return LEVEL_XP[index] ?? 0;
}

export function towerXpToNextLevel(level: number): number | null {
  if (level >= MAX_TOWER_LEVEL) return null;
  return LEVEL_XP[level] ?? null;
}

export function getTowerProgression(): TowerProgression {
  return read();
}

export function getTowerXpState(): TowerXpState {
  const progression = read();
  const level = towerLevelFromXp(progression.xp);
  const currentLevelXp = towerXpForLevel(level);
  const nextLevelXp = towerXpToNextLevel(level);
  const progress = nextLevelXp === null
    ? 1
    : Math.max(0, Math.min(1, (progression.xp - currentLevelXp) / Math.max(1, nextLevelXp - currentLevelXp)));

  return {
    ...progression,
    level,
    currentLevelXp,
    nextLevelXp: nextLevelXp ?? currentLevelXp,
    progress,
    maxed: level >= MAX_TOWER_LEVEL,
  };
}

export function grantTowerXp(amount: number): TowerXpState {
  const progression = read();
  const safeAmount = Math.max(0, Math.floor(amount));
  if (safeAmount <= 0) return getTowerXpState();

  // Keep XP capped at the final level threshold, while lifetimeXp remains an
  // audit/progression counter and continues increasing after max level.
  progression.xp = Math.min(LEVEL_XP[LEVEL_XP.length - 1], progression.xp + safeAmount);
  progression.lifetimeXp += safeAmount;
  write(progression);
  return getTowerXpState();
}

export function resetTowerProgression(): void {
  write(defaultTowerProgression());
}
