import type { Theme } from './types';

/** CSS custom property prefix for every FruitTD theme token. */
export const VAR_PREFIX = '--ftd';

function cssUrl(value: string): string {
  return value ? `url("${value}")` : 'none';
}

function scaled(size: string, scale: number): string {
  const m = /^(-?\d*\.?\d+)(px|rem|em|%)$/.exec(size);
  if (!m || scale === 1) return size;
  return `${Math.round(Number(m[1]) * scale * 1000) / 1000}${m[2]}`;
}

/**
 * Flattens a theme into the `--ftd-*` CSS variable map consumed by every
 * component. This is the ONLY place theme data becomes CSS.
 */
export function themeToCssVars(theme: Theme): Record<string, string> {
  const v: Record<string, string> = {};
  const set = (k: string, value: string | number) => {
    v[`${VAR_PREFIX}-${k}`] = String(value);
  };

  for (const [key, value] of Object.entries(theme.colors)) {
    set(`color-${kebab(key)}`, value);
  }

  const scale = theme.typography.scale;
  set('font-heading', theme.typography.headingFont);
  set('font-body', theme.typography.bodyFont);
  set('font-number', theme.typography.numberFont);
  set('font-button', theme.typography.buttonFont);
  set('font-scale', scale);
  for (const [key, value] of Object.entries(theme.typography.sizes)) {
    set(`text-${key}`, scaled(value, scale));
  }
  for (const [key, value] of Object.entries(theme.typography.weights)) {
    set(`weight-${key}`, value);
  }

  set('radius-panel', theme.shapes.panelRadius);
  set('radius-button', theme.shapes.buttonRadius);
  set('radius-card', theme.shapes.cardRadius);
  set('border-width', theme.shapes.borderWidth);

  set('shadow', theme.effects.shadow);
  set('shadow-soft', theme.effects.shadowSoft);
  set('glow', theme.effects.glow);
  set('blur', theme.effects.blur);
  set('panel-opacity', theme.effects.panelOpacity);
  set('muted-opacity', theme.effects.mutedOpacity);
  set('backdrop-opacity', theme.effects.backdropOpacity);

  const rm = theme.animation.reducedMotion;
  set('speed-transition', `${rm ? 0 : theme.animation.transitionSpeed}ms`);
  set('speed-popup', `${rm ? 0 : theme.animation.popupSpeed}ms`);
  set('speed-hover', `${rm ? 0 : theme.animation.hoverSpeed}ms`);
  set('speed-screen', `${rm ? 0 : theme.animation.screenTransition}ms`);
  set('easing', theme.animation.easing);

  for (const [key, value] of Object.entries(theme.spacing)) {
    set(`space-${kebab(key)}`, value);
  }

  for (const [key, value] of Object.entries(theme.assets)) {
    set(`asset-${kebab(key)}`, cssUrl(value));
  }

  return v;
}

function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Applies theme variables + data attributes to a root element (default <html>). */
export function applyThemeToDom(theme: Theme, root?: HTMLElement): void {
  const el = root ?? document.documentElement;
  const vars = themeToCssVars(theme);
  for (const [key, value] of Object.entries(vars)) el.style.setProperty(key, value);
  el.dataset.ftdTheme = theme.id;
  el.dataset.ftdButtonStyle = theme.surfaces.buttonStyle;
  el.dataset.ftdPanelStyle = theme.surfaces.panelStyle;
  el.dataset.ftdUppercase = theme.surfaces.uppercaseLabels ? 'on' : 'off';
  el.dataset.ftdMotion = theme.animation.reducedMotion ? 'reduced' : 'full';
}

/** Produces a `:root { … }` stylesheet string (useful for export/debug). */
export function themeToCssText(theme: Theme, selector = ':root'): string {
  const vars = themeToCssVars(theme);
  const body = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}
