import type { GameMode } from './save';

export interface ModeRules {
  id: GameMode;
  name: string;
  blurb: string;
  lives: number;
  startMoney: number;
  yellow: number;
  pink: number;
  orange: number;
  hpMul: number;
  speedMul: number;
  spawnGapMul: number;
  waveOffset: number;
  currencyMul: number;
  leakMul: number;
  superMul: number;
  hints: boolean;
  guest: boolean;
}

export const MODE_INFO: ModeRules[] = [
  {
    id: 'casual',
    name: 'Casual',
    blurb: 'Softer fruit, 18 lives, extra cash. Tips if you are new.',
    lives: 18,
    startMoney: 180,
    yellow: 12,
    pink: 12,
    orange: 4,
    hpMul: 0.82,
    speedMul: 0.86,
    spawnGapMul: 1.15,
    waveOffset: 0,
    currencyMul: 1.15,
    leakMul: 1,
    superMul: 1.15,
    hints: true,
    guest: false,
  },
  {
    id: 'ranked',
    name: 'Ranked',
    blurb: 'Tougher fruit, less cash. Score is saved on its own ladder.',
    lives: 14,
    startMoney: 120,
    yellow: 6,
    pink: 6,
    orange: 0,
    hpMul: 1.12,
    speedMul: 1.08,
    spawnGapMul: 0.92,
    waveOffset: 0,
    currencyMul: 0.82,
    leakMul: 1,
    superMul: 0.9,
    hints: false,
    guest: false,
  },
  {
    id: 'coop',
    name: 'Co-op',
    blurb: 'Guest assist on a shared wall (local helper — online drop-in later).',
    lives: 20,
    startMoney: 200,
    yellow: 14,
    pink: 14,
    orange: 8,
    hpMul: 1,
    speedMul: 1,
    spawnGapMul: 0.95,
    waveOffset: 0,
    currencyMul: 1.05,
    leakMul: 1,
    superMul: 1.25,
    hints: true,
    guest: true,
  },
  {
    id: 'arena',
    name: 'Arena',
    blurb: '10 lives. Faster packs, earlier bosses, meaner leaks.',
    lives: 10,
    startMoney: 100,
    yellow: 4,
    pink: 4,
    orange: 0,
    hpMul: 1.28,
    speedMul: 1.2,
    spawnGapMul: 0.72,
    waveOffset: 2,
    currencyMul: 0.9,
    leakMul: 1.5,
    superMul: 1,
    hints: false,
    guest: false,
  },
];

export function modeRules(id: GameMode): ModeRules {
  return MODE_INFO.find((m) => m.id === id) ?? MODE_INFO[0];
}
