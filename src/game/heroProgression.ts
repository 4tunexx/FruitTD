import type { HeroId } from './heroes';
import { MAX_HERO_LEVEL } from './heroes';

export type HeroPerkId = 'combo' | 'juice' | 'tower' | 'critical' | 'survival';

export interface HeroPerkDef {
  id: HeroPerkId;
  name: string;
  description: string;
  unlockLevel: number;
  maxRank: number;
}

export const HERO_PERKS: HeroPerkDef[] = [
  { id: 'combo', name: 'Combo Engine', description: 'Build and keep combo momentum for longer.', unlockLevel: 10, maxRank: 3 },
  { id: 'juice', name: 'Juice Hunter', description: 'Earn extra Juice from clean slices.', unlockLevel: 20, maxRank: 3 },
  { id: 'tower', name: 'Tower Guardian', description: 'Reduce Main Tower damage from leaks while this hero is active.', unlockLevel: 30, maxRank: 3 },
  { id: 'critical', name: 'Perfect Cut', description: 'Small chance for a powerful critical slash.', unlockLevel: 50, maxRank: 3 },
  { id: 'survival', name: 'Last Stand', description: 'Gain a clutch bonus when the Main Tower is low on health.', unlockLevel: 75, maxRank: 3 },
];

export function availableHeroPerks(level: number): HeroPerkDef[] {
  return HERO_PERKS.filter((perk) => level >= perk.unlockLevel);
}

/** Auto-rank projection from hero level (unlock pacing / UI). Combat uses spent ranks instead. */
export function heroPerkRank(level: number, perk: HeroPerkDef): number {
  if (level < perk.unlockLevel) return 0;
  const steps = Math.floor((level - perk.unlockLevel) / 10) + 1;
  return Math.max(1, Math.min(perk.maxRank, steps));
}

/**
 * Per-rank perk tuning. Values are deliberately modest so perks stay
 * meaningful without being overpowered, and live in one configurable table.
 */
export const HERO_PERK_VALUES: Record<HeroPerkId, { perRank: number; mode: 'bonus' | 'reduction'; floor?: number }> = {
  combo: { perRank: 0.08, mode: 'bonus' },
  juice: { perRank: 0.10, mode: 'bonus' },
  tower: { perRank: 0.10, mode: 'reduction', floor: 0.7 },
  critical: { perRank: 0.06, mode: 'bonus' },
  survival: { perRank: 0.12, mode: 'bonus' },
};

/** Admin/live-config hook for perk tuning. */
export function setHeroPerkValue(id: HeroPerkId, perRank: number): void {
  const entry = HERO_PERK_VALUES[id];
  if (entry) entry.perRank = Math.max(0, Number(perRank) || 0);
}

/**
 * Combat multiplier from an explicit perk rank.
 * Rank 0 stays neutral (1x / no tower leak reduction).
 */
export function heroPerkMultiplier(id: HeroPerkId, rank: number): number {
  const safeRank = Math.max(0, Math.floor(Number(rank) || 0));
  const cfg = HERO_PERK_VALUES[id];
  if (safeRank <= 0 || !cfg) return 1;
  if (cfg.mode === 'reduction') {
    return Math.max(cfg.floor ?? 0, 1 - safeRank * cfg.perRank);
  }
  return 1 + safeRank * cfg.perRank;
}

export function heroMasteryReward(level: number): string | null {
  if (level >= MAX_HERO_LEVEL) return 'Mastery badge + permanent Hero 100 title';
  if (level >= 90) return 'Mastery cosmetic';
  if (level >= 75) return 'Last Stand perk rank';
  if (level >= 50) return 'Perfect Cut perk rank';
  if (level >= 30) return 'Tower Guardian perk rank';
  if (level >= 20) return 'Juice Hunter perk rank';
  if (level >= 10) return 'Combo Engine perk + next hero unlock';
  if (level >= 5) return 'Blade effect slot';
  return null;
}

export function heroLevelReward(hero: HeroId, level: number): string | null {
  if (hero === 'jiju' && level === 10) return 'Topfu unlocked';
  if (hero === 'jiju' && level === 25) return 'Lagen unlocked';
  if (level === 100) return `${hero} Mastery complete`;
  return heroMasteryReward(level);
}
