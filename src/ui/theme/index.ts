/**
 * FruitTD UI/theme architecture — public entry point.
 *
 *   GAME DATA → UI COMPONENT → THEME → LAYOUT → SCREEN
 *
 * Gameplay code must never import from here to make visual decisions, and this
 * layer must never import gameplay state.
 */
export * from './types';
export { DEFAULT_THEME } from './defaultTheme';
export { BUILTIN_PRESETS, findPreset, presetSummaries } from './presets';
export { themeStore } from './themeStore';
export { applyThemeToDom, themeToCssVars, themeToCssText, VAR_PREFIX } from './cssVars';
export {
  validateTheme,
  mergeTheme,
  cloneTheme,
  exportThemeJson,
  importThemeJson,
  sanitizeAssetUrl,
  sanitizeCssValue,
  type ThemeValidationResult,
} from './validate';
export * from './layout';
export {
  THEME_ASSET_SLOTS,
  isThemeAssetSlot,
  uploadThemeAsset,
  setThemeAsset,
  clearThemeAsset,
  getThemeAsset,
  type ThemeAssetSlot,
} from './themeAssets';

import './theme.css';
import { themeStore } from './themeStore';
import { DEFAULT_LAYOUT, findLayoutPreset, setLayout } from './layout';

/** Boots theme + layout and applies them to the DOM. Call once at startup. */
export function initThemeSystem(): void {
  themeStore.boot();
  let layout = DEFAULT_LAYOUT;
  try {
    const stored = localStorage.getItem('fruittd-layout-active-v1');
    if (stored) layout = findLayoutPreset(stored) ?? DEFAULT_LAYOUT;
  } catch {
    /* storage unavailable — default layout */
  }
  setLayout(layout);
}
