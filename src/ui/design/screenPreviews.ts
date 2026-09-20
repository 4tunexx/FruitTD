/**
 * Design Preview Mode screens.
 *
 * Main menu / heroes / inventory / shop / profile render the REAL screen
 * modules against a throwaway sample save, so the preview always matches the
 * game. The remaining entries are still theme mockups.
 *
 * These are THEME/LAYOUT previews built purely from UI primitives and sample
 * data — they never read or mutate save data, progression or game state, so a
 * designer can open any screen without playing a match.
 */
import { el } from '../components/dom';
import { defaultSave, type SaveData } from '../../game/save';
import { renderMainMenu } from '../screens/mainMenu';
import { renderShop } from '../screens/shop';
import { renderInventory } from '../screens/inventory';
import { renderHeroScreen } from '../screens/heroes';
import { renderProfile } from '../screens/profile';
import {
  GameBadge,
  GameButton,
  GameCard,
  GameCurrency,
  GameHeader,
  GamePanel,
  GameProgressBar,
  GameRankBadge,
  GameSection,
  GameTabs,
} from '../components/primitives';
import { getLayout } from '../theme/layout';
import { renderThemePreview } from './themePreview';

export type PreviewScreenId =
  | 'main-menu'
  | 'dashboard'
  | 'hero'
  | 'inventory'
  | 'shop'
  | 'profile'
  | 'missions'
  | 'achievements'
  | 'settings'
  | 'hud'
  | 'popups'
  | 'components';

export const PREVIEW_SCREENS: { id: PreviewScreenId; label: string }[] = [
  { id: 'components', label: 'Components' },
  { id: 'main-menu', label: 'Main Menu' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'hero', label: 'Heroes' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'shop', label: 'Shop' },
  { id: 'profile', label: 'Profile' },
  { id: 'missions', label: 'Missions' },
  { id: 'achievements', label: 'Achievements' },
  { id: 'settings', label: 'Settings' },
  { id: 'hud', label: 'Game HUD' },
  { id: 'popups', label: 'Popups' },
];

/**
 * Sample save used to preview the REAL screens without a match or a profile.
 * It is a throwaway object: nothing here is written back to storage.
 */
function sampleSave(): SaveData {
  const save = defaultSave();
  save.nickname = 'Preview Slicer';
  save.coins = 4200;
  save.gems = 60;
  save.highScore = 8400;
  save.rankedScore = 5200;
  save.bestWave = 14;
  save.games = 42;
  save.bestCombo = 31;
  save.ownedSkins = ['blade-default', 'wall-brick', 'blade-gold'];
  save.bladeSkin = 'blade-gold';
  save.wallSkin = 'wall-brick';
  return save;
}

const noop = () => undefined;

/** Renders a real screen into a detached host (§8 Design Preview). */
function realScreen(render: (root: HTMLElement, save: SaveData) => void): HTMLElement {
  const host = el('div', { class: 'ftd-preview-host' });
  try {
    render(host, sampleSave());
  } catch (err) {
    host.appendChild(el('div', { class: 'ftd-empty', text: `Preview failed: ${String(err)}` }));
  }
  return host;
}

export function renderPreviewScreen(id: PreviewScreenId): HTMLElement {
  switch (id) {
    case 'components':
      return renderThemePreview();
    // These preview the ACTUAL screens, so the preview can never drift from
    // what the player sees (§12).
    case 'main-menu':
      return realScreen((root, save) => renderMainMenu(root, save, { onPlay: noop }));
    case 'hero':
      return realScreen((root, save) =>
        renderHeroScreen(root, save, { onEquip: noop, onBuy: noop }),
      );
    case 'inventory':
      return realScreen((root, save) =>
        renderInventory(root, save, { onEquip: noop, onSell: noop }),
      );
    case 'shop':
      return realScreen((root, save) => renderShop(root, save, { onBuy: noop }));
    case 'profile':
      return realScreen((root, save) => renderProfile(root, save, { bestCombo: save.bestCombo }));
    case 'dashboard':
      return dashboard();
    case 'missions':
      return missions();
    case 'achievements':
      return achievements();
    case 'settings':
      return settings();
    case 'hud':
      return hud();
    case 'popups':
      return renderThemePreview();
    default:
      return el('div', { class: 'ftd-empty', text: 'Unknown preview' });
  }
}


function dashboard(): HTMLElement {
  const cfg = getLayout().dashboard;
  return el('div', { class: 'ftd-screen ftd-stack', 'data-preview': 'dashboard' }, [
    GameHeader('Wall Command', `layout: ${cfg.layout} · art: ${cfg.heroArtwork}`, [GameCurrency(12480, 'coins'), GameRankBadge('Gold III')]),
    cfg.showAnnouncement ? GamePanel({ variant: 'outline', padding: 'sm', children: [el('p', { class: 'ftd-empty', text: 'WALL BRIEFING: daily supply drop is live.' })] }) : null,
    GameTabs(
      [
        { id: 'play', label: 'Play' },
        { id: 'profile', label: 'Profile' },
        { id: 'shop', label: 'Shop' },
        { id: 'quests', label: 'Quests', badge: '!' },
      ],
      'play',
      () => {},
    ),
    el('div', { class: 'ftd-grid' }, [
      GamePanel({ title: 'Campaign', children: [GameButton({ label: 'Deploy', tone: 'primary', block: true })] }),
      GamePanel({ title: 'Endless', children: [GameButton({ label: 'Deploy', variant: 'outline', block: true })] }),
      GamePanel({ title: 'Ranked', children: [GameButton({ label: 'Queue', tone: 'accent', block: true })] }),
    ]),
  ]);
}





function missions(): HTMLElement {
  return el('div', { class: 'ftd-screen ftd-stack' }, [
    GameHeader('Missions', 'Daily · Weekly · Monthly'),
    GameSection('Daily', [
      GamePanel({ variant: 'solid', children: [GameProgressBar({ value: 7, max: 10, tone: 'primary', label: 'Slice 10 boss fruit', showValue: true }), GameButton({ label: 'Claim', tone: 'success', size: 'sm' })] }),
      GamePanel({ variant: 'solid', children: [GameProgressBar({ value: 2, max: 5, tone: 'accent', label: 'Clear 5 waves', showValue: true })] }),
    ]),
  ]);
}

function achievements(): HTMLElement {
  return el('div', { class: 'ftd-screen ftd-stack' }, [
    GameHeader('Achievements', '32 / 120 unlocked'),
    el('div', { class: 'ftd-grid' }, [
      GameCard({ title: 'First Blood', meta: 'Slice your first fruit', tone: 'success', children: [GameBadge('UNLOCKED', 'success')] }),
      GameCard({ title: 'Wall Keeper', meta: 'Hold 20 waves', tone: 'primary', children: [GameProgressBar({ value: 12, max: 20, tone: 'primary' })] }),
      GameCard({ title: 'Juice Baron', meta: 'Earn 100k coins', tone: 'coins', children: [GameProgressBar({ value: 41, max: 100, tone: 'coins' })] }),
    ]),
  ]);
}

function settings(): HTMLElement {
  return el('div', { class: 'ftd-screen ftd-stack' }, [
    GameHeader('Settings', 'Audio & session'),
    GamePanel({
      children: [
        el('div', { class: 'ftd-row' }, [GameButton({ label: 'Mute sound', variant: 'outline' }), GameButton({ label: 'Reduced motion', variant: 'outline' })]),
        el('div', { class: 'ftd-row' }, [GameButton({ label: 'Log out', tone: 'danger', variant: 'ghost' })]),
      ],
    }),
  ]);
}

function hud(): HTMLElement {
  return el('div', { class: 'ftd-screen ftd-stack' }, [
    GameHeader('Game HUD', 'In-game panels'),
    el('div', { class: 'ftd-grid' }, [
      GamePanel({ title: 'Wave 12', subtitle: 'Boss incoming', variant: 'glass', children: [GameProgressBar({ value: 60, max: 100, tone: 'danger', label: 'Wave progress' })] }),
      GamePanel({ title: 'Tower', subtitle: 'Blender · Lv 3', variant: 'glass', children: [GameProgressBar({ value: 30, max: 100, tone: 'tower', label: 'Upgrade' }), GameButton({ label: 'Upgrade · 120', tone: 'coins', size: 'sm' })] }),
      GamePanel({ title: 'Combo', variant: 'glass', children: [el('p', { class: 'ftd-num', text: 'x8' }), GameProgressBar({ value: 45, max: 100, tone: 'combo' })] }),
    ]),
  ]);
}
