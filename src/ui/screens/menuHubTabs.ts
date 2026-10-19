import { heroArt } from '../heroArt';
import { heroDef } from '../../game/heroes';
import { MODE_ICONS } from '../modeIcons';
import { renderPvpHub } from './pvp';
import { showScreenLoadFailure } from './loadFailure';
import { Newspaper, Settings, Map, Users, MessageCircle, Bell, ListChecks, Trophy, Medal, Swords } from 'lucide';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { back, openScreen } from './registry';
import type { HubTab } from './hub';
import type { NavState } from '../../game/navigation';
import type { SaveData } from '../../game/save';
import { LoadingIndicator } from '../components/loading';
import { lucideIcon } from '../lucideIcon';

function context(root: HTMLElement, eyebrow: string, title: string, body: string, links: Array<{ label: string; open: () => void }>, variant = ''): void {
  const actions = el('div', { class: 'ftd-hub-context__actions' }, links.map(({ label, open }) => GameButton({ label, variant: 'outline', block: true, onClick: open })));
  const emblem = /arena|ranked/i.test(title) ? 'Swords' : /leader|rank/i.test(title) ? 'Trophy' : /account|profile/i.test(title) ? 'Shield' : /orders|campaign/i.test(title) ? 'Map' : 'Target';
  root.appendChild(el('aside', { class: `ftd-hub-context ftd-hub-context--entering${variant ? ` ftd-hub-context--${variant}` : ''}` }, [
    el('span', { class: 'ftd-hub-context__emblem', 'aria-hidden': 'true' }, [lucideIcon(emblem, '', 28)]),
    el('p', { class: 'ftd-hub-context__eyebrow', text: eyebrow }),
    el('h2', { text: title }),
    el('p', { text: body }),
    actions,
  ]));
}

function siegeContext(root: HTMLElement, save: SaveData, ranked: boolean): void {
  root.appendChild(el('section', { class: 'ftd-siege-loadout' }, [
    el('p', { class: 'ftd-hub-context__eyebrow', text: ranked ? 'RANKED ARENA / YOUR DEFENDER' : 'ARENA / YOUR DEFENDER' }),
    heroArt(save.hero),
    el('h2', { text: heroDef(save.hero).name }),
    el('p', { text: ranked ? 'Seasonal FR on the line. Equal starting walls and income.' : 'A full siege without risking your seasonal FR.' }),
    el('dl', {}, [el('dt', { text: 'BUILD PADS' }), el('dd', { text: '10 per player' }), el('dt', { text: 'MATCH LENGTH' }), el('dd', { text: '3 minutes' }), el('dt', { text: 'VICTORY' }), el('dd', { text: 'Break the rival wall' })]),
    GameButton({ label: 'Change defender', icon: MODE_ICONS.casual, variant: 'outline', block: true, onClick: () => openScreen('HEROES') }),
    GameButton({ label: 'Season standings', icon: 'Trophy', variant: 'outline', block: true, onClick: () => openScreen('LEADERBOARD') }),
    GameButton({ label: 'Invite friends', icon: 'Users', variant: 'outline', block: true, onClick: () => openScreen('SOCIAL') }),
  ]));
}

function route(label: string, id: NavState) { return { label, open: () => openScreen(id) }; }

function renderLazyPage<T extends object>(
  root: HTMLElement,
  label: string,
  load: () => Promise<T>,
  render: (page: HTMLElement, module: T) => void,
  className = '',
): void {
  const page = el('div', className ? { class: className } : {});
  root.appendChild(page);
  page.appendChild(LoadingIndicator(`Loading ${label}…`));
  void load().then((module) => {
    if (page.parentElement) render(page, module);
  }).catch((error) => {
    console.error(`${label} screen failed`,error);
    if (page.parentElement) showScreenLoadFailure(page,label,error,()=>{page.remove();renderLazyPage(root,label,load,render,className);});
  });
}

function renderPvpTab(root: HTMLElement, queue: 'arena' | 'ranked'): void {
  const page = el('div');
  root.appendChild(page);
  // Arena's lobby is core UI. Bundle it with the hub so an open page cannot
  // request a retired Arena chunk after a production deployment.
  const start=()=>{
    try { renderPvpHub(page,queue); }
    catch(error){console.error('Arena screen failed',error);showScreenLoadFailure(page,'Arena',error,start);}
  };
  start();
}

export interface MenuHubActions {
  onOpenDaily: () => void;
  onToggleSound: () => void;
  onLogout: () => void;
  onStartCampaign: (stage: number) => void;
  showLobbyPage: (page: string) => void;
}

export function menuHubTabs(actions: MenuHubActions): HubTab[] {
  const simple: HubTab[] = [
    { id: 'LEADERBOARD', label: 'Leaderboard', icon: Trophy, renderMain: (root) => renderLazyPage(root, 'leaderboards', () => import('./leaderboards'), (page, module) => module.renderLeaderboards(page)), renderSub: root => context(root, 'GLOBAL STANDINGS', 'Chase the top', 'Compare your ranked rating, best runs, and collected rewards. Switch to Friends to see your squad.', [route('Your statistics', 'PROFILE'), route('Play Ranked', 'RANKED')], 'leaderboard') },
    { id: 'NEWS', label: 'News', icon: Newspaper, renderMain: (root, save) => {
      renderLazyPage(root, 'news', () => import('./news'), (page, module) => module.renderNews(page, save, actions.onOpenDaily), 'ftd-hub-embedded');
    }, renderSub: (root, save) => context(root, 'YOUR NEXT MOVE', 'Field orders', `${save.campaignProgress.cleared.length} campaign stages cleared.`, [
      { label: 'Claim daily bonus', open: actions.onOpenDaily }, route('Browse campaign', 'CAMPAIGN'), route('Open community', 'SOCIAL'),
    ]) },
    { id: 'SETTINGS', label: 'Settings', icon: Settings, renderMain: (root, save) => {
      renderLazyPage(root, 'settings', () => import('./settings'), (page, module) => module.renderSettings(page, save, actions), 'ftd-hub-embedded');
    }, renderSub: (root, save) => context(root, 'ACCOUNT', save.nickname || 'Slicer', 'Manage your profile and return to the game whenever you are ready.', [
      route('Open profile', 'PROFILE'), route('Return home', 'MAIN_MENU'),
    ]) },
    { id: 'CAMPAIGN', label: 'Campaign', icon: Map, renderMain: (root, save) => {
      renderLazyPage(root, 'campaign', () => import('./campaign'), (page, module) => {
        module.renderCampaign(page, save, actions.onStartCampaign);
        const boss = page.querySelector<HTMLElement>('.ftd-boss-reveal');
        const side = page.closest('.ftd-hub')?.querySelector('.ftd-hub__sub');
        if (boss && side) side.appendChild(boss);
      });
    }, renderSub: (root) => {
      const boss = root.closest('.ftd-hub')?.querySelector('.ftd-hub__main')?.querySelector<HTMLElement>('.ftd-boss-reveal');
      if (boss) root.appendChild(boss);
    } },
    ...([
      { id: 'SOCIAL', label: 'Community', icon: Users, view: 'community' },
      { id: 'MESSAGES', label: 'Messages', icon: MessageCircle, view: 'messages' },
      { id: 'NOTIFICATIONS', label: 'Notifications', icon: Bell, view: 'notifications' },
    ] as const).map(({ id, label, icon, view }): HubTab => ({ id, label, icon, renderMain: (root) => {
      renderLazyPage(root, label, () => import('./social'), (page, module) => module.renderSocial(page, view, {
        onOpenDailyReward: actions.onOpenDaily,
        onJoinCoopInvite: (code) => {
          void import('./onlineCoop').then(({ openOnlineCoopInvite }) => openOnlineCoopInvite(code)).catch((error) => {
            showScreenLoadFailure(page, 'Co-op', error, () => openScreen('CO_OP'));
          });
        },
      }));
    }, renderSub: (root) => context(root, 'YOUR NETWORK', label, view === 'messages' ? 'Open a conversation with a friend from the list.' : view === 'notifications' ? 'See recent activity and respond from this page.' : 'Find defenders, manage friends, and read the community board.', [
      route('Community', 'SOCIAL'), route('Messages', 'MESSAGES'), route('Notifications', 'NOTIFICATIONS'),
    ]) })),
  ];
  const legacy: Array<{ id: NavState; label: string; page: string; subtab?: string; icon: typeof ListChecks }> = [
    { id: 'MISSIONS', label: 'Missions', page: 'quests', subtab: 'missions', icon: ListChecks },
    { id: 'ACHIEVEMENTS', label: 'Achievements', page: 'quests', subtab: 'achievements', icon: Medal },
    { id: 'BADGES', label: 'Badges', page: 'quests', subtab: 'badges', icon: Medal },
  ];
  const pvp: HubTab[] = [
    { id: 'RANKED', label: 'Ranked PvP', icon: Trophy, renderMain: (root) => renderPvpTab(root, 'ranked'), renderSub: (root, save) => siegeContext(root, save, true) },
    { id: 'ARENA', label: 'Arena', icon: Swords, renderMain: (root) => renderPvpTab(root, 'arena'), renderSub: (root, save) => siegeContext(root, save, false) },
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
      const hub = root.closest('.ftd-hub');
      const show = (view: string) => {
        const title = view === 'badges' ? 'Badges' : view === 'achievements' ? 'Achievements' : view === 'ranks' ? 'Ranked History' : 'Missions';
        const pageTitle = hub?.querySelector<HTMLElement>('.ftd-hub-legacy__header')?.querySelector<HTMLElement>('h1')
          ?? hub?.querySelector<HTMLElement>('.ftd-hub-page-heading')?.querySelector<HTMLElement>('h1');
        if (pageTitle) pageTitle.textContent = title;
        const panel = hub?.querySelector<HTMLElement>('.ftd-hub__sub .ftd-hub-panel-content') ?? root;
        panel.replaceChildren();
        if (view === 'ranks') context(panel, 'HISTORY', 'Ranked history', 'These are your past solo Ranked scores. For live world-wide standings, choose Global or Friends rankings.', [route('Global rankings', 'LEADERBOARD'), route('Profile', 'PROFILE')]);
        else if (view === 'badges') context(panel, 'CAREER', 'Badges', 'See the marks you have earned from matches and missions.', [route('Achievements', 'ACHIEVEMENTS'), route('Profile', 'PROFILE')]);
        else if (view === 'achievements') context(panel, 'CAREER', 'Achievements', `Your ${save.games ?? 0} finished runs count toward combat milestones.`, [route('Missions', 'MISSIONS'), route('Profile', 'PROFILE')]);
        else context(panel, 'FIELD ORDERS', 'Missions', 'Complete the objectives shown on the left and claim available rewards.', [route('Achievements', 'ACHIEVEMENTS'), route('Arena', 'ARENA')]);
      };
      const tabs = hub?.querySelector('.quests-subtabs')?.querySelectorAll<HTMLButtonElement>('.subtab');
      const activeSubtab = Array.from(tabs ?? []).find((button) => button.classList.contains('is-active'));
      show(activeSubtab?.dataset.sub || 'missions');
      tabs?.forEach((button) => {
        if (button.dataset.hubContextBound === 'true') return;
        button.dataset.hubContextBound = 'true';
        button.addEventListener('click', () => show(button.dataset.sub || 'missions'));
      });
    },
  }))];
}
