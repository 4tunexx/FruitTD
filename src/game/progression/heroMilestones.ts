import { MAX_HERO_LEVEL, type HeroId } from '../heroes';

/**
 * Data-driven hero milestones.
 *
 * Milestone behaviour must never be hardcoded into UI files — every consumer
 * (HUD, toasts, hero screen, tests) reads this table.
 */
export type HeroMilestoneKind = 'cosmetic' | 'perk' | 'unlock' | 'mastery';

export interface HeroMilestone {
  level: number;
  kind: HeroMilestoneKind;
  name: string;
  reward: string;
  /** Set when reaching this level on Master Jiju unlocks another hero. */
  unlocksHero?: HeroId;
  /** Perk points granted on top of the standard per-level economy. */
  bonusPerkPoints?: number;
}

export const HERO_MILESTONES: HeroMilestone[] = [
  { level: 5, kind: 'cosmetic', name: 'First Edge', reward: 'Blade effect slot' },
  { level: 10, kind: 'perk', name: 'Combo Engine', reward: 'Hero perk I + Topfu unlock', unlocksHero: 'topfu', bonusPerkPoints: 1 },
  { level: 20, kind: 'cosmetic', name: 'Bladebearer', reward: 'Hero cosmetic slot' },
  { level: 25, kind: 'unlock', name: 'Long Reach', reward: 'Lagen unlock', unlocksHero: 'lagen' },
  { level: 30, kind: 'perk', name: 'Tower Guardian', reward: 'Hero perk II', bonusPerkPoints: 1 },
  { level: 40, kind: 'cosmetic', name: 'Orchard Veteran', reward: 'Hero cosmetic slot' },
  { level: 50, kind: 'perk', name: 'Perfect Cut', reward: 'Hero perk III', bonusPerkPoints: 1 },
  { level: 60, kind: 'cosmetic', name: 'Grove Warden', reward: 'Hero cosmetic slot' },
  { level: 75, kind: 'perk', name: 'Last Stand', reward: 'Major hero perk IV', bonusPerkPoints: 2 },
  { level: 90, kind: 'cosmetic', name: 'Mastery Aura', reward: 'Mastery cosmetic' },
  { level: 100, kind: 'mastery', name: 'Max Mastery', reward: 'MAX MASTERY — permanent Hero 100 title', bonusPerkPoints: 3 },
];

export function heroMilestoneAt(level: number): HeroMilestone | null {
  return HERO_MILESTONES.find((m) => m.level === level) ?? null;
}

export function heroMilestonesUnlocked(level: number): HeroMilestone[] {
  const lv = Math.max(1, Math.floor(level));
  return HERO_MILESTONES.filter((m) => m.level <= lv);
}

export function nextHeroMilestone(level: number): HeroMilestone | null {
  const lv = Math.max(1, Math.floor(level));
  return HERO_MILESTONES.find((m) => m.level > lv) ?? null;
}

/** Milestones crossed by moving from `fromLevel` to `toLevel` (exclusive → inclusive). */
export function heroMilestonesBetween(fromLevel: number, toLevel: number): HeroMilestone[] {
  const from = Math.max(0, Math.floor(fromLevel));
  const to = Math.max(0, Math.floor(toLevel));
  if (to <= from) return [];
  return HERO_MILESTONES.filter((m) => m.level > from && m.level <= to);
}

/** Heroes that Master Jiju's level unlocks for free (never the purchase-only heroes). */
export function heroesUnlockedByJijuLevel(level: number): HeroId[] {
  return heroMilestonesUnlocked(level)
    .map((m) => m.unlocksHero)
    .filter((id): id is HeroId => !!id);
}

export function isHeroMastered(level: number): boolean {
  return Math.floor(level) >= MAX_HERO_LEVEL;
}

/** Total bonus perk points granted by milestones up to `level`. */
export function heroMilestonePerkPoints(level: number): number {
  return heroMilestonesUnlocked(level).reduce((sum, m) => sum + (m.bonusPerkPoints ?? 0), 0);
}
