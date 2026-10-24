import {turretOffers,equippedTurrets,TURRET_SLOTS} from '../../game/turretLoadout';
import {getPublishedCreatorMedia} from '../../game/creatorMedia';
import {lucideIcon} from '../lucideIcon';
/**
 * INVENTORY (§7) — "things I own".
 *
 * Only owned items. Equipping persists, selling removes ownership, and the
 * currently equipped item cannot be sold unless another item can take its slot.
 */

import { el } from '../components/dom';
import { screenShell, categoryTabs, emptyState } from './shell';
import { renderItemCard } from './itemCard';
import { GameButton } from '../components/primitives';
import { openScreen } from './registry';
import {
  inventoryItems,
  categoriesWithItems,
  canSellItem,
  isEquipped,
  findCatalogItem,
  type ItemCategory,
} from '../../game/catalog';
import type { SaveData } from '../../game/save';

export interface InventoryCallbacks {
  onEquip: (id: string) => void;
  onUnequip?: (id: string) => void;
  onSell: (id: string) => void;
}

const LABELS: Record<string, string> = {
  all: 'All',
  turrets:'Turrets',
  slicers: 'Slicers',
  walls: 'Walls',
  effects: 'Effects',
  cosmetics: 'Cosmetics',
  heroes: 'Heroes',
  special: 'Special',
};

let activeCategory: string = 'all';

/** Shows what is currently equipped, so the loadout is never a mystery. */
function loadoutStrip(save: SaveData,cb:InventoryCallbacks): HTMLElement {
  const blade = save.bladeSkin ? findCatalogItem(save.bladeSkin) : null;
  const wall = save.wallSkin ? findCatalogItem(save.wallSkin) : null;
  const slot = (label: string, name: string, color?: string) => {
    const node = el('div', { class: 'ftd-loadout-slot' }, [
      ...(label.startsWith('TURRET')?[lucideIcon('TowerControl','',24)]:[]),
      el('span', { class: 'ftd-loadout-slot__label', text: label }),
      el('span', { class: 'ftd-loadout-slot__name', text: name }),
    ]);
    if (color) node.style.setProperty('--slot-color', color);
    return node;
  };
  const offers=turretOffers(getPublishedCreatorMedia()),loadout=equippedTurrets(save,offers);
  return el('div', { class: 'ftd-loadout-strip' }, [
    slot('BLADE', blade?.name ?? 'None equipped', blade?.color),
    slot('WALL', wall?.name ?? 'None equipped', wall?.color),
    ...Array.from({length:TURRET_SLOTS},(_,i)=>{const kind=loadout[i],offer=offers.find(offer=>offer.kind===kind);const card=slot(`TURRET ${i+1}`,offer?.name??'Empty slot','#b4ff3a');if(offer&&cb.onUnequip)card.appendChild(GameButton({label:'Unequip',size:'sm',variant:'ghost',onClick:()=>cb.onUnequip?.(`turret:${kind}`)}));return card;}),
  ]);
}

export function renderInventory(root: HTMLElement, save: SaveData, cb: InventoryCallbacks): void {
  const body = screenShell(root, {
    title: 'Inventory',
    subtitle: 'Gear you own. Equip it here.',
    save,
    actions: [
      GameButton({
        label: 'Shop',
        variant: 'outline',
        size: 'sm',
        onClick: () => openScreen('SHOP'),
      }),
    ],
  });

  body.appendChild(loadoutStrip(save,cb));

  const owned = inventoryItems(save);
  const categories = ['all', ...categoriesWithItems(owned)];
  if (!categories.includes(activeCategory)) activeCategory = 'all';

  body.appendChild(
    categoryTabs(categories, activeCategory, LABELS, (id) => {
      activeCategory = id;
      renderInventory(root, save, cb);
    }),
  );

  const filtered =
    activeCategory === 'all' ? owned : inventoryItems(save, activeCategory as ItemCategory);

  if (!filtered.length) {
    body.appendChild(
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
          equipBlockedReason:item.slot==='turret'&&!isEquipped(save,item)&&equippedTurrets(save,turretOffers(getPublishedCreatorMedia())).length>=TURRET_SLOTS?'Free a turret slot first':undefined,
          sellBlockedReason: sellCheck.ok ? undefined : sellCheck.message,
        },
        { onEquip: cb.onEquip, onUnequip: cb.onUnequip, onSell: cb.onSell },
      ),
    );
  }
  body.appendChild(grid);
}

export function resetInventoryView(): void {
  activeCategory = 'all';
}
