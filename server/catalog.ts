import {
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_BADGES,
  DEFAULT_MISSIONS,
  DEFAULT_RANK_TIERS,
  currentMonthKey,
  type CatalogAchievement,
  type CatalogBadge,
  type CatalogMission,
  type RankTier,
} from '../src/game/requirements';
import { DEFAULT_SLICERS, type CatalogSlicer } from '../src/game/slicers';
import { getCollection } from './db';

export interface StoredAdminConfig {
  configKey: string;
  missions?: CatalogMission[];
  achievements?: CatalogAchievement[];
  badges?: CatalogBadge[];
  ranks?: RankTier[];
  slicers?: CatalogSlicer[];
}

let cache: {
  at: number;
  missions: CatalogMission[];
  achievements: CatalogAchievement[];
  badges: CatalogBadge[];
  ranks: RankTier[];
  slicers: CatalogSlicer[];
} | null = null;

export function invalidateCatalogCache(): void {
  cache = null;
}

export async function loadQuestCatalog(): Promise<{
  missions: CatalogMission[];
  achievements: CatalogAchievement[];
  badges: CatalogBadge[];
  ranks: RankTier[];
  slicers: CatalogSlicer[];
}> {
  if (cache && Date.now() - cache.at < 4000) return cache;
  try {
    const col = await getCollection<StoredAdminConfig>('admin_config');
    const doc = await col.findOne({ configKey: 'game_config' });
    cache = {
      at: Date.now(),
      missions: Array.isArray(doc?.missions) && doc!.missions!.length ? doc!.missions! : DEFAULT_MISSIONS,
      achievements: Array.isArray(doc?.achievements) && doc!.achievements!.length ? doc!.achievements! : DEFAULT_ACHIEVEMENTS,
      badges: Array.isArray(doc?.badges) && doc!.badges!.length ? doc!.badges! : DEFAULT_BADGES,
      ranks: Array.isArray(doc?.ranks) && doc!.ranks!.length ? doc!.ranks! : DEFAULT_RANK_TIERS,
      slicers: Array.isArray(doc?.slicers) && doc!.slicers!.length ? doc!.slicers! : DEFAULT_SLICERS,
    };
    return cache;
  } catch {
    return {
      missions: DEFAULT_MISSIONS,
      achievements: DEFAULT_ACHIEVEMENTS,
      badges: DEFAULT_BADGES,
      ranks: DEFAULT_RANK_TIERS,
      slicers: DEFAULT_SLICERS,
    };
  }
}

export function getMonthKey(): string {
  return currentMonthKey();
}
