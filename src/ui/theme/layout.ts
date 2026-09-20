/**
 * Layout configuration — separate from theme (colors) and from game logic.
 * Changing a layout preset must never require touching gameplay code.
 */

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export type MainMenuLayout = 'hero-focus' | 'centered' | 'left-rail' | 'cinematic' | 'compact';
export type DashboardLayout = 'hero-focus' | 'tower-focus' | 'compact' | 'cinematic' | 'split' | 'grid';
export type LogoPosition = 'top-left' | 'top-center' | 'top-right' | 'center' | 'left' | 'right';
export type NavigationStyle = 'tabs' | 'rail' | 'drawer' | 'bottom-bar';

export interface MainMenuLayoutConfig {
  layout: MainMenuLayout;
  background: 'parallax' | 'image' | 'flat' | 'gradient';
  logoPosition: LogoPosition;
  primaryAction: 'play' | 'continue' | 'login';
  secondaryActions: string[];
  playerPanel: 'hidden' | 'inline' | 'corner';
  navigationStyle: NavigationStyle;
}

export interface DashboardLayoutConfig {
  layout: DashboardLayout;
  navigationStyle: NavigationStyle;
  heroArtwork: 'large' | 'small' | 'hidden';
  columns: number;
  showAnnouncement: boolean;
}

/** How a screen is presented. The navigation layer understands these. */
export type SurfaceKind = 'fullscreen' | 'overlay' | 'modal' | 'drawer' | 'panel';

export interface ScreenPresentation {
  kind: SurfaceKind;
  /** Alternative presentation per breakpoint (e.g. modal on desktop, fullscreen on mobile). */
  responsive?: Partial<Record<Breakpoint, SurfaceKind>>;
  size?: 'sm' | 'md' | 'lg' | 'full';
  animation?: 'fade' | 'scale' | 'slide' | 'none';
}

export type ScreenId =
  | 'main-menu'
  | 'dashboard'
  | 'play'
  | 'heroes'
  | 'inventory'
  | 'shop'
  | 'missions'
  | 'achievements'
  | 'profile'
  | 'news'
  | 'settings'
  | 'hud'
  | 'admin'
  | 'theme-preview';

export interface LayoutConfig {
  id: string;
  name: string;
  mainMenu: MainMenuLayoutConfig;
  dashboard: DashboardLayoutConfig;
  screens: Record<ScreenId, ScreenPresentation>;
  responsive: {
    tabletMaxWidth: number;
    mobileMaxWidth: number;
    /** Stack primary actions vertically below this width. */
    stackButtonsBelow: number;
  };
}

export const DEFAULT_LAYOUT: LayoutConfig = {
  id: 'fruittd-default-layout',
  name: 'FruitTD Default Layout',
  mainMenu: {
    layout: 'hero-focus',
    background: 'parallax',
    logoPosition: 'top-center',
    primaryAction: 'play',
    secondaryActions: ['login', 'register', 'settings', 'quit'],
    playerPanel: 'corner',
    navigationStyle: 'tabs',
  },
  dashboard: {
    layout: 'hero-focus',
    navigationStyle: 'tabs',
    heroArtwork: 'large',
    columns: 3,
    showAnnouncement: true,
  },
  screens: {
    'main-menu': { kind: 'fullscreen', animation: 'fade' },
    dashboard: { kind: 'fullscreen', animation: 'fade' },
    play: { kind: 'fullscreen', animation: 'fade' },
    heroes: { kind: 'overlay', responsive: { mobile: 'fullscreen' }, size: 'lg', animation: 'scale' },
    inventory: { kind: 'overlay', responsive: { mobile: 'fullscreen' }, size: 'lg', animation: 'slide' },
    shop: { kind: 'overlay', responsive: { mobile: 'fullscreen' }, size: 'lg', animation: 'scale' },
    missions: { kind: 'overlay', responsive: { mobile: 'fullscreen' }, size: 'md', animation: 'slide' },
    achievements: { kind: 'overlay', responsive: { mobile: 'fullscreen' }, size: 'md', animation: 'slide' },
    profile: { kind: 'overlay', responsive: { mobile: 'fullscreen' }, size: 'md', animation: 'fade' },
    news: { kind: 'overlay', responsive: { mobile: 'fullscreen' }, size: 'md', animation: 'slide' },
    settings: { kind: 'modal', size: 'sm', animation: 'scale' },
    hud: { kind: 'panel', animation: 'none' },
    admin: { kind: 'modal', size: 'full', animation: 'fade' },
    'theme-preview': { kind: 'fullscreen', animation: 'fade' },
  },
  responsive: {
    tabletMaxWidth: 1024,
    mobileMaxWidth: 720,
    stackButtonsBelow: 560,
  },
};

/** Alternative layout presets — experimentation without touching gameplay. */
export const LAYOUT_PRESETS: LayoutConfig[] = [
  DEFAULT_LAYOUT,
  {
    ...DEFAULT_LAYOUT,
    id: 'compact-layout',
    name: 'Compact',
    mainMenu: { ...DEFAULT_LAYOUT.mainMenu, layout: 'compact', logoPosition: 'top-left', background: 'flat' },
    dashboard: { ...DEFAULT_LAYOUT.dashboard, layout: 'compact', heroArtwork: 'small', columns: 2 },
  },
  {
    ...DEFAULT_LAYOUT,
    id: 'cinematic-layout',
    name: 'Cinematic',
    mainMenu: { ...DEFAULT_LAYOUT.mainMenu, layout: 'cinematic', logoPosition: 'center', background: 'image' },
    dashboard: { ...DEFAULT_LAYOUT.dashboard, layout: 'cinematic', heroArtwork: 'large', columns: 2 },
  },
  {
    ...DEFAULT_LAYOUT,
    id: 'mobile-first-layout',
    name: 'Mobile First',
    mainMenu: { ...DEFAULT_LAYOUT.mainMenu, layout: 'centered', navigationStyle: 'bottom-bar' },
    dashboard: { ...DEFAULT_LAYOUT.dashboard, layout: 'grid', navigationStyle: 'drawer', columns: 1 },
  },
];

export function breakpointForWidth(width: number, config: LayoutConfig = DEFAULT_LAYOUT): Breakpoint {
  if (width <= config.responsive.mobileMaxWidth) return 'mobile';
  if (width <= config.responsive.tabletMaxWidth) return 'tablet';
  return 'desktop';
}

/** Resolves the presentation kind for a screen at a given breakpoint. */
export function presentationFor(
  screen: ScreenId,
  breakpoint: Breakpoint,
  config: LayoutConfig = DEFAULT_LAYOUT,
): ScreenPresentation {
  const base = config.screens[screen] ?? { kind: 'overlay' as SurfaceKind };
  const override = base.responsive?.[breakpoint];
  return override ? { ...base, kind: override } : base;
}

export function findLayoutPreset(id: string): LayoutConfig | null {
  return LAYOUT_PRESETS.find((l) => l.id === id) ?? null;
}

/** Writes layout choices to the DOM as data attributes so CSS can respond. */
export function applyLayoutToDom(config: LayoutConfig, root?: HTMLElement): void {
  const el = root ?? document.documentElement;
  el.dataset.ftdLayout = config.id;
  el.dataset.ftdMenuLayout = config.mainMenu.layout;
  el.dataset.ftdMenuLogo = config.mainMenu.logoPosition;
  el.dataset.ftdMenuNav = config.mainMenu.navigationStyle;
  el.dataset.ftdDashLayout = config.dashboard.layout;
  el.dataset.ftdDashNav = config.dashboard.navigationStyle;
  el.dataset.ftdDashArt = config.dashboard.heroArtwork;
  el.style.setProperty('--ftd-dash-columns', String(config.dashboard.columns));
}

let activeLayout: LayoutConfig = DEFAULT_LAYOUT;

export function getLayout(): LayoutConfig {
  return activeLayout;
}

export function setLayout(config: LayoutConfig): LayoutConfig {
  activeLayout = config;
  if (typeof document !== 'undefined') applyLayoutToDom(config);
  return activeLayout;
}

export function currentBreakpoint(): Breakpoint {
  const width = typeof window === 'undefined' ? 1280 : window.innerWidth;
  return breakpointForWidth(width, activeLayout);
}
