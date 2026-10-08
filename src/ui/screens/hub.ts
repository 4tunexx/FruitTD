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
import { GameCurrency } from '../components/primitives';
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
  /** Clears temporary mode selection when Home is explicitly chosen. */
  onHome?: () => void;
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
let lastHubSave: SaveData | null = null;
let removeMenuDismiss: (() => void) | null = null;
let notificationPollTimer: ReturnType<typeof setInterval> | null = null;
let closeSocialPreview: (() => void) | null = null;

export function registerHubTab(tab: HubTab): void {
  tabs.set(tab.id, tab);
}

export function hubTabs(): HubTab[] {
  return [...tabs.values()];
}

function returnHome(root: HTMLElement): void {
  const wasHome = navigation.state === HUB_HOME;
  tabs.get(HUB_HOME)?.onHome?.();
  home();
  if (wasHome && lastHubSave) refreshHub(root, lastHubSave, HUB_HOME);
}

function icon(node: typeof Swords, className: string): HTMLElement | SVGElement {
  if (typeof document.createElementNS !== 'function') return el('span', { class: className, 'aria-hidden': 'true' });
  return createElement(node, { class: className, width: 18, height: 18, 'aria-hidden': 'true' });
}

function openSocialPreview(view: 'messages' | 'notifications', trigger: HTMLElement): void {
  if (closeSocialPreview) {
    const sameTrigger = trigger.getAttribute('aria-expanded') === 'true';
    closeSocialPreview();
    if (sameTrigger) return;
  }

  const title = view === 'messages' ? 'Messages' : 'Notifications';
  const destination: NavState = view === 'messages' ? 'MESSAGES' : 'NOTIFICATIONS';
  const panel = el('section', {
    class: 'ftd-hub-social-popover',
    role: 'dialog',
    'aria-label': `${title} preview`,
    'data-testid': 'hub-social-popover',
  });
  const heading = el('header', { class: 'ftd-hub-social-popover__header' }, [
    el('strong', { text: title }),
    el('span', { class: 'ftd-hub-social-popover__loading', text: 'Loading…', role: 'status' }),
  ]);
  const list = el('div', { class: 'ftd-hub-social-popover__list', 'aria-live': 'polite' });
  const footer = el('button', { type: 'button', class: 'ftd-hub-social-popover__all', text: view === 'messages' ? 'Open message centre' : 'Open notification centre' });
  panel.append(heading, list, footer);

  let closed = false;
  const close = (restoreFocus = false) => {
    if (closed) return;
    closed = true;
    panel.remove();
    closeSocialPreview = null;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', dismissOutside);
    document.removeEventListener('keydown', dismissOnEscape);
    window.removeEventListener('resize', position);
    window.removeEventListener('scroll', position, true);
    stopNavigation();
    if (restoreFocus && trigger.isConnected) trigger.focus();
  };
  const openCentre = () => { close(); openScreen(destination); };
  const dismissOutside = (event: Event) => {
    const isInside = (ancestor: HTMLElement) => {
      let node = event.target as (Node & { parentElement?: HTMLElement | null }) | null;
      while (node) { if (node === ancestor) return true; node = node.parentElement ?? null; }
      return false;
    };
    if (event.target && !isInside(panel) && !isInside(trigger)) close();
  };
  const dismissOnEscape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation(); close(true);
  };
  const position = () => {
    if (!panel.isConnected) return;
    const rect = (trigger as HTMLElement & { getBoundingClientRect?: () => DOMRect }).getBoundingClientRect?.();
    const viewportWidth = window.innerWidth || 390;
    const width = Math.min(380, viewportWidth - 24);
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(12, Math.min((rect?.right ?? viewportWidth - 12) - width, viewportWidth - width - 12))}px`;
    const height = (panel as HTMLElement & { offsetHeight?: number }).offsetHeight || 320;
    panel.style.top = `${Math.min((rect?.bottom ?? 48) + 10, Math.max(12, (window.innerHeight || 700) - height - 12))}px`;
  };
  const stopNavigation = navigation.onChange(() => close());
  closeSocialPreview = () => close();
  trigger.setAttribute('aria-expanded', 'true');
  document.body.appendChild(panel);
  position();
  footer.addEventListener('click', openCentre);
  document.addEventListener('pointerdown', dismissOutside);
  document.addEventListener('keydown', dismissOnEscape);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, true);

  const setLoading = (loading: boolean) => {
    const status = heading.querySelector<HTMLElement>('.ftd-hub-social-popover__loading');
    if (status) status.textContent = loading ? 'Loading…' : '';
  };
  const addRow = (primary: string, secondary: string, meta: string) => {
    const row = el('button', { type: 'button', class: 'ftd-hub-social-popover__item' }, [
      el('strong', { text: primary }), el('span', { text: secondary }), el('small', { text: meta }),
    ]);
    row.addEventListener('click', openCentre);
    list.appendChild(row);
  };
  const empty = (text: string) => list.replaceChildren(el('p', { class: 'ftd-hub-social-popover__empty', text }));

  if (!getAuthToken()) {
    setLoading(false);
    empty('Sign in to view your messages and activity.');
    return;
  }
  if (view === 'notifications') {
    void socialApi.notifications().then(({ notifications }) => {
      if (closed) return;
      setLoading(false);
      if (!notifications.length) return empty('You’re all caught up.');
      for (const item of notifications.slice(0, 5)) {
        addRow(item.title, item.body, `${item.actorName || 'Fruit TD'} · ${new Date(item.createdAt).toLocaleDateString()}`);
      }
    }).catch(() => { if (!closed) { setLoading(false); empty('Notifications are unavailable right now.'); } });
  } else {
    void socialApi.friends().then(async ({ friends }) => {
      const accepted = friends.filter((friend) => friend.state === 'accepted').slice(0, 6);
      const threads = await Promise.all(accepted.map(async (friend) => {
        try {
          const { messages } = await socialApi.messages(friend.username);
          return { friend, latest: messages.at(-1) };
        } catch { return { friend, latest: undefined }; }
      }));
      if (closed) return;
      setLoading(false);
      const recent = threads.filter((thread) => thread.latest).sort((a, b) => Date.parse(b.latest!.createdAt) - Date.parse(a.latest!.createdAt));
      if (!recent.length) return empty(accepted.length ? 'No messages yet. Start a conversation from your message centre.' : 'Add friends to start a conversation.');
      for (const { friend, latest } of recent.slice(0, 5)) {
        addRow(friend.nickname || friend.username, latest!.body, new Date(latest!.createdAt).toLocaleString());
      }
    }).catch(() => { if (!closed) { setLoading(false); empty('Messages are unavailable right now.'); } });
  }
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
function buildHeader(save: SaveData, opts: HubOptions, root: HTMLElement): HTMLElement {
  closeSocialPreview?.();
  removeMenuDismiss?.();
  removeMenuDismiss = null;
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
  logo.addEventListener('click', () => returnHome(root));

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

  const notifications = el('button', { class: 'ftd-hub-utility ftd-hub-utility--icon ftd-hub-notifications', type: 'button', title: 'Notifications', 'aria-label': 'Notifications', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-testid': 'nav-notifications' }, [icon(Bell, 'ftd-hub-social__icon'), el('span', { class: 'ftd-hub-social__count', hidden: true, 'aria-hidden': 'true' })]);
  const messages = el('button', { class: 'ftd-hub-utility ftd-hub-utility--icon', type: 'button', title: 'Messages', 'aria-label': 'Messages', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'data-testid': 'nav-messages' }, [icon(MessageCircle, 'ftd-hub-social__icon')]);
  const community = el('button', { class: 'ftd-hub-utility ftd-hub-utility--community', type: 'button', title: 'Community', 'aria-label': 'Community', 'data-testid': 'nav-social' }, [icon(UsersRound, 'ftd-hub-social__icon'), el('span', { text: 'Community' })]);
  const desktopActions = typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 901px)') : null;
  const isDesktop = () => desktopActions?.matches ?? false;
  const more = el('button', {
    class: 'ftd-hub-utility ftd-hub-utility--icon ftd-hub-more',
    type: 'button',
    title: 'More menus',
    'aria-label': 'More menus',
    'aria-haspopup': 'menu',
    'aria-controls': 'hub-more-menu',
    'aria-expanded': 'false',
    'data-testid': 'nav-more',
  }, [icon(Ellipsis, 'ftd-hub-social__icon')]);
  const menu = el('div', { id: 'hub-more-menu', class: 'ftd-hub-more-menu', role: isDesktop() ? 'group' : 'menu', 'aria-label': 'Game actions', hidden: !isDesktop(), 'data-testid': 'hub-more-menu' });
  const utils = el('div', { class: 'ftd-hub-utils' }, [notifications, messages, community, more]);
  const actionsRow = el('div', { class: 'ftd-hub-actions' }, [utils, menu]);
  const actions: Array<{ label: string; testId: string; run: () => void; className?: string }> = [
    { label: 'News', testId: 'nav-news', run: () => openScreen('NEWS') },
    { label: 'Leaderboard', testId: 'nav-leaderboard', run: () => openScreen('LEADERBOARD') },
    ...(opts.onOpenDaily ? [{ label: 'Daily rewards', testId: 'nav-daily', run: opts.onOpenDaily }] : []),
    { label: 'Settings', testId: 'nav-settings', run: () => openScreen('SETTINGS') },
    ...(opts.onAdmin ? [{ label: isUserAdmin() ? 'Admin' : 'Admin access', testId: 'nav-admin', run: opts.onAdmin }] : []),
    { label: 'Quit game', testId: 'nav-quit', run: () => opts.onQuit?.(), className: 'is-danger' },
  ];
  let menuOpen = false;
  const setMenuOpen = (open: boolean) => {
    if (isDesktop()) {
      menuOpen = false;
      menu.hidden = false;
      more.hidden = true;
      more.setAttribute('aria-expanded', 'false');
      if (menu.parentElement !== actionsRow) actionsRow.appendChild(menu);
      return;
    }
    menuOpen = open;
    menu.hidden = !open;
    more.hidden = false;
    menu.setAttribute('role', 'menu');
    menu.querySelectorAll<HTMLButtonElement>('[data-testid^="nav-"]').forEach((item) => item.setAttribute('role', 'menuitem'));
    more.setAttribute('aria-expanded', String(open));
    if (open) {
      document.body.appendChild(menu);
      const rect = more.getBoundingClientRect?.();
      const viewportWidth = window.innerWidth || 390;
      const viewportHeight = window.innerHeight || 700;
      const width = Math.min(250, viewportWidth - 20);
      menu.style.width = `${width}px`;
      menu.style.left = `${Math.max(10, Math.min((rect?.right ?? viewportWidth) - width, viewportWidth - width - 10))}px`;
      menu.style.top = `${Math.min((rect?.bottom ?? 70) + 8, Math.max(10, viewportHeight - (menu.offsetHeight || 320) - 10))}px`;
    } else {
      menu.remove();
    }
  };
  const closeMenu = () => setMenuOpen(false);
  for (const action of actions) {
    const item = el('button', { class: `ftd-hub-more-menu__item${action.className ? ` ${action.className}` : ''}`, type: 'button', role: isDesktop() ? undefined : 'menuitem', text: action.label, 'data-testid': action.testId });
    item.addEventListener('click', () => { closeMenu(); action.run(); });
    menu.appendChild(item);
  }
  const updateMenuPresentation = () => {
    if (isDesktop()) {
      menuOpen = false;
      menu.hidden = false;
      menu.setAttribute('role', 'group');
      menu.querySelectorAll<HTMLButtonElement>('[data-testid^="nav-"]').forEach((item) => item.removeAttribute('role'));
      more.hidden = true;
      more.setAttribute('aria-expanded', 'false');
      more.removeAttribute('aria-haspopup');
      if (menu.parentElement !== actionsRow) actionsRow.appendChild(menu);
    } else {
      menu.hidden = !menuOpen;
      menu.setAttribute('role', 'menu');
      menu.querySelectorAll<HTMLButtonElement>('[data-testid^="nav-"]').forEach((item) => item.setAttribute('role', 'menuitem'));
      more.hidden = false;
      more.setAttribute('aria-haspopup', 'menu');
      if (!menuOpen) menu.remove();
    }
  };
  updateMenuPresentation();
  more.addEventListener('click', () => {
    setMenuOpen(!menuOpen);
    if (menuOpen) menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      more.focus();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    event.stopPropagation();
    const items = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + delta + items.length) % items.length]?.focus();
  });
  notifications.addEventListener('click', () => openSocialPreview('notifications', notifications));
  messages.addEventListener('click', () => openSocialPreview('messages', messages));
  community.addEventListener('click', () => openScreen('SOCIAL'));
  const header = el('header', { class: 'ftd-hub__header' }, [logo, identity, currency, actionsRow]);
  header.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (menuOpen && !target.closest('.ftd-hub-more') && !target.closest('.ftd-hub-more-menu')) closeMenu();
  });
  const dismissMenu = (event: Event) => {
    const target = event.target as HTMLElement | null;
    if (menuOpen && target && !header.contains(target) && !menu.contains(target)) closeMenu();
  };
  const repositionMenu = () => {
    updateMenuPresentation();
    if (menuOpen) setMenuOpen(true);
  };
  document.addEventListener('pointerdown', dismissMenu);
  document.addEventListener('keydown', dismissOnEscape);
  window.addEventListener('resize', repositionMenu);
  desktopActions?.addEventListener?.('change', updateMenuPresentation);
  const stopNavigation = navigation.onChange(closeMenu);
  function dismissOnEscape(event: KeyboardEvent) {
    if (menuOpen && event.key === 'Escape') { closeMenu(); more.focus(); }
  }
  removeMenuDismiss = () => {
    closeMenu();
    document.removeEventListener('pointerdown', dismissMenu);
    document.removeEventListener('keydown', dismissOnEscape);
    window.removeEventListener('resize', repositionMenu);
    desktopActions?.removeEventListener?.('change', updateMenuPresentation);
    stopNavigation();
  };
  return header;
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
function buildFooter(active: NavState, root: HTMLElement): HTMLElement {
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
      if (tab.id === HUB_HOME) returnHome(root);
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
  removeMenuDismiss?.();
  removeMenuDismiss = null;
  if (notificationPollTimer) clearInterval(notificationPollTimer);
  notificationPollTimer = null;
  lastHubSave = save;
  clear(root);
  root.classList.add('ftd-hub');
  root.classList.toggle('is-home', active === HUB_HOME);
  root.classList.toggle('is-campaign', active === 'CAMPAIGN');

  root.appendChild(buildHeader(save, opts, root));
  if (getAuthToken()) {
    const bell = root.querySelector<HTMLButtonElement>('[data-testid="nav-notifications"]');
    const updateUnread = () => socialApi.notifications().then(({ unread }) => {
      if (!bell?.isConnected) return;
      const count = bell.querySelector<HTMLElement>('.ftd-hub-social__count');
      if (count) { count.textContent = unread > 99 ? '99+' : String(unread); count.hidden = unread === 0; }
      bell.setAttribute('aria-label', unread ? `Notifications, ${unread} unread` : 'Notifications');
    }).catch(() => {});
    void updateUnread();
    notificationPollTimer = setInterval(() => { void updateUnread(); }, 45_000);
    (notificationPollTimer as unknown as { unref?: () => void }).unref?.();
  }

  const body = el('div', { class: 'ftd-hub__body' }, [
    el('div', { class: 'ftd-hub__main' }),
    el('div', { class: 'ftd-hub__sub' }),
  ]);
  root.appendChild(body);

  root.appendChild(buildFooter(active, root));

  const tab = tabs.get(active);
  if (tab) paintTab(root, tab, save, 'none');
  lastActive = active;
}

/** Switches the active tab in place: header/footer stay mounted, panels slide. */
export function switchHubTab(root: HTMLElement, save: SaveData, next: NavState): void {
  lastHubSave = save;
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
  lastHubSave = save;
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
  lastHubSave = null;
  removeMenuDismiss?.();
  removeMenuDismiss = null;
  if (notificationPollTimer) clearInterval(notificationPollTimer);
  notificationPollTimer = null;
}

export { back, home };
