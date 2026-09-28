/**
 * Screen wiring — registers every Phase 2 screen with the navigation router.
 *
 * This is the single place that knows "nav state X renders into element Y with
 * renderer Z". Adding a screen means adding one entry here, not another ad-hoc
 * DOM toggle somewhere in the HUD (§1, §12).
 */

import './screens.css';
import './hub.css';
import { registerScreen, installScreenRouter, installNavLinks, installEscHandler } from './registry';
import { renderHub, switchHubTab, refreshHub, registerHubTab, resetHub, type HubOptions } from './hub';
import { homeHubTab, heroesHubTab, inventoryHubTab, shopHubTab, profileHubTab, coopHubTab } from './hubTabs';
import { renderNews } from './news';
import { renderSettings } from './settings';
import { navigation, type NavState } from '../../game/navigation';
import type { SaveData } from '../../game/save';
import type { HeroId } from '../../game/heroes';
import type { ProfileStats } from './profile';
import { loadLiveConfig } from '../../services/liveConfig';
import { LEGACY_MENU_PAGES, showLegacyMenuPage } from './legacyMenu';

/** Nav states painted inside the persistent hub shell (Panels 1–4), rather than as their own screen host. */
const HUB_TAB_STATES: readonly NavState[] = ['MAIN_MENU', 'HEROES', 'INVENTORY', 'SHOP', 'PROFILE', 'CO_OP'];

export interface ScreenHostCallbacks {
  /** Latest save — read fresh on every render so screens never show stale data. */
  getSave: () => SaveData;
  onPlay: () => void;
  onQuit?: () => void;
  onToggleSound: () => void;
  onLogout: () => void;
  onOpenDaily: () => void;
  onAdmin?: () => void;
  onBuyItem: (id: string) => void;
  onEquipItem: (id: string) => void;
  onUnequipItem?: (id: string) => void;
  onSellItem: (id: string) => void;
  onEquipHero: (id: HeroId) => void;
  onBuyHero: (id: HeroId) => void;
  getProfileStats?: () => ProfileStats;
  /** Optional lobby row for the main menu. */
  lobbyStrip?: () => HTMLElement | null;
  /** Shows a page inside the legacy lobby (quests / leaderboard / skills). */
  showLobbyPage?: (page: string) => void;
}

let callbacks: ScreenHostCallbacks | null = null;
/** True once the hub shell has painted at least once, so tab switches animate instead of rebuilding the frame. */
let hubMounted = false;
/** Which hub tab is currently painted, so a same-tab refresh (e.g. after buying an item) skips the slide animation. */
let activeHubTab: NavState | null = null;

function host(id: string): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.getElementById(id);
}

/** Re-renders whichever screen is currently on top. Call after the save changes. */
export function refreshCurrentScreen(): void {
  if (!callbacks) return;
  renderFor(navigation.state);
}

function renderFor(state: NavState): void {
  if (!callbacks) return;
  const save = callbacks.getSave();

  if (HUB_TAB_STATES.includes(state)) {
    const root = host('screen-hub');
    if (!root) return;
    if (!hubMounted) {
      renderHub(root, save, state, hubOptions());
      hubMounted = true;
    } else if (state === activeHubTab) {
      // Same tab, fresh data (e.g. after a buy/equip/sell) — repaint in
      // place, no slide animation.
      refreshHub(root, save, state);
    } else {
      switchHubTab(root, save, state);
    }
    activeHubTab = state;
    if (state === 'SHOP') {
      void loadLiveConfig(true).then(() => {
        if (navigation.state === 'SHOP') {
          const liveRoot = host('screen-hub');
          if (liveRoot) refreshHub(liveRoot, save, 'SHOP');
        }
      });
    }
    return;
  }

  switch (state) {
    case 'NEWS': {
      const root = host('screen-news');
      if (root) renderNews(root, save, callbacks.onOpenDaily);
      break;
    }
    case 'SETTINGS': {
      const root = host('screen-settings');
      if (root) renderSettings(root, save, { onToggleSound: callbacks.onToggleSound, onLogout: callbacks.onLogout });
      break;
    }
    default:
      break;
  }
}

function hubOptions(): HubOptions {
  if (!callbacks) throw new Error('installGameScreens must run before the hub renders');
  return {
    onPlay: callbacks.onPlay,
    onQuit: callbacks.onQuit,
    onAdmin: callbacks.onAdmin,
    onOpenDaily: callbacks.onOpenDaily,
  };
}

/** Registers all screens and starts the router. Call once at boot. */
export function installGameScreens(cb: ScreenHostCallbacks): void {
  callbacks = cb;
  hubMounted = false;
  activeHubTab = null;
  resetHub();

  registerHubTab(homeHubTab(() => cb.onPlay()));
  registerHubTab(heroesHubTab({ onEquip: cb.onEquipHero, onBuy: cb.onBuyHero }));
  registerHubTab(inventoryHubTab({ onEquip: cb.onEquipItem, onUnequip: cb.onUnequipItem, onSell: cb.onSellItem }));
  registerHubTab(shopHubTab({ onBuy: cb.onBuyItem }));
  registerHubTab(profileHubTab(() => cb.getProfileStats?.() ?? {}, cb.onPlay));
  registerHubTab(coopHubTab());

  // One shared host for every hub tab. Tabs are siblings, not overlays of
  // each other — only one hub tab is ever on screen, so each is registered
  // as a plain (non-overlay) screen sharing `screen-hub`; the registry's
  // "only one non-overlay screen visible" invariant does the rest, and BACK
  // from any tab falls through to MAIN_MENU exactly as it did before (§1, §10).
  for (const id of HUB_TAB_STATES) {
    registerScreen({
      id,
      elementId: 'screen-hub',
      onEnter: () => renderFor(id),
    });
  }

  registerScreen({
    id: 'NEWS',
    elementId: 'screen-news',
    overlay: true,
    onEnter: () => renderFor('NEWS'),
  });
  registerScreen({
    id: 'SETTINGS',
    elementId: 'screen-settings',
    overlay: true,
    onEnter: () => renderFor('SETTINGS'),
  });

  // Legacy lobby pages: one element, different page per nav state.
  for (const { id } of LEGACY_MENU_PAGES) {
    registerScreen({
      id,
      overlay: true,
      // A shared host must have one owner, not competing per-screen hide callbacks.
      setVisible: () => undefined,
    });
  }

  installScreenRouter();
  const showLegacy = (state: NavState) => {
    showLegacyMenuPage(state, host('hud-start'), cb.showLobbyPage ?? (() => undefined));
  };
  navigation.onChange((change) => showLegacy(change.to));
  showLegacy(navigation.state);
  installNavLinks();
  installEscHandler();
  navigation.installHistoryIntegration();
}

export { registerScreen, installScreenRouter } from './registry';
export { go, openScreen, back, home } from './registry';
