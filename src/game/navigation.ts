/**
 * FruitTD navigation controller.
 *
 * One source of truth for "what screen am I on". Screens are opened and closed
 * through this controller only — no feature code should toggle `.hidden` on
 * another screen's DOM, because that is how back/ESC/mobile-back stop working.
 *
 * Model:
 *   - A base state (TITLE / MAIN_MENU / PLAY / ...) plus a stack of screens
 *     pushed on top of it.
 *   - OPEN pushes, CLOSE/BACK pops, HOME unwinds to the menu.
 *   - The browser history is kept in sync so Android's back gesture works.
 */

export type NavState =
  | 'TITLE'
  | 'MAIN_MENU'
  | 'PLAY'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'PROFILE'
  | 'HEROES'
  | 'INVENTORY'
  | 'SHOP'
  | 'MISSIONS'
  | 'ACHIEVEMENTS'
  | 'RANKED'
  | 'CO_OP'
  | 'CREATOR'
  | 'SETTINGS'
  | 'ADMIN';

/** Screens that sit on top of the menu rather than replacing the game. */
export const OVERLAY_STATES: readonly NavState[] = [
  'PROFILE',
  'HEROES',
  'INVENTORY',
  'SHOP',
  'MISSIONS',
  'ACHIEVEMENTS',
  'RANKED',
  'CO_OP',
  'CREATOR',
  'SETTINGS',
  'ADMIN',
];

/** States that mean "a match is on screen". */
const IN_GAME: readonly NavState[] = ['PLAY', 'PAUSED', 'GAME_OVER'];

export const HOME_STATE: NavState = 'MAIN_MENU';

export interface NavChange {
  to: NavState;
  from: NavState;
  /** How the change happened, so screens can pick an animation direction. */
  via: 'open' | 'close' | 'back' | 'home' | 'set';
}

export type NavListener = (change: NavChange) => void;
/** Return false to veto a navigation (e.g. "abandon this match?"). */
export type NavGuard = (change: NavChange) => boolean;

export class NavigationController {
  private current: NavState = 'TITLE';
  private stack: NavState[] = [];
  private listeners: NavListener[] = [];
  private guards: NavGuard[] = [];
  private historyReady = false;
  /** Set while we drive history ourselves, so popstate doesn't double-handle. */
  private syncingHistory = false;

  get state(): NavState {
    return this.current;
  }

  /** Screens stacked on top of the base state, oldest first. */
  get breadcrumb(): NavState[] {
    return [...this.stack, this.current];
  }

  get depth(): number {
    return this.stack.length;
  }

  onChange(callback: NavListener): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  /**
   * Registers a veto. Used for "you are mid-match, really leave?" so a match is
   * never silently lost (§10).
   */
  addGuard(guard: NavGuard): () => void {
    this.guards.push(guard);
    return () => {
      this.guards = this.guards.filter((g) => g !== guard);
    };
  }

  private allowed(change: NavChange): boolean {
    return this.guards.every((guard) => guard(change));
  }

  private commit(to: NavState, via: NavChange['via']): boolean {
    const from = this.current;
    if (from === to && via !== 'open') return false;
    const change: NavChange = { to, from, via };
    if (!this.allowed(change)) return false;
    this.current = to;
    for (const listener of this.listeners) listener(change);
    this.syncHistory();
    return true;
  }

  /** Replaces the current screen without stacking (TITLE ↔ MAIN_MENU, PLAY). */
  setState(next: NavState): boolean {
    if (this.current === next) return false;
    // Moving to a base state clears anything stacked above it.
    this.stack = [];
    return this.commit(next, 'set');
  }

  /** Pushes a screen on top of the current one. BACK will return here. */
  open(screen: NavState): boolean {
    if (this.current === screen) return false;
    const previous = this.current;
    // Push BEFORE notifying: listeners read `breadcrumb` to decide which
    // ancestors stay mounted under an overlay, so the stack must already be
    // correct when they run.
    this.stack.push(previous);
    if (!this.commit(screen, 'open')) {
      this.stack.pop(); // vetoed — undo the push
      return false;
    }
    return true;
  }

  /** Pops the top screen. Same as BACK; kept for call-site readability. */
  close(): boolean {
    return this.back();
  }

  /**
   * Goes back one level. Falls back to a sensible parent when the stack is
   * empty so BACK is never a dead end (§1).
   */
  back(): boolean {
    if (this.stack.length > 0) {
      const target = this.stack[this.stack.length - 1];
      const change: NavChange = { to: target, from: this.current, via: 'back' };
      if (!this.allowed(change)) return false;
      this.stack.pop();
      this.current = target;
      for (const listener of this.listeners) listener(change);
      this.syncHistory();
      return true;
    }
    const fallback = this.fallbackFor(this.current);
    if (!fallback) return false;
    return this.commit(fallback, 'back');
  }

  /** Where BACK goes when nothing is stacked. */
  private fallbackFor(state: NavState): NavState | null {
    if (state === 'TITLE') return null;
    if (state === 'MAIN_MENU') return 'TITLE';
    if (state === 'PAUSED' || state === 'GAME_OVER') return HOME_STATE;
    if (state === 'PLAY') return HOME_STATE;
    return HOME_STATE;
  }

  /** Unwinds everything back to the main menu. */
  home(): boolean {
    if (this.current === HOME_STATE) {
      this.stack = [];
      return false;
    }
    const change: NavChange = { to: HOME_STATE, from: this.current, via: 'home' };
    if (!this.allowed(change)) return false;
    this.stack = [];
    this.current = HOME_STATE;
    for (const listener of this.listeners) listener(change);
    this.syncHistory();
    return true;
  }

  /** True when the given state is a stacked overlay rather than a base screen. */
  isOverlay(state: NavState = this.current): boolean {
    return OVERLAY_STATES.includes(state);
  }

  /** True when BACK has somewhere to go — drives whether to show a back button. */
  canGoBack(): boolean {
    return this.stack.length > 0 || this.fallbackFor(this.current) !== null;
  }

  isPlaying(): boolean {
    return this.current === 'PLAY';
  }

  isPaused(): boolean {
    return this.current === 'PAUSED';
  }

  isInGame(): boolean {
    return IN_GAME.includes(this.current);
  }

  /** Only true when the player can actually slash — not while paused/overlaid. */
  canInteract(): boolean {
    return this.current === 'PLAY';
  }

  /** True when a menu surface (not the match) owns the screen. */
  isMenu(): boolean {
    return !this.isInGame();
  }

  reset(to: NavState = 'TITLE'): void {
    this.stack = [];
    this.current = to;
  }

  /* ───────────── Browser / mobile back integration ───────────── */

  /**
   * Mirrors navigation into browser history so the Android back gesture and the
   * desktop back button pop a screen instead of leaving the game (§1, §9).
   */
  installHistoryIntegration(win: Window = window): () => void {
    if (this.historyReady) return () => undefined;
    this.historyReady = true;

    const onPopState = () => {
      if (this.syncingHistory) return;
      // The user went "back"; mirror it into our own stack.
      if (this.canGoBack()) {
        this.back();
      } else {
        // Nothing to pop — re-assert our entry so we don't fall out of the app.
        this.syncHistory();
      }
    };

    win.addEventListener('popstate', onPopState);
    try {
      win.history.replaceState({ ftdNav: this.current }, '');
    } catch {
      /* history unavailable (file://, sandbox) — navigation still works */
    }

    return () => {
      win.removeEventListener('popstate', onPopState);
      this.historyReady = false;
    };
  }

  /** Depth already represented in browser history, to avoid duplicate entries. */
  private historyDepth = 0;

  private syncHistory(): void {
    if (!this.historyReady || typeof window === 'undefined') return;
    const depth = this.depth;
    const entry = { ftdNav: this.current, depth };
    this.syncingHistory = true;
    try {
      if (depth > this.historyDepth) {
        // Going deeper: add exactly one entry so one back gesture pops one screen.
        window.history.pushState(entry, '');
      } else {
        // Same level or shallower: the popstate already consumed the entry.
        window.history.replaceState(entry, '');
      }
      this.historyDepth = depth;
    } catch {
      /* ignore */
    } finally {
      this.syncingHistory = false;
    }
  }
}

export const navigation = new NavigationController();
