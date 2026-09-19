/**
 * Data-driven combo configuration.
 *
 * Thresholds, multipliers and reset reasons all live here so combo behaviour
 * stays consistent across gameplay, rewards and UI.
 */

export interface ComboTier {
  combo: number;
  label: string;
  /** One-off bonus score awarded when this tier is first reached in a chain. */
  bonusScore: number;
  bonusHeroXp: number;
  colour: string;
}

export const COMBO_TIERS: ComboTier[] = [
  { combo: 5, label: 'Nice', bonusScore: 25, bonusHeroXp: 1, colour: '#fbbf24' },
  { combo: 10, label: 'Sharp', bonusScore: 60, bonusHeroXp: 2, colour: '#f97316' },
  { combo: 20, label: 'Brutal', bonusScore: 150, bonusHeroXp: 4, colour: '#fb7185' },
  { combo: 35, label: 'Insane', bonusScore: 320, bonusHeroXp: 7, colour: '#e879f9' },
  { combo: 50, label: 'Unstoppable', bonusScore: 600, bonusHeroXp: 12, colour: '#38bdf8' },
];

/** Score/reward scaling per combo point. Capped so combos stay fair. */
export const COMBO_SCALING = {
  perCombo: 0.08,
  maxBonus: 2.5,
  /** Base seconds a combo survives without a hit. */
  baseTimer: 1.35,
};

export function comboMultiplier(combo: number, comboRewardMultiplier = 1): number {
  const safe = Math.max(0, Math.floor(combo));
  return 1 + Math.min(COMBO_SCALING.maxBonus, safe * COMBO_SCALING.perCombo * comboRewardMultiplier);
}

export function comboTierAt(combo: number): ComboTier | null {
  const safe = Math.max(0, Math.floor(combo));
  return COMBO_TIERS.filter((t) => safe >= t.combo).pop() ?? null;
}

/** Tiers newly crossed moving from `from` to `to`. Used for one-off bonuses. */
export function comboTiersBetween(from: number, to: number): ComboTier[] {
  const a = Math.max(0, Math.floor(from));
  const b = Math.max(0, Math.floor(to));
  if (b <= a) return [];
  return COMBO_TIERS.filter((t) => t.combo > a && t.combo <= b);
}

/**
 * Every reason a combo may reset. Keeping this closed prevents the accidental
 * resets called out in §8 — anything not listed must NOT clear the combo.
 */
export type ComboResetReason =
  | 'miss'
  | 'explosive_mistake'
  | 'tower_damage'
  | 'leak'
  | 'match_end'
  | 'timeout';

export const COMBO_RESET_REASONS: ComboResetReason[] = [
  'miss',
  'explosive_mistake',
  'tower_damage',
  'leak',
  'match_end',
  'timeout',
];

export function isComboResetReason(reason: string): reason is ComboResetReason {
  return (COMBO_RESET_REASONS as string[]).includes(reason);
}
