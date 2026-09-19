/**
 * FruitTD theme system — type definitions.
 *
 * A theme is PURE VISUAL DATA. It must never contain gameplay state
 * (coins, xp, hero ownership, rank, rules) and never executable code.
 */

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  panel: string;
  panelSecondary: string;
  border: string;
  text: string;
  textMuted: string;
  success: string;
  warning: string;
  danger: string;
  xp: string;
  coins: string;
  tower: string;
  combo: string;
}

export interface ThemeTypography {
  headingFont: string;
  bodyFont: string;
  numberFont: string;
  buttonFont: string;
  /** Multiplier applied to every font size (0.75 – 1.5). */
  scale: number;
  sizes: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    display: string;
  };
  weights: {
    body: number;
    heading: number;
    button: number;
    number: number;
  };
}

export interface ThemeShapes {
  panelRadius: string;
  buttonRadius: string;
  cardRadius: string;
  borderWidth: string;
}

export interface ThemeEffects {
  shadow: string;
  shadowSoft: string;
  glow: string;
  blur: string;
  /** 0..1 – opacity of panel fills. */
  panelOpacity: number;
  /** 0..1 – opacity of dimmed/disabled content. */
  mutedOpacity: number;
  /** 0..1 – modal backdrop darkness. */
  backdropOpacity: number;
}

export interface ThemeAnimation {
  /** ms */
  transitionSpeed: number;
  popupSpeed: number;
  hoverSpeed: number;
  screenTransition: number;
  easing: string;
  reducedMotion: boolean;
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  screenPadding: string;
  panelPadding: string;
  gridGap: string;
}

export type ButtonStyle = 'solid' | 'outline' | 'ghost' | 'glass';
export type PanelStyle = 'glass' | 'solid' | 'outline' | 'flat';

export interface ThemeSurfaces {
  buttonStyle: ButtonStyle;
  panelStyle: PanelStyle;
  /** Uppercase button/tab labels. */
  uppercaseLabels: boolean;
}

/** Asset slots a theme may override. Values are validated URLs (or ''). */
export interface ThemeAssets {
  logo: string;
  background: string;
  panelBackground: string;
  buttonImage: string;
  heroArtwork: string;
  menuArtwork: string;
  favicon: string;
  decor: string;
}

export interface Theme {
  /** Stable id, e.g. "fruittd-default". */
  id: string;
  /** Human readable name. */
  name: string;
  /** Schema version for migrations. */
  version: number;
  colors: ThemeColors;
  typography: ThemeTypography;
  shapes: ThemeShapes;
  effects: ThemeEffects;
  animation: ThemeAnimation;
  spacing: ThemeSpacing;
  surfaces: ThemeSurfaces;
  assets: ThemeAssets;
}

export type PartialTheme = {
  [K in keyof Theme]?: Theme[K] extends string | number
    ? Theme[K]
    : Partial<Theme[K]>;
};

export const THEME_SCHEMA_VERSION = 1;
