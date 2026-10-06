/**
 * HUB — the unified 4-panel menu shell.
 *
 * Replaces the old "one screen per nav state" feel with a single persistent
 * frame:
 *   Panel 3 (header)  — identity + currency + utilities. Never remounts.
 *   Panel 4 (footer)  — tab bar (Heroes / Inventory / Shop / ...). Never remounts.
 *   Panel 1 (main)    — the selected tab's primary content. Slides on switch.
 *   Panel 2 (sub)     — the selected tab's contextual detail. Slides on switch.
 *
 * Each tab is a small adapter (`HubTab`) that knows how to paint Panel 1 and
 * Panel 2 for itself; the hub owns the chrome and the transition. This keeps
 * every existing `render*` function in `shop.ts` / `inventory.ts` / etc.
 * untouched — those still work standalone (and are what `render.test.ts`
 * exercises) — the hub just recomposes the same pieces into a shared frame.
 *
 * Navigation is unchanged: each tab is still a real `NavState`, so back/ESC/
 * browser-history all keep working exactly as before (§1, §10). The hub only
 * changes *how* a tab is painted, never *whether* it participates in nav.
 */

import { el, clear } from '../components/dom';
import { GameButton, GameCurrency } from '../components/primitives';
import { Bell, Ellipsis, MessageCircle, UsersRound, createElement, type Swords } from 'lucide';
import { openScreen, back, home } from './registry';
import { isUserAdmin } from '../../services/admin';
import { heroDef } from '../../game/heroes';
import { getHeroXpState } from '../../game/progression';
import { bindArenaRating } from '../../services/pvpRating';
import type { SaveData } from '../../game/save';
import { navigation, type NavState } from '../../game/navigation';
import { getAuthToken } from '../../services/auth';
import { socialApi } from '../../services/social';

/** A tab's contextual UI: what goes in Panel 1 (main) and Panel 2 (sub). */
export interface HubTab {
  id: NavState;
  label: string;
  icon: typeof Swords;
  /** Paints the primary content area. Called on every entry and refresh. */
  renderMain: (root: HTMLElement, save: SaveData) => void;
  /** Paints the contextual detail panel. */
  renderSub?: (root: HTMLElement, save: SaveData) => void;
}

export interface HubOptions {
  onQuit?: () => void;
  onAdmin?: () => void;
  onOpenDaily?: () => void;
  onPlay: () => void;
  onSelectMode?: (mode: import('../../game/save').GameMode) => void;
  onCampaign?: () => void;
}

/** The default tab: PLAY + loadout, reached via the Home destination or logo. */
export const HUB_HOME: NavState = 'MAIN_MENU';

const tabs = new Map<NavState, HubTab>();
let lastActive: NavState | null = null;

export function registerHubTab(tab: HubTab): void {
  tabs.set(tab.id, tab);
}

export function hubTabs(): HubTab[] {
  return [...tabs.values()];
}

function icon(node: typeof Swords, className: string): HTMLElement | SVGElement {
  if (typeof document.createElementNS !== 'function') return el('span', { class: className, 'aria-hidden': 'true' });
  return createElement(node, { class: className, width: 18, height: 18, 'aria-hidden': 'true' });
}

function buildCurrency(save: SaveData): HTMLElement {
  const currency = el('div', { class: 'ftd-hub-currency', 'aria-label': 'Wallet and shop' });
  updateCurrency(currency, save);
  return currency;
}

function updateCurrency(currency: HTMLElement, save: SaveData): void {
  currency.replaceChildren();
  for (const [amount, kind, label] of [
    [save.coins, 'coins', 'Coins'], [save.gems, 'gems', 'Gems'],
  ] as const) {
    const button = el('button', { class: 'ftd-hub-currency__button', type: 'button', title: `Open shop · ${label}`, 'aria-label': `${amount.toLocaleString()} ${label}. Open shop`, 'data-testid': `nav-${kind}` }, [GameCurrency(amount, kind)]);
    button.addEventListener('click', () => openScreen('SHOP'));
    currency.appendChild(button);
  }
}

function buildSocialControl(
  button: HTMLButtonElement,
  title: string,
  actionLabel: string,
  destination: NavState,
  loadItems: (list: HTMLElement) => Promise<void>,
): HTMLElement {
  const list = el('div', { class: 'ftd-hub-popover__list' });
  const action = el('button', { class: 'ftd-hub-popover__action', type: 'button', text: actionLabel, 'data-testid': destination === 'MESSAGES' ? 'open-messages-inbox' : 'open-notifications-center' });
  action.addEventListener('click', () => openScreen(destination));
  const popover = el('div', { class: 'ftd-hub-popover', role: 'region', 'aria-label': title }, [
    el('strong', { class: 'ftd-hub-popover__title', text: title }),
    list,
    action,
  ]);
  const wrapper = el('div', { class: 'ftd-hub-social-control' }, [button, popover]);
  let loaded = false;
  const show = () => {
    wrapper.parentElement?.querySelectorAll<HTMLElement>('.ftd-hub-popover').forEach((other) => {
      if (other !== popover) other.classList.remove('is-open');
    });
    wrapper.parentElement?.querySelectorAll<HTMLButtonElement>('[aria-expanded="true"]').forEach((other) => {
      if (other !== button) other.setAttribute('aria-expanded', 'false');
    });
    popover.classList.add('is-open');
    button.setAttribute('aria-expanded', 'true');
    if (loaded || !getAuthToken()) {
      if (!getAuthToken() && !loaded) list.replaceChildren(el('p', { class: 'ftd-hub-popover__empty', text: 'Sign in to view your updates.' }));
      return;
    }
    loaded = true;
    list.replaceChildren(el('p', { class: 'ftd-hub-popover__empty', text: 'Loading…' }));
    void loadItems(list).catch(() => list.replaceChildren(el('p', { class: 'ftd-hub-popover__empty', text: 'Could not load updates.' })));
  };
  const hide = () => { popover.classList.remove('is-open'); button.setAttribute('aria-expanded', 'false'); };
  button.addEventListener('click', () => popover.classList.contains('is-open') ? hide() : show());
  wrapper.addEventListener('mouseenter', () => { if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) show(); });
  wrapper.addEventListener('mouseleave', () => { if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) hide(); });
  button.addEventListener('focus', () => { if (window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) show(); });
  return wrapper;
}

/** Builds the persistent header (Panel 3). Rebuilt on each full render, but never mid-tab-switch. */
function buildHeader(save: SaveData, opts: HubOptions): HTMLElement {
  const hero = heroDef(save.hero);
  const xp = getHeroXpState(save, save.hero);

  const logo = el('button', {
    class: 'ftd-hub-logo',
    type: 'button',
    'aria-label': 'Home',
    title: 'Home',
  }, [
    el('span', { class: 'ftd-hub-logo__main', text: 'FRUIT' }),
    el('span', { class: 'ftd-hub-logo__accent', text: 'TD' }),
  ]);
  logo.setAttribute('data-testid', 'nav-brand-home');
  logo.addEventListener('click', () => home());

  const identity = el('button', { class: 'ftd-hub-identity', type: 'button', title: 'Open profile', 'aria-label': `Open ${save.nickname || 'Slicer'} profile`, 'data-testid': 'nav-avatar-profile' }, [
    el('img', {
      class: 'ftd-hub-identity__avatar',
      src: save.avatar || '',
      alt: `${save.nickname || 'Slicer'} avatar`,
    }),
    el('div', { class: 'ftd-hub-identity__text' }, [
      el('p', { class: 'ftd-hub-identity__name', text: save.nickname || 'Slicer' }),
      el('p', { class: 'ftd-hub-identity__meta' }, [
        el('span', { class: 'ftd-hub-identity__rank', text: 'Unranked' }),
        el('span', { class: 'ftd-hub-identity__sep', text: '·' }),
        el('span', { class: 'ftd-hub-identity__hero-level', text: `${hero.name} Lv ${xp.level}` }),
      ]),
    ]),
  ]);
  bindArenaRating(identity.querySelector<HTMLElement>('.ftd-hub-identity__rank'));
  identity.addEventListener('click', () => openScreen('PROFILE'));

  const currency = buildCurrency(save);

  const utilityLinks = el('div', { class:'ftd-hub-menu__items' }, [
    GameButton({ label: 'News', variant: 'ghost', size: 'sm', onClick: () => openScreen('NEWS') }),
    GameButton({ label: 'Leaderboard', variant: 'ghost', size: 'sm', onClick: () => openScreen('LEADERBOARD') }),
    ...(opts.onOpenDaily ? [GameButton({ label: 'Daily', variant: 'outline', size: 'sm', onClick: opts.onOpenDaily })] : []),
    GameButton({ label: 'Settings', variant: 'ghost', size: 'sm', onClick: () => openScreen('SETTINGS') }),
    ...(opts.onAdmin ? [GameButton({ label: isUserAdmin() ? 'Admin' : 'Admin access', variant: 'ghost', size: 'sm', class: 'ftd-hub-admin', onClick: opts.onAdmin })] : []),
    GameButton({ label: 'Quit', variant: 'ghost', size: 'sm', tone: 'danger', onClick: () => opts.onQuit?.() }),
  ]);
  const utilityMenu = el('details', { class:'ftd-hub-menu' }, [
    el('summary', { title:'More options', 'aria-label':'More options' }, [icon(Ellipsis,'ftd-hub-menu__icon')]),
    utilityLinks,
  ]);
  const notificationButton = el('button', { class: 'ftd-hub-utility ftd-hub-utility--icon ftd-hub-notifications', type: 'button', title: 'Notifications', 'aria-label': 'Notifications', 'aria-expanded': 'false', 'data-testid': 'nav-notifications' }, [icon(Bell, 'ftd-hub-social__icon'), el('span', { class: 'ftd-hub-social__count', hidden: true, 'aria-hidden': 'true' })]);
  const messageButton = el('button', { class: 'ftd-hub-utility ftd-hub-utility--icon', type: 'button', title: 'Messages', 'aria-label': 'Messages', 'aria-expanded': 'false', 'data-testid': 'nav-messages' }, [icon(MessageCircle, 'ftd-hub-social__icon')]);
  const notificationControl = buildSocialControl(notificationButton, 'NOTIFICATIONS', 'Open notification center', 'NOTIFICATIONS', async (list) => {
    const data = await socialApi.notifications();
    list.replaceChildren(...(data.notifications.slice(0, 3).map((item) => {
      const row = el('button', { class: 'ftd-hub-popover__item', type: 'button' }, [
        el('strong', { text: item.title }),
        el('small', { text: item.body }),
      ]);
      row.addEventListener('click', () => openScreen('NOTIFICATIONS'));
      return row;
    })));
    if (!data.notifications.length) list.appendChild(el('p', { class: 'ftd-hub-popover__empty', text: 'You’re all caught up.' }));
  });
  const messageControl = buildSocialControl(messageButton, 'MESSAGES', 'Open inbox', 'MESSAGES', async (list) => {
    const data = await socialApi.friends();
    const friend = data.friends.find((item) => item.state === 'accepted');
    if (!friend) {
      list.replaceChildren(el('p', { class: 'ftd-hub-popover__empty', text: 'Your inbox is ready when you add a friend.' }));
      return;
    }
    const inbox = await socialApi.messages(friend.username);
    const recent = inbox.messages.slice(-2).reverse();
    list.replaceChildren(...(recent.map((item) => {
      const row = el('button', { class: 'ftd-hub-popover__item', type: 'button' }, [
        el('strong', { text: friend.nickname || friend.username }),
        el('small', { text: item.body }),
      ]);
      row.addEventListener('click', () => openScreen('MESSAGES'));
      return row;
    })));
    if (!recent.length) list.appendChild(el('p', { class: 'ftd-hub-popover__empty', text: 'No recent messages.' }));
  });
  const utils = el('div', { class: 'ftd-hub-utils' }, [
    notificationControl,
    messageControl,
    el('button', { class: 'ftd-hub-utility ftd-hub-utility--community', type: 'button', title: 'Community', 'aria-label': 'Community', 'data-testid': 'nav-social' }, [icon(UsersRound, 'ftd-hub-social__icon'), el('span', { text: 'Community' })]),
    utilityMenu,
  ]);

  const settings = [...utilityLinks.querySelectorAll<HTMLButtonElement>('.ftd-btn')]
    .find((button) => button.textContent?.trim() === 'Settings');
  settings?.setAttribute('data-testid', 'nav-settings');
  const admin = utilityLinks.querySelector<HTMLButtonElement>('.ftd-hub-admin');
  admin?.setAttribute('data-testid', 'nav-admin');
  utils.querySelector<HTMLButtonElement>('[data-testid="nav-social"]')?.addEventListener('click', () => openScreen('SOCIAL'));

  return el('header', { class: 'ftd-hub__header' }, [logo, identity, currency, utils]);
}

/** Keep persistent header controls mounted while reflecting the latest save. */
function syncHeader(root: HTMLElement, save: SaveData): void {
  const hero = heroDef(save.hero);
  const xp = getHeroXpState(save, save.hero);
  const avatar = root.querySelector<HTMLImageElement>('.ftd-hub-identity__avatar');
  if (avatar) {
    avatar.src = save.avatar || '';
    avatar.alt = `${save.nickname || 'Slicer'} avatar`;
  }
  const name = root.querySelector('.ftd-hub-identity__name');
  if (name) name.textContent = save.nickname || 'Slicer';
  const identity = root.querySelector<HTMLElement>('.ftd-hub-identity');
  identity?.setAttribute('aria-label', `Open ${save.nickname || 'Slicer'} profile`);
  const rankLabel = root.querySelector('.ftd-hub-identity__rank');
  bindArenaRating(rankLabel as HTMLElement | null);
  const heroLevel = root.querySelector('.ftd-hub-identity__hero-level');
  if (heroLevel) heroLevel.textContent = `${hero.name} Lv ${xp.level}`;
  const currency = root.querySelector('.ftd-hub-currency');
  if (currency) updateCurrency(currency as HTMLElement, save);
}

/** Builds the persistent footer (Panel 4): five core game destinations. */
function buildFooter(active: NavState): HTMLElement {
  const nav = el('nav', { class: 'ftd-hub__footer', 'aria-label': 'Game menu' });
  const destinations: NavState[] = ['MAIN_MENU', 'HEROES', 'INVENTORY', 'SHOP', 'PROFILE'];
  for (const tab of tabs.values()) {
    if (!destinations.includes(tab.id)) continue;
    const button = el('button', {
      class: `ftd-hub-tab${tab.id === active ? ' is-active' : ''}`,
      type: 'button',
      role: 'tab',
      'aria-selected': String(tab.id === active),
      'data-hub-tab': tab.id,
      'data-testid': `nav-${tab.id === 'MAIN_MENU' ? 'home' : tab.id.toLowerCase()}`,
    }, [
      icon(tab.icon, 'ftd-hub-tab__icon'),
      el('span', { class: 'ftd-hub-tab__label', text: tab.label }),
    ]);
    button.addEventListener('click', () => {
      if (tab.id === HUB_HOME) home();
      else if (tab.id !== navigation.state) openScreen(tab.id);
    });
    nav.appendChild(button);
  }
  return nav;
}

/**
 * Paints (or re-paints) Panel 1 + Panel 2 for the given tab, sliding the new
 * content in. `direction` picks which edge the incoming content slides from,
 * so moving between tabs feels directional rather than a flat crossfade.
 */
function paintTab(root: HTMLElement, tab: HubTab, save: SaveData, direction: 'forward' | 'back' | 'none'): void {
  root.classList.remove('is-pvp-battle');
  const mainHost = root.querySelector('.ftd-hub__main') as HTMLElement | null;
  const subHost = root.querySelector('.ftd-hub__sub') as HTMLElement | null;
  if (!mainHost) return;

  // The older missions and leaderboard widgets retain their event handlers
  // when moved into the hub. Park them before replacing the previous panel.
  const legacyHome = document.getElementById('menu-world');
  if (legacyHome) {
    for (const page of mainHost.querySelectorAll<HTMLElement>('.menu-page')) {
      if (page.getAttribute('data-hub-legacy') !== 'true') continue;
      page.removeAttribute('data-hub-legacy');
      legacyHome.appendChild(page);
    }
  }

  const mainInner = el('div', { class: 'ftd-hub-panel-content' });
  tab.renderMain(mainInner, save);

  clear(mainHost);
  mainHost.appendChild(mainInner);
  if (direction !== 'none') {
    mainHost.scrollTop = 0;
    const body = root.querySelector('.ftd-hub__body');
    if (body) body.scrollTop = 0;
  }

  if (subHost) {
    clear(subHost);
    if (tab.renderSub) {
      const subInner = el('div', { class: 'ftd-hub-panel-content' });
      subHost.appendChild(subInner);
      tab.renderSub(subInner, save);
      subHost.classList.remove('is-empty');
      if (direction !== 'none') subHost.scrollTop = 0;
    } else {
      subHost.classList.add('is-empty');
    }
  }
  root.classList.toggle('is-single-panel', !tab.renderSub);

  if (direction !== 'none') {
    const animClass = direction === 'forward' ? 'is-sliding-in-forward' : 'is-sliding-in-back';
    for (const host of [mainInner, ...(subHost?.firstElementChild ? [subHost.firstElementChild] : [])]) {
      host.classList.add(animClass);
      // Force reflow so the animation restarts on every tab switch, then let
      // it clean up after itself rather than leaving a class behind that
      // would suppress the next transition.
      void (host as HTMLElement).offsetWidth;
      host.addEventListener('animationend', () => host.classList.remove(animClass), { once: true });
    }
  }
}

/**
 * Renders the full hub shell: header + footer once, then the active tab's
 * panels. Call on first entry; call `switchHubTab` on subsequent tab clicks
 * so the header/footer are never torn down.
 */
export function renderHub(root: HTMLElement, save: SaveData, active: NavState, opts: HubOptions): void {
  clear(root);
  root.classList.add('ftd-hub');
  root.classList.toggle('is-home', active === HUB_HOME);
  root.classList.toggle('is-campaign', active === 'CAMPAIGN');

  root.appendChild(buildHeader(save, opts));
  if (getAuthToken()) {
    const bell = root.querySelector<HTMLButtonElement>('[data-testid="nav-notifications"]');
    void socialApi.notifications().then(({ unread }) => {
      if (!bell?.isConnected) return;
      const count = bell.querySelector<HTMLElement>('.ftd-hub-social__count');
      if (count) { count.textContent = unread > 99 ? '99+' : String(unread); count.hidden = unread === 0; }
      bell.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    }).catch(() => {});
  }

  const body = el('div', { class: 'ftd-hub__body' }, [
    el('div', { class: 'ftd-hub__main' }),
    el('div', { class: 'ftd-hub__sub' }),
  ]);
  root.appendChild(body);

  root.appendChild(buildFooter(active));

  const tab = tabs.get(active);
  if (tab) paintTab(root, tab, save, 'none');
  lastActive = active;
}

/** Switches the active tab in place: header/footer stay mounted, panels slide. */
export function switchHubTab(root: HTMLElement, save: SaveData, next: NavState): void {
  const tab = tabs.get(next);
  if (!tab) return;

  syncHeader(root, save);

  const order = [...tabs.keys()];
  root.classList.toggle('is-home', next === HUB_HOME);
  root.classList.toggle('is-campaign', next === 'CAMPAIGN');
  const prevIndex = lastActive ? order.indexOf(lastActive) : -1;
  const nextIndex = order.indexOf(next);
  const direction: 'forward' | 'back' = nextIndex >= prevIndex ? 'forward' : 'back';

  const footer = root.querySelector('.ftd-hub__footer');
  footer?.querySelectorAll('.ftd-hub-tab').forEach((btn) => {
    const isActive = (btn as HTMLElement).getAttribute('data-hub-tab') === next;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });

  paintTab(root, tab, save, direction);
  lastActive = next;
}

/** Re-paints whichever tab is active, without animating — for data refreshes. */
export function refreshHub(root: HTMLElement, save: SaveData, active: NavState): void {
  const tab = tabs.get(active);
  if (!tab) return;
  syncHeader(root, save);
  root.classList.toggle('is-home', active === HUB_HOME);
  root.classList.toggle('is-campaign', active === 'CAMPAIGN');
  paintTab(root, tab, save, 'none');
  lastActive = active;
}

export function resetHub(): void {
  tabs.clear();
  lastActive = null;
}

export { back, home };
