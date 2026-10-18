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
import { ICON_ASSETS, extractedIcon } from './extractedIcons';
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
  const asset = getLiveConfig().iconOverrides[key] || ICON_ASSETS[key];
  if (asset) {
    const cssSized = /(?:^|\s)(?:ftd-mode-card__icon|ftd-hub-tab__icon|ftd-home-mode-detail__art)(?:\s|$)/.test(className);
    const icon = extractedIcon(asset, className, cssSized ? 0 : size);
    icon.dataset.iconRole = key;
    return icon;
  }
  const node = GAME_GLYPHS[name || ''] ?? ICONS[name || ''] ?? BadgeCheck;
  if (typeof document.createElementNS !== 'function') {
    const fallback = document.createElement('span');
    fallback.className = className;
    fallback.setAttribute('aria-hidden', 'true');
    return fallback;
  }
  return createElement(node, { class: `${className}${GAME_GLYPHS[name || ''] ? ' ftd-game-glyph' : ''}`.trim(), width: size, height: size, 'aria-hidden': 'true' });
}

function refreshPublishedIcons(): void {
  document.querySelectorAll<HTMLElement>('.ftd-extracted-icon[data-icon-role]').forEach((icon) => {
    const size = Number.parseFloat(icon.style.width) || 20;
    icon.replaceWith(lucideIcon(icon.dataset.iconRole, icon.className, size));
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
