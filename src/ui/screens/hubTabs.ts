import { bindArenaRating } from '../../services/pvpRating';
import { renderModeStats } from './modeStats';
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
import { getAdminSprite } from '../adminSprites';
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
import { currentSeasonLabel } from '../../game/requirements';
import { Backpack, Home, Map as MapIcon, ShoppingCart, Shield, Swords, UserRound, UsersRound, Waves, createElement } from 'lucide';
import { getTowerXpState as getMainTowerXpState } from '../../game/towerProgression';
import type { SaveData } from '../../game/save';
import type { HeroScreenCallbacks } from './heroes';
import type { ShopCallbacks } from './shop';
import type { InventoryCallbacks } from './inventory';
import type { ProfileStats } from './profile';
import { HUB_HOME } from './hub';
import { fetchDailyBonusStatus, fetchMissions } from '../../services/api';

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
    root.replaceChildren();
    const available = shopItems(save);
    const categories = ['all', ...categoriesWithItems(available)];
    if (!categories.includes(shopCategory)) shopCategory = 'all';

    root.appendChild(el('div', { class: 'ftd-hub-catalog-heading' }, [
      el('div', {}, [el('p', { text: 'ARMORY / SUPPLIES' }), el('h1', { text: 'SHOP' })]),
      el('span', { text: `${available.length} ITEMS AVAILABLE` }),
    ]));

    root.appendChild(
      categoryTabs(categories, shopCategory, CATEGORY_LABELS, (id) => {
        shopCategory = id;
        shopMain(cb)(root, save);
        root.parentElement?.scrollTo?.({ top: 0 });
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
    root.replaceChildren();
    const owned = inventoryItems(save);
    const categories = ['all', ...categoriesWithItems(owned)];
    if (!categories.includes(inventoryCategory)) inventoryCategory = 'all';

    root.appendChild(el('div', { class: 'ftd-hub-catalog-heading' }, [
      el('div', {}, [el('p', { text: 'YOUR LOADOUT' }), el('h1', { text: 'INVENTORY' })]),
      el('span', { text: `${owned.length} ITEMS OWNED` }),
    ]));

    root.appendChild(
      categoryTabs(categories, inventoryCategory, CATEGORY_LABELS, (id) => {
        inventoryCategory = id;
        inventoryMain(cb)(root, save);
        root.parentElement?.scrollTo?.({ top: 0 });
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
function inventorySub(save: SaveData, root: HTMLElement, onEquip: (id: string) => void): void {
  const blade = save.bladeSkin ? findCatalogItem(save.bladeSkin) : null;
  const wall = save.wallSkin ? findCatalogItem(save.wallSkin) : null;

  root.appendChild(el('p', { class: 'ftd-hub-sub-card__label', text: 'EQUIPPED ITEMS' }));

  const slot = (label: string, item: typeof blade, starterId: string) =>
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
      ...(!item ? [GameButton({ label: `Equip ${label.toLowerCase()}`, variant: 'outline', onClick: () => onEquip(starterId) })] : []),
    ]);

  root.appendChild(slot('BLADE', blade, 'blade-default'));
  root.appendChild(slot('WALL', wall, 'wall-brick'));
}

export function inventoryHubTab(cb: InventoryCallbacks): HubTab {
  return {
    id: 'INVENTORY',
    label: 'Inventory',
    icon: Backpack,
    renderMain: inventoryMain(cb),
    renderSub: (root, save) => inventorySub(save, root, cb.onEquip),
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
        const detailRoot = root.closest('.ftd-hub')
          ?.querySelector('.ftd-hub__sub')
          ?.querySelector<HTMLElement>('.ftd-hub-panel-content');
        if (detailRoot) heroesSub(cb)(detailRoot, save);
        const detail = detailRoot?.querySelector('.ftd-hero-detail');
        detail?.classList.add('is-entering');
      });
      roster.appendChild(tile);
    }
    root.replaceChildren(el('div', { class: 'ftd-hub-catalog-heading' }, [
      el('div', {}, [el('p', { text: 'CHOOSE YOUR OPERATIVE' }), el('h1', { text: 'HEROES' })]),
      el('span', { text: `${HEROES.length} HEROES` }),
    ]), roster);
  };
}

/** Panel 2 for heroes: the big detail card — art, level, perks, action. */
function heroesSub(cb: HeroScreenCallbacks) {
  return (root: HTMLElement, save: SaveData) => {
    root.replaceChildren();
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
    const sprite = getAdminSprite(`hero-${heroId}` as Parameters<typeof getAdminSprite>[0]);
    if (sprite) art.appendChild(el('img', { class: 'ftd-hero-art__sprite', src: sprite, alt: `${def.name} character art` }));
    else art.appendChild(el('span', { class: 'ftd-hero-art__figure', 'aria-hidden': 'true' }, [
      el('i', { class: 'ftd-hero-art__head' }),
      el('i', { class: 'ftd-hero-art__body' }),
      el('i', { class: 'ftd-hero-art__weapon' }),
    ]));

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
        GameButton({ label: status.requirement, variant: 'outline', size: 'lg', block: true, disabled: true }),
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

function profileMain(getStats: () => ProfileStats) {
  return (root: HTMLElement, save: SaveData) => {
    const stats = getStats();
    root.appendChild(el('div', { class: 'ftd-hub-catalog-heading' }, [
      el('div', {}, [el('p', { text: 'CAREER RECORD' }), el('h1', { text: 'PROFILE' })]),
      el('span', { text: save.nickname || 'SLICER' }),
    ]));
    const grid = el('div', { class: 'ftd-stat-grid' }, [
      statCard('Highest wave', String(save.bestWave ?? 1)),
      statCard('Highest score', (save.highScore ?? 0).toLocaleString()),
      statCard('Ranked Arena', 'Loading rank…'),
      statCard('Games played', String(save.games ?? 0)),
      statCard('Best combo', stats.bestCombo ? `×${stats.bestCombo}` : '—'),
      statCard('Coins', (save.coins ?? 0).toLocaleString()),
      statCard('Achievements', stats.achievementsTotal ? `${stats.achievementsUnlocked ?? 0}/${stats.achievementsTotal}` : String(stats.achievementsUnlocked ?? 0)),
      statCard('Season', stats.season ?? currentSeasonLabel()),
    ]);
    root.appendChild(grid);
    renderModeStats(root);
    const rankCard = grid.children[2]?.querySelector<HTMLElement>('.ftd-stat__value');
    bindArenaRating(rankCard);
    root.appendChild(
      el('div', { class: 'ftd-profile-actions' }, [
        GameButton({ label: 'Missions', variant: 'outline', onClick: () => openScreen('MISSIONS') }),
        GameButton({ label: 'Achievements', variant: 'outline', onClick: () => openScreen('ACHIEVEMENTS') }),
        GameButton({ label: 'Ranked', variant: 'outline', onClick: () => openScreen('RANKED') }),
        GameButton({ label: 'Leaderboard', variant: 'outline', onClick: () => openScreen('LEADERBOARD') }),
        GameButton({ label: 'Local Co-op', variant: 'outline', onClick: () => openScreen('CO_OP') }),
        GameButton({ label: 'Settings', variant: 'outline', onClick: () => openScreen('SETTINGS') }),
      ]),
    );
  };
}

/** Panel 2 for profile: identity banner + mastery bars. */
function profileSub(root: HTMLElement, save: SaveData): void {
  const hero = heroDef(save.hero);
  const heroXp = getHeroXpState(save, save.hero);
  const tower = getTowerXpState();

  const banner = el('div', { class: 'ftd-profile-banner' }, [
    el('img', { class: 'ftd-profile-banner__avatar', src: save.avatar || '', alt: `${save.nickname || 'Slicer'} avatar` }),
    el('div', { class: 'ftd-profile-banner__text' }, [
      el('h2', { class: 'ftd-profile-banner__name', text: save.nickname || 'Slicer' }),
      el('div', { class: 'ftd-profile-banner__badges' }, [
        el('span', { class: 'ftd-profile-rank', text: 'Unranked' }),
        el('span', { class: 'ftd-profile-hero', text: `Main · ${hero.name}` }),
      ]),
      el('p', { class: 'ftd-profile-banner__next', text: 'Ranked Arena rating' }),
      el('p', { class: 'ftd-profile-banner__record' }),
    ]),
  ]);
  bindArenaRating(banner.querySelector<HTMLElement>('.ftd-profile-rank'));
  bindArenaRating(banner.querySelector<HTMLElement>('.ftd-profile-banner__next'), 'progress');
  bindArenaRating(banner.querySelector<HTMLElement>('.ftd-profile-banner__record'), 'record');
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

export function profileHubTab(getStats: () => ProfileStats): HubTab {
  return {
    id: 'PROFILE',
    label: 'Profile',
    icon: UserRound,
    renderMain: profileMain(getStats),
    renderSub: profileSub,
  };
}

/* ─────────────────────────── CO-OP ─────────────────────────── */

export function coopHubTab(onStart?: () => void): HubTab {
  return {
    id: 'CO_OP',
    label: 'Co-op',
    icon: UsersRound,
    renderMain: (root) => {
      void import('./onlineCoop').then(({ renderOnlineCoop }) => {
        if (root.isConnected) renderOnlineCoop(root, () => onStart?.());
      });
    },
    renderSub: (root) => {
      root.appendChild(el('aside', { class: 'ftd-hub-context' }, [
        el('p', { class: 'ftd-hub-context__eyebrow', text: 'ONLINE TEAM PLAY' }),
        el('h2', { text: 'Defend together' }),
        el('p', { text: 'Both online players use mouse or touch to slice fruit and build shared defenses.' }),
        el('p', { text: 'Create a private room for a friend or find a random teammate.' }),
        el('p', { text: 'The wall and Fruts are shared. Each connected account receives the same match rewards.' }),
        GameButton({ label: 'Choose another mode', variant: 'outline', block: true, onClick: () => openScreen('MAIN_MENU') }),
      ]));
    },
  };
}

/* ─────────────────────────── HOME (PLAY stage) ─────────────────────────── */

/**
 * The default tab: reachable from the Home footer destination and header logo.
 * Panel 1 is the PLAY call-to-action; Panel 2 is the active-hero loadout. This
 * is exactly what used to be `.ftd-mainmenu__stage` before the hub existed.
 */
function modeGlyph(node: typeof Swords): HTMLElement | SVGElement {
  if (typeof document.createElementNS !== 'function') return el('span', { class: 'ftd-mode-card__icon', text: '✦', 'aria-hidden': 'true' });
  return createElement(node, { class: 'ftd-mode-card__icon', width: 23, height: 23, 'aria-hidden': 'true' });
}

function homeMain(onPlay: () => void, onMode?: (mode: import('../../game/save').GameMode) => void, onCampaign?: () => void) {
  return (root: HTMLElement, save: SaveData) => {
    const playContent = el('div', { class: 'ftd-playcard__content' }, [
      el('p', { class: 'ftd-playcard__eyebrow', text: 'ORCHARD OUTPOST / READY FOR ACTION' }),
      el('h1', { class: 'ftd-playcard__title' }, [
        el('span', { class: 'ftd-playcard__title-main', text: 'FRUIT' }),
        el('span', { class: 'ftd-playcard__title-accent', text: 'TD' }),
      ]),
      el('p', { class: 'ftd-playcard__tagline', text: 'SLICE. BUILD. SURVIVE.' }),
      el('p', { class: 'ftd-playcard__brief', text: 'Swipe the fruit. Power your defences. Keep the wall standing.' }),
      GameButton({ label: 'BATTLE!', tone: 'primary', size: 'lg', class: 'ftd-playcard__cta', onClick: onPlay }),
      el('p', { class: 'ftd-playcard__mode', text: `${save.mode.toUpperCase()} / READY TO DEPLOY` }),
    ]);
    playContent.querySelector('.ftd-playcard__cta')?.setAttribute('data-testid', 'nav-play');
    const modes = el('section', { class: 'ftd-mode-select', 'aria-label': 'Game modes' }, [
      el('div', { class: 'ftd-mode-select__heading' }, [el('h2', { text: 'CHOOSE YOUR RUN' }), el('span', { text: 'CAMPAIGN · STAGE ' + String(save.campaignProgress.unlocked).padStart(2, '0') })]),
      el('div', { class: 'ftd-mode-select__grid' }),
    ]);
    const grid = modes.querySelector('.ftd-mode-select__grid')!;
    const entries = [
      { id: 'casual' as const, name: 'Casual', note: 'Learn the lanes', icon: Shield },
      { id: 'horde' as const, name: 'Horde', note: 'Endless · highest wave wins', icon: Waves },
    ];
    entries.forEach((mode) => {
      const button = el('button', { type: 'button', class: `ftd-mode-card${save.mode === mode.id ? ' is-active' : ''}`, 'aria-pressed': String(save.mode === mode.id), 'data-testid': `mode-${mode.id}` }, [modeGlyph(mode.icon), el('span', { class: 'ftd-mode-card__copy' }, [el('strong', { text: mode.name }), el('small', { text: mode.note })])]);
      button.addEventListener('click', () => onMode?.(mode.id)); grid.appendChild(button);
    });
    const campaign = el('button', { type: 'button', class: 'ftd-mode-card ftd-mode-card--campaign', 'data-testid': 'campaign-open' }, [modeGlyph(MapIcon), el('span', { class: 'ftd-mode-card__copy' }, [el('strong', { text: 'Campaign' }), el('small', { text: '100 stages · bosses · rewards' })])]);
    campaign.addEventListener('click', () => onCampaign?.()); grid.appendChild(campaign);
    const coop = el('button', { type: 'button', class: 'ftd-mode-card', 'data-testid': 'mode-coop' }, [modeGlyph(UsersRound), el('span', { class: 'ftd-mode-card__copy' }, [el('strong', { text: 'Co-op' }), el('small', { text: 'Squad up · play together' })])]);
    coop.addEventListener('click', () => openScreen('CO_OP')); grid.appendChild(coop);
    const arena = el('button', { type: 'button', class: 'ftd-mode-card', 'data-testid': 'mode-arena' }, [modeGlyph(Swords), el('span', { class: 'ftd-mode-card__copy' }, [el('strong', { text: 'Arena PvP' }), el('small', { text: 'Tower siege · Normal or Ranked' })])]);
    arena.addEventListener('click', () => openScreen('ARENA')); grid.appendChild(arena);
    const shortcuts = el('nav', { class: 'ftd-outpost-shortcuts', 'aria-label': 'Outpost shortcuts' }, [
      GameButton({ label: 'MISSIONS', variant: 'outline', onClick: () => openScreen('MISSIONS') }),
      GameButton({ label: 'RANKINGS', variant: 'outline', onClick: () => openScreen('LEADERBOARD') }),
      GameButton({ label: 'GEAR UP', variant: 'outline', onClick: () => openScreen('INVENTORY') }),
    ]);
    root.appendChild(el('div', { class: 'ftd-playcard' }, [el('div', { class: 'ftd-outpost-art', 'aria-hidden': 'true' }), shortcuts, playContent, modes]));
  };
}

function homeSub(root: HTMLElement, save: SaveData): void {
  const hero = heroDef(save.hero);
  const xp = getHeroXpState(save, save.hero);
  const tower = getMainTowerXpState();

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
        el('div', { class: 'ftd-loadout__stat' }, [el('span', { text: 'RANKED ARENA' }), el('strong', { class: 'ftd-loadout__rank', text: 'Unranked' })]),
        el('div', { class: 'ftd-loadout__stat' }, [el('span', { text: 'BEST WAVE' }), el('strong', { text: String(save.bestWave) })]),
        el('div', { class: 'ftd-loadout__stat' }, [el('span', { text: 'HIGH SCORE' }), el('strong', { text: save.highScore.toLocaleString() })]),
        el('div', { class: 'ftd-loadout__stat' }, [el('span', { text: 'MATCHES' }), el('strong', { text: String(save.games) })]),
      ]),
      missionProgressPanel(),
    ]),
  );
  bindArenaRating(root.querySelector<HTMLElement>('.ftd-loadout__rank'));
}

function missionProgressPanel(): HTMLElement {
  const panel = el('section', { class: 'ftd-mission-progress', 'aria-label': 'Mission progress', 'data-testid': 'home-mission-progress' });
  const rows = new Map<'daily' | 'main', { fill: HTMLElement; value: HTMLElement }>();
  for (const type of ['daily', 'main'] as const) {
    const label = type === 'daily' ? 'DAILY MISSIONS' : 'MAIN MISSIONS';
    const row = el('div', { class: 'ftd-mission-progress__row ftd-mission-progress__row--' + type }, [
      el('div', { class: 'ftd-mission-progress__heading' }, [el('span', { text: label }), el('strong', { text: '—' })]),
      el('div', { class: 'ftd-mission-progress__track', role: 'progressbar', 'aria-label': label, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, [el('i')]),
    ]);
    rows.set(type, { fill: row.querySelector('i')!, value: row.querySelector('strong')! });
    panel.appendChild(row);
  }

  const loginMission = el('button', {
    class: 'ftd-mission-login',
    type: 'button',
    'data-testid': 'daily-login-mission',
    'aria-label': 'Open daily login reward',
  }, [
    el('span', { class: 'ftd-mission-login__mark', text: '✓', 'aria-hidden': 'true' }),
    el('span', { class: 'ftd-mission-login__copy' }, [
      el('strong', { text: 'DAILY LOGIN' }),
      el('small', { text: 'Claim today’s supply to complete this mission.' }),
    ]),
    el('span', { class: 'ftd-mission-login__status', text: 'CHECKING' }),
  ]);
  loginMission.addEventListener('click', () => document.getElementById('btn-daily-chip')?.click());
  panel.appendChild(loginMission);

  void Promise.all([fetchMissions(), fetchDailyBonusStatus()]).then(([result, bonus]) => {
    if (!panel.isConnected) return;
    const loginDone = !!bonus && !bonus.canClaim;
    const status = loginMission.querySelector<HTMLElement>('.ftd-mission-login__status');
    const description = loginMission.querySelector<HTMLElement>('.ftd-mission-login__copy small');
    loginMission.classList.toggle('is-complete', loginDone);
    if (status) status.textContent = bonus ? (loginDone ? 'COMPLETE' : 'CLAIM REWARD') : 'SIGN IN';
    if (description) description.textContent = bonus
      ? (loginDone ? 'Today’s reward claimed. Come back tomorrow.' : 'Claim today’s supply to complete this mission.')
      : 'Sign in to track and claim today’s login reward.';
    if (!result) return;
    for (const type of ['daily', 'main'] as const) {
      const items = result.missions.filter((mission) => mission.type === type);
      const completed = items.filter((mission) => mission.completed).length + (type === 'daily' && loginDone ? 1 : 0);
      const total = items.length + (type === 'daily' && bonus ? 1 : 0);
      const percent = total ? Math.round((completed / total) * 100) : 0;
      const row = rows.get(type)!;
      row.value.textContent = completed + '/' + total;
      row.fill.style.width = String(percent) + '%';
      row.fill.parentElement?.setAttribute('aria-valuenow', String(percent));
    }
  }).catch(() => undefined);
  return panel;
}

export function homeHubTab(onPlay: () => void, onMode?: (mode: import('../../game/save').GameMode) => void, onCampaign?: () => void): HubTab {
  return {
    id: HUB_HOME,
    label: 'Home',
    icon: Home,
    renderMain: homeMain(onPlay, onMode, onCampaign),
    renderSub: homeSub,
  };
}
