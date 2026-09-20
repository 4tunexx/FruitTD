import type { HeroId } from './heroes';
import { heroXpToLevel } from './heroes';
import { HERO_PERKS, heroPerkMultiplier, type HeroPerkId } from './heroProgression';
import { getSaveEpoch, loadSave, writeSave, type HeroPerkRanks } from './save';
import { perkPointsFromLevel } from './progression';

const EMPTY_RANKS: HeroPerkRanks = { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} };
let cachedRanks: HeroPerkRanks | null = null;
let cachedEpoch = -1;

/**
 * Perk ranks are read every frame by combat multipliers, so the parsed save is
 * cached and invalidated by the save epoch rather than re-read each call.
 */
export function loadHeroPerks(): HeroPerkRanks {
  const epoch = getSaveEpoch();
  if (cachedRanks && cachedEpoch === epoch) return cachedRanks;
  cachedRanks = loadSave().heroPerkRanks || EMPTY_RANKS;
  cachedEpoch = epoch;
  return cachedRanks;
}

export function heroPerkRank(hero: HeroId, perk: HeroPerkId): number {
  return Number(loadHeroPerks()[hero]?.[perk]) || 0;
}

/** Combat multiplier from the player's spent perk ranks for this hero. */
export function heroCombatPerkMultiplier(hero: HeroId, perk: HeroPerkId): number {
  return heroPerkMultiplier(perk, heroPerkRank(hero, perk));
}

export function canUpgradeHeroPerk(hero: HeroId, perk: HeroPerkId, heroXp: number, availablePoints: number): boolean {
  const def = HERO_PERKS.find((p) => p.id === perk);
  if (!def || availablePoints <= 0) return false;
  const level = heroXpToLevel(heroXp);
  return level >= def.unlockLevel && heroPerkRank(hero, perk) < def.maxRank;
}

/**
 * Spends one perk point. Re-validates against the persisted save (not just the
 * caller's numbers) so a stale or tampered UI cannot grant a free rank.
 */
export function upgradeHeroPerk(hero: HeroId, perk: HeroPerkId, heroXp: number, availablePoints: number): boolean {
  if (!canUpgradeHeroPerk(hero, perk, heroXp, availablePoints)) return false;
  const def = HERO_PERKS.find((p) => p.id === perk);
  if (!def) return false;
  const save = loadSave();
  if (!save.heroPerkRanks) save.heroPerkRanks = { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} };

  // Authoritative re-check against persisted state.
  const trueXp = Math.max(0, Number(save.xp[hero]) || 0);
  if (heroXpToLevel(trueXp) < def.unlockLevel) return false;
  if (getAvailableHeroPerkPoints(hero, trueXp) <= 0) return false;

  const rank = Math.max(0, Number(save.heroPerkRanks[hero][perk]) || 0);
  if (rank >= def.maxRank) return false;
  save.heroPerkRanks[hero][perk] = rank + 1;
  writeSave(save);
  return true;
}

/**
 * Perk points earned from hero level (central economy, milestones included)
 * minus ranks already spent. Can never go negative.
 */
export function getAvailableHeroPerkPoints(hero: HeroId, heroXp: number): number {
  const earned = perkPointsFromLevel(heroXpToLevel(heroXp));
  const ranks = loadHeroPerks()[hero] || {};
  const spent = HERO_PERKS.reduce((sum, perk) => sum + Math.max(0, Number(ranks[perk.id]) || 0), 0);
  return Math.max(0, earned - spent);
}
