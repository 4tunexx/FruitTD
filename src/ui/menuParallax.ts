/** Subtle menu / match background parallax from pointer (PC) and orientation / touch (phone). */

const MAX_SHIFT = 18;
const MAX_ZOOM = 0.035;
const SOFT_SCALE = 0.45;

let booted = false;
let targetX = 0;
let targetY = 0;
let curX = 0;
let curY = 0;
let raf = 0;
let soft = false;

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setTargets(nx: number, ny: number): void {
  // nx/ny in [-1, 1]
  const scale = soft ? SOFT_SCALE : 1;
  targetX = Math.max(-1, Math.min(1, nx)) * scale;
  targetY = Math.max(-1, Math.min(1, ny)) * scale;
}

function applyLayers(): void {
  const zoom = 1 + Math.hypot(curX, curY) * MAX_ZOOM;
  document.documentElement.style.setProperty('--parallax-x', `${(curX * MAX_SHIFT).toFixed(2)}px`);
  document.documentElement.style.setProperty('--parallax-y', `${(curY * MAX_SHIFT).toFixed(2)}px`);
  document.documentElement.style.setProperty('--parallax-zoom', zoom.toFixed(4));

  document.querySelectorAll<HTMLElement>('[data-parallax-root]').forEach((root) => {
    const softRoot = root.hasAttribute('data-parallax-soft');
    const mul = softRoot ? SOFT_SCALE : 1;
    root.style.setProperty('--parallax-x', `${(curX * MAX_SHIFT * mul).toFixed(2)}px`);
    root.style.setProperty('--parallax-y', `${(curY * MAX_SHIFT * mul).toFixed(2)}px`);
    root.style.setProperty('--parallax-zoom', (1 + Math.hypot(curX, curY) * MAX_ZOOM * mul).toFixed(4));
  });
}

function tick(): void {
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
  const beta = typeof e.beta === 'number' ? e.beta : 0; // -180..180 front-back
  const gamma = typeof e.gamma === 'number' ? e.gamma : 0; // -90..90 left-right
  setTargets(gamma / 45, beta / 45);
}

/** Call once after DOM ready. Safe to call multiple times. */
export function bootMenuParallax(): void {
  if (booted || reducedMotion()) return;
  booted = true;

  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('touchmove', onTouch, { passive: true });
  window.addEventListener('deviceorientation', onOrient, { passive: true });

  // Soften when match HUD visible (game running) — still subtle
  const obs = new MutationObserver(() => {
    const start = document.getElementById('hud-start');
    const title = document.getElementById('title-screen');
    const menusOpen =
      (start && !start.classList.contains('hidden')) ||
      (title && !title.classList.contains('hidden'));
    soft = !menusOpen;
  });
  const start = document.getElementById('hud-start');
  const title = document.getElementById('title-screen');
  if (start) obs.observe(start, { attributes: true, attributeFilter: ['class'] });
  if (title) obs.observe(title, { attributes: true, attributeFilter: ['class'] });

  raf = requestAnimationFrame(tick);
}

export function stopMenuParallax(): void {
  if (!booted) return;
  booted = false;
  cancelAnimationFrame(raf);
  window.removeEventListener('pointermove', onPointer);
  window.removeEventListener('touchmove', onTouch);
  window.removeEventListener('deviceorientation', onOrient);
}
