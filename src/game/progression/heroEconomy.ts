/**
 * Central, configurable hero economy.
 *
 * §1/§4 require hero purchase costs to come from ONE configurable value each.
 * `heroes.ts` reads its `purchaseCost` from this table, so changing a price
 * here changes it everywhere (shop, hero screen, purchase validation, tests).
 */
import type { HeroId } from '../heroes';

export interface HeroPriceConfig {
  /** Coin cost for purchase-only heroes. */
  cost: number;
}

export const HERO_PRICES: Partial<Record<HeroId, HeroPriceConfig>> = {
  tripos: { cost: 1800 },
  ki: { cost: 3000 },
};

export function heroPrice(id: HeroId): number | null {
  return HERO_PRICES[id]?.cost ?? null;
}

/** Admin/live-config hook: override a hero price at runtime. */
export function setHeroPrice(id: HeroId, cost: number): void {
  const safe = Math.max(0, Math.floor(Number(cost) || 0));
  if (HERO_PRICES[id]) HERO_PRICES[id]!.cost = safe;
  else HERO_PRICES[id] = { cost: safe };
}
