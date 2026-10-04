/**
 * SHOP (§6) — "things available to buy".
 *
 * Strictly purchase-only. Owned items never appear here; they live in the
 * inventory. Buying moves an item SHOP → INVENTORY and never auto-equips.
 */

import { el } from '../components/dom';
import { screenShell, categoryTabs, emptyState } from './shell';
import { renderItemCard } from './itemCard';
import { GameButton } from '../components/primitives';
import { openScreen } from './registry';
import { allCatalogItems, ownsItem, shopItems, categoriesWithItems, type ItemCategory } from '../../game/catalog';
import type { SaveData } from '../../game/save';

export interface ShopCallbacks {
  onBuy: (id: string) => void;
}

const LABELS: Record<string, string> = {
  all: 'All',
  slicers: 'Slicers',
  walls: 'Walls',
  effects: 'Effects',
  cosmetics: 'Cosmetics',
  heroes: 'Heroes',
  special: 'Special',
};

let activeCategory: string = 'all';
let showOwned = false;

export function renderShop(root: HTMLElement, save: SaveData, cb: ShopCallbacks): void {
  const body = screenShell(root, {
    title: 'Shop',
    subtitle: 'Spend coins on new gear. Purchases go to your inventory.',
    save,
    actions: [
      GameButton({
        label: 'Inventory',
        variant: 'outline',
        size: 'sm',
        onClick: () => openScreen('INVENTORY'),
      }),
    ],
  });

  body.appendChild(GameButton({ label: showOwned ? 'Show purchasable items' : 'Browse all gear, including owned', variant: 'outline', size: 'sm', onClick: () => { showOwned = !showOwned; renderShop(root, save, cb); } }));
  const available = showOwned ? allCatalogItems() : shopItems(save);
  const categories = ['all', ...categoriesWithItems(available)];
  if (!categories.includes(activeCategory)) activeCategory = 'all';

  body.appendChild(
    categoryTabs(categories, activeCategory, LABELS, (id) => {
      activeCategory = id;
      renderShop(root, save, cb);
    }),
  );

  const filtered =
    activeCategory === 'all'
      ? available
      : available.filter((item) => item.category === activeCategory as ItemCategory);

  if (!filtered.length) {
    body.appendChild(
      emptyState(
        available.length ? 'Nothing here yet' : 'You own everything',
        available.length
          ? 'Try another category.'
          : 'Every item in the shop is already in your inventory.',
        GameButton({
          label: 'Open inventory',
          tone: 'primary',
          onClick: () => openScreen('INVENTORY'),
        }),
      ),
    );
    return;
  }

  const grid = el('div', { class: 'ftd-item-grid' });
  for (const item of filtered) {
    grid.appendChild(
      renderItemCard(
        item,
        {
          mode: 'shop',
          owned: ownsItem(save, item),
          equipped: false,
          affordable: save.coins >= item.price,
        },
        { onBuy: cb.onBuy },
      ),
    );
  }
  body.appendChild(grid);
}

/** Clears view state so tests and screen re-entry start predictably. */
export function resetShopView(): void {
  activeCategory = 'all';
  showOwned = false;
}

