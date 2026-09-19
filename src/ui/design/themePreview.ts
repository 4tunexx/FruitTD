/**
 * Theme Preview — the UI testing playground.
 * Renders every important primitive at once so theme changes can be judged
 * without playing a match.
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
  GameTooltip,
  GameXPBar,
  type Tone,
} from '../components/primitives';
import { confirmModal, GameToast, openSurface } from '../components/surface';

const TONES: Tone[] = ['primary', 'accent', 'success', 'warning', 'danger', 'xp', 'coins', 'tower', 'combo'];

export function renderThemePreview(): HTMLElement {
  const root = el('div', { class: 'ftd-stack ftd-screen', id: 'ftd-theme-preview' });

  root.appendChild(
    GameHeader('Theme Preview', 'Every FruitTD UI primitive, live-themed.', [
      GameButton({ label: 'Toast', tone: 'accent', variant: 'outline', onClick: () => GameToast('Wave cleared — +250 coins', 'success') }),
      GameButton({ label: 'Modal', tone: 'primary', onClick: () => void demoModal() }),
    ]),
  );

  root.appendChild(
    GameSection('Buttons', [
      el('div', { class: 'ftd-row' }, [
        GameButton({ label: 'Solid', tone: 'primary' }),
        GameButton({ label: 'Outline', tone: 'accent', variant: 'outline' }),
        GameButton({ label: 'Ghost', variant: 'ghost' }),
        GameButton({ label: 'Glass', tone: 'xp', variant: 'glass' }),
        GameButton({ label: 'Danger', tone: 'danger' }),
        GameButton({ label: 'Disabled', disabled: true }),
        GameButton({ label: 'Small', size: 'sm' }),
        GameButton({ label: 'Large', size: 'lg', tone: 'success' }),
      ]),
    ]),
  );

  root.appendChild(
    GameSection('Panels & cards', [
      el('div', { class: 'ftd-grid' }, [
        GamePanel({ title: 'Glass panel', subtitle: 'Default surface', variant: 'glass', children: [el('p', { class: 'ftd-empty', text: 'Wave 12 · Hold the wall.' })] }),
        GamePanel({ title: 'Solid panel', variant: 'solid', children: [GameProgressBar({ value: 62, max: 100, tone: 'tower', label: 'Tower integrity', showValue: true })] }),
        GamePanel({ title: 'Outline panel', variant: 'outline', children: [GameCard({ title: 'Combo x8', meta: 'Perfect slice streak', tone: 'combo', interactive: true })] }),
      ]),
    ]),
  );

  root.appendChild(
    GameSection('Badges, currency, rank', [
      el('div', { class: 'ftd-row' }, [
        ...TONES.map((tone) => GameBadge(tone.toUpperCase(), tone)),
        GameRankBadge('Gold III'),
        GameCurrency(12480, 'coins'),
        GameCurrency(340, 'gems'),
        GameAvatar('', 'Slicer', 'md'),
        GameTooltip(GameBadge('Hover me', 'accent'), 'Tooltips read from the theme too'),
      ]),
    ]),
  );

  root.appendChild(
    GameSection('Progress & XP', [
      GameXPBar(640, 1000, 14),
      GameProgressBar({ value: 82, max: 100, tone: 'success', label: 'Wall health', showValue: true }),
      GameProgressBar({ value: 45, max: 100, tone: 'combo', label: 'Super charge', size: 'lg' }),
    ]),
  );

  const tabBody = el('p', { class: 'ftd-empty', text: 'Play tab content' });
  root.appendChild(
    GameSection('Tabs & navigation', [
      GameTabs(
        [
          { id: 'play', label: 'Play' },
          { id: 'heroes', label: 'Heroes' },
          { id: 'shop', label: 'Shop' },
          { id: 'quests', label: 'Quests', badge: '!' },
        ],
        'play',
        (id) => {
          tabBody.textContent = `${id} tab content`;
        },
      ),
      tabBody,
    ]),
  );

  root.appendChild(
    GameSection('Hero & item cards', [
      el('div', { class: 'ftd-grid' }, [
        GameHeroCard({ name: 'Jiju', role: 'Blade Dancer', level: 12, selected: true }),
        GameHeroCard({ name: 'Topfu', role: 'Guardian', level: 7 }),
        GameHeroCard({ name: 'Lagen', role: 'Locked', locked: true }),
      ]),
      el('div', { class: 'ftd-grid' }, [
        GameItemCard({ name: 'Gold Blade', rarity: 'Legendary', price: 1200, icon: '🗡️' }),
        GameItemCard({ name: 'Melon Wall', rarity: 'Epic', price: 800, icon: '🍉', owned: true }),
        GameItemCard({ name: 'Juice Pack', rarity: 'Common', price: 120, icon: '🧃' }),
      ]),
    ]),
  );

  root.appendChild(
    GameSection('Overlays', [
      el('div', { class: 'ftd-row' }, [
        GameButton({ label: 'Drawer', variant: 'outline', onClick: () => openSurface({ kind: 'drawer', title: 'Navigation', content: [el('p', { class: 'ftd-empty', text: 'Mobile navigation drawer' })] }) }),
        GameButton({ label: 'Overlay', variant: 'outline', onClick: () => openSurface({ kind: 'overlay', size: 'lg', title: 'Inventory', content: [el('p', { class: 'ftd-empty', text: 'Overlay presentation' })] }) }),
        GameButton({ label: 'Fullscreen', variant: 'outline', onClick: () => openSurface({ kind: 'fullscreen', title: 'Hero Selection', content: [el('p', { class: 'ftd-empty', text: 'Fullscreen presentation' })] }) }),
        GameButton({ label: 'Confirm', tone: 'danger', variant: 'outline', onClick: () => void confirmModal({ title: 'Purchase', message: 'Buy Gold Blade for 1,200 coins?', tone: 'danger' }) }),
      ]),
    ]),
  );

  return root;
}

async function demoModal(): Promise<void> {
  const ok = await confirmModal({ title: 'Hero unlock', message: 'Unlock Lagen for 2,500 coins?', confirmLabel: 'Unlock' });
  GameToast(ok ? 'Hero unlocked (preview only)' : 'Cancelled', ok ? 'success' : 'default');
}
