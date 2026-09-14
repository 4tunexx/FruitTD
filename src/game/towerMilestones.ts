import { MAX_TOWER_LEVEL } from './world';

export interface TowerMilestone {
  level: number;
  name: string;
  description: string;
  reward: string;
}

export interface TowerMilestoneBonuses {
  startingLives: number;
  maxLives: number;
  juiceGainMultiplier: number;
  defenceFireRateMultiplier: number;
  comboRewardMultiplier: number;
  lastStandRewardMultiplier: number;
  perfectWaveXpMultiplier: number;
  masterFortressBadge: boolean;
}

/** Account-level Main Tower milestones. These are progression rewards, not free combat upgrades. */
export const TOWER_MILESTONES: TowerMilestone[] = [
  { level: 2, name: 'Fortified Base', description: 'Your tower has survived its first major upgrade.', reward: '+1 starting life' },
  { level: 3, name: 'Juice Core', description: 'The tower starts converting clean defence into more Juice.', reward: '+5% Juice gain' },
  { level: 4, name: 'Reinforced Wall', description: 'A stronger defence gives you more room for mistakes.', reward: '+1 maximum life' },
  { level: 5, name: 'Rapid Defence', description: 'Your tower systems respond faster to pressure.', reward: '+5% defence fire rate' },
  { level: 6, name: 'Combo Battery', description: 'Long combos feed the tower systems.', reward: '+5% combo reward' },
  { level: 7, name: 'Emergency Core', description: 'Low-health defence becomes more rewarding.', reward: '+10% Last Stand reward' },
  { level: 8, name: 'Fortress', description: 'The Main Tower enters endgame progression.', reward: '+1 maximum life' },
  { level: 9, name: 'Elite Core', description: 'High-level defence earns better progression rewards.', reward: '+10% Tower XP from perfect waves' },
  { level: 10, name: 'Master Fortress', description: 'The Main Tower has reached maximum mastery.', reward: 'Permanent Fortress badge + Master Tower title' },
];

export function towerMilestone(level: number): TowerMilestone | null {
  const lv = Math.max(1, Math.min(MAX_TOWER_LEVEL, Math.floor(level)));
  return TOWER_MILESTONES.find((m) => m.level === lv) ?? null;
}

export function towerUnlockedMilestones(level: number): TowerMilestone[] {
  const lv = Math.max(1, Math.floor(level));
  return TOWER_MILESTONES.filter((m) => m.level <= lv);
}

/** Calculate cumulative permanent bonuses from unlocked tower milestones. */
export function getTowerMilestoneBonuses(accountTowerLevel: number): TowerMilestoneBonuses {
  const unlocked = towerUnlockedMilestones(accountTowerLevel);
  const bonuses: TowerMilestoneBonuses = {
    startingLives: 0,
    maxLives: 0,
    juiceGainMultiplier: 1,
    defenceFireRateMultiplier: 1,
    comboRewardMultiplier: 1,
    lastStandRewardMultiplier: 1,
    perfectWaveXpMultiplier: 1,
    masterFortressBadge: false,
  };
  
  for (const milestone of unlocked) {
    if (milestone.level === 2) bonuses.startingLives += 1;
    if (milestone.level === 3) bonuses.juiceGainMultiplier += 0.05;
    if (milestone.level === 4) bonuses.maxLives += 1;
    if (milestone.level === 5) bonuses.defenceFireRateMultiplier += 0.05;
    if (milestone.level === 6) bonuses.comboRewardMultiplier += 0.05;
    if (milestone.level === 7) bonuses.lastStandRewardMultiplier += 0.1;
    if (milestone.level === 8) bonuses.maxLives += 1;
    if (milestone.level === 9) bonuses.perfectWaveXpMultiplier += 0.1;
    if (milestone.level === 10) bonuses.masterFortressBadge = true;
  }
  
  return bonuses;
}
