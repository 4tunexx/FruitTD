import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, MeshBasicMaterial } from 'three';
import { combatTokenFrame, COMBAT_GOLD, setCombatTokenKind } from './combatTokens';

test('normal tokens and recycled bosses retain a solid gold frame without a stale boss rim', () => {
  const frame = combatTokenFrame(1);
  const rim = frame.getObjectByName('token-rim') as Mesh;
  const boss = frame.getObjectByName('token-boss-rim')!;
  assert.equal((rim.material as MeshBasicMaterial).color.getHex(), COMBAT_GOLD);
  assert.equal(boss.visible, false);
  setCombatTokenKind(frame, 'boss');
  assert.equal(boss.visible, true);
  setCombatTokenKind(frame, 'fruit');
  assert.equal(boss.visible, false);
  assert.ok((frame.getObjectByName('token-back') as Mesh).renderOrder < rim.renderOrder);
});

test('circular combat art preserves fruit collision sizes and tower attack ranges', async () => {
  const values = new Map<string, string>();
  (globalThis as any).localStorage ??= { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
  const { FruitField, FRUIT_DEFS } = await import('./fruits');
  const { TurretRig, turretRange } = await import('./turrets');
  const field = new FruitField(() => {});
  const fruit = field.spawn('banana')!;
  const boss = field.spawn('watermelon', true)!;
  assert.equal(fruit.body.geometry.type, 'CircleGeometry');
  assert.equal(fruit.radius, FRUIT_DEFS.banana.radius * .62);
  assert.equal(boss.radius, FRUIT_DEFS.watermelon.radius * 1.05);
  assert.equal(boss.body.getObjectByName('token-boss-rim')!.visible, true);
  const tower = new TurretRig('laser');
  assert.ok(tower.group.getObjectByName('combat-token-frame'));
  assert.equal(turretRange('laser', 1), 7.2);
  assert.ok(turretRange('laser',10)>turretRange('laser',1));
});
