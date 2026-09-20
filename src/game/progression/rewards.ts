/**
 * Central reward pipeline.
 *
 *   GAME EVENT → REWARD CALCULATION → PLAYER PROGRESSION → SAVE → UI FEEDBACK
 *
 * This module owns the CALCULATION step only: it is pure, synchronous and has
 * no side effects, so rewards can be unit-tested and can never be granted
 * twice by accident. Applying the result is `applyRewards` in `progression.ts`.
 */
import { enemyRule, type EnemyKind } from '../enemies';
import { COMBO_TIERS, comboMultiplier } from './combo';

export type RewardEventType =
  | 'fruit_sliced'
  | 'special_enemy_killed'
  | 'boss_defeated'
  | 'combo_milestone'
  | 'wave_cleared'
  | 'perfect_wave'
  | 'bomb_parry'
  | 'reslice'
  | 'match_completed'
  | 'game_over';

export interface RewardEvent {
  type: RewardEventType;
  /** Base score value of the target (fruit definition score, etc.). */
  baseScore?: number;
  enemyKind?: EnemyKind;
  boss?: boolean;
  combo?: number;
  wave?: number;
  score?: number;
  /** Reslice generation depth. */
  generation?: number;
}

/** The single shape every reward flows through. */
export interface RewardBundle {
  score: number;
  coins: number;
  heroXp: number;
  towerXp: number;
  /** Human-readable reason, used for UI feedback/telemetry. */
  reason: RewardEventType;
}

export interface RewardModifiers {
  /** Live-config / admin score multiplier. */
  scoreMultiplier: number;
  /** Mode currency multiplier. */
  currencyMultiplier: number;
  /** VIP coin multiplier. */
  vipCoinMultiplier: number;
  /** VIP XP multiplier. */
  vipXpMultiplier: number;
  /** Tower milestone combo reward multiplier. */
  comboRewardMultiplier: number;
  /** Tower milestone Last Stand multiplier (applied when low on lives). */
  lastStandMultiplier: number;
  /** Tower milestone perfect-wave XP multiplier. */
  perfectWaveXpMultiplier: number;
  /** Hero perk XP bonus. */
  heroXpMultiplier: number;
  /** True when the player is in Last Stand territory. */
  lowHealth: boolean;
}

export function defaultModifiers(): RewardModifiers {
  return {
    scoreMultiplier: 1,
    currencyMultiplier: 1,
    vipCoinMultiplier: 1,
    vipXpMultiplier: 1,
    comboRewardMultiplier: 1,
    lastStandMultiplier: 1,
    perfectWaveXpMultiplier: 1,
    heroXpMultiplier: 1,
    lowHealth: false,
  };
}

export const EMPTY_REWARD: Readonly<RewardBundle> = Object.freeze({
  score: 0,
  coins: 0,
  heroXp: 0,
  towerXp: 0,
  reason: 'fruit_sliced' as RewardEventType,
});

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/**
 * Pure reward calculation. Special-enemy score/XP multipliers are applied here
 * — this is the only place they reach the economy, which guarantees §7's
 * "all special enemy reward multipliers must actually reach the reward system".
 */
export function calculateReward(event: RewardEvent, mods: RewardModifiers = defaultModifiers()): RewardBundle {
  const rule = enemyRule(event.enemyKind ?? 'normal');
  const combo = Math.max(0, Math.floor(event.combo ?? 0));
  const comboMul = comboMultiplier(combo, mods.comboRewardMultiplier);
  const lastStand = mods.lowHealth ? mods.lastStandMultiplier : 1;

  let score = 0;
  let coins = 0;
  let heroXp = 0;
  let towerXp = 0;

  switch (event.type) {
    case 'fruit_sliced':
    case 'special_enemy_killed': {
      const base = Math.max(0, event.baseScore ?? 0) * (event.boss ? 4 : 1);
      score = base * rule.scoreMultiplier * comboMul * lastStand;
      heroXp = (event.boss ? 4 : 1) * rule.xpMultiplier;
      towerXp = score / 6;
      coins = score * 0.6;
      break;
    }
    case 'boss_defeated': {
      const base = Math.max(0, event.baseScore ?? 0);
      score = base * 4 * rule.scoreMultiplier * comboMul * lastStand;
      heroXp = 12 * rule.xpMultiplier;
      towerXp = score / 4;
      coins = score * 0.8;
      break;
    }
    case 'bomb_parry': {
      const base = Math.max(0, event.baseScore ?? 0);
      score = base * comboMul * lastStand;
      heroXp = 1;
      towerXp = score / 6;
      coins = score * 0.6;
      break;
    }
    case 'reslice': {
      const gen = Math.max(1, Math.floor(event.generation ?? 1));
      score = 4 * gen * comboMul;
      towerXp = score / 6;
      coins = score * 0.6;
      break;
    }
    case 'combo_milestone': {
      const tier = COMBO_TIERS.filter((t) => combo >= t.combo).pop();
      if (!tier) return { ...EMPTY_REWARD, reason: event.type };
      score = tier.bonusScore * mods.comboRewardMultiplier;
      heroXp = tier.bonusHeroXp;
      coins = tier.bonusScore * 0.3;
      break;
    }
    case 'wave_cleared': {
      const wave = Math.max(1, Math.floor(event.wave ?? 1));
      score = 20 + wave * 10;
      heroXp = 3 + Math.floor(wave / 2);
      towerXp = 8 + wave * 2;
      coins = 10 + wave * 3;
      break;
    }
    case 'perfect_wave': {
      const wave = Math.max(1, Math.floor(event.wave ?? 1));
      const bonus = (3 + wave * 0.75) * mods.perfectWaveXpMultiplier;
      score = bonus * 4;
      heroXp = Math.max(2, Math.round(bonus / 2));
      towerXp = bonus;
      coins = bonus;
      break;
    }
    case 'match_completed':
    case 'game_over': {
      const finalScore = Math.max(0, event.score ?? 0);
      coins = Math.max(2, finalScore / 18);
      heroXp = Math.max(1, finalScore / 400);
      towerXp = Math.max(1, finalScore / 200);
      break;
    }
  }

  return {
    score: clampNonNegative(score * mods.scoreMultiplier),
    coins: clampNonNegative(coins * mods.currencyMultiplier * mods.vipCoinMultiplier),
    heroXp: clampNonNegative(heroXp * mods.vipXpMultiplier * mods.heroXpMultiplier),
    towerXp: clampNonNegative(towerXp),
    reason: event.type,
  };
}

export function addRewards(a: RewardBundle, b: RewardBundle): RewardBundle {
  return {
    score: a.score + b.score,
    coins: a.coins + b.coins,
    heroXp: a.heroXp + b.heroXp,
    towerXp: a.towerXp + b.towerXp,
    reason: b.reason,
  };
}

export function isEmptyReward(reward: RewardBundle): boolean {
  return reward.score === 0 && reward.coins === 0 && reward.heroXp === 0 && reward.towerXp === 0;
}
