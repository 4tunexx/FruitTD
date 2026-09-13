import { getScoreMultiplier, getStartLivesScale, getStartMoneyScale, getSuperChargeMultiplier } from '../services/liveConfig';
import type { HeroId } from './heroes';
import { modeRules } from './modes';
import { MAX_LIVES } from './world';

export interface GameState {
  score: number;
  currency: number;
  lives: number;
  maxLives: number;
  wave: number;
  elapsed: number;
  towerLevel: number;
  running: boolean;
  toast: string;
  toastTimer: number;
  waveSpawning: boolean;
  waveClearTimer: number;
  waveTotal: number;
  waveKilled: number;
  hero: HeroId;
  heroLevel: number;
  heroXp: number;
  combo: number;
  comboTimer: number;
  superJuice: number;
  mode: 'casual' | 'ranked' | 'coop' | 'arena';
}

export function createState(): GameState {
  return {
    score: 0,
    currency: 140,
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    wave: 1,
    elapsed: 0,
    towerLevel: 1,
    running: true,
    toast: '',
    toastTimer: 0,
    waveSpawning: false,
    waveClearTimer: 2.5,
    waveTotal: 0,
    waveKilled: 0,
    hero: 'jiju',
    heroLevel: 1,
    heroXp: 0,
    combo: 0,
    comboTimer: 0,
    superJuice: 0,
    mode: 'casual',
  };
}

export function resetState(state: GameState): void {
  const hero = state.hero;
  const heroLevel = state.heroLevel;
  const heroXp = state.heroXp;
  const mode = state.mode;
  Object.assign(state, createState());
  state.hero = hero;
  state.heroLevel = heroLevel;
  state.heroXp = heroXp;
  state.mode = mode;
  const rules = modeRules(mode);
  state.lives = Math.max(1, Math.round(rules.lives * getStartLivesScale()));
  state.maxLives = state.lives;
  state.currency = Math.max(0, Math.round(rules.startMoney * getStartMoneyScale()));
}

export function leakCost(state: GameState, fruitKind: string, boss: boolean): number {
  const rules = modeRules(state.mode);
  let n = fruitKind === 'bomb' ? 2 : 1;
  if (boss) n += 2;
  return Math.max(1, Math.round(n * rules.leakMul));
}

export function addScore(state: GameState, base: number): void {
  const rules = modeRules(state.mode);
  const scoreMul = getScoreMultiplier();
  state.score += Math.round(base * scoreMul);
  state.currency += Math.max(2, Math.round(base * 0.6 * rules.currencyMul));
}

export function chargeSuper(state: GameState, amount: number): void {
  state.superJuice = Math.min(100, state.superJuice + amount * getSuperChargeMultiplier());
}

export function toast(state: GameState, message: string, seconds = 1.5): void {
  state.toast = message;
  state.toastTimer = seconds;
}
