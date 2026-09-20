import { installDomStub } from '../domStub.test-helper';

// The registry captures `document` on import, so the stub must exist first.
installDomStub();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  registerScreen,
  resetRegistry,
  installScreenRouter,
  getScreen,
  registeredScreens,
} from './registry';
import { navigation, type NavState } from '../../game/navigation';

interface Tracked {
  id: NavState;
  visible: boolean;
  enters: number;
  exits: number;
}

/** Registers screens backed by plain flags rather than real elements. */
function setup(ids: NavState[], overlays: NavState[] = []): Map<NavState, Tracked> {
  resetRegistry();
  navigation.reset('MAIN_MENU');
  const tracked = new Map<NavState, Tracked>();
  for (const id of ids) {
    const entry: Tracked = { id, visible: false, enters: 0, exits: 0 };
    tracked.set(id, entry);
    registerScreen({
      id,
      overlay: overlays.includes(id),
      setVisible: (visible) => { entry.visible = visible; },
      onEnter: () => { entry.enters++; },
      onExit: () => { entry.exits++; },
    });
  }
  installScreenRouter();
  return tracked;
}

test('screens can be registered and looked up', () => {
  setup(['MAIN_MENU', 'SHOP']);
  assert.ok(getScreen('MAIN_MENU'));
  assert.ok(getScreen('SHOP'));
  assert.equal(getScreen('ADMIN'), undefined);
  assert.deepEqual(registeredScreens().sort(), ['MAIN_MENU', 'SHOP']);
});

test('the router paints the current screen on install', () => {
  const tracked = setup(['MAIN_MENU', 'SHOP']);
  assert.equal(tracked.get('MAIN_MENU')!.visible, true);
  assert.equal(tracked.get('SHOP')!.visible, false);
});

test('opening a full screen hides the previous one', () => {
  const tracked = setup(['MAIN_MENU', 'PLAY']);
  navigation.setState('PLAY');
  assert.equal(tracked.get('PLAY')!.visible, true);
  assert.equal(tracked.get('MAIN_MENU')!.visible, false);
});

test('an overlay keeps its parent mounted underneath', () => {
  const tracked = setup(['MAIN_MENU', 'SHOP'], ['SHOP']);
  navigation.open('SHOP');
  assert.equal(tracked.get('SHOP')!.visible, true);
  assert.equal(tracked.get('MAIN_MENU')!.visible, true, 'overlay must not tear down the menu');
});

test('closing an overlay restores the parent and hides the overlay', () => {
  const tracked = setup(['MAIN_MENU', 'SHOP'], ['SHOP']);
  navigation.open('SHOP');
  navigation.back();
  assert.equal(tracked.get('SHOP')!.visible, false);
  assert.equal(tracked.get('MAIN_MENU')!.visible, true);
});

test('onEnter and onExit fire exactly once per transition', () => {
  const tracked = setup(['MAIN_MENU', 'SHOP'], ['SHOP']);
  const shop = tracked.get('SHOP')!;
  const menu = tracked.get('MAIN_MENU')!;
  const menuEntersBefore = menu.enters;

  navigation.open('SHOP');
  assert.equal(shop.enters, 1);
  assert.equal(menu.exits, 0, 'the menu stays mounted under an overlay');

  navigation.back();
  assert.equal(shop.exits, 1);
  assert.equal(menu.enters, menuEntersBefore, 'the menu never re-entered');
});

test('re-entering a screen re-fires onEnter so it can refresh its data', () => {
  const tracked = setup(['MAIN_MENU', 'SHOP'], ['SHOP']);
  navigation.open('SHOP');
  navigation.back();
  navigation.open('SHOP');
  assert.equal(tracked.get('SHOP')!.enters, 2);
});

test('only one non-overlay screen is ever visible at a time', () => {
  const tracked = setup(['MAIN_MENU', 'PLAY', 'PROFILE']);
  for (const target of ['PLAY', 'PROFILE', 'MAIN_MENU'] as NavState[]) {
    navigation.setState(target);
    const visible = [...tracked.values()].filter((t) => t.visible).map((t) => t.id);
    assert.deepEqual(visible, [target], `expected only ${target} visible, got ${visible.join(',')}`);
  }
});

test('deep overlay stacks keep every ancestor mounted', () => {
  const tracked = setup(['MAIN_MENU', 'SHOP', 'INVENTORY'], ['SHOP', 'INVENTORY']);
  navigation.open('SHOP');
  navigation.open('INVENTORY');
  assert.equal(tracked.get('MAIN_MENU')!.visible, true);
  assert.equal(tracked.get('SHOP')!.visible, true);
  assert.equal(tracked.get('INVENTORY')!.visible, true);

  navigation.home();
  assert.equal(tracked.get('SHOP')!.visible, false);
  assert.equal(tracked.get('INVENTORY')!.visible, false);
  assert.equal(tracked.get('MAIN_MENU')!.visible, true);
});

test('navigating to an unregistered screen hides everything else safely', () => {
  const tracked = setup(['MAIN_MENU', 'SHOP']);
  navigation.setState('CREATOR'); // never registered
  assert.equal(tracked.get('MAIN_MENU')!.visible, false);
  assert.equal(tracked.get('SHOP')!.visible, false);
});

test('the body records the active screen for CSS hooks', () => {
  setup(['MAIN_MENU', 'SHOP'], ['SHOP']);
  navigation.open('SHOP');
  assert.equal(document.body.dataset.ftdScreen, 'SHOP');
  assert.equal(document.body.dataset.ftdNavDepth, '1');
  navigation.back();
  assert.equal(document.body.dataset.ftdScreen, 'MAIN_MENU');
  assert.equal(document.body.dataset.ftdNavDepth, '0');
});

/* ───────────── data-nav delegation & ESC (§1, §10) ───────────── */

import { installNavLinks, installEscHandler, back } from './registry';

/** Dispatches a minimal click at the delegated document listener. */
function clickVia(target: HTMLElement): void {
  (document as unknown as { dispatchEvent: (ev: unknown) => void }).dispatchEvent({
    type: 'click',
    target,
    preventDefault() {},
  });
}

function navButton(value: string, replace = false): HTMLElement {
  const btn = document.createElement('button');
  btn.setAttribute('data-nav', value);
  (btn as unknown as { dataset: Record<string, string> }).dataset.nav = value;
  if (replace) btn.setAttribute('data-nav-replace', '');
  document.body.appendChild(btn);
  return btn;
}

test('data-nav buttons push the named screen', () => {
  setup(['MAIN_MENU', 'SHOP'], ['SHOP']);
  const dispose = installNavLinks(document);
  const btn = navButton('SHOP');

  // Delegated listener lives on the document, so dispatch there.
  clickVia(btn);
  assert.equal(navigation.state, 'SHOP');
  dispose();
});

test('data-nav="back" and "home" work through delegation', () => {
  setup(['MAIN_MENU', 'SHOP', 'INVENTORY'], ['SHOP', 'INVENTORY']);
  const dispose = installNavLinks(document);

  navigation.open('SHOP');
  const backBtn = navButton('back');
  clickVia(backBtn);
  assert.equal(navigation.state, 'MAIN_MENU');

  navigation.open('SHOP');
  navigation.open('INVENTORY');
  const homeBtn = navButton('home');
  clickVia(homeBtn);
  assert.equal(navigation.state, 'MAIN_MENU');
  assert.equal(navigation.depth, 0);
  dispose();
});

test('ESC closes the top screen but never interrupts a match', () => {
  setup(['MAIN_MENU', 'SHOP', 'PLAY'], ['SHOP']);
  const handlers: Array<(ev: unknown) => void> = [];
  const fakeWin = {
    addEventListener: (type: string, fn: (ev: unknown) => void) => {
      if (type === 'keydown') handlers.push(fn);
    },
    removeEventListener: () => undefined,
  } as unknown as Window;

  installEscHandler(fakeWin);
  const press = () => handlers[0]({ key: 'Escape', code: 'Escape', preventDefault() {} });

  navigation.open('SHOP');
  press();
  assert.equal(navigation.state, 'MAIN_MENU', 'ESC must close an overlay');

  navigation.setState('PLAY');
  press();
  assert.equal(navigation.state, 'PLAY', 'ESC must not yank the player out of a match');
});

test('back() is a no-op rather than an error at the root', () => {
  setup(['TITLE']);
  navigation.reset('TITLE');
  assert.equal(back(), false);
  assert.equal(navigation.state, 'TITLE');
});
