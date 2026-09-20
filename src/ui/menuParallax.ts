/** Subtle menu / dashboard parallax from pointer (PC) and orientation / touch (phone).
 *  Fully stopped while PLAYING/PAUSED — no soft in-match parallax. */

import { navigation } from '../game/navigation';

const MAX_SHIFT = 18;
const MAX_ZOOM = 0.035;

let booted = false;
let active = false;
let targetX = 0;
let targetY = 0;
let curX = 0;
let curY = 0;
let raf = 0;
let cachedRoots: HTMLElement[] = [];
let menuObs: MutationObserver | null = null;
let rootObs: MutationObserver | null = null;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function menusVisible(): boolean {
  const start = document.getElementById('hud-start');
  const title = document.getElementById('title-screen');
  return (
    (!!start && !start.classList.contains('hidden')) ||
    (!!title && !title.classList.contains('hidden'))
  );
}

/** Only when title or dashboard is showing — never during PLAYING/PAUSED. */
function shouldRun(): boolean {
  if (reducedMotion()) return false;
  if (navigation.isInGame()) return false;
  return menusVisible();
}

function refreshRoots(): void {
  cachedRoots = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax-root]'));
}

function setTargets(nx: number, ny: number): void {
  targetX = Math.max(-1, Math.min(1, nx));
  targetY = Math.max(-1, Math.min(1, ny));
}

function applyLayers(): void {
  const zoom = 1 + Math.hypot(curX, curY) * MAX_ZOOM;
  const xPx = `${(curX * MAX_SHIFT).toFixed(2)}px`;
  const yPx = `${(curY * MAX_SHIFT).toFixed(2)}px`;
  const zoomStr = zoom.toFixed(4);
  document.documentElement.style.setProperty('--parallax-x', xPx);
  document.documentElement.style.setProperty('--parallax-y', yPx);
  document.documentElement.style.setProperty('--parallax-zoom', zoomStr);

  for (const root of cachedRoots) {
    root.style.setProperty('--parallax-x', xPx);
    root.style.setProperty('--parallax-y', yPx);
    root.style.setProperty('--parallax-zoom', zoomStr);
  }
}

function clearLayers(): void {
  document.documentElement.style.setProperty('--parallax-x', '0px');
  document.documentElement.style.setProperty('--parallax-y', '0px');
  document.documentElement.style.setProperty('--parallax-zoom', '1');
  for (const root of cachedRoots) {
    root.style.setProperty('--parallax-x', '0px');
    root.style.setProperty('--parallax-y', '0px');
    root.style.setProperty('--parallax-zoom', '1');
  }
}

function tick(): void {
  if (!active) return;
  curX += (targetX - curX) * 0.08;
  curY += (targetY - curY) * 0.08;
  applyLayers();
  raf = requestAnimationFrame(tick);
}

function onPointer(e: PointerEvent): void {
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  setTargets((e.clientX / w) * 2 - 1, (e.clientY / h) * 2 - 1);
}

function onTouch(e: TouchEvent): void {
  const t = e.touches[0];
  if (!t) return;
  const w = window.innerWidth || 1;
  const h = window.innerHeight || 1;
  setTargets((t.clientX / w) * 2 - 1, (t.clientY / h) * 2 - 1);
}

function onOrient(e: DeviceOrientationEvent): void {
  const beta = typeof e.beta === 'number' ? e.beta : 0;
  const gamma = typeof e.gamma === 'number' ? e.gamma : 0;
  setTargets(gamma / 45, beta / 45);
}

function startActive(): void {
  if (active) return;
  active = true;
  refreshRoots();
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('deviceorientation', onOrient, { passive: true });
  raf = requestAnimationFrame(tick);
}

function stopActive(): void {
  if (!active) return;
  active = false;
  cancelAnimationFrame(raf);
  raf = 0;
  window.removeEventListener('pointermove', onPointer);
  window.removeEventListener('touchmove', onTouch);
  window.removeEventListener('deviceorientation', onOrient);
  targetX = 0;
  targetY = 0;
  curX = 0;
  curY = 0;
  clearLayers();
}

/** Re-evaluate whether parallax should run (menus vs in-match). */
export function syncMenuParallax(): void {
  if (!booted) return;
  if (shouldRun()) startActive();
  else stopActive();
}

/** Call once after DOM ready. Safe to call multiple times. */
export function bootMenuParallax(): void {
  if (booted) return;
  booted = true;

  menuObs = new MutationObserver(() => syncMenuParallax());
  const start = document.getElementById('hud-start');
  const title = document.getElementById('title-screen');
  if (start) menuObs.observe(start, { attributes: true, attributeFilter: ['class'] });
  if (title) menuObs.observe(title, { attributes: true, attributeFilter: ['class'] });

  rootObs = new MutationObserver(() => {
    if (active) refreshRoots();
  });
  rootObs.observe(document.body, { childList: true, subtree: true });

  navigation.onChange(() => syncMenuParallax());

  syncMenuParallax();
}

export function stopMenuParallax(): void {
  if (!booted) return;
  booted = false;
  stopActive();
  menuObs?.disconnect();
  rootObs?.disconnect();
  menuObs = null;
  rootObs = null;
}
