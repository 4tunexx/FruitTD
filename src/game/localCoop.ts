import { ARENA_D, ARENA_W } from './world';

export interface LocalCoopState {
  x: number;
  z: number;
  cooldown: number;
}

const MOVE_SPEED = 9;
const SLASH_INTERVAL = 0.38;

export function advanceLocalCoop(
  state: LocalCoopState,
  keys: ReadonlySet<string>,
  attackHeld: boolean,
  dt: number,
): { state: LocalCoopState; slash: boolean } {
  const dx = Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft'));
  const dz = Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'));
  const length = Math.hypot(dx, dz) || 1;
  const next: LocalCoopState = {
    x: Math.max(-ARENA_W * 0.44, Math.min(ARENA_W * 0.44, state.x + dx / length * Math.max(0, dt) * MOVE_SPEED)),
    z: Math.max(-6.7, Math.min(ARENA_D * 0.43, state.z + dz / length * Math.max(0, dt) * MOVE_SPEED)),
    cooldown: Math.max(0, state.cooldown - Math.max(0, dt)),
  };
  const slash = attackHeld && next.cooldown === 0;
  if (slash) next.cooldown = SLASH_INTERVAL;
  return { state: next, slash };
}
