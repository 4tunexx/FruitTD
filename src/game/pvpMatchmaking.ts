import { DEFAULT_PVP_CONFIG, pvpTier, type PvpConfig, type PvpQueue } from './pvp';
export interface MatchmakingPlayer { userId: string; queue: PvpQueue; points: number; createdAt: number }
export function pvpSearchRange(player: MatchmakingPlayer, now: number): number {
  const waited = Math.max(0, now - player.createdAt);
  return Math.min(player.queue === 'ranked' ? 300 : 500, 100 + Math.floor(waited / 15_000) * 50);
}
export function pvpCanMatch(a: MatchmakingPlayer, b: MatchmakingPlayer, now: number, config: PvpConfig = DEFAULT_PVP_CONFIG): boolean {
  if (a.userId === b.userId || a.queue !== b.queue || !Number.isFinite(a.points) || !Number.isFinite(b.points)) return false;
  if (Math.abs(a.points - b.points) > Math.min(pvpSearchRange(a, now), pvpSearchRange(b, now))) return false;
  const tiers = [...config.rating.tiers].sort((x, y) => x.min - y.min);
  const tier = (points: number) => tiers.findIndex(item => item.name === pvpTier(points, config));
  const gap = Math.abs(tier(a.points) - tier(b.points));
  // Waiting never opens the entire ladder. Adjacent tiers need both players to wait.
  return gap === 0 || gap === 1 && Math.min(now - a.createdAt, now - b.createdAt) >= 30_000;
}
