/**
 * Screen mockups for Design Preview Mode.
 *
 * These are THEME/LAYOUT previews built purely from UI primitives and sample
 * data — they never read or mutate save data, progression or game state, so a
 * designer can open any screen without playing a match.
 */
import { el } from '../components/dom';
import {
  GameAvatar,
  GameBadge,
  GameButton,
  GameCard,
  GameCurrency,
  GameHeader,
  GameHeroCard,
  GameItemCard,
  GamePanel,
  GameProgressBar,
  GameRankBadge,
  GameSection,
  GameTabs,
  GameXPBar,
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

export function renderPreviewScreen(id: PreviewScreenId): HTMLElement {
  switch (id) {
    case 'components':
      return renderThemePreview();
    case 'main-menu':
      return mainMenu();
    case 'dashboard':
      return dashboard();
    case 'hero':
      return heroes();
    case 'inventory':
      return inventory();
    case 'shop':
      return shop();
    case 'profile':
      return profile();
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

function mainMenu(): HTMLElement {
  const cfg = getLayout().mainMenu;
  return el('div', { class: 'ftd-screen ftd-stack', 'data-preview': 'main-menu' }, [
    GamePanel({
      variant: 'glass',
      padding: 'lg',
      children: [
        el('p', { class: 'ftd-empty', text: `layout: ${cfg.layout} · logo: ${cfg.logoPosition} · nav: ${cfg.navigationStyle}` }),
        el('h1', { class: 'ftd-header__title', text: 'FRUIT TD' }),
        el('p', { class: 'ftd-header__sub', text: 'Slice. Hold the Wall.' }),
        el('div', { class: 'ftd-row' }, [
          GameButton({ label: cfg.primaryAction, tone: 'primary', size: 'lg' }),
          ...cfg.secondaryActions.map((a) => GameButton({ label: a, variant: 'outline' })),
        ]),
      ],
    }),
  ]);
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

function heroes(): HTMLElement {
  return el('div', { class: 'ftd-screen ftd-stack' }, [
    GameHeader('Heroes', 'Pick your slicer'),
    el('div', { class: 'ftd-grid' }, [
      GameHeroCard({ name: 'Jiju', role: 'Blade Dancer', level: 12, selected: true }),
      GameHeroCard({ name: 'Topfu', role: 'Guardian', level: 7 }),
      GameHeroCard({ name: 'Lagen', role: 'Sniper', level: 3 }),
      GameHeroCard({ name: 'Tripos', role: 'Locked', locked: true }),
    ]),
    GamePanel({ title: 'Hero progression', children: [GameXPBar(640, 1000, 12), GameProgressBar({ value: 3, max: 5, tone: 'tower', label: 'Perk points', showValue: true })] }),
  ]);
}

function inventory(): HTMLElement {
  return el('div', { class: 'ftd-screen ftd-stack' }, [
    GameHeader('Inventory', 'Blades, walls and consumables'),
    el('div', { class: 'ftd-grid' }, [
      GameItemCard({ name: 'Gold Blade', rarity: 'Legendary', icon: '🗡️', owned: true }),
      GameItemCard({ name: 'Melon Wall', rarity: 'Epic', icon: '🍉', owned: true }),
      GameItemCard({ name: 'Juice Pack', rarity: 'Common', icon: '🧃', owned: true }),
      GameItemCard({ name: 'Frost Blade', rarity: 'Rare', icon: '❄️' }),
    ]),
  ]);
}

function shop(): HTMLElement {
  return el('div', { class: 'ftd-screen ftd-stack' }, [
    GameHeader('Shop', 'Spend coins, not gameplay balance', [GameCurrency(12480, 'coins')]),
    el('div', { class: 'ftd-grid' }, [
      GameItemCard({ name: 'Gold Blade', rarity: 'Legendary', price: 1200, icon: '🗡️' }),
      GameItemCard({ name: 'Neon Wall', rarity: 'Epic', price: 800, icon: '🧱' }),
      GameItemCard({ name: 'VIP Bronze', rarity: 'Bundle', price: 500, icon: '👑' }),
    ]),
  ]);
}

function profile(): HTMLElement {
  return el('div', { class: 'ftd-screen ftd-stack' }, [
    el('div', { class: 'ftd-row' }, [GameAvatar('', 'Slicer', 'lg'), el('div', {}, [el('h2', { class: 'ftd-header__title', text: 'Slicer' }), GameRankBadge('Gold III')])]),
    el('div', { class: 'ftd-grid' }, [
      GameCard({ title: 'Best score', meta: '184,920', tone: 'accent' }),
      GameCard({ title: 'Waves cleared', meta: '1,204', tone: 'primary' }),
      GameCard({ title: 'Fruit sliced', meta: '92,113', tone: 'combo' }),
    ]),
    GamePanel({ title: 'Season progress', children: [GameProgressBar({ value: 72, max: 100, tone: 'xp', showValue: true })] }),
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
