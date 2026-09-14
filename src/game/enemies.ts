import type { FruitKind } from './fruits';

/** Special enemy behaviour layered on top of normal fruit targets. */
export type EnemyKind = 'normal' | 'explosive' | 'armored' | 'splitter' | 'swift';

export interface EnemyRule {
  kind: EnemyKind;
  label: string;
  description: string;
  /** Short lore line for toasts / spawn callouts. */
  flavor: string;
  towerDamageOnLeak: number;
  towerDamageOnHit: number;
  hpMultiplier: number;
  speedMultiplier: number;
  scoreMultiplier: number;
  xpMultiplier: number;
  colour: number;
  warning: string;
}

export const ENEMY_RULES: Record<EnemyKind, EnemyRule> = {
  normal: {
    kind: 'normal', label: 'Rot-Walker',
    description: 'Shambling orchard undead. Standard target.',
    flavor: 'Just another Rot-Walker from the grove.',
    warning: '',
    towerDamageOnLeak: 1, towerDamageOnHit: 0, hpMultiplier: 1, speedMultiplier: 1,
    scoreMultiplier: 1, xpMultiplier: 1, colour: 0xffffff,
  },
  explosive: {
    kind: 'explosive', label: 'Chem-Burst',
    description: 'Lab-chem fruit swollen with volatile juice. A bad slash can damage the Main Tower.',
    flavor: 'Chem-Burst — cut clean or the tower eats the blast.',
    warning: 'CHEM-BURST — CUT CLEAN OR IT BLOWS',
    towerDamageOnLeak: 3, towerDamageOnHit: 2, hpMultiplier: 0.85, speedMultiplier: 1.12,
    scoreMultiplier: 1.7, xpMultiplier: 2, colour: 0xff5533,
  },
  armored: {
    kind: 'armored', label: 'Rind-Plate',
    description: 'Thick rind plating. Extra health, high reward for focus fire.',
    flavor: 'Rind-Plate lumbering in — crack the shell.',
    warning: 'RIND-PLATE',
    towerDamageOnLeak: 2, towerDamageOnHit: 0, hpMultiplier: 2.2, speedMultiplier: 0.78,
    scoreMultiplier: 2.2, xpMultiplier: 2.4, colour: 0x9aa4b2,
  },
  splitter: {
    kind: 'splitter', label: 'Pod-Spawner',
    description: 'Break it before it reaches the tower or it releases smaller targets.',
    flavor: 'Pod-Spawner — end it before the nest opens.',
    warning: 'POD-SPAWNER',
    towerDamageOnLeak: 2, towerDamageOnHit: 0, hpMultiplier: 1.35, speedMultiplier: 0.96,
    scoreMultiplier: 2.0, xpMultiplier: 2.2, colour: 0x8d6cff,
  },
  swift: {
    kind: 'swift', label: 'Juice-Runner',
    description: 'Sprinter soaked in bad juice. Tests reaction speed and mobile players.',
    flavor: 'Juice-Runner closing fast!',
    warning: 'JUICE-RUNNER',
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

export function specialFruitKind(kind: FruitKind): FruitKind {
  return kind;
}

export function enemyReward(kind: EnemyKind, base: number): number {
  const rule = enemyRule(kind);
  return Math.max(0, Math.round(base * rule.scoreMultiplier));
}

export function enemyXpReward(kind: EnemyKind, base: number): number {
  const rule = enemyRule(kind);
  return Math.max(1, Math.round(base * rule.xpMultiplier));
}
