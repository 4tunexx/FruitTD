import {
  fetchAchievements,
  updateAchievementProgress,
} from './api';

export function showAchievementToast(title: string, desc: string, icon = '🏆', reward?: string): void {
  let container = document.getElementById('achievement-toasts');
  if (!container) {
    container = document.createElement('div');
    container.id = 'achievement-toasts';
    container.className = 'fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className =
    'pointer-events-auto flex items-center gap-4 px-5 py-4 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-amber-400/50 shadow-[0_0_25px_rgba(251,191,36,0.3)] text-white transform translate-x-full opacity-0 transition-all duration-500 ease-out min-w-[300px] max-w-[400px]';

  toast.innerHTML = `
    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(245,158,11,0.5)] shrink-0 animate-bounce">
      ${icon}
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-[10px] uppercase font-black tracking-widest text-amber-300 flex items-center gap-1.5">
        <span>🏆</span> ACHIEVEMENT UNLOCKED!
      </div>
      <div class="font-bold text-sm text-white truncate">${title}</div>
      <div class="text-xs text-slate-300 truncate">${desc}</div>
      ${reward ? `<div class="mt-1 text-[11px] font-semibold text-emerald-400">+${reward}</div>` : ''}
    </div>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-x-full', 'opacity-0');
    toast.classList.add('translate-x-0', 'opacity-100');
  });

  // Auto dismiss
  setTimeout(() => {
    toast.classList.add('translate-x-full', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 500);
  }, 4500);
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
