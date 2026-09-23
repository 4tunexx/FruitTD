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
import { createElement, Backpack, Coins, Gem, Medal, ScrollText, ShoppingCart, Swords, Trophy, UserRound, UsersRound } from 'lucide';
import { isUserAdmin } from '../../services/admin';
import { heroDef, MAX_HERO_LEVEL } from '../../game/heroes';
import { getHeroXpState } from '../../game/progression';
import { rankFromScore } from '../../game/requirements';
import { getTowerXpState } from '../../game/towerProgression';
import type { SaveData } from '../../game/save';
import type { NavState } from '../../game/navigation';

export interface MainMenuCallbacks {
  onPlay: () => void;
  onQuit?: () => void;
  onAdmin?: () => void;
  /** Optional lobby row (daily missions, latest achievement, season). */
  lobbyStrip?: () => HTMLElement | null;
}

interface MenuDestination {
  id: NavState;
  label: string;
  icon: typeof Swords;
  hint: string;
}

const DESTINATIONS: MenuDestination[] = [
  { id: 'HEROES', label: 'Heroes', icon: Swords, hint: 'Pick your slicer' },
  { id: 'INVENTORY', label: 'Inventory', icon: Backpack, hint: 'Gear you own' },
  { id: 'SHOP', label: 'Shop', icon: ShoppingCart, hint: 'Blades & walls' },
  { id: 'MISSIONS', label: 'Missions', icon: ScrollText, hint: 'Daily rewards' },
  { id: 'ACHIEVEMENTS', label: 'Achievements', icon: Medal, hint: 'Career marks' },
  { id: 'RANKED', label: 'Ranked', icon: Trophy, hint: 'Climb the ladder' },
  { id: 'CO_OP', label: 'Co-op', icon: UsersRound, hint: 'Defend together' },
  { id: 'PROFILE', label: 'Profile', icon: UserRound, hint: 'Your record' },
];

function icon(node: typeof Swords, className: string): HTMLElement | SVGElement {
  // The app uses Lucide SVGs; the lightweight Node test DOM has no SVG factory.
  if (typeof document.createElementNS !== 'function') return el('span', { class: className, 'aria-hidden': 'true' });
  return createElement(node, { class: className, width: 18, height: 18, 'aria-hidden': 'true' });
}

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
      icon(Coins, 'ftd-identity__currency-icon'),
      el('span', { class: 'ftd-identity__coin-value', text: save.coins.toLocaleString() }),
    ]),
    el('div', { class: 'ftd-identity__gems', title: 'Gems' }, [
      icon(Gem, 'ftd-identity__currency-icon'),
      el('span', { class: 'ftd-identity__gem-value', text: save.gems.toLocaleString() }),
    ]),
  ]);
}

export function renderMainMenu(root: HTMLElement, save: SaveData, cb: MainMenuCallbacks): void {
  clear(root);
  root.classList.add('ftd-mainmenu');

  const hero = heroDef(save.hero);
  const xp = getHeroXpState(save, save.hero);
  const tower = getTowerXpState();
  const rank = rankFromScore(save.rankedScore || save.highScore || 0);

  // ── Top bar: identity + small utilities ──
  root.appendChild(
    el('header', { class: 'ftd-mainmenu__top' }, [
      playerIdentity(save),
      el('div', { class: 'ftd-mainmenu__utils' }, [
        GameButton({ label: 'News', variant: 'ghost', size: 'sm', onClick: () => openScreen('NEWS') }),
        GameButton({
          label: 'Settings',
          variant: 'ghost',
          size: 'sm',
          onClick: () => openScreen('SETTINGS'),
        }),
        ...(cb.onAdmin
          ? [GameButton({
            label: isUserAdmin() ? 'Admin' : 'Admin access',
            variant: 'ghost',
            size: 'sm',
            class: 'ftd-mainmenu__admin',
            onClick: cb.onAdmin,
          })]
          : []),
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
  playPanel.querySelector('.ftd-playcard__cta')?.setAttribute('data-testid', 'combat-play-button');

  // ── Current loadout, so a new player sees who they are playing as ──
  stage.appendChild(
    el('aside', { class: 'ftd-loadout' }, [
      el('p', { class: 'ftd-loadout__label', text: 'ACTIVE OPERATIVE' }),
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
      el('div', { class: 'ftd-loadout__career', 'aria-label': 'Career progression' }, [
        el('div', { class: 'ftd-loadout__stat' }, [
          el('span', { text: 'RANK' }),
          el('strong', { text: rank.title }),
        ]),
        el('div', { class: 'ftd-loadout__stat' }, [
          el('span', { text: 'BEST WAVE' }),
          el('strong', { text: String(save.bestWave) }),
        ]),
        el('div', { class: 'ftd-loadout__stat' }, [
          el('span', { text: 'HIGH SCORE' }),
          el('strong', { text: save.highScore.toLocaleString() }),
        ]),
        el('div', { class: 'ftd-loadout__stat' }, [
          el('span', { text: 'MATCHES' }),
          el('strong', { text: String(save.games) }),
        ]),
      ]),
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
      icon(dest.icon, 'ftd-navtile__icon'),
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
