import assert from 'node:assert/strict';
import { test } from 'node:test';
import { battleScenery } from './battleArt';
import { Mesh } from 'three';

async function combat() {
  (globalThis as any).localStorage ??= { getItem: () => null, setItem: () => {} };
  const [{ TurretRig, TURRETS }, { JuiceBank, JuiceSystem }, { FruitField }] = await Promise.all([
    import('./turrets'), import('./juice'), import('./fruits'),
  ]);
  return { TurretRig, TURRETS, JuiceBank, JuiceSystem, FruitField };
}

test('all six turrets have visible mechanisms; online presentation cannot spend fuel or damage enemies', async () => {
  const { TurretRig, TURRETS } = await combat();
  for (const { kind } of TURRETS) {
    const rig = new TurretRig(kind);
    const mechanism = rig.group.children[0]!.children.find(node => node.type === 'Group' && node.name !== 'combat-token-frame')!;
    assert.ok(mechanism.children.length >= 3, `${kind} has a visible mechanism beyond a blank disc`);
    rig.animate(.2, true);
    assert.equal(rig.phase, .2);
    assert.equal(rig.cooldown, 0);
    assert.equal(rig.charge, 0);
  }
});

test('sprinkler consumes orange fuel and stops when empty', async () => {
  const { TurretRig, JuiceBank, JuiceSystem } = await combat();
  const rig = new TurretRig('sprinkler'), bank = new JuiceBank();
  let shots = 0;
  const ctx = { dt: .25, fruits: [], bank, juice: new JuiceSystem(), onHit: () => {}, shoot: () => { shots++; } };
  assert.equal(rig.tick(0,0,1,ctx), false);
  bank.orange = 1;
  assert.equal(rig.tick(0,0,1,ctx), true);
  assert.equal(bank.orange, 0);
  assert.equal(rig.tick(0,0,1,ctx), false);
  assert.equal(shots, 1);
});

test('cannon hits once per projectile and swept contact survives a slow frame', async () => {
  const { TurretRig, JuiceBank, JuiceSystem, FruitField } = await combat();
  const rig = new TurretRig('railgun'), bank = new JuiceBank();
  const fruit = new FruitField(() => {}).spawn('orange')!;
  fruit.group.position.set(0,.7,1.5);
  bank.pink = 12;
  let hits = 0;
  const ctx = { dt: .05, fruits: [fruit], bank, juice: new JuiceSystem(), onHit: () => { hits++; }, shoot: () => {} };
  rig.charge = 3;
  rig.tick(0,0,1,ctx); // launch
  ctx.dt = .1;
  rig.tick(0,0,1,ctx); // projectile crosses target between frames
  fruit.group.position.z = 3;
  rig.tick(0,0,1,ctx); // still intersecting this projectile
  assert.equal(hits, 1);
  assert.equal(bank.pink, 6);
});

test('scenery remains outside the playable width for solo and long online fields', () => {
  for (const length of [44,132]) {
    const scenery = battleScenery(22,length,12);
    assert.ok(scenery.children.length > 12);
    assert.ok(scenery.children.length <= 84, 'perimeter complexity stays bounded');
    scenery.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const halfWidth = (node.geometry as any).parameters.width / 2;
      assert.ok(Math.abs(node.position.x) - halfWidth > 11, 'no scenery covers lanes or build pads');
    });
  }
});
