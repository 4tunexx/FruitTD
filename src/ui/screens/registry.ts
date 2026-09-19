/**
 * Screen registry — the bridge between the navigation controller and the DOM.
 *
 * A screen registers once with how to show/hide itself. The registry then
 * reacts to navigation changes. Feature code calls `go()/openScreen()/back()`
 * and never touches another screen's classes, which is what makes BACK, ESC
 * and the mobile back gesture work everywhere (§1, §10).
 */

import { navigation, type NavChange, type NavState } from '../../game/navigation';

export interface ScreenDef {
  id: NavState;
  /** Element id in index.html, when the screen is markup-backed. */
  elementId?: string;
  /** Called when the screen becomes visible. */
  onEnter?: (change: NavChange) => void;
  /** Called when the screen is left. */
  onExit?: (change: NavChange) => void;
  /** Custom visibility, for screens that are not a simple `.hidden` toggle. */
  setVisible?: (visible: boolean, change: NavChange) => void;
  /**
   * Overlay screens render on top of the menu, so the menu stays mounted
   * underneath instead of being torn down.
   */
  overlay?: boolean;
}

const screens = new Map<NavState, ScreenDef>();
/** Screens currently painted on-screen. */
const shownIds = new Set<NavState>();
let installed = false;

export function registerScreen(def: ScreenDef): void {
  screens.set(def.id, def);
}

export function getScreen(id: NavState): ScreenDef | undefined {
  return screens.get(id);
}

export function registeredScreens(): NavState[] {
  return [...screens.keys()];
}

/** Test seam — drops all registrations and listeners. */
export function resetRegistry(): void {
  screens.clear();
  shownIds.clear();
  installed = false;
}

function applyVisibility(def: ScreenDef, visible: boolean, change: NavChange): void {
  if (def.setVisible) {
    def.setVisible(visible, change);
    return;
  }
  if (!def.elementId) return;
  const el = typeof document !== 'undefined' ? document.getElementById(def.elementId) : null;
  if (!el) return;
  el.classList.toggle('hidden', !visible);
  el.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

/**
 * Shows exactly the screens that should be visible for `change.to`, hiding the
 * rest. Overlays keep their parent visible beneath them.
 */
function render(change: NavChange): void {
  const target = change.to;
  const def = screens.get(target);
  // An overlay keeps whatever is underneath on screen.
  const visibleIds = new Set<NavState>([target]);
  if (def?.overlay) {
    for (const parent of navigation.breadcrumb) visibleIds.add(parent);
  }

  for (const [id, screen] of screens) {
    const shouldShow = visibleIds.has(id);
    const wasShown = shownIds.has(id);
    if (shouldShow === wasShown) continue;
    applyVisibility(screen, shouldShow, change);
    if (shouldShow) {
      shownIds.add(id);
      screen.onEnter?.(change);
    } else {
      shownIds.delete(id);
      screen.onExit?.(change);
    }
  }

  if (typeof document !== 'undefined') {
    document.body.dataset.ftdScreen = target;
    document.body.dataset.ftdNavDepth = String(navigation.depth);
  }
}

/** Wires the registry to the navigation controller. Call once at startup. */
export function installScreenRouter(): void {
  if (installed) return;
  installed = true;
  navigation.onChange(render);
  // Paint the current state so the first screen is correct without a change.
  render({ to: navigation.state, from: navigation.state, via: 'set' });
}

/* ───────────── Navigation helpers used by UI code ───────────── */

/** Replaces the current base screen. */
export function go(state: NavState): boolean {
  return navigation.setState(state);
}

/** Pushes a screen; BACK returns to where the player was. */
export function openScreen(state: NavState): boolean {
  return navigation.open(state);
}

export function closeScreen(): boolean {
  return navigation.close();
}

export function back(): boolean {
  return navigation.back();
}

export function home(): boolean {
  return navigation.home();
}

/**
 * Binds every `[data-nav]` element in the document.
 *
 *   data-nav="SHOP"       → push the shop
 *   data-nav="back"       → back
 *   data-nav="home"       → main menu
 *   data-nav-replace      → replace instead of push
 *
 * Delegated from the document, so markup rendered later is wired automatically
 * and no screen needs its own click plumbing (§1, §12).
 */
export function installNavLinks(root: Document | HTMLElement = document): () => void {
  const handler = (event: Event) => {
    const start = event.target as HTMLElement | null;
    const el = start?.closest?.('[data-nav]') as HTMLElement | null;
    if (!el) return;
    const value = el.dataset.nav;
    if (!value) return;
    event.preventDefault();
    if (value === 'back') {
      back();
    } else if (value === 'home') {
      home();
    } else if (el.hasAttribute('data-nav-replace')) {
      go(value as NavState);
    } else {
      openScreen(value as NavState);
    }
  };
  root.addEventListener('click', handler);
  return () => root.removeEventListener('click', handler);
}

/**
 * ESC closes the top screen on desktop. Gameplay keeps its own pause handling,
 * so ESC is ignored while a match is actually running (§1).
 */
export function installEscHandler(win: Window = window): () => void {
  const handler = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' && event.code !== 'Escape') return;
    if (navigation.isInGame()) return; // pause logic owns ESC during a match
    if (!navigation.canGoBack()) return;
    event.preventDefault();
    back();
  };
  win.addEventListener('keydown', handler);
  return () => win.removeEventListener('keydown', handler);
}
