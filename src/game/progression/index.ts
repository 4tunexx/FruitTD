/**
 * Player progression — the APPLY step of the reward pipeline.
 *
 *   GAME EVENT → REWARD CALCULATION → **PLAYER PROGRESSION → SAVE** → UI FEEDBACK
 *
 * Everything that grants hero XP, tower XP or coins must go through
 * `applyRewards`. Nothing else may mutate those fields, which is what keeps
 * rewards from being duplicated by several independent systems (§6).
 */
import {
  MAX_HERO_LEVEL,
  heroXpForLevel,
  heroXpToLevel,
  type HeroId,
} from '../heroes';
import { grantTowerXp, getTowerXpState } from '../towerProgression';
import { towerMilestone } from '../towerMilestones';
import type { SaveData } from '../save';
import {
  HERO_MILESTONES,
  heroMilestonesBetween,
  heroMilestonePerkPoints,
  heroesUnlockedByJijuLevel,
  nextHeroMilestone,
  type HeroMilestone,
} from './heroMilestones';
import type { RewardBundle } from './rewards';

export * from './rewards';
export * from './combo';
export * from './heroMilestones';

export const MAX_HERO_XP = heroXpForLevel(MAX_HERO_LEVEL);

/** Everything that changed as a result of applying rewards — drives UI feedback. */
export interface ProgressionResult {
  heroId: HeroId;
  heroXpGained: number;
  heroLevelBefore: number;
  heroLevelAfter: number;
  heroLeveledUp: boolean;
  heroMaxed: boolean;
  heroMilestones: HeroMilestone[];
  heroesUnlocked: HeroId[];
  perkPointsGained: number;
  towerXpGained: number;
  towerLevelBefore: number;
  towerLevelAfter: number;
  towerLeveledUp: boolean;
  towerMaxed: boolean;
  towerMilestoneNames: string[];
  coinsGained: number;
  scoreGained: number;
}

function emptyResult(heroId: HeroId, heroLevel: number, towerLevel: number): ProgressionResult {
  return {
    heroId,
    heroXpGained: 0,
    heroLevelBefore: heroLevel,
    heroLevelAfter: heroLevel,
    heroLeveledUp: false,
    heroMaxed: heroLevel >= MAX_HERO_LEVEL,
    heroMilestones: [],
    heroesUnlocked: [],
    perkPointsGained: 0,
    towerXpGained: 0,
    towerLevelBefore: towerLevel,
    towerLevelAfter: towerLevel,
    towerLeveledUp: false,
    towerMaxed: false,
    towerMilestoneNames: [],
    coinsGained: 0,
    scoreGained: 0,
  };
}

/** Perk points earned purely from levelling (1 every 10 levels from Lv 10). */
export function perkPointsFromLevel(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  const fromLevels = lv < 10 ? 0 : Math.floor((lv - 10) / 10) + 1;
  return fromLevels + heroMilestonePerkPoints(lv);
}

export const MAX_COINS = 1_000_000;

/**
 * Applies a reward bundle to the save. This is the ONLY writer of hero XP,
 * tower XP and coins.
 *
 * The caller is responsible for persisting (`writeSave`) once — we deliberately
 * do not write here so a burst of slices in one frame is a single save.
 */
export function applyRewards(
  save: SaveData,
  reward: RewardBundle,
  opts: { heroId?: HeroId } = {},
): ProgressionResult {
  const heroId = opts.heroId ?? save.hero;
  const xpBefore = Math.max(0, Number(save.xp[heroId]) || 0);
  const heroLevelBefore = heroXpToLevel(xpBefore);
  const towerLevelBefore = getTowerXpState().level;

  const result = emptyResult(heroId, heroLevelBefore, towerLevelBefore);

  // ── Hero XP ────────────────────────────────────────────────────────────
  const heroXp = Math.max(0, Math.floor(reward.heroXp));
  if (heroXp > 0) {
    const xpAfter = Math.min(MAX_HERO_XP, xpBefore + heroXp);
    save.xp[heroId] = xpAfter;
    result.heroXpGained = xpAfter - xpBefore;
    const heroLevelAfter = heroXpToLevel(xpAfter);
    result.heroLevelAfter = heroLevelAfter;
    result.heroLeveledUp = heroLevelAfter > heroLevelBefore;
    result.heroMaxed = heroLevelAfter >= MAX_HERO_LEVEL;

    if (result.heroLeveledUp) {
      result.heroMilestones = heroMilestonesBetween(heroLevelBefore, heroLevelAfter);
      const pointsBefore = perkPointsFromLevel(heroLevelBefore);
      const pointsAfter = perkPointsFromLevel(heroLevelAfter);
      result.perkPointsGained = Math.max(0, pointsAfter - pointsBefore);
      save.skillPoints = Math.max(0, Math.min(10_000, (save.skillPoints ?? 0) + result.perkPointsGained));

      // Hero unlocks are driven by Master Jiju's level only.
      if (heroId === 'jiju') {
        const owned = new Set<HeroId>(save.ownedHeroes);
        for (const unlocked of heroesUnlockedByJijuLevel(heroLevelAfter)) {
          if (!owned.has(unlocked)) {
            owned.add(unlocked);
            result.heroesUnlocked.push(unlocked);
          }
        }
        if (result.heroesUnlocked.length) save.ownedHeroes = [...owned];
      }
    }
  }

  // ── Tower XP ───────────────────────────────────────────────────────────
  const towerXp = Math.max(0, Math.floor(reward.towerXp));
  if (towerXp > 0) {
    const before = getTowerXpState();
    const after = grantTowerXp(towerXp);
    result.towerXpGained = after.xp - before.xp;
    result.towerLevelAfter = after.level;
    result.towerLeveledUp = after.level > before.level;
    result.towerMaxed = after.maxed;
    if (result.towerLeveledUp) {
      for (let lv = before.level + 1; lv <= after.level; lv++) {
        const milestone = towerMilestone(lv);
        if (milestone) result.towerMilestoneNames.push(`Lv ${lv} · ${milestone.name} — ${milestone.reward}`);
      }
    }
    save.towerXp = after.xp;
    save.towerLifetimeXp = after.lifetimeXp;
  }

  // ── Coins ──────────────────────────────────────────────────────────────
  const coins = Math.max(0, Math.floor(reward.coins));
  if (coins > 0) {
    const before = Math.max(0, Number(save.coins) || 0);
    save.coins = Math.min(MAX_COINS, before + coins);
    result.coinsGained = save.coins - before;
  }

  result.scoreGained = Math.max(0, Math.floor(reward.score));
  return result;
}

/* ───────────────────────── Hero XP state helpers ───────────────────────── */

export interface HeroXpState {
  heroId: HeroId;
  xp: number;
  level: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  xpIntoLevel: number;
  xpForLevel: number;
  progress: number;
  maxed: boolean;
  nextMilestone: HeroMilestone | null;
}

/** Single central function for hero XP presentation. No UI may recompute this. */
export function getHeroXpState(save: SaveData, heroId: HeroId = save.hero): HeroXpState {
  const xp = Math.max(0, Math.min(MAX_HERO_XP, Number(save.xp[heroId]) || 0));
  const level = heroXpToLevel(xp);
  const maxed = level >= MAX_HERO_LEVEL;
  const currentLevelXp = heroXpForLevel(level);
  const nextLevelXp = maxed ? null : heroXpForLevel(level + 1);
  const xpForLevel = maxed ? 0 : Math.max(1, (nextLevelXp ?? 0) - currentLevelXp);
  const xpIntoLevel = maxed ? 0 : xp - currentLevelXp;
  return {
    heroId,
    xp,
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpForLevel,
    progress: maxed ? 1 : Math.max(0, Math.min(1, xpIntoLevel / xpForLevel)),
    maxed,
    nextMilestone: nextHeroMilestone(level),
  };
}

/* ───────────────────────── Hero ownership / purchase ───────────────────── */

export type HeroAvailability = 'owned' | 'locked' | 'purchasable';

export interface HeroStatus {
  heroId: HeroId;
  availability: HeroAvailability;
  owned: boolean;
  /** Master Jiju level needed for a free unlock, or null for purchase-only heroes. */
  unlockLevel: number | null;
  purchaseCost: number | null;
  /** Player-facing requirement text. */
  requirement: string;
  level: number;
  xp: number;
  canAfford: boolean;
  equippable: boolean;
}

export function heroMilestoneUnlockLevel(heroId: HeroId): number | null {
  return HERO_MILESTONES.find((m) => m.unlocksHero === heroId)?.level ?? null;
}
