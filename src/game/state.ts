import { getScoreMultiplier, getStartLivesScale, getStartMoneyScale, getSuperChargeMultiplier } from '../services/liveConfig';
import { heroXpForLevel, heroXpToLevel, MAX_HERO_LEVEL, type HeroId } from './heroes';
import { modeRules } from './modes';
import type { ComboResetReason } from './progression/combo';
import { MAX_LIVES } from './world';
import { getTowerXpState } from './towerProgression';
import { getTowerMilestoneBonuses } from './towerMilestones';
import { comboMultiplier } from './progression/combo';

export interface GameState {
  score: number;
  currency: number;
  lives: number;
  maxLives: number;
  wave: number;
  level: number;
  wavesInLevel: number;
  elapsed: number;
  towerLevel: number;
  towerXp: number;
  towerXpToNext: number | null;
  towerXpProgress: number;
  running: boolean;
  toast: string;
  toastTimer: number;
  waveSpawning: boolean;
  waveClearTimer: number;
  waveTotal: number;
  waveKilled: number;
  bossIntro: boolean;
  bossIntroTimer: number;
  hero: HeroId;
  heroLevel: number;
  heroXp: number;
  combo: number;
  comboTimer: number;
  /** Peak combo this session; survives combo resets so it can be persisted. */
  bestCombo: number;
  superJuice: number;
  mode: 'casual' | 'ranked' | 'coop' | 'arena';
}

const MAX_HERO_XP = heroXpForLevel(MAX_HERO_LEVEL);

export function createState(): GameState {
  const tower = getTowerXpState();
  const base: GameState = {
    score: 0,
    currency: 140,
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    wave: 1,
    level: 1,
    wavesInLevel: 5,
    elapsed: 0,
    towerLevel: 1,
    towerXp: tower.xp,
    towerXpToNext: tower.nextLevelXp,
    towerXpProgress: tower.progress,
    running: true,
    toast: '',
    toastTimer: 0,
    waveSpawning: false,
    waveClearTimer: 2.5,
    waveTotal: 0,
    waveKilled: 0,
    bossIntro: false,
    bossIntroTimer: 0,
    hero: 'jiju',
    heroLevel: 1,
    heroXp: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    superJuice: 0,
    mode: 'casual',
  };
  const state = new Proxy(base, {
    get(target, property, receiver) {
      if (property === 'heroLevel') return heroXpToLevel(target.heroXp);
      if (property === 'heroXp') return Math.min(MAX_HERO_XP, Math.max(0, Number(target.heroXp) || 0));
      return Reflect.get(target, property, receiver);
    },
    set(target, property, value, receiver) {
      if (property === 'heroLevel') {
        target.heroLevel = Math.max(1, Math.min(MAX_HERO_LEVEL, Number(value) || 1));
        return true;
      }
      if (property === 'heroXp') {
        target.heroXp = Math.max(0, Math.min(MAX_HERO_XP, Number(value) || 0));
        return true;
      }
      if (property === 'lives') {
        const previous = Number(target.lives) || 0;
        const next = Math.max(0, Math.min(Math.max(1, Number(target.maxLives) || MAX_LIVES), Number(value) || 0));
        if (next < previous) {
          target.combo = 0;
          target.comboTimer = 0;
        }
        target.lives = next;
        return true;
      }
      if (property === 'combo') {
        const next = Math.max(0, Math.floor(Number(value) || 0));
        target.combo = next;
        if (next > target.bestCombo) target.bestCombo = next;
        return true;
      }
      return Reflect.set(target, property, value, receiver);
    },
  });
  return state;
}

export function resetState(state: GameState): void {
  const hero = state.hero;
  const heroXp = state.heroXp;
  const tower = getTowerXpState();
  const mode = state.mode;
  // Peak combo is a career stat, not a match stat — it must survive a restart
  // so persist() can still record it after the state is rebuilt.
  const bestCombo = state.bestCombo ?? 0;
  Object.assign(state, createState());
  state.hero = hero;
  state.heroXp = heroXp;
  state.bestCombo = bestCombo;
  state.towerLevel = 1;
  state.towerXp = tower.xp;
  state.towerXpToNext = tower.nextLevelXp;
  state.towerXpProgress = tower.progress;
  state.mode = mode;
  const rules = modeRules(mode);
  const bonuses = getTowerMilestoneBonuses(tower.level);
  state.lives = Math.max(1, Math.round((rules.lives + bonuses.startingLives) * getStartLivesScale()));
  state.maxLives = Math.max(state.lives, state.lives + bonuses.maxLives);
  state.currency = Math.max(0, Math.round(rules.startMoney * getStartMoneyScale()));
}

export function leakCost(state: GameState, fruitKind: string, boss: boolean): number {
  const rules = modeRules(state.mode);
  let n = fruitKind === 'bomb' ? 2 : 1;
  if (boss) n += 2;
  return Math.max(1, Math.round(n * rules.leakMul));
}

export function damageTower(state: GameState, amount: number): number {
  const damage = Math.max(0, Math.round(amount));
  if (damage <= 0 || state.lives <= 0) return 0;
  const actual = Math.min(state.lives, damage);
  state.lives -= actual;
  resetCombo(state, 'tower_damage');
  return actual;
}

function resetCombo(state: GameState, _reason: ComboResetReason): void {
  state.combo = 0;
  state.comboTimer = 0;
}

/**
 * True when every spawned target in the wave was destroyed.
 * `waveKilled` counts only spawned wave members — splitter children are
 * excluded so a perfect wave stays accurately detectable (§7).
 */
export function isPerfectWave(state: GameState): boolean {
  return state.waveTotal > 0 && state.waveKilled >= state.waveTotal;
}

/** @deprecated Superseded by the central reward pipeline (progression/rewards). */
export function awardPerfectWave(state: GameState): number {
  if (!isPerfectWave(state)) return 0;
  const tower = getTowerXpState();
  const bonuses = getTowerMilestoneBonuses(tower.level);
  return Math.max(4, Math.round((3 + state.wave * 0.75) * bonuses.perfectWaveXpMultiplier));
}

/**
 * Score-only helper for non-reward score adjustments.
 *
 * Coins/hero XP/tower XP are NOT granted here — that is exclusively the job of
 * the central reward pipeline, which prevents the double-awarding that used to
 * happen when addScore and grantHeroXp both ran for one event.
 */
export function addScore(state: GameState, base: number): void {
  const scoreMul = getScoreMultiplier();
  const tower = getTowerXpState();
  const bonuses = getTowerMilestoneBonuses(tower.level);
  const comboMul = comboMultiplier(state.combo, bonuses.comboRewardMultiplier);
  const lastStandMul =
    state.lives <= Math.ceil(state.maxLives * 0.25) ? bonuses.lastStandRewardMultiplier : 1;
  const rewarded = Math.max(0, Math.round(base * comboMul * lastStandMul));
  state.score += Math.round(rewarded * scoreMul);
}

export function chargeSuper(state: GameState, amount: number): void {
  state.superJuice = Math.min(100, state.superJuice + amount * getSuperChargeMultiplier());
}

export function toast(state: GameState, message: string, seconds = 1.8): void {
  state.toast = message;
  state.toastTimer = seconds;
}

