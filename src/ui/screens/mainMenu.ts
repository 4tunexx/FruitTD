/**
 * MAIN MENU (§2).
 *
 * A game main menu, not a website sidebar: one dominant PLAY action, a compact
 * identity strip, and large secondary destinations. The player should look at
 * this once and know to press PLAY.
 */

import { el, clear } from '../components/dom';
import { GameButton } from '../components/primitives';
import { openScreen } from './registry';
import { heroDef, MAX_HERO_LEVEL } from '../../game/heroes';
import { getHeroXpState } from '../../game/progression';
import { rankFromScore } from '../../game/requirements';
import { getTowerXpState } from '../../game/towerProgression';
import type { SaveData } from '../../game/save';
import type { NavState } from '../../game/navigation';

export interface MainMenuCallbacks {
  onPlay: () => void;
  onQuit?: () => void;
  onNews?: () => void;
  /** Optional lobby row (daily missions, latest achievement, season). */
  lobbyStrip?: () => HTMLElement | null;
}

interface MenuDestination {
  id: NavState;
  label: string;
  icon: string;
  hint: string;
}

const DESTINATIONS: MenuDestination[] = [
  { id: 'HEROES', label: 'Heroes', icon: '🗡', hint: 'Pick your slicer' },
  { id: 'INVENTORY', label: 'Inventory', icon: '🎒', hint: 'Gear you own' },
  { id: 'SHOP', label: 'Shop', icon: '🛒', hint: 'Blades & walls' },
  { id: 'MISSIONS', label: 'Missions', icon: '📜', hint: 'Daily rewards' },
  { id: 'RANKED', label: 'Ranked', icon: '🏆', hint: 'Climb the ladder' },
  { id: 'CO_OP', label: 'Co-op', icon: '👥', hint: 'Defend together' },
  { id: 'PROFILE', label: 'Profile', icon: '👤', hint: 'Your record' },
];

/** Compact identity strip: who am I, what level, how rich (§2, DoD). */
export function playerIdentity(save: SaveData): HTMLElement {
  const hero = heroDef(save.hero);
  const xp = getHeroXpState(save, save.hero);
  const rank = rankFromScore(save.rankedScore || save.highScore || 0);

  const avatar = el('img', {
    class: 'ftd-identity__avatar',
    src: save.avatar || '',
    alt: `${save.nickname || 'Slicer'} avatar`,
  });

  return el('div', { class: 'ftd-identity' }, [
    avatar,
    el('div', { class: 'ftd-identity__text' }, [
      el('p', { class: 'ftd-identity__name', text: save.nickname || 'Slicer' }),
      el('p', { class: 'ftd-identity__meta' }, [
        el('span', { class: 'ftd-identity__rank', text: rank.title }),
        el('span', { class: 'ftd-identity__sep', text: '·' }),
        el('span', { text: `${hero.name} Lv ${xp.level}` }),
      ]),
    ]),
    el('div', { class: 'ftd-identity__coins' }, [
      el('span', { class: 'ftd-identity__coin-icon', text: '🪙', 'aria-hidden': 'true' }),
      el('span', { class: 'ftd-identity__coin-value', text: save.coins.toLocaleString() }),
    ]),
  ]);
}

export function renderMainMenu(root: HTMLElement, save: SaveData, cb: MainMenuCallbacks): void {
  clear(root);
  root.classList.add('ftd-mainmenu');

  const hero = heroDef(save.hero);
  const xp = getHeroXpState(save, save.hero);
  const tower = getTowerXpState();

  // ── Top bar: identity + small utilities ──
  root.appendChild(
    el('header', { class: 'ftd-mainmenu__top' }, [
      playerIdentity(save),
      el('div', { class: 'ftd-mainmenu__utils' }, [
        GameButton({ label: 'News', variant: 'ghost', size: 'sm', onClick: () => cb.onNews?.() }),
        GameButton({
          label: 'Settings',
          variant: 'ghost',
          size: 'sm',
          onClick: () => openScreen('SETTINGS'),
        }),
        GameButton({
          label: 'Quit',
          variant: 'ghost',
          size: 'sm',
          tone: 'danger',
          onClick: () => cb.onQuit?.(),
        }),
      ]),
    ]),
  );

  // ── Centre stage: the PLAY call to action ──
  const stage = el('div', { class: 'ftd-mainmenu__stage' });

  const playPanel = el('div', { class: 'ftd-playcard' }, [
    el('p', { class: 'ftd-playcard__eyebrow', text: 'HOLD THE WALL' }),
    el('h1', { class: 'ftd-playcard__title' }, [
      el('span', { class: 'ftd-playcard__title-main', text: 'FRUIT' }),
      el('span', { class: 'ftd-playcard__title-accent', text: 'TD' }),
    ]),
    el('p', {
      class: 'ftd-playcard__tagline',
      text: 'The orchard turned. Sharpen your blade and hold the line.',
    }),
    GameButton({
      label: 'PLAY',
      tone: 'primary',
      size: 'lg',
      class: 'ftd-playcard__cta',
      onClick: () => cb.onPlay(),
    }),
    el('p', { class: 'ftd-playcard__mode', text: `Mode · ${save.mode.toUpperCase()}` }),
  ]);
  stage.appendChild(playPanel);

  // ── Current loadout, so a new player sees who they are playing as ──
  stage.appendChild(
    el('aside', { class: 'ftd-loadout' }, [
      el('p', { class: 'ftd-loadout__label', text: 'YOUR HERO' }),
      el('p', { class: 'ftd-loadout__hero', text: hero.name }),
      el('p', { class: 'ftd-loadout__title', text: hero.title }),
      el('div', { class: 'ftd-loadout__bar' }, [
        el('i', { style: `width:${Math.round(xp.progress * 100)}%` }),
      ]),
      el('p', {
        class: 'ftd-loadout__xp',
        text: xp.maxed
          ? `Lv ${MAX_HERO_LEVEL} · Mastered`
          : `Lv ${xp.level} · ${xp.xpIntoLevel}/${xp.xpForLevel} XP`,
      }),
      el('p', { class: 'ftd-loadout__tower', text: `Main Tower · Lv ${tower.level}` }),
      GameButton({
        label: 'Change hero',
        variant: 'outline',
        size: 'sm',
        block: true,
        onClick: () => openScreen('HEROES'),
      }),
    ]),
  );

  root.appendChild(stage);

  // ── Secondary destinations ──
  const nav = el('nav', { class: 'ftd-mainmenu__nav', 'aria-label': 'Game menu' });
  for (const dest of DESTINATIONS) {
    const tile = el('button', {
      class: 'ftd-navtile',
      type: 'button',
      'data-nav': dest.id,
    }, [
      el('span', { class: 'ftd-navtile__icon', text: dest.icon, 'aria-hidden': 'true' }),
      el('span', { class: 'ftd-navtile__label', text: dest.label }),
      el('span', { class: 'ftd-navtile__hint', text: dest.hint }),
    ]);
    nav.appendChild(tile);
  }
  root.appendChild(nav);

  // ── Lobby strip: missions + achievement + season (§3 bottom row) ──
  if (cb.lobbyStrip) {
    const strip = cb.lobbyStrip();
    if (strip) root.appendChild(strip);
  }
}
