import { Newspaper, Settings, Map, Users, MessageCircle, Bell, ListChecks, Trophy, Medal } from 'lucide';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { back } from './registry';
import { renderNews } from './news';
import { renderSettings } from './settings';
import { renderCampaign } from './campaign';
import type { HubTab } from './hub';
import type { NavState } from '../../game/navigation';

export interface MenuHubActions {
  onOpenDaily: () => void;
  onToggleSound: () => void;
  onLogout: () => void;
  onStartCampaign: (stage: number) => void;
  showLobbyPage: (page: string) => void;
}

export function menuHubTabs(actions: MenuHubActions): HubTab[] {
  const simple: HubTab[] = [
    { id: 'NEWS', label: 'News', icon: Newspaper, renderMain: (root, save) => {
      const page = el('div', { class: 'ftd-hub-embedded' }); root.appendChild(page);
      renderNews(page, save, actions.onOpenDaily);
    } },
    { id: 'SETTINGS', label: 'Settings', icon: Settings, renderMain: (root, save) => {
      const page = el('div', { class: 'ftd-hub-embedded' }); root.appendChild(page);
      renderSettings(page, save, actions);
    } },
    { id: 'CAMPAIGN', label: 'Campaign', icon: Map, renderMain: (root, save) => {
      const page = el('div');
      root.appendChild(page);
      renderCampaign(page, save, actions.onStartCampaign);
    } },
    ...([
      { id: 'SOCIAL', label: 'Community', icon: Users, view: 'community' },
      { id: 'MESSAGES', label: 'Messages', icon: MessageCircle, view: 'messages' },
      { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell, view: 'notifications' },
    ] as const).map(({ id, label, icon, view }): HubTab => ({ id, label, icon, renderMain: (root) => {
      const page = el('div');
      root.appendChild(page);
      void import('./social').then(({ renderSocial }) => {
        if (page.isConnected) renderSocial(page, view);
      }).catch(() => {
        if (!page.isConnected) return;
        page.replaceChildren(el('p', { role: 'alert', text: `${label} could not load. Open it again to retry.` }));
      });
    } })),
  ];
  const legacy: Array<{ id: NavState; label: string; page: string; subtab?: string; icon: typeof ListChecks }> = [
    { id: 'MISSIONS', label: 'Missions', page: 'quests', subtab: 'missions', icon: ListChecks },
    { id: 'ACHIEVEMENTS', label: 'Achievements', page: 'quests', subtab: 'achievements', icon: Medal },
    { id: 'RANKED', label: 'Ranked', page: 'leaderboard', icon: Trophy },
  ];
  return [...simple, ...legacy.map(({ id, label, page, subtab, icon }): HubTab => ({
    id, label, icon,
    renderMain: (root) => {
      const header = el('header', { class: 'ftd-hub-legacy__header' }, [
        GameButton({ label: 'Back', variant: 'ghost', onClick: back }),
        el('h1', { text: label }),
      ]);
      root.appendChild(header);
      actions.showLobbyPage(page);
      const content = document.getElementById(`page-${page}`);
      if (!content) return;
      content.setAttribute('data-hub-legacy', 'true');
      root.appendChild(content);
      if (subtab) content.querySelector<HTMLButtonElement>(`.quests-subtabs .subtab[data-sub="${subtab}"]`)?.click();
    },
  }))];
}
