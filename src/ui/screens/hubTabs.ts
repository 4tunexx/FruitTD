/**
 * Hub tab adapters — one per destination in the footer tab bar.
 *
 * Each adapter splits an existing screen's content into Panel 1 (primary
 * list/grid) and Panel 2 (contextual detail), reusing the real catalog,
 * hero and progression logic that `shop.ts` / `inventory.ts` / `heroes.ts` /
 * `profile.ts` already use — nothing here re-implements game rules, it only
 * re-lays-out what those modules already compute.
 */

import { el } from '../components/dom';
import { GameButton, GameCurrency } from '../components/primitives';
import { categoryTabs, emptyState } from './shell';
import { renderItemCard } from './itemCard';
import type { HubTab } from './hub';
import { openScreen } from './registry';
import {
  shopItems,
  inventoryItems,
  categoriesWithItems,
  canSellItem,
  isEquipped,
  findCatalogItem,
  type ItemCategory,
} from '../../game/catalog';
import { HEROES, MAX_HERO_LEVEL, heroDef, type HeroId } from '../../game/heroes';
import { getHeroXpState, nextHeroMilestone, type HeroAvailability } from '../../game/progression';
import { getAllHeroStatuses } from '../../game/progression/heroStatus';
import { HERO_PERKS } from '../../game/heroProgression';
import { heroPerkRank } from '../../game/heroPerkSave';
import { getTowerXpState } from '../../game/towerProgression';
import { rankFromScore, DEFAULT_RANK_TIERS } from '../../game/requirements';
import { Backpack, Home, ShoppingCart, Swords, UserRound, UsersRound } from 'lucide';
import { getTowerXpState as getMainTowerXpState } from '../../game/towerProgression';
import type { SaveData } from '../../game/save';
import type { HeroScreenCallbacks } from './heroes';
import type { ShopCallbacks } from './shop';
import type { InventoryCallbacks } from './inventory';
import type { ProfileStats } from './profile';
import { HUB_HOME } from './hub';

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  slicers: 'Slicers',
  walls: 'Walls',
  effects: 'Effects',
  cosmetics: 'Cosmetics',
  heroes: 'Heroes',
  special: 'Special',
};

/* ─────────────────────────── SHOP ─────────────────────────── */

let shopCategory = 'all';

function shopMain(cb: ShopCallbacks) {
  return (root: HTMLElement, save: SaveData) => {
    const available = shopItems(save);
    const categories = ['all', ...categoriesWithItems(available)];
    if (!categories.includes(shopCategory)) shopCategory = 'all';

    root.appendChild(
      categoryTabs(categories, shopCategory, CATEGORY_LABELS, (id) => {
        shopCategory = id;
        shopMain(cb)(root, save);
      }),
    );

    const filtered = shopCategory === 'all' ? available : shopItems(save, shopCategory as ItemCategory);

    if (!filtered.length) {
      root.appendChild(
        emptyState(
          available.length ? 'Nothing here yet' : 'You own everything',
          available.length ? 'Try another category.' : 'Every item in the shop is already in your inventory.',
        ),
      );
      return;
    }

    const grid = el('div', { class: 'ftd-item-grid' });
    for (const item of filtered) {
      grid.appendChild(
        renderItemCard(
          item,
          { mode: 'shop', owned: false, equipped: false, affordable: save.coins >= item.price },
          { onBuy: cb.onBuy },
        ),
      );
    }
    root.appendChild(grid);
  };
}

/** Panel 2 for the shop: what you can spend, and a jump back to what you own. */
function shopSub(save: SaveData, root: HTMLElement): void {
  root.appendChild(
    el('div', { class: 'ftd-hub-sub-card' }, [
      el('p', { class: 'ftd-hub-sub-card__label', text: 'YOUR BALANCE' }),
      GameCurrency(save.coins, 'coins'),
      save.gems ? GameCurrency(save.gems, 'gems') : null,
    ]),
  );
  root.appendChild(
    el('div', { class: 'ftd-hub-sub-card' }, [
      el('p', { class: 'ftd-hub-sub-card__label', text: 'ALREADY OWN GEAR?' }),
      el('p', { class: 'ftd-hub-sub-card__hint', text: 'Equip or sell it from your inventory.' }),
      GameButton({ label: 'Open inventory', variant: 'outline', size: 'sm', block: true, onClick: () => openScreen('INVENTORY') }),
    ]),
  );
}

export function shopHubTab(cb: ShopCallbacks): HubTab {
  return {
    id: 'SHOP',
    label: 'Shop',
    icon: ShoppingCart,
    renderMain: shopMain(cb),
    renderSub: (root, save) => shopSub(save, root),
  };
}

/* ───────────────────────── INVENTORY ───────────────────────── */

let inventoryCategory = 'all';

function inventoryMain(cb: InventoryCallbacks) {
  return (root: HTMLElement, save: SaveData) => {
    const owned = inventoryItems(save);
    const categories = ['all', ...categoriesWithItems(owned)];
    if (!categories.includes(inventoryCategory)) inventoryCategory = 'all';

    root.appendChild(
      categoryTabs(categories, inventoryCategory, CATEGORY_LABELS, (id) => {
        inventoryCategory = id;
        inventoryMain(cb)(root, save);
      }),
    );

    const filtered = inventoryCategory === 'all' ? owned : inventoryItems(save, inventoryCategory as ItemCategory);

    if (!filtered.length) {
      root.appendChild(
        emptyState(
          'Nothing here yet',
          'Buy gear in the shop and it will show up here.',
          GameButton({ label: 'Open shop', tone: 'primary', onClick: () => openScreen('SHOP') }),
        ),
      );
      return;
    }

    const grid = el('div', { class: 'ftd-item-grid' });
    for (const item of filtered) {
      const sellCheck = canSellItem(save, item.id);
      grid.appendChild(
        renderItemCard(
          item,
          {
            mode: 'inventory',
            owned: true,
            equipped: isEquipped(save, item),
            affordable: true,
            sellBlockedReason: sellCheck.ok ? undefined : sellCheck.message,
          },
          { onEquip: cb.onEquip, onUnequip: cb.onUnequip, onSell: cb.onSell },
        ),
      );
    }
    root.appendChild(grid);
  };
}

/** Panel 2 for inventory: "Equipped Items" — exactly what the sketch asked for. */
function inventorySub(save: SaveData, root: HTMLElement): void {
  const blade = save.bladeSkin ? findCatalogItem(save.bladeSkin) : null;
  const wall = save.wallSkin ? findCatalogItem(save.wallSkin) : null;

  root.appendChild(el('p', { class: 'ftd-hub-sub-card__label', text: 'EQUIPPED ITEMS' }));

  const slot = (label: string, item: typeof blade) =>
    el('div', { class: 'ftd-hub-sub-card' }, [
      el('p', { class: 'ftd-hub-sub-card__label', text: label }),
      el('p', { class: 'ftd-hub-sub-card__value', text: item?.name ?? 'None equipped' }),
      ...(item?.stats.length
        ? [el('ul', { class: 'ftd-hub-sub-card__stats' },
            item.stats.map((s) => el('li', {}, [
              el('span', { text: s.label }),
              el('span', { text: s.value }),
            ])))]
        : []),
    ]);

  root.appendChild(slot('BLADE', blade));
  root.appendChild(slot('WALL', wall));
}

export function inventoryHubTab(cb: InventoryCallbacks): HubTab {
  return {
    id: 'INVENTORY',
    label: 'Inventory',
    icon: Backpack,
    renderMain: inventoryMain(cb),
    renderSub: (root, save) => inventorySub(save, root),
  };
}

/* ─────────────────────────── HEROES ─────────────────────────── */

let selectedHero: HeroId | null = null;

function availabilityBadge(availability: HeroAvailability): HTMLElement {
  const map: Record<HeroAvailability, { text: string; cls: string }> = {
    owned: { text: 'OWNED', cls: 'is-owned' },
    locked: { text: 'LOCKED', cls: 'is-locked' },
    purchasable: { text: 'BUY', cls: 'is-buy' },
  };
  const info = map[availability];
  return el('span', { class: `ftd-hero-state ${info.cls}`, text: info.text });
}

function heroesMain(cb: HeroScreenCallbacks) {
  return (root: HTMLElement, save: SaveData) => {
    if (!selectedHero || !HEROES.some((h) => h.id === selectedHero)) selectedHero = save.hero;

    const roster = el('div', { class: 'ftd-hero-roster ftd-hero-roster--hub' });
    for (const status of getAllHeroStatuses(save)) {
      const def = heroDef(status.heroId);
      const xp = getHeroXpState(save, status.heroId);
      const isSelected = status.heroId === selectedHero;
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
        selectedHero = status.heroId;
        heroesMain(cb)(root, save);
        const detail = document.querySelector('.ftd-hub__sub .ftd-hero-detail');
        detail?.classList.add('is-entering');
      });
      roster.appendChild(tile);
    }
    root.replaceChildren(roster);
  };
}

/** Panel 2 for heroes: the big detail card — art, level, perks, action. */
function heroesSub(cb: HeroScreenCallbacks) {
  return (root: HTMLElement, save: SaveData) => {
    if (!selectedHero) selectedHero = save.hero;
    const heroId = selectedHero;
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
        el('div', { class: 'ftd-hero-detail__bar' }, [el('i', { style: `width:${Math.round(xp.progress * 100)}%` })]),
        ...(milestone
          ? [el('p', { class: 'ftd-hero-detail__milestone', text: `Next milestone · Lv ${milestone.level} — ${milestone.reward}` })]
          : []),
      ]),
    ]);

    const perks = el('div', { class: 'ftd-hero-perks' }, [el('p', { class: 'ftd-hero-perks__label', text: 'ABILITIES' })]);
    for (const perk of HERO_PERKS) {
      const rank = heroPerkRank(heroId, perk.id);
      const unlocked = xp.level >= perk.unlockLevel;
      perks.appendChild(
        el('div', { class: `ftd-hero-perk${unlocked ? '' : ' is-locked'}` }, [
          el('span', { class: 'ftd-hero-perk__name', text: perk.name }),
          el('span', { class: 'ftd-hero-perk__rank', text: unlocked ? `${rank}/${perk.maxRank}` : `Lv ${perk.unlockLevel}` }),
        ]),
      );
    }
    detail.appendChild(perks);

    const actions = el('div', { class: 'ftd-hero-detail__actions' });
    if (status.availability === 'owned') {
      const equipped = save.hero === heroId;
      actions.appendChild(
        GameButton({
          label: equipped ? 'Equipped' : 'Equip',
          tone: 'primary', size: 'lg', block: true, disabled: equipped,
          onClick: () => cb.onEquip(heroId),
        }),
      );
    } else if (status.availability === 'purchasable') {
      const affordable = status.canAfford;
      actions.appendChild(
        GameButton({
          label: affordable ? `Buy · ${(status.purchaseCost ?? 0).toLocaleString()} coins` : 'Not enough coins',
          tone: affordable ? 'primary' : 'default', size: 'lg', block: true, disabled: !affordable,
          onClick: () => cb.onBuy(heroId),
        }),
      );
    } else {
      actions.appendChild(
        GameButton({ label: `🔒 ${status.requirement}`, variant: 'outline', size: 'lg', block: true, disabled: true }),
      );
    }
    detail.appendChild(actions);

    root.replaceChildren(detail);
  };
}

export function heroesHubTab(cb: HeroScreenCallbacks): HubTab {
  return {
    id: 'HEROES',
    label: 'Heroes',
    icon: Swords,
    renderMain: heroesMain(cb),
    renderSub: heroesSub(cb),
  };
}

/* ─────────────────────────── PROFILE ─────────────────────────── */

function statCard(label: string, value: string, hint?: string): HTMLElement {
  return el('div', { class: 'ftd-stat' }, [
    el('p', { class: 'ftd-stat__label', text: label }),
    el('p', { class: 'ftd-stat__value', text: value }),
    ...(hint ? [el('p', { class: 'ftd-stat__hint', text: hint })] : []),
  ]);
}

function profileMain(getStats: () => ProfileStats, onPlay?: () => void) {
  return (root: HTMLElement, save: SaveData) => {
    const stats = getStats();
    const grid = el('div', { class: 'ftd-stat-grid' }, [
      statCard('Highest wave', String(save.bestWave ?? 1)),
      statCard('Highest score', (save.highScore ?? 0).toLocaleString()),
      statCard('Ranked score', (save.rankedScore ?? 0).toLocaleString()),
      statCard('Games played', String(save.games ?? 0)),
      statCard('Best combo', stats.bestCombo ? `×${stats.bestCombo}` : '—'),
      statCard('Coins', (save.coins ?? 0).toLocaleString()),
      statCard('Achievements', stats.achievementsTotal ? `${stats.achievementsUnlocked ?? 0}/${stats.achievementsTotal}` : String(stats.achievementsUnlocked ?? 0)),
      statCard('Season', stats.season ?? 'Season 1'),
    ]);
    root.appendChild(grid);
    root.appendChild(
      el('div', { class: 'ftd-profile-actions' }, [
        ...(onPlay ? [GameButton({ label: 'Play now', tone: 'primary', size: 'lg', onClick: onPlay })] : []),
        GameButton({ label: 'Missions', variant: 'outline', onClick: () => openScreen('MISSIONS') }),
        GameButton({ label: 'Achievements', variant: 'outline', onClick: () => openScreen('ACHIEVEMENTS') }),
        GameButton({ label: 'Ranked', variant: 'outline', onClick: () => openScreen('RANKED') }),
        GameButton({ label: 'Co-op lobby', variant: 'outline', onClick: () => openScreen('CO_OP') }),
        GameButton({ label: 'Settings', variant: 'ghost', onClick: () => openScreen('SETTINGS') }),
      ]),
    );
  };
}

/** Panel 2 for profile: identity banner + mastery bars. */
function profileSub(root: HTMLElement, save: SaveData): void {
  const hero = heroDef(save.hero);
  const heroXp = getHeroXpState(save, save.hero);
  const tower = getTowerXpState();
  const best = save.rankedScore || save.highScore || 0;
  const rank = rankFromScore(best);
  const nextRank = DEFAULT_RANK_TIERS.filter((t) => t.minScore > best).sort((a, b) => a.minScore - b.minScore)[0];

  const banner = el('div', { class: 'ftd-profile-banner' }, [
    el('img', { class: 'ftd-profile-banner__avatar', src: save.avatar || '', alt: `${save.nickname || 'Slicer'} avatar` }),
    el('div', { class: 'ftd-profile-banner__text' }, [
      el('h2', { class: 'ftd-profile-banner__name', text: save.nickname || 'Slicer' }),
      el('div', { class: 'ftd-profile-banner__badges' }, [
        el('span', { class: 'ftd-profile-rank', text: rank.title }),
        el('span', { class: 'ftd-profile-hero', text: `Main · ${hero.name}` }),
      ]),
      ...(nextRank
        ? [el('p', { class: 'ftd-profile-banner__next', text: `${(nextRank.minScore - best).toLocaleString()} score to ${nextRank.title}` })]
        : [el('p', { class: 'ftd-profile-banner__next', text: 'Top rank reached' })]),
    ]),
  ]);
  banner.style.setProperty('--rank-color', rank.color);
  root.appendChild(banner);

  root.appendChild(
    el('div', { class: 'ftd-profile-mastery' }, [
      el('div', { class: 'ftd-profile-mastery__block' }, [
        el('p', { class: 'ftd-profile-mastery__label', text: 'HERO MASTERY' }),
        el('p', { class: 'ftd-profile-mastery__value', text: `${hero.name} · Lv ${heroXp.level}/${MAX_HERO_LEVEL}` }),
        el('div', { class: 'ftd-profile-bar' }, [el('i', { style: `width:${Math.round(heroXp.progress * 100)}%` })]),
      ]),
      el('div', { class: 'ftd-profile-mastery__block' }, [
        el('p', { class: 'ftd-profile-mastery__label', text: 'MAIN TOWER' }),
        el('p', { class: 'ftd-profile-mastery__value', text: `Level ${tower.level}` }),
        el('div', { class: 'ftd-profile-bar ftd-profile-bar--tower' }, [el('i', { style: `width:${Math.round(tower.progress * 100)}%` })]),
      ]),
    ]),
  );
}

export function profileHubTab(getStats: () => ProfileStats, onPlay?: () => void): HubTab {
  return {
    id: 'PROFILE',
    label: 'Profile',
    icon: UserRound,
    renderMain: profileMain(getStats, onPlay),
    renderSub: profileSub,
  };
}

/* ─────────────────────────── CO-OP (placeholder) ─────────────────────────── */

export function coopHubTab(): HubTab {
  return {
    id: 'CO_OP',
    label: 'Co-op',
    icon: UsersRound,
    renderMain: (root) => {
      root.appendChild(emptyState('Co-op is warming up', 'Invite a friend from the lobby once matchmaking is live.'));
    },
  };
}

/* ─────────────────────────── HOME (PLAY stage) ─────────────────────────── */

/**
 * The default tab: reachable from the Home footer destination and header logo.
 * Panel 1 is the PLAY call-to-action; Panel 2 is the active-hero loadout. This
 * is exactly what used to be `.ftd-mainmenu__stage` before the hub existed.
 */
function homeMain(onPlay: () => void) {
  return (root: HTMLElement, save: SaveData) => {
    const playPanel = el('div', { class: 'ftd-playcard' }, [
      el('p', { class: 'ftd-playcard__eyebrow', text: 'HOLD THE WALL' }),
      el('h1', { class: 'ftd-playcard__title' }, [
        el('span', { class: 'ftd-playcard__title-main', text: 'FRUIT' }),
        el('span', { class: 'ftd-playcard__title-accent', text: 'TD' }),
      ]),
      el('p', { class: 'ftd-playcard__tagline', text: 'The orchard turned. Sharpen your blade and hold the line.' }),
      GameButton({ label: 'PLAY', tone: 'primary', size: 'lg', class: 'ftd-playcard__cta', onClick: onPlay }),
      el('p', { class: 'ftd-playcard__mode', text: `Mode · ${save.mode.toUpperCase()}` }),
    ]);
    root.appendChild(playPanel);
    playPanel.querySelector('.ftd-playcard__cta')?.setAttribute('data-testid', 'nav-play');
  };
}

function homeSub(root: HTMLElement, save: SaveData): void {
  const hero = heroDef(save.hero);
  const xp = getHeroXpState(save, save.hero);
  const tower = getMainTowerXpState();
  const rank = rankFromScore(save.rankedScore || save.highScore || 0);

  root.appendChild(
    el('aside', { class: 'ftd-loadout' }, [
      el('p', { class: 'ftd-loadout__label', text: 'ACTIVE OPERATIVE' }),
      el('p', { class: 'ftd-loadout__hero', text: hero.name }),
      el('p', { class: 'ftd-loadout__title', text: hero.title }),
      el('div', { class: 'ftd-loadout__bar' }, [el('i', { style: `width:${Math.round(xp.progress * 100)}%` })]),
      el('p', {
        class: 'ftd-loadout__xp',
        text: xp.maxed ? `Lv ${MAX_HERO_LEVEL} · Mastered` : `Lv ${xp.level} · ${xp.xpIntoLevel}/${xp.xpForLevel} XP`,
      }),
      el('p', { class: 'ftd-loadout__tower', text: `Main Tower · Lv ${tower.level}` }),
      GameButton({ label: 'Change hero', variant: 'outline', size: 'sm', block: true, onClick: () => openScreen('HEROES') }),
      el('div', { class: 'ftd-loadout__career', 'aria-label': 'Career progression' }, [
        el('div', { class: 'ftd-loadout__stat' }, [el('span', { text: 'RANK' }), el('strong', { text: rank.title })]),
        el('div', { class: 'ftd-loadout__stat' }, [el('span', { text: 'BEST WAVE' }), el('strong', { text: String(save.bestWave) })]),
        el('div', { class: 'ftd-loadout__stat' }, [el('span', { text: 'HIGH SCORE' }), el('strong', { text: save.highScore.toLocaleString() })]),
        el('div', { class: 'ftd-loadout__stat' }, [el('span', { text: 'MATCHES' }), el('strong', { text: String(save.games) })]),
      ]),
    ]),
  );
}

export function homeHubTab(onPlay: () => void): HubTab {
  return {
    id: HUB_HOME,
    label: 'Home',
    icon: Home,
    renderMain: homeMain(onPlay),
    renderSub: homeSub,
  };
}
