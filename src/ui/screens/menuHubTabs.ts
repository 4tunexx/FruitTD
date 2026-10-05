import { Newspaper, Settings, Map, Users, MessageCircle, Bell, ListChecks, Trophy, Medal, Swords } from 'lucide';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { back, openScreen } from './registry';
import { renderNews } from './news';
import { renderSettings } from './settings';
import { renderCampaign } from './campaign';
import type { HubTab } from './hub';
import type { NavState } from '../../game/navigation';
import type { SaveData } from '../../game/save';
import { renderPvpHub } from './pvp';

function context(root: HTMLElement, eyebrow: string, title: string, body: string, links: Array<{ label: string; open: () => void }>): void {
  const actions = el('div', { class: 'ftd-hub-context__actions' }, links.map(({ label, open }) => GameButton({ label, variant: 'outline', block: true, onClick: open })));
  root.appendChild(el('aside', { class: 'ftd-hub-context' }, [
    el('p', { class: 'ftd-hub-context__eyebrow', text: eyebrow }),
    el('h2', { text: title }),
    el('p', { text: body }),
    actions,
  ]));
}

function route(label: string, id: NavState) { return { label, open: () => openScreen(id) }; }

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
    }, renderSub: (root, save) => context(root, 'YOUR NEXT MOVE', 'Field orders', `${save.campaignProgress.cleared.length} campaign stages cleared.`, [
      { label: 'Claim daily bonus', open: actions.onOpenDaily }, route('Browse campaign', 'CAMPAIGN'), route('Open community', 'SOCIAL'),
    ]) },
    { id: 'SETTINGS', label: 'Settings', icon: Settings, renderMain: (root, save) => {
      const page = el('div', { class: 'ftd-hub-embedded' }); root.appendChild(page);
      renderSettings(page, save, actions);
    }, renderSub: (root, save) => context(root, 'ACCOUNT', save.nickname || 'Slicer', 'Manage your profile and return to the game whenever you are ready.', [
      route('Open profile', 'PROFILE'), route('Return home', 'MAIN_MENU'),
    ]) },
    { id: 'CAMPAIGN', label: 'Campaign', icon: Map, renderMain: (root, save) => {
      const page = el('div');
      root.appendChild(page);
      renderCampaign(page, save, actions.onStartCampaign);
    }, renderSub: (root) => {
      const boss = root.closest('.ftd-hub')?.querySelector('.ftd-hub__main')?.querySelector<HTMLElement>('.ftd-boss-reveal');
      if (boss) root.appendChild(boss);
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
    }, renderSub: (root) => context(root, 'YOUR NETWORK', label, view === 'messages' ? 'Open a conversation with a friend from the list.' : view === 'notifications' ? 'See recent activity and respond from this page.' : 'Find defenders, manage friends, and read the community board.', [
      route('Community', 'SOCIAL'), route('Messages', 'MESSAGES'), route('Notifications', 'NOTIFICATIONS'),
    ]) })),
  ];
  const legacy: Array<{ id: NavState; label: string; page: string; subtab?: string; icon: typeof ListChecks }> = [
    { id: 'MISSIONS', label: 'Missions', page: 'quests', subtab: 'missions', icon: ListChecks },
    { id: 'ACHIEVEMENTS', label: 'Achievements', page: 'quests', subtab: 'achievements', icon: Medal },
  ];
  const pvp: HubTab[] = [
    { id: 'RANKED', label: 'Ranked PvP', icon: Trophy, renderMain: (root) => renderPvpHub(root, 'ranked'), renderSub: (root) => context(root, 'FR POINT LADDER', 'Ranked siege', 'Public 1v1 fruit siege. Wins, ties, and losses update your seasonal FR rating.', [route('Community', 'SOCIAL')]) },
    { id: 'ARENA', label: 'Arena', icon: Swords, renderMain: (root) => renderPvpHub(root, 'arena'), renderSub: (root) => context(root, 'NORMAL OR RANKED', 'Arena siege', 'Build turrets, upgrade defences, and send attacks. Equal stats, equipped appearances, and the same Rally power. Normal keeps your rank; Ranked changes FR.', [route('Community', 'SOCIAL')]) },
  ];
  return [...simple, ...pvp, ...legacy.map(({ id, label, page, subtab, icon }): HubTab => ({
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
    renderSub: (root, save: SaveData) => {
      const show = (view: string) => {
        root.replaceChildren();
        if (view === 'ranks') context(root, 'HISTORY', 'Solo records', 'These are your past solo Ranked scores. Current FR points and PvP results are in Ranked.', [route('Open Arena', 'ARENA'), route('Profile', 'PROFILE')]);
        else if (view === 'badges') context(root, 'CAREER', 'Badges', 'See the marks you have earned from matches and missions.', [route('Achievements', 'ACHIEVEMENTS'), route('Profile', 'PROFILE')]);
        else if (view === 'achievements') context(root, 'CAREER', 'Achievements', `Your ${save.games ?? 0} finished runs count toward combat milestones.`, [route('Missions', 'MISSIONS'), route('Profile', 'PROFILE')]);
        else context(root, 'FIELD ORDERS', 'Missions', 'Complete the objectives shown on the left and claim available rewards.', [route('Achievements', 'ACHIEVEMENTS'), route('Arena', 'ARENA')]);
      };
      const tabs = root.closest('.ftd-hub')?.querySelectorAll<HTMLButtonElement>('.quests-subtabs .subtab');
      show(root.closest('.ftd-hub')?.querySelector<HTMLButtonElement>('.quests-subtabs .subtab.is-active')?.dataset.sub || 'missions');
      tabs?.forEach((button) => button.addEventListener('click', () => show(button.dataset.sub || 'missions')));
    },
  }))];
}
