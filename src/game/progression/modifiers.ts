/**
 * Collects the live reward modifiers from every system that legitimately
 * influences rewards (mode rules, admin live config, VIP, tower milestones,
 * hero perks) into the single struct the reward calculator consumes.
 *
 * Keeping this in one place is what stops multipliers from being applied twice
 * in different code paths.
 */
import { getScoreMultiplier } from '../../services/liveConfig';
import { heroCombatPerkMultiplier } from '../heroPerkSave';
import { modeRules } from '../modes';
import type { SaveData } from '../save';
import type { GameState } from '../state';
import { getTowerMilestoneBonuses } from '../towerMilestones';
import { getTowerXpState } from '../towerProgression';
import { vipCoinMultiplier, vipXpMultiplier } from '../vipBonuses';
import { defaultModifiers, type RewardModifiers } from './rewards';

export function currentRewardModifiers(state: GameState, save: SaveData): RewardModifiers {
  const rules = modeRules(state.mode);
  const bonuses = getTowerMilestoneBonuses(getTowerXpState().level);
  const lowHealth = state.lives <= Math.ceil(state.maxLives * 0.25);

  return {
    ...defaultModifiers(),
    scoreMultiplier: getScoreMultiplier(),
    currencyMultiplier: rules.currencyMul,
    vipCoinMultiplier: vipCoinMultiplier(),
    vipXpMultiplier: vipXpMultiplier(),
    comboRewardMultiplier: bonuses.comboRewardMultiplier,
    lastStandMultiplier: bonuses.lastStandRewardMultiplier,
    perfectWaveXpMultiplier: bonuses.perfectWaveXpMultiplier,
    // Hero perk: Last Stand boosts rewards when the tower is in danger.
    heroXpMultiplier: lowHealth ? heroCombatPerkMultiplier(save.hero, 'survival') : 1,
    lowHealth,
  };
}
