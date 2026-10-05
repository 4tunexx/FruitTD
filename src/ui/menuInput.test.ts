import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDomStub, resetDom } from './domStub.test-helper';
installDomStub();
import { installMenuInput } from './menuInput';

test('keyboard and gamepad focus ignore hidden dialogs and stay inside the visible legacy modal', () => {
  resetDom();
  const globals = globalThis as any;
  const saved = { input: globals.HTMLInputElement, textarea: globals.HTMLTextAreaElement, select: globals.HTMLSelectElement, computed: globals.getComputedStyle, frame: globals.requestAnimationFrame };
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const pad = { buttons: Array.from({ length: 16 }, () => ({ pressed: false })), axes: [0, 0] };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { getGamepads: () => [pad] } });
  let nextFrame!: FrameRequestCallback;
  globals.requestAnimationFrame = (callback: FrameRequestCallback) => { nextFrame = callback; return 1; };
  globals.HTMLInputElement = class {}; globals.HTMLTextAreaElement = class {}; globals.HTMLSelectElement = class {};
  globals.getComputedStyle = () => ({ visibility: 'visible' });
  const doc = document as any;
  const make = (tag: string, y = 0) => {
    const node = document.createElement(tag) as any;
    node.getClientRects = () => node.classList.contains('hidden') ? [] : [{}];
    node.getBoundingClientRect = () => ({ x: 0, y, width: 120, height: 30 });
    node.focus = () => { doc.activeElement = node; }; node.scrollIntoView = () => {};
    return node;
  };
  const hiddenStory = make('section'); hiddenStory.className = 'hud-modal-backdrop hidden';
  const title = make('section'); title.id = 'title-screen';
  const play = make('button'); play.setAttribute('data-testid', 'nav-play'); title.append(play);
  title.querySelectorAll = () => [play];
  const settings = make('section'); settings.className = 'hud-modal-backdrop';
  const close = make('button', 20); close.className = 'modal-close-btn'; const mute = make('button', 80); settings.append(close, mute);
  let titleClicks = 0; play.addEventListener('click', () => titleClicks++);
  close.addEventListener('click', () => settings.classList.add('hidden'));
  settings.querySelectorAll = () => [close, mute];
  document.body.append(hiddenStory, title, settings); doc.activeElement = play;
  try {
    installMenuInput();
    const down = () => document.dispatchEvent({ type: 'keydown', key: 'ArrowDown', target: doc.activeElement, preventDefault() {} } as unknown as Event);
    down(); assert.equal(doc.activeElement, close, 'focus moves into Settings instead of the hidden story or title');
    down(); assert.equal(doc.activeElement, mute);
    settings.classList.add('hidden'); down(); assert.equal(doc.activeElement, play, 'closing Settings restores title controls');
    settings.classList.remove('hidden'); doc.activeElement = play;
    pad.buttons[0]!.pressed = true; nextFrame(200);
    assert.equal(titleClicks, 0, 'gamepad A cannot activate the title behind Settings');
    assert.equal(doc.activeElement, close);
    pad.buttons[0]!.pressed = false; pad.buttons[1]!.pressed = true; nextFrame(400);
    assert.equal(settings.classList.contains('hidden'), true, 'gamepad B closes the visible Settings modal');
  } finally {
    globals.HTMLInputElement = saved.input; globals.HTMLTextAreaElement = saved.textarea; globals.HTMLSelectElement = saved.select; globals.getComputedStyle = saved.computed; globals.requestAnimationFrame = saved.frame;
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor); else delete globals.navigator;
    resetDom();
  }
});
