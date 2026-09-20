/**
 * Screen wiring — registers every Phase 2 screen with the navigation router.
 *
 * This is the single place that knows "nav state X renders into element Y with
 * renderer Z". Adding a screen means adding one entry here, not another ad-hoc
 * DOM toggle somewhere in the HUD (§1, §12).
 */

import './screens.css';
import { registerScreen, installScreenRouter, installNavLinks, installEscHandler } from './registry';
import { renderMainMenu, type MainMenuCallbacks } from './mainMenu';
import { renderShop } from './shop';
import { renderInventory } from './inventory';
import { renderHeroScreen } from './heroes';
import { renderProfile, type ProfileStats } from './profile';
import { renderNews } from './news';
import { renderSettings } from './settings';
import { screenShell, emptyState } from './shell';
import { navigation, type NavState } from '../../game/navigation';
import type { SaveData } from '../../game/save';
import type { HeroId } from '../../game/heroes';

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
  switch (state) {
    case 'MAIN_MENU': {
      const root = host('screen-main-menu');
      if (root) {
        const menuCb: MainMenuCallbacks = {
          onPlay: callbacks.onPlay,
          onQuit: callbacks.onQuit,
          onAdmin: callbacks.onAdmin,
          lobbyStrip: callbacks.lobbyStrip,
        };
        renderMainMenu(root, save, menuCb);
      }
      break;
    }
    case 'HEROES': {
      const root = host('screen-heroes');
      if (root) {
        renderHeroScreen(root, save, {
          onEquip: callbacks.onEquipHero,
          onBuy: callbacks.onBuyHero,
        });
      }
      break;
    }
    case 'INVENTORY': {
      const root = host('screen-inventory');
      if (root) {
        renderInventory(root, save, {
          onEquip: callbacks.onEquipItem,
          onSell: callbacks.onSellItem,
        });
      }
      break;
    }
    case 'SHOP': {
      const root = host('screen-shop');
      if (root) renderShop(root, save, { onBuy: callbacks.onBuyItem });
      break;
    }
    case 'PROFILE': {
      const root = host('screen-profile');
      if (root) renderProfile(root, save, callbacks.getProfileStats?.() ?? {});
      break;
    }
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
    // MISSIONS / ACHIEVEMENTS / RANKED reuse the existing lobby pages and their
    // working logic rather than duplicating them into new screens (§12).
    case 'CO_OP': {
      const root = host('screen-coop');
      if (root) {
        const body = screenShell(root, { title: 'Co-op', subtitle: 'Hold the wall together.', save });
        body.appendChild(emptyState('Co-op is warming up', 'Invite a friend from the lobby once matchmaking is live.'));
      }
      break;
    }
    default:
      break;
  }
}

/** Registers all screens and starts the router. Call once at boot. */
export function installGameScreens(cb: ScreenHostCallbacks): void {
  callbacks = cb;

  const defs: Array<{ id: NavState; elementId: string; overlay?: boolean }> = [
    { id: 'MAIN_MENU', elementId: 'screen-main-menu' },
    { id: 'HEROES', elementId: 'screen-heroes', overlay: true },
    { id: 'INVENTORY', elementId: 'screen-inventory', overlay: true },
    { id: 'SHOP', elementId: 'screen-shop', overlay: true },
    { id: 'PROFILE', elementId: 'screen-profile', overlay: true },
    { id: 'NEWS', elementId: 'screen-news', overlay: true },
    { id: 'SETTINGS', elementId: 'screen-settings', overlay: true },
    { id: 'CO_OP', elementId: 'screen-coop', overlay: true },
  ];

  for (const def of defs) {
    registerScreen({
      id: def.id,
      elementId: def.elementId,
      overlay: def.overlay,
      // Render on entry so a screen always shows current data.
      onEnter: () => renderFor(def.id),
    });
  }

  // Legacy lobby pages: one element, different page per nav state.
  const legacyPages: Array<{ id: NavState; page: string }> = [
    { id: 'MISSIONS', page: 'quests' },
    { id: 'ACHIEVEMENTS', page: 'profile' },
    { id: 'RANKED', page: 'leaderboard' },
  ];
  for (const { id, page } of legacyPages) {
    registerScreen({
      id,
      overlay: true,
      setVisible: (visible) => {
        const gate = document.getElementById('hud-start');
        if (!gate) return;
        gate.classList.toggle('hidden', !visible);
        if (visible) cb.showLobbyPage?.(page);
      },
    });
  }

  installScreenRouter();
  installNavLinks();
  installEscHandler();
  navigation.installHistoryIntegration();
}

export { registerScreen, installScreenRouter } from './registry';
export { go, openScreen, back, home } from './registry';
