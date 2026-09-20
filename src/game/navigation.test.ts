import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NavigationController, OVERLAY_STATES, type NavState } from './navigation';

function nav(): NavigationController {
  const controller = new NavigationController();
  controller.reset('MAIN_MENU');
  return controller;
}

/* ───────────────── Core state machine (§1) ───────────────── */

test('every required screen state is navigable', () => {
  const required: NavState[] = [
    'TITLE', 'MAIN_MENU', 'PLAY', 'PAUSED', 'GAME_OVER', 'PROFILE', 'HEROES',
    'INVENTORY', 'SHOP', 'MISSIONS', 'ACHIEVEMENTS', 'RANKED', 'CO_OP',
    'CREATOR', 'SETTINGS', 'ADMIN',
  ];
  for (const state of required) {
    const controller = nav();
    controller.setState(state);
    assert.equal(controller.state, state, `${state} must be reachable`);
  }
});

test('OPEN stacks and BACK returns to the previous screen', () => {
  const controller = nav();
  controller.open('SHOP');
  assert.equal(controller.state, 'SHOP');
  assert.equal(controller.depth, 1);

  controller.back();
  assert.equal(controller.state, 'MAIN_MENU');
  assert.equal(controller.depth, 0);
});

test('BACK unwinds a deep stack one screen at a time', () => {
  const controller = nav();
  controller.open('PROFILE');
  controller.open('HEROES');
  controller.open('SHOP');
  assert.deepEqual(controller.breadcrumb, ['MAIN_MENU', 'PROFILE', 'HEROES', 'SHOP']);

  controller.back();
  assert.equal(controller.state, 'HEROES');
  controller.back();
  assert.equal(controller.state, 'PROFILE');
  controller.back();
  assert.equal(controller.state, 'MAIN_MENU');
});

test('BACK always works — it is never a dead end', () => {
  for (const state of OVERLAY_STATES) {
    const controller = nav();
    controller.setState(state);
    assert.equal(controller.canGoBack(), true, `${state} must offer BACK`);
    assert.equal(controller.back(), true, `${state} BACK must do something`);
    assert.equal(controller.state, 'MAIN_MENU');
  }
});

test('BACK from the title screen is the only dead end', () => {
  const controller = new NavigationController();
  controller.reset('TITLE');
  assert.equal(controller.canGoBack(), false);
  assert.equal(controller.back(), false);
  assert.equal(controller.state, 'TITLE');
});

test('HOME unwinds the whole stack at once', () => {
  const controller = nav();
  controller.open('PROFILE');
  controller.open('SHOP');
  controller.open('INVENTORY');
  controller.home();
  assert.equal(controller.state, 'MAIN_MENU');
  assert.equal(controller.depth, 0);
});

test('CLOSE is equivalent to BACK', () => {
  const controller = nav();
  controller.open('SHOP');
  controller.close();
  assert.equal(controller.state, 'MAIN_MENU');
});

test('switching base state clears anything stacked above it', () => {
  const controller = nav();
  controller.open('SHOP');
  controller.open('INVENTORY');
  controller.setState('PLAY');
  assert.equal(controller.depth, 0);
  assert.equal(controller.state, 'PLAY');
});

test('opening the screen you are already on does nothing', () => {
  const controller = nav();
  controller.open('SHOP');
  const depth = controller.depth;
  assert.equal(controller.open('SHOP'), false);
  assert.equal(controller.depth, depth, 'must not stack a duplicate');
});

/* ───────────────── Guards: never lose a match (§10) ───────────────── */

test('a guard can veto leaving a live match', () => {
  const controller = nav();
  controller.setState('PLAY');
  controller.addGuard((change) => !(change.from === 'PLAY' && change.to === 'MAIN_MENU'));

  assert.equal(controller.home(), false);
  assert.equal(controller.state, 'PLAY', 'the match must survive a vetoed exit');
});

test('a guard that allows the change lets navigation through', () => {
  const controller = nav();
  controller.setState('PLAY');
  let asked = 0;
  controller.addGuard(() => {
    asked++;
    return true;
  });
  controller.home();
  assert.ok(asked > 0, 'the guard must actually be consulted');
  assert.equal(controller.state, 'MAIN_MENU');
});

test('guards can be removed', () => {
  const controller = nav();
  const remove = controller.addGuard(() => false);
  assert.equal(controller.setState('SHOP'), false);
  remove();
  assert.equal(controller.setState('SHOP'), true);
});

test('pausing and resuming is never blocked by the leave-match guard', () => {
  const controller = nav();
  controller.setState('PLAY');
  controller.addGuard((change) => {
    const leaving = change.from === 'PLAY' && change.to !== 'PAUSED';
    return !leaving;
  });
  assert.equal(controller.setState('PAUSED'), true);
  assert.equal(controller.state, 'PAUSED');
});

/* ───────────────── Listeners ───────────────── */

test('listeners receive the direction of travel', () => {
  const controller = nav();
  const seen: string[] = [];
  controller.onChange((change) => seen.push(`${change.from}->${change.to}:${change.via}`));

  controller.open('SHOP');
  controller.back();
  controller.setState('PLAY');

  assert.deepEqual(seen, [
    'MAIN_MENU->SHOP:open',
    'SHOP->MAIN_MENU:back',
    'MAIN_MENU->PLAY:set',
  ]);
});

test('listeners can be unsubscribed', () => {
  const controller = nav();
  let count = 0;
  const off = controller.onChange(() => count++);
  controller.open('SHOP');
  off();
  controller.back();
  assert.equal(count, 1);
});

/* ───────────────── Helpers ───────────────── */

test('interaction is only allowed while actually playing', () => {
  const controller = nav();
  controller.setState('PLAY');
  assert.equal(controller.canInteract(), true);

  controller.setState('PAUSED');
  assert.equal(controller.canInteract(), false, 'paused must block slicing');

  controller.open('SHOP');
  assert.equal(controller.canInteract(), false, 'an open overlay must block slicing');
});

test('in-game and menu states are mutually exclusive', () => {
  const controller = nav();
  for (const state of ['PLAY', 'PAUSED', 'GAME_OVER'] as NavState[]) {
    controller.setState(state);
    assert.equal(controller.isInGame(), true, `${state} is in-game`);
    assert.equal(controller.isMenu(), false);
  }
  for (const state of ['MAIN_MENU', 'SHOP', 'PROFILE'] as NavState[]) {
    controller.setState(state);
    assert.equal(controller.isInGame(), false, `${state} is not in-game`);
    assert.equal(controller.isMenu(), true);
  }
});

test('overlay screens are identified correctly', () => {
  const controller = nav();
  assert.equal(controller.isOverlay('SHOP'), true);
  assert.equal(controller.isOverlay('INVENTORY'), true);
  assert.equal(controller.isOverlay('MAIN_MENU'), false);
  assert.equal(controller.isOverlay('PLAY'), false);
});

/* ───────────────── Mobile back gesture (§1, §9) ───────────────── */

test('history integration pops a screen instead of leaving the game', () => {
  const listeners: Array<(ev: unknown) => void> = [];
  const fakeWindow = {
    addEventListener: (type: string, fn: (ev: unknown) => void) => {
      if (type === 'popstate') listeners.push(fn);
    },
    removeEventListener: () => undefined,
    history: { pushState: () => undefined, replaceState: () => undefined },
  } as unknown as Window;

  const controller = nav();
  controller.installHistoryIntegration(fakeWindow);
  controller.open('SHOP');
  assert.equal(listeners.length, 1, 'a popstate listener must be registered');

  // Simulate the Android back gesture.
  listeners[0]({});
  assert.equal(controller.state, 'MAIN_MENU', 'back gesture must pop the screen');
});

test('history integration is installed only once', () => {
  let added = 0;
  const fakeWindow = {
    addEventListener: () => { added++; },
    removeEventListener: () => undefined,
    history: { pushState: () => undefined, replaceState: () => undefined },
  } as unknown as Window;

  const controller = nav();
  controller.installHistoryIntegration(fakeWindow);
  controller.installHistoryIntegration(fakeWindow);
  assert.equal(added, 1);
});

test('navigation still works when history is unavailable', () => {
  const fakeWindow = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    history: {
      pushState: () => { throw new Error('blocked'); },
      replaceState: () => { throw new Error('blocked'); },
    },
  } as unknown as Window;

  const controller = nav();
  controller.installHistoryIntegration(fakeWindow);
  // Must not throw despite history being unusable.
  controller.open('SHOP');
  assert.equal(controller.state, 'SHOP');
  controller.back();
  assert.equal(controller.state, 'MAIN_MENU');
});
