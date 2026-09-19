/**
 * Unified item catalog — ONE source of truth for everything ownable.
 *
 * The shop and the inventory are two different *views* over this catalog:
 *
 *   SHOP      = catalog items the player does NOT own  ("what can I buy")
 *   INVENTORY = catalog items the player DOES own       ("what do I own")
 *
 * They must never be merged into a single list (§6, §7). Both read from here,
 * so an item can never exist in one view and not the other.
 */

import { HEROES, type HeroId } from './heroes';
import { heroPrice } from './progression/heroEconomy';
import type { CatalogSlicer, SlicerRarity } from './slicers';
import { getEnabledSlicers } from '../services/liveConfig';
import { WALL_SKINS, type SaveData } from './save';

export type ItemCategory = 'slicers' | 'walls' | 'effects' | 'cosmetics' | 'heroes' | 'special';
export type { SlicerRarity };

/** Slot an item occupies when equipped. `null` = not equippable. */
export type EquipSlot = 'blade' | 'wall' | 'hero' | null;

export interface CatalogItem {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  rarity: SlicerRarity;
  /** Coin price. 0 = free/starter. */
  price: number;
  /** Coins returned when sold. 0 = cannot be sold. */
  sellValue: number;
  slot: EquipSlot;
  /** Primary colour for swatches/previews (#rrggbb). */
  color: string;
  /** Secondary glow colour (#rrggbb). */
  glowColor: string;
  /** Starter items are always owned and can never be sold. */
  starter: boolean;
  /** Gameplay modifiers, shown on the card so value is visible (§8). */
  stats: ItemStat[];
  /** Full slicer record, when this item is a blade. */
  slicer?: CatalogSlicer;
}

export interface ItemStat {
  label: string;
  value: string;
  /** True when the stat is better than baseline, for accent colouring. */
  positive: boolean;
}

export const STARTER_ITEMS = ['blade-default', 'wall-brick'] as const;

export function isStarterItem(id: string): boolean {
  return (STARTER_ITEMS as readonly string[]).includes(id);
}

const RARITY_ORDER: Record<SlicerRarity, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
};

export function rarityRank(rarity: SlicerRarity): number {
  return RARITY_ORDER[rarity] ?? 0;
}

function hexFromNumber(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

function slicerStats(slicer: CatalogSlicer): ItemStat[] {
  const stats: ItemStat[] = [];
  if (slicer.damageMul !== 1) {
    stats.push({ label: 'Damage', value: `×${slicer.damageMul}`, positive: slicer.damageMul > 1 });
  }
  if (slicer.juiceMul !== 1) {
    stats.push({ label: 'Juice', value: `×${slicer.juiceMul}`, positive: slicer.juiceMul > 1 });
  }
  if (slicer.brittleBonus > 0) {
    stats.push({ label: 'Brittle', value: `+${slicer.brittleBonus}s`, positive: true });
  }
  return stats;
}

function slicerToItem(slicer: CatalogSlicer): CatalogItem {
  return {
    id: slicer.id,
    name: slicer.name,
    description: slicer.blurb,
    category: 'slicers',
    rarity: slicer.rarity,
    price: slicer.cost,
    sellValue: slicer.sellValue,
    slot: 'blade',
    color: slicer.color,
    glowColor: slicer.glowColor,
    starter: isStarterItem(slicer.id),
    stats: slicerStats(slicer),
    slicer,
  };
}

function wallToItem(wall: (typeof WALL_SKINS)[number]): CatalogItem {
  const hex = hexFromNumber(wall.color);
  return {
    id: wall.id,
    name: wall.name,
    description: wall.blurb,
    category: 'walls',
    rarity: wall.cost === 0 ? 'common' : wall.cost >= 280 ? 'epic' : 'rare',
    price: wall.cost,
    sellValue: wall.sellValue,
    slot: 'wall',
    color: hex,
    glowColor: hex,
    starter: isStarterItem(wall.id),
    stats: [],
  };
}

function heroToItem(heroId: HeroId): CatalogItem | null {
  const def = HEROES.find((h) => h.id === heroId);
  if (!def) return null;
  const price = heroPrice(heroId);
  return {
    id: `hero:${def.id}`,
    name: def.name,
    description: def.blurb ?? '',
    category: 'heroes',
    rarity: price && price >= 3000 ? 'legendary' : price ? 'epic' : 'rare',
    price: price ?? 0,
    sellValue: 0,
    slot: 'hero',
    color: def.trail ? hexFromNumber(def.trail) : '#38bdf8',
    glowColor: '#f8fafc',
    starter: def.id === 'jiju',
    stats: [],
  };
}

/** Every item that exists, across all categories. */
export function allCatalogItems(): CatalogItem[] {
  const items: CatalogItem[] = [];
  for (const slicer of getEnabledSlicers()) items.push(slicerToItem(slicer));
  for (const wall of WALL_SKINS) items.push(wallToItem(wall));
  for (const hero of HEROES) {
    const item = heroToItem(hero.id);
    // Only purchasable heroes belong in the shop; the rest unlock by levelling.
    if (item && item.price > 0) items.push(item);
  }
  return items;
}

export function findCatalogItem(id: string): CatalogItem | null {
  return allCatalogItems().find((item) => item.id === id) ?? null;
}

/** True when the save owns this item. Heroes use `ownedHeroes`, skins `ownedSkins`. */
export function ownsItem(save: SaveData, item: CatalogItem): boolean {
  if (item.category === 'heroes') {
    const heroId = item.id.replace(/^hero:/, '') as HeroId;
    return save.ownedHeroes.includes(heroId);
  }
  return save.ownedSkins.includes(item.id);
}

/** True when this exact item is currently equipped in its slot. */
export function isEquipped(save: SaveData, item: CatalogItem): boolean {
  if (item.slot === 'blade') return save.bladeSkin === item.id;
  if (item.slot === 'wall') return save.wallSkin === item.id;
  if (item.slot === 'hero') return `hero:${save.hero}` === item.id;
  return false;
}

/**
 * SHOP view: things available to buy. Owned items are excluded entirely —
 * the shop answers "what can I buy", never "what do I have" (§6).
 */
export function shopItems(save: SaveData, category?: ItemCategory): CatalogItem[] {
  return allCatalogItems()
    .filter((item) => !ownsItem(save, item))
    .filter((item) => item.price > 0)
    .filter((item) => !category || item.category === category)
    .sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity) || a.price - b.price);
}

/**
 * INVENTORY view: only what the player owns (§7).
 */
export function inventoryItems(save: SaveData, category?: ItemCategory): CatalogItem[] {
  return allCatalogItems()
    .filter((item) => ownsItem(save, item))
    .filter((item) => !category || item.category === category)
    .sort((a, b) => {
      // Equipped first, then rarity, then name — the useful reading order.
      const equippedDelta = Number(isEquipped(save, b)) - Number(isEquipped(save, a));
      if (equippedDelta !== 0) return equippedDelta;
      const rarityDelta = rarityRank(b.rarity) - rarityRank(a.rarity);
      if (rarityDelta !== 0) return rarityDelta;
      return a.name.localeCompare(b.name);
    });
}

/** Categories that actually contain something, for tab rendering. */
export function categoriesWithItems(items: CatalogItem[]): ItemCategory[] {
  const order: ItemCategory[] = ['slicers', 'walls', 'effects', 'cosmetics', 'heroes', 'special'];
  return order.filter((category) => items.some((item) => item.category === category));
}

export type SellRefusal = 'not-owned' | 'starter-item' | 'no-value' | 'equipped-only-option';

export interface SellCheck {
  ok: boolean;
  reason?: SellRefusal;
  message?: string;
}

/**
 * Guards selling (§7).
 *
 * The important rule: you cannot sell the item you have equipped unless some
 * other owned item can take its slot, otherwise the player ends up with an
 * empty blade/wall slot and a broken loadout.
 */
export function canSellItem(save: SaveData, id: string): SellCheck {
  const item = findCatalogItem(id);
  if (!item) return { ok: false, reason: 'not-owned', message: 'Unknown item.' };
  if (!ownsItem(save, item)) return { ok: false, reason: 'not-owned', message: 'You do not own this.' };
  if (item.starter || isStarterItem(id)) {
    return { ok: false, reason: 'starter-item', message: 'Starter gear cannot be sold.' };
  }
  if (item.sellValue <= 0) {
    return { ok: false, reason: 'no-value', message: 'This item has no sell value.' };
  }
  if (isEquipped(save, item)) {
    const replacements = inventoryItems(save).filter(
      (other) => other.slot === item.slot && other.id !== item.id,
    );
    if (replacements.length === 0) {
      return {
        ok: false,
        reason: 'equipped-only-option',
        message: 'Equip another item in this slot first.',
      };
    }
  }
  return { ok: true };
}
