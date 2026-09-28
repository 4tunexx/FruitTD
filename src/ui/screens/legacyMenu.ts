import type { NavState } from '../../game/navigation';

export const LEGACY_MENU_PAGES: Array<{ id: NavState; page: string; subtab?: string }> = [
  { id: 'MISSIONS', page: 'quests', subtab: 'missions' },
  { id: 'ACHIEVEMENTS', page: 'quests', subtab: 'achievements' },
  { id: 'RANKED', page: 'leaderboard' },
];

/** Shows a legacy page inside the shared lobby host and selects its subtab. */
export function showLegacyMenuPage(
  state: NavState,
  root: HTMLElement | null,
  showPage: (page: string) => void,
): void {
  const selected = LEGACY_MENU_PAGES.find((entry) => entry.id === state);
  root?.classList.toggle('hidden', !selected);
  if (!selected) return;

  showPage(selected.page);
  if (selected.subtab) {
    root?.querySelector<HTMLButtonElement>(`.quests-subtabs .subtab[data-sub="${selected.subtab}"]`)?.click();
  }
}
