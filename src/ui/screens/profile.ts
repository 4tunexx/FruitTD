/**
 * PROFILE (§4) — a game profile, not an account settings page.
 *
 * Everything here is read from the save and the progression layer, so the
 * numbers can never disagree with what the game awarded.
 */

import { el } from '../components/dom';
import { screenShell } from './shell';
import { GameButton } from '../components/primitives';
import { openScreen } from './registry';
import { heroDef, MAX_HERO_LEVEL } from '../../game/heroes';
import { getHeroXpState } from '../../game/progression';
import { getTowerXpState } from '../../game/towerProgression';
import { MAX_TOWER_LEVEL } from '../../game/world';
import { rankFromScore, DEFAULT_RANK_TIERS } from '../../game/requirements';
import type { SaveData } from '../../game/save';

export interface ProfileStats {
  /** Best combo reached, tracked by the match runtime. */
  bestCombo?: number;
  achievementsUnlocked?: number;
  achievementsTotal?: number;
  season?: string;
}

function statCard(label: string, value: string, hint?: string): HTMLElement {
  return el('div', { class: 'ftd-stat' }, [
    el('p', { class: 'ftd-stat__label', text: label }),
    el('p', { class: 'ftd-stat__value', text: value }),
    ...(hint ? [el('p', { class: 'ftd-stat__hint', text: hint })] : []),
  ]);
}

export function renderProfile(root: HTMLElement, save: SaveData, stats: ProfileStats = {}): void {
  const body = screenShell(root, { title: 'Profile', subtitle: 'Your record so far.', save });

  const hero = heroDef(save.hero);
  const heroXp = getHeroXpState(save, save.hero);
  const tower = getTowerXpState();
  const best = save.rankedScore || save.highScore || 0;
  const rank = rankFromScore(best);
  const nextRank = DEFAULT_RANK_TIERS.filter((t) => t.minScore > best).sort(
    (a, b) => a.minScore - b.minScore,
  )[0];

  // ── Identity banner ──
  const banner = el('div', { class: 'ftd-profile-banner' }, [
    el('img', {
      class: 'ftd-profile-banner__avatar',
      src: save.avatar || '',
      alt: `${save.nickname || 'Slicer'} avatar`,
    }),
    el('div', { class: 'ftd-profile-banner__text' }, [
      el('h2', { class: 'ftd-profile-banner__name', text: save.nickname || 'Slicer' }),
      el('div', { class: 'ftd-profile-banner__badges' }, [
        el('span', { class: 'ftd-profile-rank', text: rank.title }),
        el('span', { class: 'ftd-profile-hero', text: `Main · ${hero.name}` }),
        ...(save.vipStatus && save.vipStatus !== 'none'
          ? [el('span', { class: 'ftd-profile-vip', text: `${save.vipStatus.toUpperCase()} VIP` })]
          : []),
      ]),
      ...(nextRank
        ? [
            el('p', {
              class: 'ftd-profile-banner__next',
              text: `${(nextRank.minScore - best).toLocaleString()} score to ${nextRank.title}`,
            }),
          ]
        : [el('p', { class: 'ftd-profile-banner__next', text: 'Top rank reached' })]),
    ]),
  ]);
  banner.style.setProperty('--rank-color', rank.color);
  body.appendChild(banner);

  // ── Mastery: hero + tower progression ──
  const mastery = el('div', { class: 'ftd-profile-mastery' }, [
    el('div', { class: 'ftd-profile-mastery__block' }, [
      el('p', { class: 'ftd-profile-mastery__label', text: 'HERO MASTERY' }),
      el('p', { class: 'ftd-profile-mastery__value', text: `${hero.name} · Lv ${heroXp.level}/${MAX_HERO_LEVEL}` }),
      el('div', { class: 'ftd-profile-bar' }, [
        el('i', { style: `width:${Math.round(heroXp.progress * 100)}%` }),
      ]),
    ]),
    el('div', { class: 'ftd-profile-mastery__block' }, [
      el('p', { class: 'ftd-profile-mastery__label', text: 'MAIN TOWER' }),
      el('p', { class: 'ftd-profile-mastery__value', text: `Level ${tower.level}/${MAX_TOWER_LEVEL}` }),
      el('div', { class: 'ftd-profile-bar ftd-profile-bar--tower' }, [
        el('i', { style: `width:${Math.round(tower.progress * 100)}%` }),
      ]),
    ]),
  ]);
  body.appendChild(mastery);

  // ── Career stats ──
  const grid = el('div', { class: 'ftd-stat-grid' }, [
    statCard('Highest wave', String(save.bestWave ?? 1)),
    statCard('Highest score', (save.highScore ?? 0).toLocaleString()),
    statCard('Ranked score', (save.rankedScore ?? 0).toLocaleString()),
    statCard('Games played', String(save.games ?? 0)),
    statCard('Best combo', stats.bestCombo ? `×${stats.bestCombo}` : '—'),
    statCard('Coins', (save.coins ?? 0).toLocaleString()),
    statCard(
      'Achievements',
      stats.achievementsTotal
        ? `${stats.achievementsUnlocked ?? 0}/${stats.achievementsTotal}`
        : String(stats.achievementsUnlocked ?? 0),
    ),
    statCard('Season', stats.season ?? 'Season 1'),
  ]);
  body.appendChild(grid);

  body.appendChild(
    el('div', { class: 'ftd-profile-actions' }, [
      GameButton({ label: 'Achievements', variant: 'outline', onClick: () => openScreen('ACHIEVEMENTS') }),
      GameButton({ label: 'Heroes', variant: 'outline', onClick: () => openScreen('HEROES') }),
      GameButton({ label: 'Settings', variant: 'ghost', onClick: () => openScreen('SETTINGS') }),
    ]),
  );
}
