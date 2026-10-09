export interface RankTier {
  id: string;
  title: string;
  minScore: number;
  color: string;
  icon: string;
  rewardCoins?: number;
  rewardGems?: number;
}

export const DEFAULT_RANK_TIERS: RankTier[] = [
  { id: 'bronze', title: 'Bronze', minScore: 0, color: '#cd7f32', icon: 'Shield', rewardCoins: 100 },
  { id: 'silver', title: 'Silver', minScore: 1500, color: '#c0c0c0', icon: 'Medal', rewardCoins: 250, rewardGems: 5 },
  { id: 'gold', title: 'Gold', minScore: 4000, color: '#f5c542', icon: 'Trophy', rewardCoins: 500, rewardGems: 10 },
  { id: 'platinum', title: 'Platinum', minScore: 8000, color: '#7dd3fc', icon: 'BadgeCheck', rewardCoins: 750, rewardGems: 15 },
  { id: 'diamond', title: 'Diamond', minScore: 15000, color: '#67e8f9', icon: 'Diamond', rewardCoins: 1500, rewardGems: 30 },
  { id: 'master', title: 'Master', minScore: 25000, color: '#c084fc', icon: 'Crown', rewardCoins: 2500, rewardGems: 60 },
  { id: 'grandmaster', title: 'Grandmaster', minScore: 40000, color: '#fb7185', icon: 'Flame', rewardCoins: 5000, rewardGems: 100 },
];

export function currentSeasonLabel(date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function rankFromScore(score: number, tiers: RankTier[] = DEFAULT_RANK_TIERS): RankTier {
  const sorted = [...tiers].sort((a, b) => b.minScore - a.minScore);
  return sorted.find((tier) => score >= tier.minScore) ?? sorted[sorted.length - 1] ?? DEFAULT_RANK_TIERS[0]!;
}

export function rankThreshold(rankId: string, tiers: RankTier[] = DEFAULT_RANK_TIERS): number {
  return tiers.find((tier) => tier.id === rankId)?.minScore ?? 0;
}
