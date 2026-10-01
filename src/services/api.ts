export interface LeaderboardEntry {
  rank: number;
  userId: string;
  nickname: string;
  avatar: string;
  hero: string;
  mode: string;
  score: number;
  wave: number;
  fruitsSliced: number;
  maxCombo: number;
  steamId?: string;
  steamPersona?: string;
  steamAvatar?: string;
  date: string;
}

export interface AchievementItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  progress: number;
  maxProgress: number;
  rewardCoins: number;
  rewardSp: number;
  rewardGems?: number;
  unlocked: boolean;
  claimed: boolean;
}

export interface MissionItem {
  id: string;
  type: 'main' | 'daily';
  title: string;
  desc: string;
  icon: string;
  goal: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardSp: number;
  rewardGems?: number;
  rewardBadge?: string;
}

export interface DailyRewardTier {
  day: number;
  coins: number;
  skillPoints: number;
  gems?: number; // P1-2
  skinUnlock?: string;
  label: string;
  iconType?: 'coin' | 'gem' | 'chest' | 'blade';
}

export interface DailyStatus {
  streak: number;
  canClaim: boolean;
  lastClaimDate: string | null;
  rewards: DailyRewardTier[];
}

export interface ClaimWalletSnapshot {
  revision: number;
  saveData: Record<string, any>;
}

function acceptClaimWallet<T extends ClaimWalletSnapshot>(response: T | null): T | null {
  if (response?.saveData && Number.isSafeInteger(response.revision) && response.revision >= 0) {
    cloudRevision = response.revision;
    cloudRevisionAuthToken = getAuthToken();
  }
  return response;
}

export interface SteamProfile {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatar: string;
  avatarMedium: string;
  avatarFull: string;
  countryCode?: string;
}

import { getAuthToken } from './auth';

const USER_ID_KEY = 'fruit_td_user_id';

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = 'user_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

// Generic fetcher with fallback tolerance
async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T | null> {
  if (/^\/api\/(profile|missions|achievements|daily|badges)(?:[/?]|$)/.test(endpoint) && !getAuthToken()) return null;
  try {
    const res = await fetch(endpoint, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        ...(options?.headers || {}),
      },
    });
    if (!res.ok) {
      console.warn(`[API] ${endpoint} returned status ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[API] Request error on ${endpoint}:`, err);
    return null;
  }
}

// ----------------- LEADERBOARD -----------------
let activeRunToken: Promise<string | null> | null = null;
let runSettlementInFlight: Promise<unknown> | null = null;

export function startLeaderboardRun(mode: string): void {
  activeRunToken = apiRequest<{ success: boolean; runToken: string }>('/api/leaderboard/run', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  }).then((res) => res?.success ? res.runToken : null);
}

export async function submitScore(payload: {
  nickname: string;
  avatar: string;
  hero: string;
  mode: string;
  score: number;
  wave: number;
  fruitsSliced: number;
  maxCombo: number;
  rewards?: { coins: number; gems: number; heroXp: number; towerXp: number; skillPoints: number };
  completed?: boolean;
  steamId?: string;
  steamPersona?: string;
  steamAvatar?: string;
}): Promise<{
  isNewHigh: boolean;
  rank: number;
  monthlyRank?: { id: string; title: string; minScore: number; color: string; icon: string };
  wallet?: { saveData: Record<string, any>; revision: number };
} | null> {
  const tokenPromise = activeRunToken;
  activeRunToken = null;
  const runToken = tokenPromise ? await tokenPromise : null;
  if (!runToken) return null;
  if (syncInFlight) await syncInFlight;
  const request = apiRequest<{
    success: boolean;
    isNewHigh: boolean;
    rank: number;
    monthlyRank?: { id: string; title: string; minScore: number; color: string; icon: string };
    wallet?: { saveData: Record<string, any>; revision: number };
  }>('/api/leaderboard', {
    method: 'POST',
    body: JSON.stringify({ ...payload, runToken }),
  });
  runSettlementInFlight = request;
  const res = await request;
  if (runSettlementInFlight === request) runSettlementInFlight = null;
  return res && res.success
    ? { isNewHigh: res.isNewHigh, rank: res.rank, monthlyRank: res.monthlyRank, wallet: res.wallet }
    : null;
}

export function adoptAuthoritativeSave(revision: number): void {
  if (Number.isSafeInteger(revision) && revision >= 0) {
    cloudRevision = revision;
    cloudRevisionAuthToken = getAuthToken();
  }
}

export async function fetchMonthlyRank(): Promise<{
  season: string;
  score: number;
  rank: { id: string; title: string; minScore: number; color: string; icon: string; rewardCoins?: number; rewardGems?: number };
  next?: { id: string; title: string; minScore: number; color: string; icon: string } | null;
  claimed: boolean;
  hasEntry: boolean;
  claimedRankIds: string[];
} | null> {
  const userId = getUserId();
  const res = await apiRequest<{
    success: boolean;
    season: string;
    score: number;
    rank: { id: string; title: string; minScore: number; color: string; icon: string; rewardCoins?: number; rewardGems?: number };
    next?: { id: string; title: string; minScore: number; color: string; icon: string } | null;
    claimed: boolean;
    hasEntry: boolean;
    claimedRankIds: string[];
  }>(`/api/leaderboard/monthly-rank?userId=${encodeURIComponent(userId)}`);
  return res && res.success ? res : null;
}

export async function claimMonthlyRank(rankId?: string): Promise<{ saveData: Record<string, any>; revision: number } | null> {
  const res = await apiRequest<{ success: boolean; saveData: Record<string, any>; revision: number }>('/api/leaderboard/monthly-rank/claim', {
    method: 'POST', body: JSON.stringify(rankId ? { rankId } : {}),
  });
  return res?.success && res.saveData && Number.isSafeInteger(res.revision) ? acceptClaimWallet(res) : null;
}

export async function fetchLeaderboard(mode = 'ranked', limit = 50): Promise<{
  leaderboard: LeaderboardEntry[];
  userRank: { rank: number; score: number; wave: number } | null;
} | null> {
  const userId = getUserId();
  const res = await apiRequest<{
    success: boolean;
    leaderboard: LeaderboardEntry[];
    userRank: { rank: number; score: number; wave: number } | null;
  }>(`/api/leaderboard?mode=${encodeURIComponent(mode)}&limit=${limit}&userId=${encodeURIComponent(userId)}`);
  return res && res.success ? { leaderboard: res.leaderboard, userRank: res.userRank } : null;
}

// ----------------- ACHIEVEMENTS -----------------
export async function fetchAchievements(): Promise<{
  achievements: AchievementItem[];
  stats: { total: number; unlocked: number; claimable: number };
} | null> {
  const userId = getUserId();
  const res = await apiRequest<{
    success: boolean;
    achievements: AchievementItem[];
    stats: { total: number; unlocked: number; claimable: number };
  }>(`/api/achievements?userId=${encodeURIComponent(userId)}`);
  return res && res.success ? { achievements: res.achievements, stats: res.stats } : null;
}

export async function updateAchievementProgress(
  updates: Array<{ achievementId: string; progressDelta?: number; setProgress?: number }>
): Promise<string[]> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean; newlyUnlocked: string[] }>('/api/achievements/progress', {
    method: 'POST',
    body: JSON.stringify({ userId, updates }),
  });
  return res?.newlyUnlocked || [];
}

export async function claimAchievement(
  achievementId: string
): Promise<{ rewardCoins: number; rewardSp: number; rewardGems: number; saveData: Record<string, any>; revision: number } | null> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean; rewardCoins: number; rewardSp: number; rewardGems: number; saveData: Record<string, any>; revision: number }>(
    '/api/achievements/claim',
    {
      method: 'POST',
      body: JSON.stringify({ userId, achievementId }),
    }
  );
  return res && res.success ? acceptClaimWallet({ rewardCoins: res.rewardCoins, rewardSp: res.rewardSp, rewardGems: res.rewardGems ?? 0, saveData: res.saveData, revision: res.revision }) : null;
}

// ----------------- MISSIONS -----------------
export async function fetchMissions(): Promise<{
  missions: MissionItem[];
  totalClaimable: number;
} | null> {
  const userId = getUserId();
  const res = await apiRequest<{
    success: boolean;
    missions: MissionItem[];
    totalClaimable: number;
  }>(`/api/missions?userId=${encodeURIComponent(userId)}`);
  return res && res.success ? { missions: res.missions, totalClaimable: res.totalClaimable } : null;
}

export async function updateMissionProgress(
  updates: Array<{ missionId: string; progressDelta?: number; setProgress?: number }>
): Promise<string[]> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean; newlyCompleted?: string[] }>('/api/missions/progress', {
    method: 'POST',
    body: JSON.stringify({ userId, updates }),
  });
  return res?.success ? (res.newlyCompleted ?? []) : [];
}

export async function claimMission(missionId: string): Promise<{ rewardCoins: number; rewardSp: number; rewardGems: number; saveData: Record<string, any>; revision: number } | null> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean; rewardCoins: number; rewardSp: number; rewardGems: number; saveData: Record<string, any>; revision: number }>('/api/missions/claim', {
    method: 'POST',
    body: JSON.stringify({ userId, missionId }),
  });
  return res && res.success ? acceptClaimWallet({ rewardCoins: res.rewardCoins, rewardSp: res.rewardSp, rewardGems: res.rewardGems ?? 0, saveData: res.saveData, revision: res.revision }) : null;
}

// ----------------- DAILY BONUS -----------------
export async function fetchDailyBonusStatus(): Promise<DailyStatus | null> {
  const userId = getUserId();
  const res = await apiRequest<{
    success: boolean;
    streak: number;
    canClaim: boolean;
    lastClaimDate: string | null;
    rewards: DailyRewardTier[];
  }>(`/api/daily?userId=${encodeURIComponent(userId)}`);
  return res && res.success
    ? {
        streak: res.streak,
        canClaim: res.canClaim,
        lastClaimDate: res.lastClaimDate,
        rewards: res.rewards,
      }
    : null;
}

export async function claimDailyBonus(): Promise<{ streak: number; reward: DailyRewardTier; saveData: Record<string, any>; revision: number } | null> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean; streak: number; reward: DailyRewardTier; saveData: Record<string, any>; revision: number }>('/api/daily/claim', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  return res && res.success ? acceptClaimWallet({ streak: res.streak, reward: res.reward, saveData: res.saveData, revision: res.revision }) : null;
}

// ----------------- STEAM -----------------
export async function linkSteam(steamQuery: string): Promise<{
  profile: SteamProfile;
  bonusReward: { coins: number; sp: number };
} | null> {
  const userId = getUserId();
  const res = await apiRequest<{
    success: boolean;
    profile: SteamProfile;
    bonusReward: { coins: number; sp: number };
  }>('/api/steam/link', {
    method: 'POST',
    body: JSON.stringify({ userId, steamQuery }),
  });
  return res && res.success ? { profile: res.profile, bonusReward: res.bonusReward } : null;
}

export async function getSteamStatus(): Promise<{
  linked: boolean;
  steamId?: string;
  personaName?: string;
  avatar?: string;
} | null> {
  const token = localStorage.getItem('fruit_td_token');
  const res = await apiRequest<{
    success: boolean;
    linked: boolean;
    steamId?: string;
    personaName?: string;
    avatar?: string;
  }>('/api/steam/status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res && res.success ? res : null;
}

// ----------------- CLOUD SAVE -----------------
export async function fetchCloudSave(): Promise<Record<string, any> | null> {
  const res = await apiRequest<{
    success: boolean;
    saveData: Record<string, any> | null;
    revision: number;
  }>('/api/profile');
  if (res?.success && Number.isSafeInteger(res.revision) && res.revision >= 0) {
    cloudRevision = res.revision;
    cloudRevisionAuthToken = getAuthToken();
  }
  return res && res.success ? res.saveData : null;
}

let pendingSave: { userId: string; saveData: Record<string, any> } | null = null;
let syncInFlight: Promise<boolean> | null = null;
let cloudRevision: number | null = null;
let cloudRevisionAuthToken: string | null = null;

export function syncCloudSave(saveData: Record<string, any>): Promise<boolean> {
  const authToken = getAuthToken();
  if (!authToken) return Promise.resolve(false);
  if (cloudRevisionAuthToken !== authToken) cloudRevision = null;
  // Only profile-owned fields travel through generic sync. Balances,
  // progression, inventory and loadout are written by their dedicated server
  // actions; including local copies here would make the whole save conflict.
  pendingSave = {
    userId: getUserId(),
    saveData: {
      nickname: String(saveData.nickname || '').slice(0, 64),
      avatar: typeof saveData.avatar === 'string' ? saveData.avatar.slice(0, 900_000) : '',
      mode: ['casual', 'ranked', 'coop', 'arena', 'horde', 'campaign'].includes(saveData.mode) ? saveData.mode : 'casual',
      campaignProgress: saveData.campaignProgress,
    },
  };
  if (!syncInFlight) {
    syncInFlight = (async () => {
      let success = true;
      while (pendingSave) {
        if (runSettlementInFlight) await runSettlementInFlight;
        const snapshot = pendingSave;
        pendingSave = null;
        if (snapshot.userId !== getUserId() || !getAuthToken()) continue;
        if (cloudRevision === null) await fetchCloudSave();
        if (cloudRevision === null) {
          success = false;
          continue;
        }
        const res = await apiRequest<{ success: boolean; revision: number }>('/api/profile/sync', {
          method: 'POST',
          body: JSON.stringify({ ...snapshot, revision: cloudRevision }),
        });
        if (res?.success && Number.isSafeInteger(res.revision)) cloudRevision = res.revision;
        success = Boolean(res?.success) && success;
      }
      return success;
    })().finally(() => { syncInFlight = null; });
  }
  return syncInFlight;
}

export type CatalogueAction = 'buy' | 'equip' | 'unequip' | 'sell' | 'buy-vip' | 'buy-skill';

/** Server-authoritative shop/loadout mutation. The returned wallet replaces local state. */
export async function performCatalogueAction(
  action: CatalogueAction,
  id: string,
): Promise<{ saveData: Record<string, any>; revision: number } | null> {
  if (!getAuthToken()) return null;
  // Serialize wallet actions behind any in-flight profile sync so a just-saved
  // profile cannot race the catalogue action's revision compare-and-swap.
  if (syncInFlight) await syncInFlight;
  if (runSettlementInFlight) await runSettlementInFlight;
  const response = await apiRequest<{
    success: boolean;
    saveData: Record<string, any>;
    revision: number;
  }>('/api/items/action', {
    method: 'POST',
    body: JSON.stringify({ action, id }),
  });
  if (!response?.success || !response.saveData || !Number.isSafeInteger(response.revision)) return null;
  cloudRevision = response.revision;
  cloudRevisionAuthToken = getAuthToken();
  return { saveData: response.saveData, revision: response.revision };
}

export async function performWalletAction(action: 'buy-vip' | 'buy-skill', id: string): Promise<{ saveData: Record<string, any>; revision: number } | null> {
  return performCatalogueAction(action, id);
}
