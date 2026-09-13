import { getUserId } from './api';
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
}

async function apiJson<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
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
