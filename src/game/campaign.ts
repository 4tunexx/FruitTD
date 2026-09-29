/** Campaign structure and deterministic fallback boss roster (10 × 10 unique names). */
export interface CampaignBoss {
  name: string;
  title: string;
  description: string;
  difficulty: number;
  rewardCoins: number;
  rewardGems: number;
  revealImage?: string;
}

const EPITHETS = ['Rot King','Juice Crusher','Rind Titan','Blight Warden','Pulp Reaver','Orchard Tyrant','Core Breaker','Grove Stalker','Crown Eater','Omega Rot'];
const FRUITS = ['Citrus','Melon','Pineapple','Berry','Banana','Kiwi','Apple','Dragonfruit','Papaya','Blood Orange'];

export function campaignWaves(level: number): number {
  const n = Math.max(1, Math.min(100, Math.floor(level)));
  return n < 10 ? 5 : Math.floor(n / 10) * 10;
}

export function defaultCampaignBoss(level: number): CampaignBoss {
  const n = Math.max(1, Math.min(100, Math.floor(level)));
  const index = n - 1;
  const tier = Math.floor(index / 10);
  return {
    name: `${FRUITS[index % 10]} ${EPITHETS[tier]}`,
    title: `Campaign Overlord · Stage ${n}`,
    description: `A tier ${tier + 1} orchard tyrant. Expect ${campaignWaves(n)} waves of escalating enemies before the final breach.`,
    difficulty: 1 + (n - 1) * 0.075,
    rewardCoins: 80 + n * 24,
    rewardGems: Math.min(Math.floor((campaignWaves(n) + 1) / 5), 1 + Math.floor(n / 10)),
  };
}

export function campaignBoss(level: number, overrides?: Partial<CampaignBoss>[]): CampaignBoss {
  const base = defaultCampaignBoss(level);
  const custom = overrides?.[Math.max(1, Math.min(100, Math.floor(level))) - 1];
  return { ...base, ...(custom ?? {}) };
}

export interface CampaignProgress { unlocked: number; cleared: number[] }
export const DEFAULT_CAMPAIGN_PROGRESS: CampaignProgress = { unlocked: 1, cleared: [] };

export function sanitizeCampaignProgress(value: unknown): CampaignProgress {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CAMPAIGN_PROGRESS, cleared: [] };
  const candidate = value as Partial<CampaignProgress>;
  const cleared = Array.isArray(candidate.cleared)
    ? [...new Set(candidate.cleared.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= 100))].sort((a,b) => a-b)
    : [];
  const unlocked = Number.isInteger(candidate.unlocked) ? Math.max(1, Math.min(100, candidate.unlocked!)) : 1;
  return { unlocked: Math.max(unlocked, Math.min(100, Math.max(0, ...cleared) + 1)), cleared };
}
