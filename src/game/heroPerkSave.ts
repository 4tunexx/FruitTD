import type { HeroId } from './heroes';
import { heroXpToLevel } from './heroes';
import { HERO_PERKS, type HeroPerkId } from './heroProgression';
import { loadSave, writeSave, type HeroPerkRanks } from './save';

export function loadHeroPerks(): HeroPerkRanks {
  const save = loadSave();
  return save.heroPerkRanks || { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} };
}

export function heroPerkRank(hero: HeroId, perk: HeroPerkId): number {
  return Number(loadHeroPerks()[hero]?.[perk]) || 0;
}

export function canUpgradeHeroPerk(hero: HeroId, perk: HeroPerkId, heroXp: number, availablePoints: number): boolean {
  const def = HERO_PERKS.find((p) => p.id === perk);
  if (!def || availablePoints <= 0) return false;
  const level = heroXpToLevel(heroXp);
  return level >= def.unlockLevel && heroPerkRank(hero, perk) < def.maxRank;
}

export function upgradeHeroPerk(hero: HeroId, perk: HeroPerkId, heroXp: number, availablePoints: number): boolean {
  if (!canUpgradeHeroPerk(hero, perk, heroXp, availablePoints)) return false;
  const def = HERO_PERKS.find((p) => p.id === perk);
  if (!def) return false;
  const save = loadSave();
  if (!save.heroPerkRanks) save.heroPerkRanks = { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} };
  const rank = Number(save.heroPerkRanks[hero][perk]) || 0;
  save.heroPerkRanks[hero][perk] = Math.min(def.maxRank, rank + 1);
  writeSave(save);
  return true;
}

/** Perk points earned from hero level minus ranks already spent. */
export function getAvailableHeroPerkPoints(hero: HeroId, heroXp: number): number {
  const level = heroXpToLevel(heroXp);
  const earned = level < 10 ? 0 : Math.floor((level - 10) / 10) + 1;
  const ranks = loadHeroPerks()[hero] || {};
  const spent = HERO_PERKS.reduce((sum, perk) => sum + (Number(ranks[perk.id]) || 0), 0);
  return Math.max(0, earned - spent);
}
