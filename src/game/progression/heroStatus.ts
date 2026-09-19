/**
 * Hero ownership, unlock requirements and atomic purchasing (§4).
 *
 * A player must never be able to equip an unavailable hero, and a purchase must
 * atomically check price → check ownership → subtract coins → add hero → save.
 */
import { HEROES, heroDef, heroXpToLevel, type HeroId } from '../heroes';
import type { SaveData } from '../save';
import { heroMilestoneUnlockLevel, type HeroAvailability, type HeroStatus } from './index';

/** Master Jiju's level drives every free unlock. */
export function jijuLevel(save: SaveData): number {
  return heroXpToLevel(Math.max(0, Number(save.xp.jiju) || 0));
}

export function getHeroStatus(save: SaveData, heroId: HeroId): HeroStatus {
  const def = heroDef(heroId);
  const xp = Math.max(0, Number(save.xp[heroId]) || 0);
  const level = heroXpToLevel(xp);
  const owned = save.ownedHeroes.includes(heroId);
  const cost = def.purchaseOnly ? (def.purchaseCost ?? null) : null;
  const unlockLevel = def.purchaseOnly ? null : heroMilestoneUnlockLevel(heroId) ?? def.unlockLevel;
  const coins = Math.max(0, Number(save.coins) || 0);

  let availability: HeroAvailability;
  let requirement: string;
  if (owned) {
    availability = 'owned';
    requirement = heroId === 'jiju' ? 'Starter hero' : 'Owned';
  } else if (def.purchaseOnly) {
    availability = 'purchasable';
    requirement = `${(cost ?? 0).toLocaleString()} Coins`;
  } else {
    availability = 'locked';
    requirement = `Reach Master Jiju Lv ${unlockLevel ?? def.unlockLevel}`;
  }

  return {
    heroId,
    availability,
    owned,
    unlockLevel,
    purchaseCost: cost,
    requirement,
    level,
    xp,
    canAfford: cost !== null && coins >= cost,
    equippable: owned,
  };
}

export function getAllHeroStatuses(save: SaveData): HeroStatus[] {
  return HEROES.map((h) => getHeroStatus(save, h.id));
}

/** A hero may only be equipped when it is genuinely owned. */
export function canEquipHero(save: SaveData, heroId: HeroId): boolean {
  return getHeroStatus(save, heroId).equippable;
}

export type PurchaseFailure =
  | 'not-purchasable'
  | 'already-owned'
  | 'insufficient-coins'
  | 'invalid-hero';

export interface PurchaseResult {
  ok: boolean;
  error?: PurchaseFailure;
  message?: string;
  coinsSpent?: number;
  coinsRemaining?: number;
}

/**
 * Atomically purchases a hero. Mutates `save` only when every check passes, so
 * a failed purchase can never leave coins deducted without the hero (or vice
 * versa). The caller persists once afterwards.
 */
export function purchaseHeroAtomic(save: SaveData, heroId: HeroId): PurchaseResult {
  const def = HEROES.find((h) => h.id === heroId);
  if (!def) return { ok: false, error: 'invalid-hero', message: 'Unknown hero' };
  if (!def.purchaseOnly || !def.purchaseCost) {
    return { ok: false, error: 'not-purchasable', message: `${def.name} is not a purchasable hero` };
  }
  if (save.ownedHeroes.includes(heroId)) {
    return { ok: false, error: 'already-owned', message: `${def.name} is already owned` };
  }
  const cost = def.purchaseCost;
  const coins = Math.max(0, Number(save.coins) || 0);
  if (coins < cost) {
    return {
      ok: false,
      error: 'insufficient-coins',
      message: `Need ${(cost - coins).toLocaleString()} more coins`,
    };
  }

  // All checks passed — commit.
  save.coins = coins - cost;
  save.ownedHeroes = [...new Set([...save.ownedHeroes, heroId])];
  return { ok: true, coinsSpent: cost, coinsRemaining: save.coins };
}
