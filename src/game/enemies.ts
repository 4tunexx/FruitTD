import type { FruitKind } from './fruits';

/**
 * Special enemy behaviour layered on top of the existing fruit targets.
 * These are intentionally data-driven so waves can mix normal fruit with
 * dangerous targets without putting special-case rules into the renderer.
 */
export type EnemyKind = 'normal' | 'explosive' | 'armored' | 'splitter' | 'swift';

export interface EnemyRule {
  kind: EnemyKind;
  label: string;
  description: string;
  towerDamageOnLeak: number;
  towerDamageOnHit: number;
  hpMultiplier: number;
  speedMultiplier: number;
  scoreMultiplier: number;
  xpMultiplier: number;
  colour: number;
}

export const ENEMY_RULES: Record<EnemyKind, EnemyRule> = {
  normal: {
    kind: 'normal', label: 'Normal', description: 'Standard target.',
    towerDamageOnLeak: 1, towerDamageOnHit: 0, hpMultiplier: 1, speedMultiplier: 1,
    scoreMultiplier: 1, xpMultiplier: 1, colour: 0xffffff,
  },
  explosive: {
    kind: 'explosive', label: 'Volatile',
    description: 'Destroy it safely. Slicing it damages the Main Tower.',
    towerDamageOnLeak: 3, towerDamageOnHit: 2, hpMultiplier: 0.85, speedMultiplier: 1.12,
    scoreMultiplier: 1.7, xpMultiplier: 2, colour: 0xff5533,
  },
  armored: {
    kind: 'armored', label: 'Armored',
    description: 'Heavy target with extra health. High reward for focus.',
    towerDamageOnLeak: 2, towerDamageOnHit: 0, hpMultiplier: 2.2, speedMultiplier: 0.78,
    scoreMultiplier: 2.2, xpMultiplier: 2.4, colour: 0x9aa4b2,
  },
  splitter: {
    kind: 'splitter', label: 'Splitter',
    description: 'Break it before it reaches the tower or it releases smaller targets.',
    towerDamageOnLeak: 2, towerDamageOnHit: 0, hpMultiplier: 1.35, speedMultiplier: 0.96,
    scoreMultiplier: 2.0, xpMultiplier: 2.2, colour: 0x8d6cff,
  },
  swift: {
    kind: 'swift', label: 'Swift',
    description: 'Fast target that tests reaction speed and mobile players.',
    towerDamageOnLeak: 2, towerDamageOnHit: 0, hpMultiplier: 0.75, speedMultiplier: 1.65,
    scoreMultiplier: 1.8, xpMultiplier: 1.7, colour: 0x55d8ff,
  },
};

export function enemyRule(kind: EnemyKind): EnemyRule {
  return ENEMY_RULES[kind] ?? ENEMY_RULES.normal;
}

/** Deterministic special-enemy selection from wave progress. */
export function specialEnemyForWave(wave: number, roll: number): EnemyKind {
  if (wave < 3) return 'normal';
  const r = Math.max(0, Math.min(0.999999, roll));
  if (wave >= 12 && r < 0.05) return 'splitter';
  if (wave >= 8 && r < 0.12) return 'armored';
  if (wave >= 5 && r < 0.22) return 'swift';
  if (wave >= 4 && r < 0.31) return 'explosive';
  return 'normal';
}

/** Fruit fallback used by special targets when a wave only supplies a kind. */
export function specialFruitKind(kind: FruitKind): FruitKind {
  return kind;
}
