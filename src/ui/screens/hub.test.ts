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
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { defaultSave, type SaveData } from '../../game/save';
import { navigation } from '../../game/navigation';
import { resetRegistry, registerScreen, installScreenRouter, openScreen } from './registry';
import { renderHub, switchHubTab, refreshHub, registerHubTab, resetHub, type HubTab } from './hub';
import { homeHubTab, profileHubTab } from './hubTabs';
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

test('primary hub routes are reachable, Back returns one level, and Home clears the stack', () => {
  resetHub();
  resetRegistry();
  navigation.reset('MAIN_MENU');
  for (const [id, label] of [
    ['MAIN_MENU', 'Home'], ['HEROES', 'Heroes'], ['INVENTORY', 'Inventory'],
    ['SHOP', 'Shop'], ['PROFILE', 'Profile'], ['CO_OP', 'Co-op'],
  ] as const) registerHubTab(stubTab(id, label));

  const root = host();
  renderHub(root, defaultSave(), 'MAIN_MENU', { onPlay: () => undefined });

  for (const [testId, state] of [
    ['nav-heroes', 'HEROES'], ['nav-inventory', 'INVENTORY'],
    ['nav-shop', 'SHOP'], ['nav-profile', 'PROFILE'],
  ] as const) {
    const route = root.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!;
    assert.ok(route, `${testId} route should be rendered`);
    route.click();
    assert.equal(navigation.state, state);
    assert.equal(navigation.back(), true);
    assert.equal(navigation.state, 'MAIN_MENU');
  }

  openScreen('SHOP');
  openScreen('INVENTORY');
  root.querySelector<HTMLButtonElement>('[data-testid="nav-home"]')!.click();
  assert.equal(navigation.state, 'MAIN_MENU');
  assert.equal(navigation.depth, 0, 'Home clears nested route history');
});

test('the hub exposes stable Play, Settings, and Admin test ids', () => {
  resetHub();
  navigation.reset('MAIN_MENU');
  let adminOpens = 0;
  let playStarts = 0;
  registerHubTab(homeHubTab(() => { playStarts++; }));
  const root = host();
  renderHub(root, defaultSave(), 'MAIN_MENU', { onPlay: () => undefined, onAdmin: () => { adminOpens++; } });

  for (const id of ['nav-play', 'nav-home', 'nav-settings', 'nav-admin']) {
    assert.ok(root.querySelector(`[data-testid="${id}"]`), `${id} should be stable and present`);
  }
  root.querySelector<HTMLButtonElement>('[data-testid="nav-play"]')!.click();
  assert.equal(playStarts, 1, 'the active Play action calls the existing launch callback');
  root.querySelector<HTMLButtonElement>('[data-testid="nav-settings"]')!.click();
  assert.equal(navigation.state, 'SETTINGS');
  assert.equal(navigation.back(), true);
  assert.equal(navigation.state, 'MAIN_MENU');
  root.querySelector<HTMLButtonElement>('[data-testid="nav-admin"]')!.click();
  assert.equal(adminOpens, 1);
});

test('legacy lobby navigation and Play markup are hidden, inert, and unwired', () => {
  const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../../main.ts', import.meta.url), 'utf8');
  const hud = readFileSync(new URL('../../ui/hud.ts', import.meta.url), 'utf8');
  assert.match(html, /<nav id="menu-leftnav"[^>]*\bhidden\b[^>]*\binert\b/);
  assert.match(html, /<footer id="menu-bottombar"[^>]*\bhidden\b[^>]*\binert\b/);
  assert.doesNotMatch(main, /getElementById\(['"]btn-start['"]\)/);
  assert.equal((main.match(/navigation\.addGuard\(/g) ?? []).length, 1, 'one match-leave guard owns quit confirmation');
  assert.equal((main.match(/confirm\('Leave this match\?/g) ?? []).length, 1, 'match quit uses one confirmation');
  assert.doesNotMatch(hud, /querySelectorAll<HTMLButtonElement>\('\[data-page\]'\)/);
  assert.doesNotMatch(hud, /#menu-leftnav/);
  assert.doesNotMatch(hud, /getElementById\(['"]btn-dash-main-menu['"]\).*addEventListener/);
});

test('the footer presents five core destinations and keeps the home state explicit', () => {
  resetHub();
  for (const [id, label] of [
    ['MAIN_MENU', 'Home'], ['HEROES', 'Heroes'], ['INVENTORY', 'Inventory'],
    ['SHOP', 'Shop'], ['PROFILE', 'Profile'], ['CO_OP', 'Co-op'],
  ] as const) registerHubTab(stubTab(id, label));

  const root = host();
  renderHub(root, defaultSave(), 'MAIN_MENU', { onPlay: () => undefined });
  assert.deepEqual(
    [...root.querySelectorAll('.ftd-hub-tab')].map((tab) => tab.getAttribute('data-hub-tab')),
    ['MAIN_MENU', 'HEROES', 'INVENTORY', 'SHOP', 'PROFILE'],
  );
  assert.equal(root.classList.contains('is-home'), true);

  switchHubTab(root, defaultSave(), 'SHOP');
  assert.equal(root.classList.contains('is-home'), false);
});

test('profile keeps the legacy destinations reachable and exposes its Play action', () => {
  let played = 0;
  const profile = profileHubTab(() => ({}), () => { played++; });
  const main = host();
  profile.renderMain(main, defaultSave());

  const actions = main.querySelector('.ftd-profile-actions');
  const actionButtons = actions?.querySelectorAll('button') ?? [];
  const actionLabels = [...actionButtons].map((button) => button.textContent);
  assert.deepEqual(actionLabels, ['Play now', 'Missions', 'Achievements', 'Ranked', 'Co-op lobby', 'Settings']);
  actionButtons[0]?.click();
  assert.equal(played, 1);
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
