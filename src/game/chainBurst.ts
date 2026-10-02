import type { Fruit, FruitField } from './fruits';

/** Splash damages up to four nearby ordinary enemies. No wall damage. */
export function detonatePulpPopper(field: FruitField, source: Fruit, onKilled: (fruit: Fruit) => void): number {
  const x = source.group.position.x;
  const z = source.group.position.z;
  const nearby = field.fruits
    .filter((other) => other.alive && other !== source && !other.boss && other.enemyKind !== 'explosive'
      && Math.hypot(other.group.position.x - x, other.group.position.z - z) <= 2.6)
    .sort((a, b) => Math.hypot(a.group.position.x - x, a.group.position.z - z)
      - Math.hypot(b.group.position.x - x, b.group.position.z - z))
    .slice(0, 4);
  for (const other of nearby) {
    const splash = Math.min(40, Math.max(12, Math.round(other.maxHp * 0.55)));
    if (field.hurt(other, splash, 'turret')) onKilled(other);
  }
  return nearby.length;
}
