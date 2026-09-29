import {
  fetchAchievements,
  updateAchievementProgress,
} from './api';
import { GameToast } from '../ui/components/surface';

export function showAchievementToast(title: string, desc: string, icon = '🏆', reward?: string): void {
  GameToast(desc, 'accent', 4500, {
    title: `ACHIEVEMENT · ${title}`,
    icon,
    meta: reward ? `+${reward}` : undefined,
  });
}

// Local cache of unlocked achievements to avoid duplicate toasts
const unlockedSet = new Set<string>();

export async function initAchievementsCache(): Promise<void> {
  const res = await fetchAchievements();
  if (res?.achievements) {
    for (const a of res.achievements) {
      if (a.unlocked) {
        unlockedSet.add(a.id);
      }
    }
  }
}

export async function applyAchievementUpdates(
  updates: Array<{ achievementId: string; progressDelta?: number; setProgress?: number }>
): Promise<void> {
  await reportAchievementProgress(updates);
}

export async function reportAchievementProgress(
  updates: Array<{ achievementId: string; progressDelta?: number; setProgress?: number }>
): Promise<void> {
  const newUnlocks = await updateAchievementProgress(updates);
  if (newUnlocks && newUnlocks.length > 0) {
    const data = await fetchAchievements();
    for (const id of newUnlocks) {
      if (!unlockedSet.has(id)) {
        unlockedSet.add(id);
        const ach = data?.achievements.find((a) => a.id === id);
        if (ach) {
          const rewardText = `${ach.rewardCoins} Coins${ach.rewardSp ? ` + ${ach.rewardSp} SP` : ''}`;
          showAchievementToast(ach.title, ach.desc, ach.icon, rewardText);
        }
      }
    }
  }
}
