import type { HeroId } from './heroes';
import { heroXpToLevel } from './heroes';
import { HERO_PERKS, type HeroPerkId } from './heroProgression';

const KEY = 'fruit-td-hero-perks-v1';
export type HeroPerkRanks = Record<HeroId, Partial<Record<HeroPerkId, number>>>;

const empty = (): HeroPerkRanks => ({ jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} });

export function loadHeroPerks(): HeroPerkRanks {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<HeroPerkRanks>;
    const out = empty();
    for (const hero of Object.keys(out) as HeroId[]) {
      for (const perk of HERO_PERKS) {
        const rank = Number(parsed[hero]?.[perk.id]) || 0;
        out[hero][perk.id] = Math.max(0, Math.min(perk.maxRank, Math.floor(rank)));
      }
    }
    return out;
  } catch { return empty(); }
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
  const data = loadHeroPerks();
  const rank = Number(data[hero][perk]) || 0;
  data[hero][perk] = Math.min(def.maxRank, rank + 1);
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}
