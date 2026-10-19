import {
  AlertTriangle, Apple, ArrowLeft, ArrowUpCircle, Backpack, BadgeCheck, Banana, Bell, Bomb, BrainCircuit, CalendarCheck,
  CalendarDays, Castle, ChartNoAxesCombined, Cherry, ChevronsUp, Circle, CircleDot,
  Citrus, Coins, Crown, Diamond, Droplets, Flame, Gamepad2, Gauge, Gem, Gift,
  GitBranch, Hammer, Infinity, Landmark, Leaf, Link, LockKeyhole, Mail, Map, Medal, Move, Palette, Pause, Play, Plus,
  RotateCcw, ScanLine, Scissors, ScrollText, Settings, Shield, ShieldCheck, ShoppingBag, ShoppingCart, Skull, Slice,
  Sparkles, Sword, Swords, Target, Tornado, TowerControl, Trophy, UserRound, UsersRound,
  User, UserPlus, Users, Volume2, VolumeX, Waves, X, Zap, createElement, type IconNode,
} from 'lucide';
import { GAME_GLYPHS } from './gameGlyphs';
import { resolveIconAsset, ICON_ROLE_ALIASES, extractedIcon } from './extractedIcons';
import { getLiveConfig } from '../services/liveConfig';

const ICONS: Record<string, IconNode> = {
  AlertTriangle, Apple, ArrowLeft, ArrowUpCircle, Backpack, BadgeCheck, Banana, Bell, Bomb, BrainCircuit, CalendarCheck,
  CalendarDays, Castle, ChartNoAxesCombined, Cherry, ChevronsUp, Circle, CircleDot,
  Citrus, Coins, Crown, Diamond, Droplets, Flame, Gamepad2, Gauge, Gem, Gift,
  GitBranch, Hammer, Infinity, Landmark, Leaf, Link, LockKeyhole, Mail, Map, Medal, Move, Palette, Pause, Play, Plus,
  RotateCcw, ScanLine, Scissors, ScrollText, Settings, Shield, ShieldCheck, ShoppingBag, ShoppingCart, Skull, Slice,
  Sparkles, Sword, Swords, Target, Tornado, TowerControl, Trophy, UserRound, UsersRound,
  User, UserPlus, Users, Volume2, VolumeX, Waves, X, Zap,
};

/** Render only icons shipped with the application. Admin supplied names fall back safely. */
export function lucideIcon(name: string | null | undefined, className = '', size = 20): SVGElement | HTMLElement {
  const key = name || '';
  const fallback = ICON_ROLE_ALIASES[key] || key;
  // Replacing an SVG with a PNG (or restoring it) must not retain renderer classes.
  const cleanClass = className.split(/\s+/).filter(value => value && value !== 'ftd-extracted-icon' && value !== 'ftd-game-glyph').join(' ');
  const overrides = getLiveConfig().iconOverrides;
  const asset = resolveIconAsset(key,overrides);
  let icon: SVGElement | HTMLElement;
  if (asset) {
    const cssSized = /(?:^|\s)(?:ftd-mode-card__icon|ftd-hub-tab__icon|ftd-home-mode-detail__art)(?:\s|$)/.test(cleanClass);
    icon = extractedIcon(asset, cleanClass, cssSized ? 0 : size);
  } else if (typeof document.createElementNS !== 'function') {
    icon = document.createElement('span');
    icon.className = cleanClass;
    icon.setAttribute('aria-hidden', 'true');
  } else {
    const node = GAME_GLYPHS[fallback] ?? ICONS[fallback] ?? BadgeCheck;
    icon = createElement(node, { class: `${cleanClass}${GAME_GLYPHS[fallback] ? ' ftd-game-glyph' : ''}`.trim(), width: size, height: size, 'aria-hidden': 'true' });
  }
  icon.setAttribute('data-icon-role', key);
  icon.setAttribute('data-icon-size', String(size));
  return icon;
}

function refreshPublishedIcons(): void {
  document.querySelectorAll<SVGElement | HTMLElement>('[data-icon-role]').forEach((icon) => {
    const size = Number(icon.getAttribute('data-icon-size')) || 20;
    icon.parentElement?.replaceChild(lucideIcon(icon.getAttribute('data-icon-role'), icon.getAttribute('class') || '', size), icon);
  });
}

if (typeof window !== 'undefined') window.addEventListener('fruit-td-icons-update', refreshPublishedIcons);

export function mountLucideIcon(host: Element | null, name: string | null | undefined, size = 20): void {
  if (!host) return;
  host.replaceChildren(lucideIcon(name, '', size));
}

export const ADMIN_ICON_NAMES = Object.freeze(Object.keys(ICONS).sort());

export function mountLucidePlaceholders(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-lucide]').forEach((host) => {
    mountLucideIcon(host, host.dataset.lucide, Number(host.dataset.lucideSize) || 20);
  });
}
