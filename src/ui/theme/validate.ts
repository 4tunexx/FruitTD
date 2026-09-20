import { DEFAULT_THEME } from './defaultTheme';
import { THEME_SCHEMA_VERSION, type ButtonStyle, type PanelStyle, type Theme } from './types';

/** Result of validating an untrusted theme payload. */
export interface ThemeValidationResult {
  ok: boolean;
  theme: Theme;
  errors: string[];
  warnings: string[];
}

const COLOR_RE =
  /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)|hsla?\([^()]*\)|transparent|currentColor)$/;

const LENGTH_RE = /^-?\d*\.?\d+(px|rem|em|%|vh|vw|ch)$/;

/** Font stacks may not contain url()/expression()/js — only names & generics. */
const FONT_RE = /^[-\w\s'",.]+$/;

const SHADOW_RE = /^(none|[-\w\s.,()#%/]+)$/;

const BUTTON_STYLES: ButtonStyle[] = ['solid', 'outline', 'ghost', 'glass'];
const PANEL_STYLES: PanelStyle[] = ['glass', 'solid', 'outline', 'flat'];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Strips anything that could break out of a CSS value. */
export function sanitizeCssValue(value: string): string {
  return value.replace(/[;{}<>\\]/g, '').replace(/url\s*\(/gi, '').replace(/expression\s*\(/gi, '').trim();
}

function pickString(
  raw: Record<string, unknown>,
  key: string,
  fallback: string,
  re: RegExp,
  path: string,
  errors: string[],
): string {
  const v = raw[key];
  if (v === undefined) return fallback;
  if (typeof v !== 'string') {
    errors.push(`${path}.${key}: expected string`);
    return fallback;
  }
  const clean = sanitizeCssValue(v);
  if (!clean || !re.test(clean)) {
    errors.push(`${path}.${key}: invalid value "${v}"`);
    return fallback;
  }
  return clean;
}

function pickNumber(
  raw: Record<string, unknown>,
  key: string,
  fallback: number,
  min: number,
  max: number,
  path: string,
  errors: string[],
): number {
  const v = raw[key];
  if (v === undefined) return fallback;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    errors.push(`${path}.${key}: expected finite number`);
    return fallback;
  }
  if (v < min || v > max) {
    errors.push(`${path}.${key}: out of range (${min}–${max})`);
    return Math.min(max, Math.max(min, v));
  }
  return v;
}

function pickBool(raw: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = raw[key];
  return typeof v === 'boolean' ? v : fallback;
}

/** Only http(s), root-relative and data:image URLs are accepted for assets. */
export function sanitizeAssetUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return '';
  if (/["'()\\\s]/.test(v)) return null;
  if (/^https?:\/\/[^\s]+$/i.test(v)) return v;
  if (/^\/[^/\\][^\s]*$/.test(v)) return v;
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(v)) return v;
  return null;
}

function section(raw: unknown, key: string, errors: string[]): Record<string, unknown> {
  if (raw === undefined) return {};
  if (!isPlainObject(raw)) {
    errors.push(`${key}: expected object`);
    return {};
  }
  return raw;
}

/**
 * Validates and normalizes an untrusted theme object (e.g. imported JSON).
 * Never throws; unknown/invalid fields fall back to the default theme so the
 * UI always has a complete, renderable theme.
 */
export function validateTheme(input: unknown, base: Theme = DEFAULT_THEME): ThemeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(input)) {
    return { ok: false, theme: cloneTheme(base), errors: ['theme: expected an object'], warnings };
  }

  const version = typeof input.version === 'number' ? input.version : THEME_SCHEMA_VERSION;
  if (version > THEME_SCHEMA_VERSION) warnings.push(`theme.version ${version} is newer than supported ${THEME_SCHEMA_VERSION}`);

  const id =
    typeof input.id === 'string' && /^[a-z0-9][a-z0-9-_]{0,48}$/i.test(input.id.trim())
      ? input.id.trim()
      : (() => {
          if (input.id !== undefined) errors.push('theme.id: invalid id');
          return base.id;
        })();

  const name =
    typeof input.name === 'string' && input.name.trim().length > 0 && input.name.length <= 60
      ? input.name.trim().replace(/[<>]/g, '')
      : (() => {
          if (input.name !== undefined) errors.push('theme.name: invalid name');
          return base.name;
        })();

  const c = section(input.colors, 'colors', errors);
  const colors = { ...base.colors };
  (Object.keys(base.colors) as (keyof typeof colors)[]).forEach((k) => {
    colors[k] = pickString(c, k, base.colors[k], COLOR_RE, 'colors', errors);
  });

  const t = section(input.typography, 'typography', errors);
  const tSizes = section(t.sizes, 'typography.sizes', errors);
  const tWeights = section(t.weights, 'typography.weights', errors);
  const typography = {
    headingFont: pickString(t, 'headingFont', base.typography.headingFont, FONT_RE, 'typography', errors),
    bodyFont: pickString(t, 'bodyFont', base.typography.bodyFont, FONT_RE, 'typography', errors),
    numberFont: pickString(t, 'numberFont', base.typography.numberFont, FONT_RE, 'typography', errors),
    buttonFont: pickString(t, 'buttonFont', base.typography.buttonFont, FONT_RE, 'typography', errors),
    scale: pickNumber(t, 'scale', base.typography.scale, 0.6, 2, 'typography', errors),
    sizes: { ...base.typography.sizes },
    weights: { ...base.typography.weights },
  };
  (Object.keys(base.typography.sizes) as (keyof typeof typography.sizes)[]).forEach((k) => {
    typography.sizes[k] = pickString(tSizes, k, base.typography.sizes[k], LENGTH_RE, 'typography.sizes', errors);
  });
  (Object.keys(base.typography.weights) as (keyof typeof typography.weights)[]).forEach((k) => {
    typography.weights[k] = Math.round(
      pickNumber(tWeights, k, base.typography.weights[k], 100, 900, 'typography.weights', errors),
    );
  });

  const sh = section(input.shapes, 'shapes', errors);
  const shapes = {
    panelRadius: pickString(sh, 'panelRadius', base.shapes.panelRadius, LENGTH_RE, 'shapes', errors),
    buttonRadius: pickString(sh, 'buttonRadius', base.shapes.buttonRadius, LENGTH_RE, 'shapes', errors),
    cardRadius: pickString(sh, 'cardRadius', base.shapes.cardRadius, LENGTH_RE, 'shapes', errors),
    borderWidth: pickString(sh, 'borderWidth', base.shapes.borderWidth, LENGTH_RE, 'shapes', errors),
  };

  const e = section(input.effects, 'effects', errors);
  const effects = {
    shadow: pickString(e, 'shadow', base.effects.shadow, SHADOW_RE, 'effects', errors),
    shadowSoft: pickString(e, 'shadowSoft', base.effects.shadowSoft, SHADOW_RE, 'effects', errors),
    glow: pickString(e, 'glow', base.effects.glow, SHADOW_RE, 'effects', errors),
    blur: pickString(e, 'blur', base.effects.blur, LENGTH_RE, 'effects', errors),
    panelOpacity: pickNumber(e, 'panelOpacity', base.effects.panelOpacity, 0, 1, 'effects', errors),
    mutedOpacity: pickNumber(e, 'mutedOpacity', base.effects.mutedOpacity, 0, 1, 'effects', errors),
    backdropOpacity: pickNumber(e, 'backdropOpacity', base.effects.backdropOpacity, 0, 1, 'effects', errors),
  };

  const a = section(input.animation, 'animation', errors);
  const animation = {
    transitionSpeed: pickNumber(a, 'transitionSpeed', base.animation.transitionSpeed, 0, 2000, 'animation', errors),
    popupSpeed: pickNumber(a, 'popupSpeed', base.animation.popupSpeed, 0, 2000, 'animation', errors),
    hoverSpeed: pickNumber(a, 'hoverSpeed', base.animation.hoverSpeed, 0, 2000, 'animation', errors),
    screenTransition: pickNumber(a, 'screenTransition', base.animation.screenTransition, 0, 2000, 'animation', errors),
    easing: pickString(a, 'easing', base.animation.easing, /^[-\w\s.,()]+$/, 'animation', errors),
    reducedMotion: pickBool(a, 'reducedMotion', base.animation.reducedMotion),
  };

  const sp = section(input.spacing, 'spacing', errors);
  const spacing = { ...base.spacing };
  (Object.keys(base.spacing) as (keyof typeof spacing)[]).forEach((k) => {
    spacing[k] = pickString(sp, k, base.spacing[k], LENGTH_RE, 'spacing', errors);
  });

  const su = section(input.surfaces, 'surfaces', errors);
  const buttonStyle = BUTTON_STYLES.includes(su.buttonStyle as ButtonStyle)
    ? (su.buttonStyle as ButtonStyle)
    : (su.buttonStyle !== undefined && errors.push('surfaces.buttonStyle: unknown style'), base.surfaces.buttonStyle);
  const panelStyle = PANEL_STYLES.includes(su.panelStyle as PanelStyle)
    ? (su.panelStyle as PanelStyle)
    : (su.panelStyle !== undefined && errors.push('surfaces.panelStyle: unknown style'), base.surfaces.panelStyle);
  const surfaces = {
    buttonStyle,
    panelStyle,
    uppercaseLabels: pickBool(su, 'uppercaseLabels', base.surfaces.uppercaseLabels),
  };

  const as = section(input.assets, 'assets', errors);
  const assets = { ...base.assets };
  (Object.keys(base.assets) as (keyof typeof assets)[]).forEach((k) => {
    if (as[k] === undefined) return;
    const url = sanitizeAssetUrl(as[k]);
    if (url === null) {
      errors.push(`assets.${k}: unsafe or malformed URL`);
      return;
    }
    assets[k] = url;
  });

  const theme: Theme = {
    id,
    name,
    version: THEME_SCHEMA_VERSION,
    colors,
    typography,
    shapes,
    effects,
    animation,
    spacing,
    surfaces,
    assets,
  };

  return { ok: errors.length === 0, theme, errors, warnings };
}

export function cloneTheme(theme: Theme): Theme {
  return JSON.parse(JSON.stringify(theme)) as Theme;
}

/** Deep-merges a partial patch over a theme, then revalidates. */
export function mergeTheme(base: Theme, patch: unknown): Theme {
  if (!isPlainObject(patch)) return cloneTheme(base);
  const merged: Record<string, unknown> = { ...(cloneTheme(base) as unknown as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const current = merged[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      const inner: Record<string, unknown> = { ...current };
      for (const [k2, v2] of Object.entries(value)) {
        const cur2 = inner[k2];
        inner[k2] = isPlainObject(v2) && isPlainObject(cur2) ? { ...cur2, ...v2 } : v2;
      }
      merged[key] = inner;
    } else {
      merged[key] = value;
    }
  }
  return validateTheme(merged, base).theme;
}

/** Serializes a theme to pretty JSON (safe data only). */
export function exportThemeJson(theme: Theme): string {
  return JSON.stringify(validateTheme(theme).theme, null, 2);
}

/** Parses an imported JSON string. Never evaluates code. */
export function importThemeJson(json: string, base: Theme = DEFAULT_THEME): ThemeValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, theme: cloneTheme(base), errors: ['theme: not valid JSON'], warnings: [] };
  }
  return validateTheme(parsed, base);
}
