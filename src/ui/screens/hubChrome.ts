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

function desktopChromeEnabled(): boolean {
  return typeof window === 'undefined' || window.innerWidth >= 901;
}

export function applyHubChromeMode(root: HTMLElement, mode = getHubChromeMode()): void {
  const desktop = desktopChromeEnabled();
  root.classList.toggle('is-chrome-auto-hidden', desktop && mode === 'auto');
  root.classList.toggle('is-chrome-always', mode === 'always');
  root.classList.remove('is-chrome-revealed');
  const arriving = desktop && mode === 'auto' && root.classList.contains('is-arriving');
  const syncPanel = (slot: 'header' | 'footer', panel: HTMLElement | null) => {
    let hovered = false;
    try { hovered = Boolean(panel?.matches(':hover')); } catch { /* older DOM implementations may not support :hover */ }
    const focused = Boolean(panel && document.activeElement && panel.contains(document.activeElement));
    const revealed = !desktop || mode === 'always' || arriving || hovered || focused;
    root.classList.toggle(`is-chrome-${slot}-revealed`, revealed);
    if (panel) {
      panel.inert = !revealed;
      panel.setAttribute('aria-hidden', String(!revealed));
    }
    root.querySelector<HTMLElement>(`.ftd-hub-chrome-edge--${slot === 'header' ? 'top' : 'bottom'}`)
      ?.setAttribute('aria-expanded', String(revealed));
  };
  syncPanel('header', root.querySelector<HTMLElement>('.ftd-hub__header'));
  syncPanel('footer', root.querySelector<HTMLElement>('.ftd-hub__footer'));
}

/** Bind independent desktop edge controls for the persistent header and footer. */
export function bindHubChromeReveal(root: HTMLElement): void {
  if (root.dataset.hubChromeBound === 'true') {
    applyHubChromeMode(root);
    return;
  }
  root.dataset.hubChromeBound = 'true';
  const header = root.querySelector<HTMLElement>('.ftd-hub__header');
  const footer = root.querySelector<HTMLElement>('.ftd-hub__footer');
  const topEdge = document.createElement('button');
  topEdge.type = 'button';
  topEdge.className = 'ftd-hub-chrome-edge ftd-hub-chrome-edge--top';
  topEdge.setAttribute('aria-label', 'Reveal top header');
  topEdge.setAttribute('aria-expanded', 'false');
  topEdge.textContent = '⌄';
  const bottomEdge = document.createElement('button');
  bottomEdge.type = 'button';
  bottomEdge.className = 'ftd-hub-chrome-edge ftd-hub-chrome-edge--bottom';
  bottomEdge.setAttribute('aria-label', 'Reveal bottom navigation');
  bottomEdge.setAttribute('aria-expanded', 'false');
  bottomEdge.textContent = '⌃';
  root.append(topEdge, bottomEdge);

  const bindPanel = (panel: HTMLElement | null, edge: HTMLButtonElement, slot: 'header' | 'footer') => {
    if (!panel) return;
    const revealedClass = `is-chrome-${slot}-revealed`;
    let hideTimer = 0;
    const reveal = () => {
      if (!desktopChromeEnabled()) return;
      window.clearTimeout(hideTimer);
      root.classList.add(revealedClass);
      panel.inert = false;
      panel.setAttribute('aria-hidden', 'false');
      edge.setAttribute('aria-expanded', 'true');
    };
    const scheduleHide = () => {
      if (!desktopChromeEnabled()) return;
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        if (root.classList.contains('is-chrome-always') || panel.contains(document.activeElement)) return;
        root.classList.remove(revealedClass);
        panel.inert = true;
        panel.setAttribute('aria-hidden', 'true');
        edge.setAttribute('aria-expanded', 'false');
      }, 220);
    };
    const focusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && (panel.contains(next) || edge.contains(next))) return;
      scheduleHide();
    };
    for (const target of [panel, edge]) {
      target.addEventListener('pointerenter', reveal);
      target.addEventListener('pointerleave', scheduleHide);
      target.addEventListener('focusin', reveal);
      target.addEventListener('focusout', focusOut);
    }
    edge.addEventListener('click', reveal);
  };
  bindPanel(header, topEdge, 'header');
  bindPanel(footer, bottomEdge, 'footer');
  window.addEventListener('resize', () => applyHubChromeMode(root));
  applyHubChromeMode(root);
}
