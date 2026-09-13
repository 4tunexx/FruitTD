import { getScoreMultiplier, getStartLivesScale, getStartMoneyScale, getSuperChargeMultiplier } from '../services/liveConfig';
import { heroXpForLevel, heroXpToLevel, MAX_HERO_LEVEL, type HeroId } from './heroes';
import { modeRules } from './modes';
import { MAX_LIVES } from './world';
import { getTowerXpState, grantTowerXp } from './towerProgression';

export interface GameState {
  score: number; currency: number; lives: number; maxLives: number; wave: number; elapsed: number;
  towerLevel: number; towerXp: number; towerXpToNext: number | null; towerXpProgress: number;
  running: boolean; toast: string; toastTimer: number; waveSpawning: boolean; waveClearTimer: number;
  waveTotal: number; waveKilled: number; hero: HeroId; heroLevel: number; heroXp: number;
  combo: number; comboTimer: number; superJuice: number; mode: 'casual' | 'ranked' | 'coop' | 'arena';
}

function createHeroProgressionState(): Pick<GameState, 'heroLevel' | 'heroXp'> {
  return { heroLevel: 1, heroXp: 0 };
}

const MAX_HERO_XP = heroXpForLevel(MAX_HERO_LEVEL);

export function createState(): GameState {
  const tower = getTowerXpState();
  const base: GameState = {
    score: 0, currency: 140, lives: MAX_LIVES, maxLives: MAX_LIVES, wave: 1, elapsed: 0,
    towerLevel: 1, towerXp: tower.xp, towerXpToNext: tower.nextLevelXp, towerXpProgress: tower.progress,
    running: true, toast: '', toastTimer: 0, waveSpawning: false, waveClearTimer: 2.5, waveTotal: 0, waveKilled: 0,
    hero: 'jiju', ...createHeroProgressionState(), combo: 0, comboTimer: 0, superJuice: 0, mode: 'casual',
  };

  return new Proxy(base, {
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
      return Reflect.set(target, property, value, receiver);
    },
  });
}

export function resetState(state: GameState): void {
  const hero = state.hero; const heroXp = state.heroXp; const tower = getTowerXpState(); const mode = state.mode;
  Object.assign(state, createState());
  state.hero = hero; state.heroXp = heroXp; state.towerLevel = 1;
  state.towerXp = tower.xp; state.towerXpToNext = tower.nextLevelXp; state.towerXpProgress = tower.progress; state.mode = mode;
  const rules = modeRules(mode);
  state.lives = Math.max(1, Math.round(rules.lives * getStartLivesScale())); state.maxLives = state.lives;
  state.currency = Math.max(0, Math.round(rules.startMoney * getStartMoneyScale()));
}

export function leakCost(state: GameState, fruitKind: string, boss: boolean): number {
  const rules = modeRules(state.mode); let n = fruitKind === 'bomb' ? 2 : 1; if (boss) n += 2;
  return Math.max(1, Math.round(n * rules.leakMul));
}

/** Apply damage to the Main Tower. Returns the actual damage dealt. */
export function damageTower(state: GameState, amount: number): number {
  const damage = Math.max(0, Math.round(amount)); if (damage <= 0 || state.lives <= 0) return 0;
  const actual = Math.min(state.lives, damage); state.lives -= actual; state.combo = 0; state.comboTimer = 0; return actual;
}

/** Extra tower defence reward for surviving a wave without leaks. */
export function awardPerfectWave(state: GameState): number {
  if (state.waveKilled <= 0 || state.waveTotal <= 0 || state.waveKilled < state.waveTotal) return 0;
  const reward = Math.max(4, Math.round(3 + state.wave * 0.75)); state.currency += reward;
  const tower = grantTowerXp(reward); state.towerXp = tower.xp; state.towerXpToNext = tower.nextLevelXp; state.towerXpProgress = tower.progress;
  return reward;
}

/**
 * Central reward path. Keeping the combo multiplier here means every normal
 * kill, boss kill, reslice and turret reward can benefit without duplicating
 * multiplier math throughout the game loop.
 */
export function addScore(state: GameState, base: number): void {
  const rules = modeRules(state.mode);
  const scoreMul = getScoreMultiplier();
  const comboMul = 1 + Math.min(2.5, Math.max(0, state.combo) * 0.08);
  const rewarded = Math.max(0, Math.round(base * comboMul));
  state.score += Math.round(rewarded * scoreMul);
  state.currency += Math.max(2, Math.round(rewarded * 0.6 * rules.currencyMul));
  const xpGain = Math.max(1, Math.round(rewarded / 6));
  const tower = grantTowerXp(xpGain);
  state.towerXp = tower.xp; state.towerXpToNext = tower.nextLevelXp; state.towerXpProgress = tower.progress;
}

export function chargeSuper(state: GameState, amount: number): void { state.superJuice = Math.min(100, state.superJuice + amount * getSuperChargeMultiplier()); }
export function toast(state: GameState, message: string, seconds = 1.5): void { state.toast = message; state.toastTimer = seconds; state.toastTimer = seconds; }
