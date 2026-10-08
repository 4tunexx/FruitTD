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
import { HERO_ABILITIES } from '../../game/heroAbilities';

export interface HeroScreenCallbacks {
  onEquip: (id: HeroId) => void;
  onBuy: (id: HeroId) => void;
  onLockedInfo?: (message: string) => void;
  onToggleAbility?: (id: string) => void;
  onUpgradeAbility?: (id: string) => void;
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
    el('p', { class: 'ftd-hero-perks__label', text: 'HERO MASTERY · PASSIVE SKILLS' }),
  ]);
  for (const perk of HERO_PERKS) {
    const rank = heroPerkRank(heroId, perk.id);
    const perkGlyph: Record<string, string> = { combo: '03', juice: '05', tower: '19', critical: '15', survival: '06' };
    const unlocked = xp.level >= perk.unlockLevel;
    perks.appendChild(
      el('div', { class: `ftd-hero-perk${unlocked ? '' : ' is-locked'}` }, [
        el('span', { class: 'ftd-hero-perk__name' }, [el('img', { src: `/assets/icons/sigil-${perkGlyph[perk.id] ?? '01'}.svg`, alt: '', style: 'width:30px;height:30px;object-fit:contain;vertical-align:middle;margin-right:8px;' }), el('span', { text: perk.name })]),
        el('span', {
          class: 'ftd-hero-perk__rank',
          text: unlocked ? `${rank}/${perk.maxRank}` : `Lv ${perk.unlockLevel}`,
        }),
      ]),
    );
  }
  detail.appendChild(perks);
  const powers = el('section', { class: 'ftd-hero-power-tree' }, [
    el('div', { class: 'ftd-hero-power-tree__head' }, [
      el('span', { class: 'ftd-hero-power-tree__eyebrow', text: 'POWER TREE' }),
      el('p', { class: 'ftd-hero-power-tree__hint', text: 'Six unlocks · spend skill points · equip up to three' }),
    ]),
  ]);
  const nodes = el('ol', { class: 'ftd-hero-power-tree__nodes' });
  const heroAbilities = HERO_ABILITIES.filter((item) => item.hero === heroId);
  heroAbilities.forEach((ability, index) => {
    const rank = save.heroAbilityRanks?.[ability.id] ?? 0;
    const unlocked = status.availability === 'owned' && xp.level >= ability.unlockLevel;
    const equipped = (save.heroAbilityLoadouts?.[heroId] ?? []).includes(ability.id);
    const state = !unlocked ? `LOCKED · LV ${ability.unlockLevel}` : equipped ? 'EQUIPPED' : 'READY';
    const actions = el('div', { class: 'ftd-power-node__actions' });
    if (rank < 3) {
      const upgrade = el('button', { type: 'button', class: 'ftd-power-node__action is-upgrade', text: 'UPGRADE · 1 SP' });
      upgrade.disabled = !unlocked || save.skillPoints < 1;
      upgrade.addEventListener('click', () => cb.onUpgradeAbility?.(ability.id));
      actions.appendChild(upgrade);
    }
    const canEquip = rank > 0 || ability.id === 'jiju-1';
    const toggle = el('button', { type: 'button', class: 'ftd-power-node__action', text: equipped ? 'UNEQUIP' : 'EQUIP' });
    toggle.disabled = !unlocked || !canEquip || (!equipped && (save.heroAbilityLoadouts?.[heroId] ?? []).length >= 3);
    toggle.addEventListener('click', () => cb.onToggleAbility?.(ability.id));
    actions.appendChild(toggle);
    const pips = el('div', { class: 'ftd-power-node__rank' }, [
      el('span', { class: 'ftd-power-node__rank-label', text: `RANK ${rank}/3` }),
      ...Array.from({ length: 3 }, (_, pip) => el('i', { class: pip < rank ? 'is-filled' : '' })),
    ]);
    nodes.appendChild(el('li', { class: `ftd-power-node${unlocked ? ' is-unlocked' : ' is-locked'}${equipped ? ' is-equipped' : ''}` }, [
      el('div', { class: 'ftd-power-node__rail' }, [
        el('div', { class: 'ftd-power-node__badge' }, [el('img', { src: ability.iconUrl, alt: '', loading: 'lazy' })]),
        el('span', { class: 'ftd-power-node__number', text: String(index + 1).padStart(2, '0') }),
      ]),
      el('div', { class: 'ftd-power-node__card' }, [
        el('div', { class: 'ftd-power-node__top' }, [
          el('h3', { class: 'ftd-power-node__title', text: ability.name }),
          el('span', { class: 'ftd-power-node__state', text: state }),
        ]),
        el('p', { class: 'ftd-power-node__description', text: ability.description }),
        el('div', { class: 'ftd-power-node__footer' }, [pips, actions]),
      ]),
    ]));
  });
  powers.appendChild(nodes);
  detail.appendChild(powers);

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
        label: status.requirement,
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
