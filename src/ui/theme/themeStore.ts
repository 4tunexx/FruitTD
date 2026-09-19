import { DEFAULT_THEME } from './defaultTheme';
import { applyThemeToDom } from './cssVars';
import { BUILTIN_PRESETS, findPreset } from './presets';
import type { Theme } from './types';
import { cloneTheme, exportThemeJson, importThemeJson, mergeTheme, validateTheme } from './validate';

const ACTIVE_KEY = 'fruittd-theme-active-v1';
const CUSTOM_KEY = 'fruittd-theme-custom-v1';

type Listener = (theme: Theme) => void;

function hasStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Runtime holder for the active theme.
 * Gameplay code never touches this — only UI/theme layers do.
 */
class ThemeStore {
  private current: Theme = cloneTheme(DEFAULT_THEME);
  private listeners = new Set<Listener>();
  private booted = false;

  get(): Theme {
    return this.current;
  }

  /** Loads the persisted theme (if any) and applies it to the DOM. */
  boot(): Theme {
    if (this.booted) return this.current;
    this.booted = true;
    const stored = this.readStored();
    if (stored) this.current = stored;
    this.apply();
    return this.current;
  }

  private readStored(): Theme | null {
    if (!hasStorage()) return null;
    try {
      const custom = localStorage.getItem(CUSTOM_KEY);
      if (custom) {
        const res = importThemeJson(custom);
        if (res.theme) return res.theme;
      }
      const activeId = localStorage.getItem(ACTIVE_KEY);
      if (activeId) return findPreset(activeId) ? cloneTheme(findPreset(activeId)!) : null;
    } catch {
      /* ignore corrupt storage – fall back to default */
    }
    return null;
  }

  /** Replaces the whole theme (validated) and notifies listeners. */
  set(theme: unknown, opts: { persist?: boolean } = {}): Theme {
    const res = validateTheme(theme);
    this.current = res.theme;
    this.apply();
    if (opts.persist !== false) this.persist();
    return this.current;
  }

  /** Applies a partial patch — used by the live theme editor. */
  patch(patch: unknown, opts: { persist?: boolean } = {}): Theme {
    this.current = mergeTheme(this.current, patch);
    this.apply();
    if (opts.persist !== false) this.persist();
    return this.current;
  }

  usePreset(id: string): Theme | null {
    const preset = findPreset(id);
    if (!preset) return null;
    this.set(cloneTheme(preset));
    if (hasStorage()) {
      try {
        localStorage.setItem(ACTIVE_KEY, id);
      } catch {
        /* storage full / blocked */
      }
    }
    return this.current;
  }

  reset(): Theme {
    if (hasStorage()) {
      try {
        localStorage.removeItem(CUSTOM_KEY);
        localStorage.removeItem(ACTIVE_KEY);
      } catch {
        /* ignore */
      }
    }
    return this.set(cloneTheme(DEFAULT_THEME), { persist: false });
  }

  export(): string {
    return exportThemeJson(this.current);
  }

  import(json: string) {
    const res = importThemeJson(json);
    if (res.ok || res.errors.length < 8) this.set(res.theme);
    return res;
  }

  presets(): Theme[] {
    return BUILTIN_PRESETS;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private persist(): void {
    if (!hasStorage()) return;
    try {
      localStorage.setItem(CUSTOM_KEY, exportThemeJson(this.current));
    } catch {
      /* ignore */
    }
  }

  private apply(): void {
    if (typeof document !== 'undefined') applyThemeToDom(this.current);
    this.listeners.forEach((fn) => fn(this.current));
  }
}

export const themeStore = new ThemeStore();
export type { Theme };
