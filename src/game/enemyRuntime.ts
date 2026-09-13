import { FruitField, type Fruit } from './fruits';

/** Adds special-enemy behaviours without bloating the core fruit damage system. */
export function installEnemyRuntime(): void {
  const proto = FruitField.prototype as FruitField & {
    __enemyRuntimeInstalled?: boolean;
    hurt: (fruit: Fruit, amount: number) => boolean;
  };
  if (proto.__enemyRuntimeInstalled) return;
  proto.__enemyRuntimeInstalled = true;

  const originalHurt = proto.hurt;
  proto.hurt = function patchedHurt(fruit: Fruit, amount: number): boolean {
    const wasSplitter = fruit.enemyKind === 'splitter';
    const x = fruit.group.position.x;
    const y = fruit.group.position.y;
    const z = fruit.group.position.z;
    const killed = originalHurt.call(this, fruit, amount);
    if (!killed || !wasSplitter) return killed;

    // Splitters release two smaller normal targets, preserving wave pressure.
    for (const offset of [-0.7, 0.7]) {
      const child = this.spawn('strawberry', false, 'normal');
      if (!child) continue;
      child.group.position.set(x + offset, y + 0.15, z - 0.15);
      child.radius *= 0.72;
      child.hp = Math.max(1, Math.round(child.hp * 0.7));
      child.maxHp = child.hp;
      child.impulseX = offset * 2.4;
      child.impulseZ = 1.2;
      child.spin.set(0, 3.2, 0);
    }
    return killed;
  };
}

installEnemyRuntime();
