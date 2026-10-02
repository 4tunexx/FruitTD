import type { RewardEvent } from './progression/rewards';

/** Fruts exist only during a match. Score, VIP and shop coins cannot buy artillery. */
export function frutsForEvent(event: RewardEvent, modeMultiplier = 1): number {
  const wave = Math.max(1, Math.floor(event.wave ?? 1));
  let amount = 0;
  switch (event.type) {
    case 'fruit_sliced': amount = 2; break;
    case 'special_enemy_killed': amount = 4; break;
    case 'boss_defeated': amount = 30; break;
    case 'wave_cleared': amount = 12 + Math.min(10, Math.floor(wave / 5) * 2); break;
    case 'perfect_wave': amount = 4; break;
    case 'bomb_parry': amount = 2; break;
    case 'loot_drop': amount = Math.min(8, Math.max(0, event.lootFruts ?? 0)); break;
  }
  return Math.max(0, Math.round(amount * Math.max(0.5, Math.min(1.5, modeMultiplier))));
}

/** Fixed cadence keeps rare drops visible and bounded in server run receipts. */
export function fruitLoot(kills: number): { fruts: number; coins: number; gems: number } {
  const n = Math.max(0, Math.floor(kills));
  return {
    fruts: n > 0 && n % 8 === 0 ? 8 : 0,
    coins: n > 0 && n % 20 === 0 ? 3 : 0,
    gems: n > 0 && n % 100 === 0 ? 1 : 0,
  };
}
