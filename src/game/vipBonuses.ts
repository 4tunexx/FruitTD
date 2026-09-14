import { loadSave } from './save';
import { getLiveConfig } from '../services/liveConfig';
import type { VipTierRewards } from '../services/admin';

const FALLBACK_VIP_COSTS: Record<'bronze' | 'silver' | 'gold', number> = {
  bronze: 100,
  silver: 250,
  gold: 500,
};

const FALLBACK_VIP_COIN_GRANTS: Record<'bronze' | 'silver' | 'gold', number> = {
  bronze: 1000,
  silver: 2500,
  gold: 5000,
};

export function getOwnedVipTier(): VipTierRewards | null {
  const status = loadSave().vipStatus || 'none';
  if (status === 'none') return null;
  const tiers = getLiveConfig().vipTiers || [];
  return tiers.find((t) => t.tier === status) ?? null;
}

/** coinBonus on VipTierRewards is a percent (e.g. 10 = +10% coins). */
export function vipCoinMultiplier(): number {
  const tier = getOwnedVipTier();
  if (!tier) return 1;
  const pct = Number(tier.coinBonus);
  return 1 + (Number.isFinite(pct) ? Math.max(0, pct) : 0) / 100;
}

/** xpBonus on VipTierRewards is a percent (e.g. 5 = +5% XP). */
export function vipXpMultiplier(): number {
  const tier = getOwnedVipTier();
  if (!tier) return 1;
  const pct = Number(tier.xpBonus);
  return 1 + (Number.isFinite(pct) ? Math.max(0, pct) : 0) / 100;
}

export function vipTierPrice(tier: 'bronze' | 'silver' | 'gold'): number {
  const found = (getLiveConfig().vipTiers || []).find((t) => t.tier === tier);
  const price = Number(found?.price);
  if (Number.isFinite(price) && price > 0) return Math.floor(price);
  return FALLBACK_VIP_COSTS[tier];
}

/** Flat coin grant on purchase — not in VipTierRewards schema, keep hardcoded fallback. */
export function vipTierPurchaseCoins(tier: 'bronze' | 'silver' | 'gold'): number {
  return FALLBACK_VIP_COIN_GRANTS[tier];
}
