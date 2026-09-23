import { installDomStub } from '../domStub.test-helper';

// Screens capture `document` on import, so the stub must be installed first.
installDomStub();

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
import { defaultSave, type SaveData } from '../../game/save';
import { renderMainMenu } from './mainMenu';
import { renderShop, resetShopView } from './shop';
import { renderInventory, resetInventoryView } from './inventory';
import { renderHeroScreen, resetHeroView } from './heroes';
import { renderProfile } from './profile';

function host(): HTMLElement {
  return document.createElement('div');
}

function richSave(): SaveData {
  const save = defaultSave();
  save.nickname = 'Slicer';
  save.coins = 5000;
  save.ownedSkins = ['blade-default', 'wall-brick', 'blade-gold'];
  save.bladeSkin = 'blade-gold';
  save.wallSkin = 'wall-brick';
  return save;
}

const noop = () => undefined;

/* Smoke tests: every screen must render for a brand-new player AND for a
   player with gear, without throwing. These catch the runtime errors that
   type-checking cannot. */

test('main menu renders for a new player and leads with PLAY', () => {
  const root = host();
  renderMainMenu(root, defaultSave(), { onPlay: noop });
  const html = root.innerHTML;
  assert.match(html, /PLAY/, 'the primary action must be present');
  assert.match(html, /ftd-playcard/);
  assert.match(html, /ftd-navtile/, 'secondary destinations must render');
});

test('main menu shows who the player is', () => {
  const root = host();
  const save = richSave();
  renderMainMenu(root, save, { onPlay: noop });
  const html = root.innerHTML;
  assert.match(html, /Slicer/, 'nickname must be visible');
  assert.match(html, /5,000|5000/, 'coins must be visible');
});

test('main menu PLAY button invokes the launch callback', () => {
  const root = host();
  let played = 0;
  renderMainMenu(root, defaultSave(), { onPlay: () => { played++; } });
  const cta = root.querySelector('.ftd-playcard__cta') as HTMLElement | null;
  assert.ok(cta, 'the PLAY button must exist');
  (cta as unknown as { click: () => void }).click();
  assert.equal(played, 1);
});

test('main menu always exposes the admin access entry when it is wired', () => {
  const root = host();
  let opened = 0;
  renderMainMenu(root, defaultSave(), { onPlay: noop, onAdmin: () => { opened++; } });
  const admin = root.querySelector('.ftd-mainmenu__admin') as HTMLElement | null;
  assert.ok(admin, 'the active menu must expose the admin entry');
  (admin as unknown as { click: () => void }).click();
  assert.equal(opened, 1);
});

test('shop renders and never lists an owned item', () => {
  resetShopView();
  const root = host();
  const save = richSave();
  renderShop(root, save, { onBuy: noop });
  const html = root.innerHTML;
  assert.match(html, /Shop/);
  assert.equal(/blade-gold/.test(html), false, 'owned gear must not appear in the shop');
});

test('inventory renders only owned gear', () => {
  resetInventoryView();
  const root = host();
  renderInventory(root, richSave(), { onEquip: noop, onSell: noop });
  const html = root.innerHTML;
  assert.match(html, /Inventory/);
  assert.match(html, /blade-gold/, 'owned gear must appear');
  assert.match(html, /EQUIPPED/, 'the equipped item must be marked');
});

test('inventory shows a helpful empty state rather than a blank page', () => {
  resetInventoryView();
  const root = host();
  const save = defaultSave();
  save.ownedSkins = [];
  save.ownedHeroes = [];
  renderInventory(root, save, { onEquip: noop, onSell: noop });
  assert.match(root.innerHTML, /ftd-empty/);
});

test('hero screen renders roster, level and an action', () => {
  resetHeroView();
  const root = host();
  renderHeroScreen(root, defaultSave(), { onEquip: noop, onBuy: noop });
  const html = root.innerHTML;
  assert.match(html, /Master Jiju/);
  assert.match(html, /Lv 1 \/ 100/, 'level must show the 1-100 range');
  assert.match(html, /ftd-hero-tile/);
  assert.match(html, /LOCKED|BUY|OWNED/, 'unlock state must be visible');
});

test('hero screen marks locked heroes with their requirement', () => {
  resetHeroView();
  const root = host();
  renderHeroScreen(root, defaultSave(), { onEquip: noop, onBuy: noop });
  assert.match(root.innerHTML, /Master Jiju Lv 10/, 'locked heroes must state how to unlock');
});

test('profile renders the full career record', () => {
  const root = host();
  const save = richSave();
  save.bestWave = 12;
  save.highScore = 8400;
  save.games = 37;
  save.bestCombo = 25;
  renderProfile(root, save, { bestCombo: save.bestCombo, season: 'Season 1' });
  const html = root.innerHTML;
  for (const expected of ['Highest wave', 'Highest score', 'Games played', 'Best combo', 'HERO MASTERY', 'MAIN TOWER']) {
    assert.ok(html.includes(expected), `profile must show "${expected}"`);
  }
  assert.match(html, /8,400/);
  assert.match(html, /×25/);
});

test('every screen renders a back control so BACK is always reachable', () => {
  const save = richSave();
  const screens: Array<[string, (root: HTMLElement) => void]> = [
    ['shop', (r) => renderShop(r, save, { onBuy: noop })],
    ['inventory', (r) => renderInventory(r, save, { onEquip: noop, onSell: noop })],
    ['heroes', (r) => renderHeroScreen(r, save, { onEquip: noop, onBuy: noop })],
    ['profile', (r) => renderProfile(r, save, {})],
  ];
  for (const [name, render] of screens) {
    const root = host();
    render(root);
    assert.ok(root.querySelector('.ftd-screen__back'), `${name} must have a back button`);
    assert.ok(root.querySelector('.ftd-screen__home'), `${name} must have a home button`);
  }
});

test('screens re-render cleanly without duplicating content', () => {
  resetShopView();
  const root = host();
  const save = richSave();
  renderShop(root, save, { onBuy: noop });
  const firstCount = root.querySelectorAll('.ftd-item-card').length;
  renderShop(root, save, { onBuy: noop });
  const secondCount = root.querySelectorAll('.ftd-item-card').length;
  assert.equal(secondCount, firstCount, 're-render must replace, not append');
});
