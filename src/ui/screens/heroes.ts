/**
 * HERO SCREEN (§5).
 *
 * Large artwork, level 1–100, XP bar, perks, unlock state, and one clear
 * action per hero: EQUIP / BUY / LOCKED. Selecting animates the preview.
 */

import { el } from '../components/dom';
import { screenShell } from './shell';
import { GameButton } from '../components/primitives';
import { HEROES, MAX_HERO_LEVEL, heroDef, type HeroId } from '../../game/heroes';
import { getHeroXpState, nextHeroMilestone, type HeroAvailability } from '../../game/progression';
import { getAllHeroStatuses } from '../../game/progression/heroStatus';
import { HERO_PERKS } from '../../game/heroProgression';
import { heroPerkRank } from '../../game/heroPerkSave';
import type { SaveData } from '../../game/save';

export interface HeroScreenCallbacks {
  onEquip: (id: HeroId) => void;
  onBuy: (id: HeroId) => void;
  onLockedInfo?: (message: string) => void;
}

let selected: HeroId | null = null;

function availabilityBadge(availability: HeroAvailability): HTMLElement {
  const map: Record<HeroAvailability, { text: string; cls: string }> = {
    owned: { text: 'OWNED', cls: 'is-owned' },
    locked: { text: 'LOCKED', cls: 'is-locked' },
    purchasable: { text: 'BUY', cls: 'is-buy' },
  };
  const info = map[availability];
  return el('span', { class: `ftd-hero-state ${info.cls}`, text: info.text });
}

/** Big preview for the currently selected hero. */
function heroDetail(save: SaveData, heroId: HeroId, cb: HeroScreenCallbacks): HTMLElement {
  const def = heroDef(heroId);
  const xp = getHeroXpState(save, heroId);
  const status = getAllHeroStatuses(save).find((s) => s.heroId === heroId)!;
  const milestone = nextHeroMilestone(xp.level);

  const art = el('div', { class: 'ftd-hero-art' });
  art.style.setProperty('--hero-color', `#${def.color.toString(16).padStart(6, '0')}`);
  art.style.setProperty('--hero-trail', `#${def.trail.toString(16).padStart(6, '0')}`);
  art.appendChild(el('span', { class: 'ftd-hero-art__glow' }));
  art.appendChild(el('span', { class: 'ftd-hero-art__initial', text: def.name.charAt(0) }));

  const detail = el('div', { class: 'ftd-hero-detail', 'data-hero': heroId }, [
    art,
    el('div', { class: 'ftd-hero-detail__body' }, [
      el('div', { class: 'ftd-hero-detail__head' }, [
        el('h2', { class: 'ftd-hero-detail__name', text: def.name }),
        availabilityBadge(status.availability),
      ]),
      el('p', { class: 'ftd-hero-detail__title', text: def.title }),
      el('p', { class: 'ftd-hero-detail__blurb', text: def.blurb }),

      // Level + XP
      el('div', { class: 'ftd-hero-detail__level' }, [
        el('span', {
          class: 'ftd-hero-detail__lv',
          text: xp.maxed ? `Lv ${MAX_HERO_LEVEL} MAX` : `Lv ${xp.level} / ${MAX_HERO_LEVEL}`,
        }),
        el('span', {
          class: 'ftd-hero-detail__xp',
          text: xp.maxed ? 'Mastered' : `${xp.xpIntoLevel} / ${xp.xpForLevel} XP`,
        }),
      ]),
      el('div', { class: 'ftd-hero-detail__bar' }, [
        el('i', { style: `width:${Math.round(xp.progress * 100)}%` }),
      ]),
      ...(milestone
        ? [
            el('p', {
              class: 'ftd-hero-detail__milestone',
              text: `Next milestone · Lv ${milestone.level} — ${milestone.reward}`,
            }),
          ]
        : []),
    ]),
  ]);

  // Perks
  const perks = el('div', { class: 'ftd-hero-perks' }, [
    el('p', { class: 'ftd-hero-perks__label', text: 'ABILITIES' }),
  ]);
  for (const perk of HERO_PERKS) {
    const rank = heroPerkRank(heroId, perk.id);
    const unlocked = xp.level >= perk.unlockLevel;
    perks.appendChild(
      el('div', { class: `ftd-hero-perk${unlocked ? '' : ' is-locked'}` }, [
        el('span', { class: 'ftd-hero-perk__name', text: perk.name }),
        el('span', {
          class: 'ftd-hero-perk__rank',
          text: unlocked ? `${rank}/${perk.maxRank}` : `Lv ${perk.unlockLevel}`,
        }),
      ]),
    );
  }
  detail.appendChild(perks);

  // Primary action
  const actions = el('div', { class: 'ftd-hero-detail__actions' });
  if (status.availability === 'owned') {
    const equipped = save.hero === heroId;
    actions.appendChild(
      GameButton({
        label: equipped ? 'Equipped' : 'Equip',
        tone: 'primary',
        size: 'lg',
        block: true,
        disabled: equipped,
        onClick: () => cb.onEquip(heroId),
      }),
    );
  } else if (status.availability === 'purchasable') {
    const affordable = status.canAfford;
    actions.appendChild(
      GameButton({
        label: affordable ? `Buy · ${(status.purchaseCost ?? 0).toLocaleString()} coins` : 'Not enough coins',
        tone: affordable ? 'primary' : 'default',
        size: 'lg',
        block: true,
        disabled: !affordable,
        onClick: () => cb.onBuy(heroId),
      }),
    );
  } else {
    actions.appendChild(
      GameButton({
        label: `🔒 ${status.requirement}`,
        variant: 'outline',
        size: 'lg',
        block: true,
        disabled: true,
      }),
    );
  }
  detail.appendChild(actions);

  return detail;
}

export function renderHeroScreen(root: HTMLElement, save: SaveData, cb: HeroScreenCallbacks): void {
  const body = screenShell(root, {
    title: 'Heroes',
    subtitle: 'Choose who holds the wall.',
    save,
  });

  if (!selected || !HEROES.some((h) => h.id === selected)) selected = save.hero;

  const layout = el('div', { class: 'ftd-hero-layout' });

  // Roster rail
  const roster = el('div', { class: 'ftd-hero-roster' });
  for (const status of getAllHeroStatuses(save)) {
    const def = heroDef(status.heroId);
    const xp = getHeroXpState(save, status.heroId);
    const isSelected = status.heroId === selected;
    const tile = el('button', {
      class: [
        'ftd-hero-tile',
        `is-${status.availability}`,
        isSelected ? 'is-selected' : '',
        save.hero === status.heroId ? 'is-equipped' : '',
      ].filter(Boolean).join(' '),
      type: 'button',
    }, [
      el('span', { class: 'ftd-hero-tile__name', text: def.name }),
      el('span', {
        class: 'ftd-hero-tile__lv',
        text: status.availability === 'owned' ? `Lv ${xp.level}` : status.requirement,
      }),
      availabilityBadge(status.availability),
    ]);
    tile.style.setProperty('--hero-color', `#${def.color.toString(16).padStart(6, '0')}`);
    tile.addEventListener('click', () => {
      selected = status.heroId;
      renderHeroScreen(root, save, cb);
      // Replay the entry animation so selection feels responsive (§11).
      const detail = root.querySelector('.ftd-hero-detail');
      detail?.classList.add('is-entering');
    });
    roster.appendChild(tile);
  }
  layout.appendChild(roster);

  const detailHost = el('div', { class: 'ftd-hero-detail-host' });
  detailHost.appendChild(heroDetail(save, selected, cb));
  layout.appendChild(detailHost);

  body.appendChild(layout);
}

export function resetHeroView(): void {
  selected = null;
}

