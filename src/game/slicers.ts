/** Admin-authored slicers (blades) sold in the shop and shown in inventory. */

export type SlicerRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type SlicerFxStyle = 'solid' | 'spark' | 'plasma' | 'ember' | 'frost';

export interface CatalogSlicer {
  id: string;
  name: string;
  blurb: string;
  enabled: boolean;
  cost: number;
  sellValue: number;
  rarity: SlicerRarity;
  /** Primary trail / glint color as #rrggbb */
  color: string;
  /** Secondary glow color */
  glowColor: string;
  fxStyle: SlicerFxStyle;
  /** Trail thickness 0.5–3 */
  trailWidth: number;
  /** Glow strength 0–1 */
  glow: number;
  /** Sparkle / glint density 0–1 */
  glint: number;
  /** Slash damage multiplier (1 = normal) */
  damageMul: number;
  /** Juice bank gain multiplier */
  juiceMul: number;
  /** Extra brittle seconds applied on hit */
  brittleBonus: number;
}

export const DEFAULT_SLICERS: CatalogSlicer[] = [
  {
    id: 'blade-default',
    name: 'Steel Blade',
    blurb: 'Reliable starter edge.',
    enabled: true,
    cost: 0,
    sellValue: 0,
    rarity: 'common',
    color: '#1d4ed8',
    glowColor: '#38bdf8',
    fxStyle: 'solid',
    trailWidth: 1,
    glow: 0.35,
    glint: 0.2,
    damageMul: 1,
    juiceMul: 1,
    brittleBonus: 0,
  },
  {
    id: 'blade-gold',
    name: 'Gold Blade',
    blurb: 'Bright trail, richer juice.',
    enabled: true,
    cost: 180,
    sellValue: 60,
    rarity: 'rare',
    color: '#f4c430',
    glowColor: '#fde68a',
    fxStyle: 'spark',
    trailWidth: 1.25,
    glow: 0.55,
    glint: 0.55,
    damageMul: 1.08,
    juiceMul: 1.15,
    brittleBonus: 0,
  },
  {
    id: 'blade-ink',
    name: 'Ink Blade',
    blurb: 'Dark slash with heavy hits.',
    enabled: true,
    cost: 240,
    sellValue: 80,
    rarity: 'epic',
    color: '#111827',
    glowColor: '#a78bfa',
    fxStyle: 'plasma',
    trailWidth: 1.4,
    glow: 0.65,
    glint: 0.4,
    damageMul: 1.16,
    juiceMul: 1,
    brittleBonus: 0.4,
  },
  {
    id: 'blade-cherry',
    name: 'Cherry Blade',
    blurb: 'Pink glints and brittle fruit.',
    enabled: true,
    cost: 320,
    sellValue: 110,
    rarity: 'legendary',
    color: '#f472b6',
    glowColor: '#fecdd3',
    fxStyle: 'ember',
    trailWidth: 1.55,
    glow: 0.7,
    glint: 0.75,
    damageMul: 1.12,
    juiceMul: 1.2,
    brittleBonus: 0.8,
  },
];

export function hexToNumber(hex: string, fallback = 0x1d4ed8): number {
  const cleaned = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback;
  return parseInt(cleaned, 16);
}

export function newSlicerId(): string {
  return `blade-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptySlicer(): CatalogSlicer {
  return {
    id: newSlicerId(),
    name: 'New Slicer',
    blurb: 'Custom admin blade.',
    enabled: true,
    cost: 200,
    sellValue: 70,
    rarity: 'rare',
    color: '#a3e635',
    glowColor: '#ecfccb',
    fxStyle: 'spark',
    trailWidth: 1.2,
    glow: 0.5,
    glint: 0.5,
    damageMul: 1.05,
    juiceMul: 1.05,
    brittleBonus: 0.2,
  };
}

export function findSlicer(list: CatalogSlicer[], id: string | undefined | null): CatalogSlicer | undefined {
  if (!id) return undefined;
  return list.find((s) => s.id === id && s.enabled !== false) || list.find((s) => s.id === id);
}
