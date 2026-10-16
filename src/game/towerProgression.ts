import { MAX_TOWER_LEVEL } from './world';

const KEY = 'fruit-td-main-tower-progression-v1';

export interface TowerProgression { xp: number; lifetimeXp: number; }
export interface TowerXpState extends TowerProgression {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  maxed: boolean;
}

// Tower XP belongs to the active run. Only lifetime XP is retained as a career statistic.
const LEVEL_XP = [0, 100, 300, 650, 1100, 1700, 2500, 3500, 4800, 6400];
let runXp = 0;

export function defaultTowerProgression(): TowerProgression { return { xp: 0, lifetimeXp: 0 }; }

function read(): TowerProgression {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { xp: runXp, lifetimeXp: 0 };
    const parsed = JSON.parse(raw) as Partial<TowerProgression>;
    return { xp: runXp, lifetimeXp: Math.max(0, Number(parsed.lifetimeXp) || 0, Number(parsed.xp) || 0) };
  } catch { return { xp: runXp, lifetimeXp: 0 }; }
}

function write(value: TowerProgression): void {
  runXp = value.xp;
  try { localStorage.setItem(KEY, JSON.stringify({ xp: 0, lifetimeXp: value.lifetimeXp })); } catch { /* best effort */ }
}

/** Migrate legacy cloud XP into lifetime stats without restoring a past run. */
export function syncTowerProgression(xp: number, lifetimeXp = xp): TowerProgression {
  const local = read();
  const next = {
    xp: runXp,
    lifetimeXp: Math.max(local.lifetimeXp, Number(lifetimeXp) || 0, Number(xp) || 0),
  };
  write(next);
  return next;
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
  const index = Math.max(0, Math.min(LEVEL_XP.length - 1, Math.floor(level) - 1));
  return LEVEL_XP[index] ?? 0;
}

export function towerXpToNextLevel(level: number): number | null {
  if (level >= MAX_TOWER_LEVEL) return null;
  return LEVEL_XP[Math.max(0, Math.floor(level))] ?? null;
}

export function getTowerProgression(): TowerProgression { return read(); }

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
  progression.xp = Math.min(LEVEL_XP[LEVEL_XP.length - 1], progression.xp + safeAmount);
  progression.lifetimeXp += safeAmount;
  write(progression);
  return getTowerXpState();
}

/** A restart, mode switch or fresh match always begins at Lv 1. */
export function resetTowerRun(): void { runXp = 0; }

export function resetTowerProgression(): void { write(defaultTowerProgression()); }
