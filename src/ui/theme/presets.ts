import { DEFAULT_THEME } from './defaultTheme';
import type { Theme } from './types';
import { mergeTheme } from './validate';

/**
 * Built-in visual presets. Presets contain ONLY visual configuration —
 * never progression, currency, ownership or game rules.
 */
export const BUILTIN_PRESETS: Theme[] = [
  DEFAULT_THEME,
  mergeTheme(DEFAULT_THEME, {
    id: 'dark-arena',
    name: 'Dark Arena',
    colors: {
      primary: '#f97316',
      secondary: '#7c2d12',
      accent: '#facc15',
      background: '#08080b',
      panel: 'rgba(255, 255, 255, 0.05)',
      panelSecondary: 'rgba(255, 255, 255, 0.09)',
      border: 'rgba(249, 115, 22, 0.25)',
      text: '#fafaf9',
      textMuted: '#a8a29e',
      combo: '#f97316',
    },
    effects: { glow: '0 0 20px rgba(249, 115, 22, 0.45)' },
  }),
  mergeTheme(DEFAULT_THEME, {
    id: 'clean-competitive',
    name: 'Clean Competitive',
    colors: {
      primary: '#38bdf8',
      secondary: '#0284c7',
      accent: '#22d3ee',
      background: '#0b1220',
      panel: 'rgba(15, 23, 42, 0.85)',
      panelSecondary: 'rgba(30, 41, 59, 0.9)',
      border: 'rgba(148, 163, 184, 0.22)',
      text: '#e2e8f0',
      textMuted: '#94a3b8',
    },
    shapes: { panelRadius: '0.25rem', buttonRadius: '0.25rem', cardRadius: '0.25rem' },
    effects: { glow: 'none', blur: '4px', shadow: '0 8px 20px rgba(0, 0, 0, 0.35)' },
    surfaces: { panelStyle: 'solid', buttonStyle: 'outline' },
  }),
  mergeTheme(DEFAULT_THEME, {
    id: 'neon',
    name: 'Neon',
    colors: {
      primary: '#e879f9',
      secondary: '#7c3aed',
      accent: '#22d3ee',
      background: '#0a021a',
      panel: 'rgba(124, 58, 237, 0.14)',
      panelSecondary: 'rgba(232, 121, 249, 0.14)',
      border: 'rgba(232, 121, 249, 0.35)',
      text: '#fdf4ff',
      textMuted: '#c4b5fd',
      xp: '#22d3ee',
      combo: '#e879f9',
    },
    shapes: { panelRadius: '1rem', buttonRadius: '999px', cardRadius: '0.9rem' },
    effects: { glow: '0 0 26px rgba(232, 121, 249, 0.6)', blur: '16px' },
    surfaces: { buttonStyle: 'glass', panelStyle: 'glass' },
  }),
  mergeTheme(DEFAULT_THEME, {
    id: 'classic',
    name: 'Classic',
    colors: {
      primary: '#84cc16',
      secondary: '#3f6212',
      accent: '#eab308',
      background: '#12160f',
      panel: 'rgba(20, 26, 16, 0.92)',
      panelSecondary: 'rgba(32, 40, 24, 0.95)',
      border: 'rgba(132, 204, 22, 0.28)',
      text: '#f7fee7',
      textMuted: '#a3b18a',
    },
    shapes: { panelRadius: '0.5rem', buttonRadius: '0.4rem', cardRadius: '0.5rem', borderWidth: '2px' },
    effects: { blur: '0px', glow: 'none' },
    surfaces: { panelStyle: 'solid', buttonStyle: 'solid', uppercaseLabels: false },
  }),
];

export function findPreset(id: string): Theme | null {
  return BUILTIN_PRESETS.find((p) => p.id === id) ?? null;
}

export function presetSummaries(): { id: string; name: string }[] {
  return BUILTIN_PRESETS.map((p) => ({ id: p.id, name: p.name }));
}
