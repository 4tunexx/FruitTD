/** Directional menu focus for keyboard and standard gamepad layouts. */
import { navigation } from '../game/navigation';

type Direction = 'left' | 'right' | 'up' | 'down';
function visible(node: HTMLElement): boolean {
  return node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden';
}
function visibleDialog(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"],.hud-modal-backdrop')].filter(visible).at(-1);
}
function controls(): HTMLElement[] {
  const scope = visibleDialog() || [...document.querySelectorAll<HTMLElement>('#screen-hub,#title-screen')].find(visible);
  if (!scope) return [];
  return [...scope.querySelectorAll<HTMLElement>('button:not(:disabled),select,a[href],summary')]
    .filter(visible);
}

function move(direction: Direction): void {
  const items = controls(); if (!items.length) return;
  const active = document.activeElement as HTMLElement;
  if (!items.includes(active)) { (items.find(item => item.getAttribute('data-testid') === 'nav-play') || items[0]!).focus(); return; }
  const rect = active.getBoundingClientRect();
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'left' || direction === 'up' ? -1 : 1;
  const x = rect.x + rect.width / 2; const y = rect.y + rect.height / 2;
  const ranked = items.filter(item => item !== active).map(item => {
    const box = item.getBoundingClientRect();
    const dx = box.x + box.width / 2 - x; const dy = box.y + box.height / 2 - y;
    const forward = (horizontal ? dx : dy) * sign;
    return { item, forward, distance: forward + Math.abs(horizontal ? dy : dx) * 3 };
  }).filter(entry => entry.forward > 2).sort((a, b) => a.distance - b.distance);
  if (ranked[0]) { ranked[0].item.focus(); ranked[0].item.scrollIntoView({ block:'nearest', inline:'nearest' }); }
}

export function installMenuInput(): void {
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (navigation.state === 'PLAY') return;
    const directions: Record<string, Direction> = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down' };
    const direction = directions[event.key];
    if (direction && controls().length) { event.preventDefault(); move(direction); }
  });
  let frame = 0; let last = 0; let previous: boolean[] = [];
  const poll = (now: number) => {
    const pad = navigator.getGamepads?.().find(Boolean);
    if (!pad) { frame = 0; previous = []; return; }
    const pressed = pad.buttons.map(button => button.pressed);
    if (navigation.state !== 'PLAY' && controls().length) {
      if (pressed[0] && !previous[0]) {
        const items = controls(); const active = document.activeElement as HTMLElement;
        if (items.includes(active)) active.click(); else items[0]?.focus();
      }
      if (pressed[1] && !previous[1]) {
        const close = visibleDialog()?.querySelector<HTMLButtonElement>('.modal-close-btn,.ftd-surface__close');
        const exit = document.querySelector<HTMLButtonElement>('.ftd-pvp.is-battle .ftd-duel-clock button');
        if (close) close.click(); else if (exit) exit.click(); else navigation.back();
      }
      const direction = pressed[14] || pad.axes[0]! < -.6 ? 'left' : pressed[15] || pad.axes[0]! > .6 ? 'right' : pressed[12] || pad.axes[1]! < -.6 ? 'up' : pressed[13] || pad.axes[1]! > .6 ? 'down' : null;
      if (direction && now - last > 180) { move(direction); last = now; }
    }
    previous = pressed; frame = requestAnimationFrame(poll);
  };
  const start = () => { if (!frame) frame = requestAnimationFrame(poll); };
  window.addEventListener('gamepadconnected', start);
  if (navigator.getGamepads?.().some(Boolean)) start();
}
