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

export function heroPerkRank(level: number, perk: HeroPerkDef): number {
  if (level < perk.unlockLevel) return 0;
  const steps = Math.floor((level - perk.unlockLevel) / 10) + 1;
  return Math.max(1, Math.min(perk.maxRank, steps));
}

export function heroPerkMultiplier(id: HeroPerkId, level: number): number {
  const perk = HERO_PERKS.find((p) => p.id === id);
  if (!perk) return 1;
  const rank = heroPerkRank(level, perk);
  if (rank <= 0) return 1;
  switch (id) {
    case 'combo': return 1 + rank * 0.08;
    case 'juice': return 1 + rank * 0.10;
    case 'tower': return Math.max(0.7, 1 - rank * 0.10);
    case 'critical': return 1 + rank * 0.06;
    case 'survival': return 1 + rank * 0.12;
  }
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
