import { adoptAuthoritativeSave, getUserId } from './api';
import { getAuthToken } from './auth';
import { showAchievementToast } from './achievements';

export interface BadgeItem {
  id: string;
  title: string;
  desc: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  claimed: boolean;
  rewardCoins: number;
  rewardGems: number;
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}), ...(options?.headers || {}) },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchBadges(): Promise<{ badges: BadgeItem[]; unlocked: number } | null> {
  const userId = getUserId();
  const res = await apiJson<{ success: boolean; badges: BadgeItem[]; unlocked: number }>(
    `/api/badges?userId=${encodeURIComponent(userId)}`
  );
  return res && res.success ? { badges: res.badges, unlocked: res.unlocked } : null;
}

export async function claimBadge(badgeId: string): Promise<{ saveData: Record<string, any>; revision: number } | null> {
  const res = await apiJson<{ success: boolean; saveData: Record<string, any>; revision: number }>('/api/badges/claim', {
    method: 'POST', body: JSON.stringify({ badgeId }),
  });
  if (!res?.success || !res.saveData || !Number.isSafeInteger(res.revision)) return null;
  adoptAuthoritativeSave(res.revision);
  return res;
}

const unlockedBadges = new Set<string>();

export async function reportBadgeProgress(
  updates: Array<{ badgeId: string; progressDelta?: number; setProgress?: number }>
): Promise<void> {
  const userId = getUserId();
  const res = await apiJson<{ success: boolean; newlyUnlocked: string[] }>('/api/badges/progress', {
    method: 'POST',
    body: JSON.stringify({ userId, updates }),
  });
  if (!res?.newlyUnlocked?.length) return;
  const data = await fetchBadges();
  for (const id of res.newlyUnlocked) {
    if (unlockedBadges.has(id)) continue;
    unlockedBadges.add(id);
    const badge = data?.badges.find((b) => b.id === id);
    if (badge) showAchievementToast('Badge Unlocked!', badge.title, badge.icon, badge.rarity);
  }
}
