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
  unlocked: boolean;
  claimed: boolean;
}

export interface MissionItem {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  title: string;
  desc: string;
  icon: string;
  goal: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardSp: number;
  rewardBadge?: string;
}

export interface DailyRewardTier {
  day: number;
  coins: number;
  skillPoints: number;
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

export interface SteamProfile {
  steamId: string;
  personaName: string;
  profileUrl: string;
  avatar: string;
  avatarMedium: string;
  avatarFull: string;
  countryCode?: string;
}

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
  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
export async function submitScore(payload: {
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
}): Promise<{
  isNewHigh: boolean;
  rank: number;
  monthlyRank?: { id: string; title: string; minScore: number; color: string; icon: string };
} | null> {
  const userId = getUserId();
  const res = await apiRequest<{
    success: boolean;
    isNewHigh: boolean;
    rank: number;
    monthlyRank?: { id: string; title: string; minScore: number; color: string; icon: string };
  }>('/api/leaderboard', {
    method: 'POST',
    body: JSON.stringify({ userId, ...payload }),
  });
  return res && res.success
    ? { isNewHigh: res.isNewHigh, rank: res.rank, monthlyRank: res.monthlyRank }
    : null;
}

export async function fetchMonthlyRank(): Promise<{
  season: string;
  score: number;
  rank: { id: string; title: string; minScore: number; color: string; icon: string };
  next?: { id: string; title: string; minScore: number; color: string; icon: string } | null;
} | null> {
  const userId = getUserId();
  const res = await apiRequest<{
    success: boolean;
    season: string;
    score: number;
    rank: { id: string; title: string; minScore: number; color: string; icon: string };
    next?: { id: string; title: string; minScore: number; color: string; icon: string } | null;
  }>(`/api/leaderboard/monthly-rank?userId=${encodeURIComponent(userId)}`);
  return res && res.success ? res : null;
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
): Promise<{ rewardCoins: number; rewardSp: number } | null> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean; rewardCoins: number; rewardSp: number }>(
    '/api/achievements/claim',
    {
      method: 'POST',
      body: JSON.stringify({ userId, achievementId }),
    }
  );
  return res && res.success ? { rewardCoins: res.rewardCoins, rewardSp: res.rewardSp } : null;
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
): Promise<boolean> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean }>('/api/missions/progress', {
    method: 'POST',
    body: JSON.stringify({ userId, updates }),
  });
  return !!res?.success;
}

export async function claimMission(missionId: string): Promise<{ rewardCoins: number; rewardSp: number } | null> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean; rewardCoins: number; rewardSp: number }>('/api/missions/claim', {
    method: 'POST',
    body: JSON.stringify({ userId, missionId }),
  });
  return res && res.success ? { rewardCoins: res.rewardCoins, rewardSp: res.rewardSp } : null;
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

export async function claimDailyBonus(): Promise<{ streak: number; reward: DailyRewardTier } | null> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean; streak: number; reward: DailyRewardTier }>('/api/daily/claim', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  return res && res.success ? { streak: res.streak, reward: res.reward } : null;
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
  const userId = getUserId();
  const res = await apiRequest<{
    success: boolean;
    saveData: Record<string, any> | null;
  }>(`/api/profile?userId=${encodeURIComponent(userId)}`);
  return res && res.success ? res.saveData : null;
}

export async function syncCloudSave(saveData: Record<string, any>): Promise<boolean> {
  const userId = getUserId();
  const res = await apiRequest<{ success: boolean }>('/api/profile/sync', {
    method: 'POST',
    body: JSON.stringify({ userId, saveData }),
  });
  return !!res?.success;
}
