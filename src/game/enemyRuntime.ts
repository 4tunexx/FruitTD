import { Vector3 } from 'three';
import { FruitField, type Fruit } from './fruits';

/**
 * Adds behaviours that sit on top of the generic fruit damage system without
 * making FruitField responsible for every special-enemy rule.
 */
export function installEnemyRuntime(): void {
  const proto = FruitField.prototype as FruitField & { __enemyRuntimeInstalled?: boolean; hurt: (fruit: Fruit, amount: number) => boolean };
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

    // A splitter releases two quick normal targets. They are deliberately
    // smaller and worth less than the parent, but keeping them alive preserves
    // the pressure of the special enemy instead of creating a free kill.
    const offsets = [-0.7, 0.7];
    for (const offset of offsets) {
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

// Imported for its side effect by the UI bootstrap, so the runtime is active
// in the existing application without requiring a second game bootstrap.
void Vector3;
installEnemyRuntime();
