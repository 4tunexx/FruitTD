import assert from 'node:assert/strict';
import { test } from 'node:test';

test('Pulp-Popper damages neighboring enemies but protects bosses and turret-only exploders', async () => {
  if (!globalThis.localStorage) {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => store.clear(),
    };
  }
  const [{ FruitField }, { detonatePulpPopper }] = await Promise.all([import('./fruits'), import('./chainBurst')]);
  const field = new FruitField(() => undefined);
  const source = field.spawn('orange', false, 'chainburst')!;
  const neighbor = field.spawn('lemon')!;
  const exploder = field.spawn('bomb', false, 'explosive')!;
  const boss = field.spawn('watermelon', true)!;
  source.group.position.set(0, 0.7, 0);
  neighbor.group.position.set(1, 0.7, 0);
  exploder.group.position.set(1.2, 0.7, 0);
  boss.group.position.set(1.5, 1, 0);
  const before = neighbor.hp;
  const explosiveHp = exploder.hp;
  const bossHp = boss.hp;
  field.hurt(source, source.hp, 'turret');
  const killed: string[] = [];
  assert.equal(detonatePulpPopper(field, source, (fruit) => killed.push(fruit.kind)), 1);
  assert.ok(neighbor.hp < before);
  assert.equal(exploder.hp, explosiveHp);
  assert.equal(boss.hp, bossHp);
  assert.deepEqual(killed, []);
});
