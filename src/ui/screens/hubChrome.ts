export type HubChromeMode = 'auto' | 'always';

const STORAGE_KEY = 'fruit-td-hub-chrome-mode';

export function getHubChromeMode(): HubChromeMode {
  try { return localStorage.getItem(STORAGE_KEY) === 'always' ? 'always' : 'auto'; }
  catch { return 'auto'; }
}

export function setHubChromeMode(mode: HubChromeMode): void {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* keep the current session preference */ }
  const hub = document.getElementById('screen-hub');
  if (hub) applyHubChromeMode(hub, mode);
}

export function applyHubChromeMode(root: HTMLElement, mode = getHubChromeMode()): void {
  root.classList.toggle('is-chrome-auto-hidden', mode === 'auto');
  root.classList.toggle('is-chrome-always', mode === 'always');
  if (mode === 'always') root.classList.remove('is-chrome-revealed');
  else if (root.classList.contains('is-arriving')) root.classList.add('is-chrome-revealed');
  else root.classList.remove('is-chrome-revealed');
}

/** Bind the top and bottom edge hot-zones that reveal the persistent chrome. */
export function bindHubChromeReveal(root: HTMLElement): void {
  const header = root.querySelector<HTMLElement>('.ftd-hub__header');
  const footer = root.querySelector<HTMLElement>('.ftd-hub__footer');
  const topEdge = document.createElement('div');
  topEdge.className = 'ftd-hub-chrome-edge ftd-hub-chrome-edge--top';
  topEdge.setAttribute('aria-hidden', 'true');
  const bottomEdge = document.createElement('div');
  bottomEdge.className = 'ftd-hub-chrome-edge ftd-hub-chrome-edge--bottom';
  bottomEdge.setAttribute('aria-hidden', 'true');
  root.append(topEdge, bottomEdge);

  let hideTimer = 0;
  const reveal = () => {
    window.clearTimeout(hideTimer);
    root.classList.add('is-chrome-revealed');
  };
  const scheduleHide = () => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => root.classList.remove('is-chrome-revealed'), 180);
  };
  for (const target of [header, footer, topEdge, bottomEdge]) {
    target?.addEventListener('pointerenter', reveal);
    target?.addEventListener('pointerleave', scheduleHide);
    target?.addEventListener('focusin', reveal);
    target?.addEventListener('focusout', scheduleHide);
  }
  applyHubChromeMode(root);
}
