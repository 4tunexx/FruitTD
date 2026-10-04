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
import { Bell, MessageCircle, UsersRound, createElement, type Swords } from 'lucide';
import { openScreen, back, home } from './registry';
import { isUserAdmin } from '../../services/admin';
import { heroDef } from '../../game/heroes';
import { getHeroXpState } from '../../game/progression';
import { rankFromScore } from '../../game/requirements';
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

/** Builds the persistent header (Panel 3). Rebuilt on each full render, but never mid-tab-switch. */
function buildHeader(save: SaveData, opts: HubOptions): HTMLElement {
  const hero = heroDef(save.hero);
  const xp = getHeroXpState(save, save.hero);
  const rank = rankFromScore(save.rankedScore || save.highScore || 0);

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
        el('span', { class: 'ftd-hub-identity__rank', text: rank.title }),
        el('span', { class: 'ftd-hub-identity__sep', text: '·' }),
        el('span', { class: 'ftd-hub-identity__hero-level', text: `${hero.name} Lv ${xp.level}` }),
      ]),
    ]),
  ]);
  identity.addEventListener('click', () => openScreen('PROFILE'));

  const currency = buildCurrency(save);

  const utils = el('div', { class: 'ftd-hub-utils' }, [
    el('button', { class: 'ftd-hub-utility ftd-hub-utility--icon ftd-hub-notifications', type: 'button', title: 'Notifications', 'aria-label': 'Notifications', 'data-testid': 'nav-notifications' }, [icon(Bell, 'ftd-hub-social__icon'), el('span', { class: 'ftd-hub-social__count', hidden: true, 'aria-hidden': 'true' })]),
    el('button', { class: 'ftd-hub-utility ftd-hub-utility--icon', type: 'button', title: 'Messages', 'aria-label': 'Messages', 'data-testid': 'nav-messages' }, [icon(MessageCircle, 'ftd-hub-social__icon')]),
    el('button', { class: 'ftd-hub-utility ftd-hub-utility--community', type: 'button', title: 'Community', 'aria-label': 'Community', 'data-testid': 'nav-social' }, [icon(UsersRound, 'ftd-hub-social__icon'), el('span', { text: 'Community' })]),
    GameButton({ label: 'News', variant: 'ghost', size: 'sm', onClick: () => openScreen('NEWS') }),
    ...(opts.onOpenDaily ? [GameButton({ label: 'Daily', variant: 'outline', size: 'sm', onClick: opts.onOpenDaily })] : []),
    GameButton({ label: 'Settings', variant: 'ghost', size: 'sm', onClick: () => openScreen('SETTINGS') }),
    ...(opts.onAdmin
      ? [GameButton({
        label: isUserAdmin() ? 'Admin' : 'Admin access',
        variant: 'ghost',
        size: 'sm',
        class: 'ftd-hub-admin',
        onClick: opts.onAdmin,
      })]
      : []),
    GameButton({ label: 'Quit', variant: 'ghost', size: 'sm', tone: 'danger', onClick: () => opts.onQuit?.() }),
  ]);

  const settings = [...utils.querySelectorAll<HTMLButtonElement>('.ftd-btn')]
    .find((button) => button.textContent?.trim() === 'Settings');
  settings?.setAttribute('data-testid', 'nav-settings');
  const admin = utils.querySelector<HTMLButtonElement>('.ftd-hub-admin');
  admin?.setAttribute('data-testid', 'nav-admin');
  utils.querySelector<HTMLButtonElement>('.ftd-hub-notifications')?.addEventListener('click', () => openScreen('NOTIFICATIONS'));
  utils.querySelector<HTMLButtonElement>('[data-testid="nav-messages"]')?.addEventListener('click', () => openScreen('MESSAGES'));
  utils.querySelector<HTMLButtonElement>('[data-testid="nav-social"]')?.addEventListener('click', () => openScreen('SOCIAL'));

  return el('header', { class: 'ftd-hub__header' }, [logo, identity, currency, utils]);
}

/** Keep persistent header controls mounted while reflecting the latest save. */
function syncHeader(root: HTMLElement, save: SaveData): void {
  const hero = heroDef(save.hero);
  const xp = getHeroXpState(save, save.hero);
  const rank = rankFromScore(save.rankedScore || save.highScore || 0);
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
  if (rankLabel) rankLabel.textContent = rank.title;
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
  if (direction !== 'none') mainHost.scrollTop = 0;

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
  paintTab(root, tab, save, 'none');
  lastActive = active;
}

export function resetHub(): void {
  tabs.clear();
  lastActive = null;
}

export { back, home };
