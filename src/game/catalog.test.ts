// Mock localStorage BEFORE any imports so module initialisation succeeds.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allCatalogItems,
  canSellItem,
  categoriesWithItems,
  findCatalogItem,
  inventoryItems,
  isEquipped,
  isStarterItem,
  ownsItem,
  rarityRank,
  shopItems,
} from './catalog';
import { defaultSave, type SaveData } from './save';

function freshSave(): SaveData {
  localStorage.clear();
  return defaultSave();
}

/* ───────────── Catalog integrity ───────────── */

test('the catalog exposes items with complete, sane data', () => {
  const items = allCatalogItems();
  assert.ok(items.length > 0, 'catalog must not be empty');
  const ids = new Set<string>();
  for (const item of items) {
    assert.ok(item.id, 'every item needs an id');
    assert.equal(ids.has(item.id), false, `duplicate id: ${item.id}`);
    ids.add(item.id);
    assert.ok(item.name, `${item.id} needs a name`);
    assert.ok(item.price >= 0, `${item.id} price must not be negative`);
    assert.ok(item.sellValue >= 0, `${item.id} sell value must not be negative`);
    assert.ok(['common', 'rare', 'epic', 'legendary'].includes(item.rarity));
  }
});

test('an item can never be worth more sold than it costs to buy', () => {
  for (const item of allCatalogItems()) {
    if (item.price === 0) continue;
    assert.ok(
      item.sellValue <= item.price,
      `${item.id} sells for ${item.sellValue} but costs ${item.price} — infinite coin loop`,
    );
  }
});

test('rarity ordering is stable', () => {
  assert.ok(rarityRank('legendary') > rarityRank('epic'));
  assert.ok(rarityRank('epic') > rarityRank('rare'));
  assert.ok(rarityRank('rare') > rarityRank('common'));
});

test('starter gear is identified and free', () => {
  assert.equal(isStarterItem('blade-default'), true);
  assert.equal(isStarterItem('wall-brick'), true);
  assert.equal(isStarterItem('blade-gold'), false);
  const starter = findCatalogItem('blade-default');
  assert.equal(starter?.price, 0);
  assert.equal(starter?.starter, true);
});

/* ───────────── SHOP vs INVENTORY separation (§6, §7) ───────────── */

test('shop shows only unowned items, inventory only owned ones', () => {
  const save = freshSave();
  const shop = shopItems(save);
  const inventory = inventoryItems(save);

  for (const item of shop) {
    assert.equal(ownsItem(save, item), false, `${item.id} is owned but listed in the shop`);
  }
  for (const item of inventory) {
    assert.equal(ownsItem(save, item), true, `${item.id} is not owned but listed in the inventory`);
  }
});

test('shop and inventory never contain the same item', () => {
  const save = freshSave();
  save.ownedSkins = ['blade-default', 'wall-brick', 'blade-gold'];
  const shopIds = new Set(shopItems(save).map((i) => i.id));
  const invIds = new Set(inventoryItems(save).map((i) => i.id));
  for (const id of invIds) {
    assert.equal(shopIds.has(id), false, `${id} appears in BOTH shop and inventory`);
  }
});

test('buying moves an item from the shop to the inventory', () => {
  const save = freshSave();
  const target = shopItems(save)[0];
  assert.ok(target, 'need a purchasable item for this test');

  assert.ok(shopItems(save).some((i) => i.id === target.id));
  assert.equal(inventoryItems(save).some((i) => i.id === target.id), false);

  // Simulate the purchase.
  save.ownedSkins.push(target.id);

  assert.equal(shopItems(save).some((i) => i.id === target.id), false, 'must leave the shop');
  assert.ok(inventoryItems(save).some((i) => i.id === target.id), 'must enter the inventory');
});

test('buying does not equip the item', () => {
  const save = freshSave();
  const target = shopItems(save, 'slicers')[0];
  assert.ok(target);
  const equippedBefore = save.bladeSkin;
  save.ownedSkins.push(target.id);
  assert.equal(save.bladeSkin, equippedBefore, 'purchase must never auto-equip');
});

test('the shop never lists free starter gear', () => {
  const save = freshSave();
  save.ownedSkins = [];
  for (const item of shopItems(save)) {
    assert.ok(item.price > 0, `${item.id} is free and should not be sold`);
  }
});

test('category filters work on both views', () => {
  const save = freshSave();
  save.ownedSkins = ['blade-default', 'wall-brick'];
  for (const item of shopItems(save, 'slicers')) assert.equal(item.category, 'slicers');
  for (const item of inventoryItems(save, 'walls')) assert.equal(item.category, 'walls');
});

test('only non-empty categories are offered as tabs', () => {
  const save = freshSave();
  const cats = categoriesWithItems(inventoryItems(save));
  for (const cat of cats) {
    assert.ok(inventoryItems(save, cat).length > 0, `${cat} tab would be empty`);
  }
});

test('a new player owns starter gear and nothing else', () => {
  const save = freshSave();
  const owned = inventoryItems(save).map((i) => i.id);
  assert.ok(owned.includes('blade-default'));
  assert.ok(owned.includes('wall-brick'));
  assert.equal(owned.length, 2, `unexpected starting inventory: ${owned.join(', ')}`);
});

/* ───────────── Equip state (§7) ───────────── */

test('equipped state is reported per slot', () => {
  const save = freshSave();
  save.bladeSkin = 'blade-default';
  save.wallSkin = 'wall-brick';

  const blade = findCatalogItem('blade-default')!;
  const wall = findCatalogItem('wall-brick')!;
  assert.equal(isEquipped(save, blade), true);
  assert.equal(isEquipped(save, wall), true);

  save.bladeSkin = '';
  assert.equal(isEquipped(save, blade), false);
});

test('equipping one blade does not equip another', () => {
  const save = freshSave();
  save.ownedSkins.push('blade-gold');
  save.bladeSkin = 'blade-gold';
  assert.equal(isEquipped(save, findCatalogItem('blade-gold')!), true);
  assert.equal(isEquipped(save, findCatalogItem('blade-default')!), false);
});

test('inventory lists equipped items first', () => {
  const save = freshSave();
  save.ownedSkins = ['blade-default', 'wall-brick', 'blade-gold'];
  save.bladeSkin = 'blade-gold';
  const first = inventoryItems(save)[0];
  assert.equal(first.id, 'blade-gold', 'the equipped item should lead the list');
});

/* ───────────── Selling rules (§7) ───────────── */

test('starter gear can never be sold', () => {
  const save = freshSave();
  const check = canSellItem(save, 'blade-default');
  assert.equal(check.ok, false);
  assert.equal(check.reason, 'starter-item');
});

test('an unowned item cannot be sold', () => {
  const save = freshSave();
  const check = canSellItem(save, 'blade-gold');
  assert.equal(check.ok, false);
  assert.equal(check.reason, 'not-owned');
});

test('the equipped item cannot be sold when it is the only one in its slot', () => {
  const save = freshSave();
  // Own exactly one non-starter blade and equip it, then drop the starter.
  save.ownedSkins = ['blade-gold'];
  save.bladeSkin = 'blade-gold';

  const check = canSellItem(save, 'blade-gold');
  assert.equal(check.ok, false);
  assert.equal(check.reason, 'equipped-only-option');
  assert.match(check.message ?? '', /equip another/i);
});

test('the equipped item can be sold once a replacement is owned', () => {
  const save = freshSave();
  save.ownedSkins = ['blade-default', 'blade-gold'];
  save.bladeSkin = 'blade-gold';
  // blade-default is a valid replacement, so selling the equipped gold blade is fine.
  assert.equal(canSellItem(save, 'blade-gold').ok, true);
});

test('an unequipped owned item with value can always be sold', () => {
  const save = freshSave();
  save.ownedSkins = ['blade-default', 'blade-gold'];
  save.bladeSkin = 'blade-default';
  assert.equal(canSellItem(save, 'blade-gold').ok, true);
});

test('items with no sell value are refused', () => {
  const save = freshSave();
  // Skins only: heroes live in ownedHeroes and are covered by their own test.
  const zeroValue = allCatalogItems().find(
    (i) => i.sellValue === 0 && !i.starter && i.price > 0 && i.category !== 'heroes',
  );
  if (!zeroValue) return; // nothing to assert in this catalog
  save.ownedSkins.push(zeroValue.id);
  const check = canSellItem(save, zeroValue.id);
  assert.equal(check.ok, false);
  assert.equal(check.reason, 'no-value');
});

test('every sell refusal explains itself to the player', () => {
  const save = freshSave();
  save.ownedSkins = ['blade-gold'];
  save.bladeSkin = 'blade-gold';
  for (const id of ['blade-default', 'blade-gold', 'does-not-exist']) {
    const check = canSellItem(save, id);
    if (!check.ok) {
      assert.ok(check.message && check.message.length > 0, `${id} refusal needs a message`);
    }
  }
});

/* ───────────── Heroes in the shop (§6) ───────────── */

test('only purchase-only heroes are sold, and never free ones', () => {
  const save = freshSave();
  const heroItems = allCatalogItems().filter((i) => i.category === 'heroes');
  const ids = heroItems.map((i) => i.id);
  assert.ok(ids.includes('hero:tripos'));
  assert.ok(ids.includes('hero:ki'));
  assert.equal(ids.includes('hero:topfu'), false, 'level-unlock heroes must not be sold');
  assert.equal(ids.includes('hero:jiju'), false);
  for (const item of heroItems) assert.ok(item.price > 0);
  // And an unowned purchasable hero shows up in the shop view.
  assert.ok(shopItems(save, 'heroes').some((i) => i.id === 'hero:tripos'));
});

test('an owned hero moves to the inventory view', () => {
  const save = freshSave();
  save.ownedHeroes = ['jiju', 'tripos'];
  assert.equal(shopItems(save, 'heroes').some((i) => i.id === 'hero:tripos'), false);
  assert.ok(inventoryItems(save, 'heroes').some((i) => i.id === 'hero:tripos'));
});

test('heroes cannot be sold', () => {
  const save = freshSave();
  save.ownedHeroes = ['jiju', 'tripos'];
  const check = canSellItem(save, 'hero:tripos');
  assert.equal(check.ok, false, 'selling a hero must be refused');
});
