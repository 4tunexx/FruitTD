import { installDomStub, resetDom } from '../domStub.test-helper';

// Screens capture `document` on import, so the stub must exist first.
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
import { navigation } from '../../game/navigation';
import { resetRegistry, registerScreen, installScreenRouter } from './registry';
import { renderHub, switchHubTab, refreshHub, registerHubTab, resetHub, type HubTab } from './hub';
import { Swords } from 'lucide';

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

function stubTab(id: HubTab['id'], label: string): HubTab {
  return {
    id,
    label,
    icon: Swords,
    renderMain: (root) => { root.textContent = `${label} main`; },
    renderSub: (root) => { root.textContent = `${label} sub`; },
  };
}

/* ───────────── hub.ts in isolation ───────────── */

test('renderHub paints header, footer and the active tab once', () => {
  resetHub();
  registerHubTab(stubTab('HEROES', 'Heroes'));
  registerHubTab(stubTab('SHOP', 'Shop'));

  const root = host();
  renderHub(root, defaultSave(), 'HEROES', { onPlay: () => undefined });

  assert.ok(root.querySelector('.ftd-hub__header'), 'header must render');
  assert.ok(root.querySelector('.ftd-hub__footer'), 'footer must render');
  assert.match(root.querySelector('.ftd-hub__main')!.textContent!, /Heroes main/);
  assert.match(root.querySelector('.ftd-hub__sub')!.textContent!, /Heroes sub/);
});

test('the active tab is marked in the footer', () => {
  resetHub();
  registerHubTab(stubTab('HEROES', 'Heroes'));
  registerHubTab(stubTab('SHOP', 'Shop'));

  const root = host();
  renderHub(root, defaultSave(), 'SHOP', { onPlay: () => undefined });

  const shopTab = root.querySelector('[data-hub-tab="SHOP"]')!;
  const heroTab = root.querySelector('[data-hub-tab="HEROES"]')!;
  assert.equal(shopTab.classList.contains('is-active'), true);
  assert.equal(heroTab.classList.contains('is-active'), false);
});

test('switchHubTab replaces panel content without rebuilding header/footer', () => {
  resetHub();
  registerHubTab(stubTab('HEROES', 'Heroes'));
  registerHubTab(stubTab('SHOP', 'Shop'));

  const root = host();
  renderHub(root, defaultSave(), 'HEROES', { onPlay: () => undefined });
  const headerBefore = root.querySelector('.ftd-hub__header');

  switchHubTab(root, defaultSave(), 'SHOP');

  assert.equal(root.querySelector('.ftd-hub__header'), headerBefore, 'header must not remount');
  assert.match(root.querySelector('.ftd-hub__main')!.textContent!, /Shop main/);
  assert.match(root.querySelector('.ftd-hub__sub')!.textContent!, /Shop sub/);
  const shopTab = root.querySelector('[data-hub-tab="SHOP"]')!;
  assert.equal(shopTab.classList.contains('is-active'), true);
});

test('a tab with no renderSub leaves the sub panel empty', () => {
  resetHub();
  registerHubTab({ id: 'HEROES', label: 'Heroes', icon: Swords, renderMain: (r) => { r.textContent = 'main only'; } });

  const root = host();
  renderHub(root, defaultSave(), 'HEROES', { onPlay: () => undefined });

  const sub = root.querySelector('.ftd-hub__sub')!;
  assert.equal(sub.classList.contains('is-empty'), true);
  assert.equal(sub.textContent, '');
});

test('refreshHub repaints in place without the slide-in animation class', () => {
  resetHub();
  registerHubTab(stubTab('SHOP', 'Shop'));

  const root = host();
  renderHub(root, defaultSave(), 'SHOP', { onPlay: () => undefined });

  refreshHub(root, defaultSave(), 'SHOP');

  const content = root.querySelector('.ftd-hub__main')!.querySelector('.ftd-hub-panel-content')!;
  assert.equal(content.classList.contains('is-sliding-in-forward'), false);
  assert.equal(content.classList.contains('is-sliding-in-back'), false);
  assert.match(content.textContent!, /Shop main/);
});

/* ───────────── integration through the real registry (mirrors installGameScreens, without importing index.ts's CSS side-effects) ───────────── */

const HUB_TAB_STATES: HubTab['id'][] = ['MAIN_MENU', 'HEROES', 'INVENTORY', 'SHOP'];

function bootHub(save: SaveData) {
  resetDom();
  resetRegistry();
  resetHub();
  navigation.reset('MAIN_MENU');

  const hub = document.createElement('div');
  hub.id = 'screen-hub';
  document.body.appendChild(hub);
  const legacyGate = document.createElement('div');
  legacyGate.id = 'hud-start';
  document.body.appendChild(legacyGate);

  registerHubTab({
    id: 'MAIN_MENU',
    label: 'Home',
    icon: Swords,
    renderMain: (root) => { root.textContent = 'PLAY stage'; },
    renderSub: (root) => { root.textContent = 'loadout card'; },
  });
  registerHubTab({
    id: 'HEROES',
    label: 'Heroes',
    icon: Swords,
    renderMain: (root) => { root.textContent = 'Heroes roster'; },
    renderSub: (root) => { root.textContent = 'Hero detail'; },
  });
  registerHubTab({
    id: 'INVENTORY',
    label: 'Inventory',
    icon: Swords,
    renderMain: (root) => { root.textContent = 'Inventory grid'; },
    renderSub: (root) => { root.textContent = 'Equipped items'; },
  });
  registerHubTab({
    id: 'SHOP',
    label: 'Shop',
    icon: Swords,
    renderMain: (root) => { root.textContent = `Shop grid · ${save.coins} coins`; },
    renderSub: (root) => { root.textContent = 'Balance card'; },
  });

  let mounted = false;
  let active: HubTab['id'] | null = null;
  const renderFor = (id: HubTab['id']) => {
    const root = document.getElementById('screen-hub')!;
    if (!mounted) {
      renderHub(root, save, id, { onPlay: () => undefined });
      mounted = true;
    } else if (id === active) {
      refreshHub(root, save, id);
    } else {
      switchHubTab(root, save, id);
    }
    active = id;
  };

  for (const id of HUB_TAB_STATES) {
    registerScreen({ id, elementId: 'screen-hub', onEnter: () => renderFor(id) });
  }
  const legacyPages: Array<{ id: any; page: string }> = [
    { id: 'MISSIONS', page: 'quests' },
    { id: 'ACHIEVEMENTS', page: 'profile' },
    { id: 'RANKED', page: 'leaderboard' },
  ];
  for (const { id } of legacyPages) {
    registerScreen({ id, overlay: true, setVisible: () => undefined });
  }

  installScreenRouter();
  const gate = document.getElementById('hud-start')!;
  const showLegacy = (state: string) => {
    gate.classList.toggle('hidden', !legacyPages.some((p) => p.id === state));
  };
  navigation.onChange((change) => showLegacy(change.to));
  showLegacy(navigation.state);

  return { renderFor };
}

test('the hub mounts for MAIN_MENU and stays a single screen host', () => {
  bootHub(richSave());
  const hub = document.getElementById('screen-hub')!;
  assert.equal(hub.classList.contains('hidden'), false, 'hub must be visible on MAIN_MENU');
  assert.match(hub.innerHTML, /PLAY stage/);
  assert.equal(document.querySelectorAll('#screen-hub').length, 1);
});

test('opening SHOP keeps the same #screen-hub element and swaps its content', () => {
  bootHub(richSave());
  navigation.open('SHOP');

  const hub = document.getElementById('screen-hub')!;
  assert.equal(hub.classList.contains('hidden'), false, 'hub stays visible for SHOP too');
  assert.match(hub.innerHTML, /Shop grid/);
  assert.equal(document.querySelectorAll('#screen-hub').length, 1, 'still exactly one hub element');
});

test('BACK from a hub tab returns to the home tab (PLAY stage)', () => {
  bootHub(richSave());
  navigation.open('SHOP');
  navigation.back();

  assert.equal(navigation.state, 'MAIN_MENU');
  const hub = document.getElementById('screen-hub')!;
  assert.match(hub.innerHTML, /PLAY stage/);
});

test('switching hub tabs never touches the legacy hud-start dashboard', () => {
  bootHub(richSave());
  const gate = document.getElementById('hud-start')!;
  navigation.open('HEROES');
  navigation.open('INVENTORY');
  assert.equal(gate.classList.contains('hidden'), true, 'legacy dashboard stays hidden behind hub tabs');
});

test('re-rendering the same active tab (e.g. after a purchase) refreshes data without a slide animation', () => {
  const save = richSave();
  const { renderFor } = bootHub(save);
  navigation.open('SHOP');

  save.coins = 42;
  renderFor('SHOP'); // simulates refreshCurrentScreen() after a buy/equip/sell

  const hub = document.getElementById('screen-hub')!;
  assert.match(hub.innerHTML, /42 coins/);
  const content = hub.querySelector('.ftd-hub__main')!.querySelector('.ftd-hub-panel-content')!;
  assert.equal(content.classList.contains('is-sliding-in-forward'), false, 'same-tab refresh must not slide');
});
