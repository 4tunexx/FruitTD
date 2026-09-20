import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Group, Mesh, BoxGeometry, SphereGeometry, MeshBasicMaterial } from 'three';
import { fruitAtlas } from './atlas';
import { FRUIT_DEFS, fruitFamily, type Fruit, type FruitKind } from './fruits';
import { ENEMY_RULES } from './enemies';
import { strokeHitsFruit, MAX_RESLICE } from './slicer';
import { MIN_SLICE_SPEED, type Slash } from '../input/blade';
import { COMBAT_COMBO_STREAKS } from './progression/combo';

function createMockFruit(kind: FruitKind, x: number, y: number, z: number): Fruit {
  const def = FRUIT_DEFS[kind];
  const group = new Group();
  group.position.set(x, y, z);
  const body = new Mesh(new SphereGeometry(1), new MeshBasicMaterial());
  const hpBack = new Mesh(new BoxGeometry(1, 0.1, 0.1), new MeshBasicMaterial());
  const hpBar = new Mesh(new BoxGeometry(1, 0.1, 0.1), new MeshBasicMaterial());
  const hazardRing = new Mesh(new SphereGeometry(1.2), new MeshBasicMaterial());
  const armorRing = new Mesh(new BoxGeometry(1.4, 0.2, 1.4), new MeshBasicMaterial());
  group.add(body, hpBack, hpBar, hazardRing, armorRing);

  return {
    alive: true,
    kind,
    enemyKind: 'normal',
    radius: def.radius * 0.62,
    group,
    body,
    hpBar,
    hpBack,
    hazardRing,
    armorRing,
    vel: new Vector3(),
    spin: new Vector3(),
    bob: 0,
    hp: def.hp,
    maxHp: def.hp,
    dodgeX: 0,
    dodgeZ: 0,
    brittle: 0,
    impulseX: 0,
    impulseZ: 0,
    squash: 0,
    boss: false,
    volatileTriggered: false,
    splitChild: false,
    studio: {
      entityKey: 'enemy-normal',
      active: false,
      phase: 'walk',
      phaseT: 0,
      dir: 'down',
      cursor: 0,
      lastClipKey: '',
      lastFrame: -1,
      flashT: 0,
    },
  };
}

describe('Phase 3: Fruit Atlas & Fruit Definitions Audit', () => {
  it('atlas has exactly 8 columns and 4 rows matching 1024x1024 layout', () => {
    const dims = fruitAtlas.getDimensions();
    assert.equal(dims.cols, 8, 'Atlas must have 8 columns');
    assert.equal(dims.rows, 4, 'Atlas must have 4 rows');
  });

  it('every fruit skin and flesh coordinate falls within the valid [0-7, 0-3] atlas bounds', () => {
    const kinds = Object.keys(FRUIT_DEFS) as FruitKind[];
    for (const kind of kinds) {
      const def = FRUIT_DEFS[kind];
      assert.ok(
        fruitAtlas.isValidTile(def.skin[0], def.skin[1]),
        `${kind} skin tile [${def.skin[0]}, ${def.skin[1]}] is invalid in atlas`,
      );
      assert.ok(
        fruitAtlas.isValidTile(def.flesh[0], def.flesh[1]),
        `${kind} flesh tile [${def.flesh[0]}, ${def.flesh[1]}] is invalid in atlas`,
      );
    }
  });

  it('apple is defined as a first-class fruit with valid family, radii, and textures', () => {
    assert.ok(FRUIT_DEFS.apple, 'Apple fruit definition must exist');
    assert.equal(FRUIT_DEFS.apple.kind, 'apple');
    assert.equal(fruitFamily('apple'), 'berry');
    assert.ok(FRUIT_DEFS.apple.radius > 0.5);
    assert.ok(FRUIT_DEFS.apple.score >= 15);
    assert.deepEqual(FRUIT_DEFS.apple.skin, [4, 3]);
    assert.deepEqual(FRUIT_DEFS.apple.flesh, [5, 3]);
  });

  it('watermelon, lemon, orange, banana, strawberry, pineapple, kiwi have verified atlas coordinates', () => {
    assert.deepEqual(FRUIT_DEFS.watermelon.skin, [0, 0]);
    assert.deepEqual(FRUIT_DEFS.watermelon.flesh, [1, 0]);
    assert.deepEqual(FRUIT_DEFS.lemon.skin, [4, 0]);
    assert.deepEqual(FRUIT_DEFS.lemon.flesh, [5, 0]);
    assert.deepEqual(FRUIT_DEFS.orange.skin, [0, 2]);
    assert.deepEqual(FRUIT_DEFS.orange.flesh, [1, 2]);
    assert.deepEqual(FRUIT_DEFS.banana.skin, [2, 1]);
    assert.deepEqual(FRUIT_DEFS.banana.flesh, [3, 1]);
    assert.deepEqual(FRUIT_DEFS.strawberry.skin, [6, 1]);
    assert.deepEqual(FRUIT_DEFS.strawberry.flesh, [3, 3]);
    assert.deepEqual(FRUIT_DEFS.pineapple.skin, [6, 0]);
    assert.deepEqual(FRUIT_DEFS.pineapple.flesh, [7, 0]);
    assert.deepEqual(FRUIT_DEFS.kiwi.skin, [2, 2]);
    assert.deepEqual(FRUIT_DEFS.kiwi.flesh, [3, 2]);
    assert.deepEqual(FRUIT_DEFS.bomb.skin, [6, 2]);
    assert.deepEqual(FRUIT_DEFS.bomb.flesh, [7, 2]);
  });
});

describe('Phase 3: Multi-Segment Slicing & Hit Detection', () => {
  it('detects hits across multi-segment strokes', () => {
    const fruit = createMockFruit('orange', 0, 0.65, 0);

    const stroke: Slash = {
      id: 101,
      from: new Vector3(-2, 0.65, -1),
      to: new Vector3(2, 0.65, 1),
      segments: [
        { from: new Vector3(-2, 0.65, -1), to: new Vector3(-1, 0.65, -0.5), speed: 12 },
        { from: new Vector3(-1, 0.65, -0.5), to: new Vector3(1, 0.65, 0.5), speed: 14 },
        { from: new Vector3(1, 0.65, 0.5), to: new Vector3(2, 0.65, 1), speed: 10 },
      ],
      speed: 14,
      charge: 0,
      pointer: 'mouse',
    };

    const res = strokeHitsFruit(stroke, fruit, 0.1);
    assert.equal(res.hit, true, 'Stroke should hit fruit intersecting its middle segment');
  });

  it('stroke does not hit fruit far from its path', () => {
    const fruit = createMockFruit('lemon', 5, 0.65, 5);

    const stroke: Slash = {
      id: 102,
      from: new Vector3(-2, 0.65, 0),
      to: new Vector3(2, 0.65, 0),
      segments: [{ from: new Vector3(-2, 0.65, 0), to: new Vector3(2, 0.65, 0), speed: 10 }],
      speed: 10,
      charge: 0,
      pointer: 'mouse',
    };

    const res = strokeHitsFruit(stroke, fruit, 0.1);
    assert.equal(res.hit, false, 'Stroke should not hit distant fruit');
  });

  it('minimum slice speed is enforced to filter accidental slow drags', () => {
    assert.ok(MIN_SLICE_SPEED >= 2.5, 'MIN_SLICE_SPEED must be at least 2.5');
    assert.ok(MIN_SLICE_SPEED <= 5.0, 'MIN_SLICE_SPEED must be reasonable for responsive play');
  });
});

describe('Phase 3: Combo Escalation Tiers', () => {
  it('combo streak table contains all required tiers: 1, 2, 3, 5, 10, 25, 50', () => {
    const tiers = COMBAT_COMBO_STREAKS.map((s) => s.n);
    assert.ok(tiers.includes(1), 'Must include tier 1');
    assert.ok(tiers.includes(2), 'Must include tier 2');
    assert.ok(tiers.includes(3), 'Must include tier 3');
    assert.ok(tiers.includes(5), 'Must include tier 5');
    assert.ok(tiers.includes(10), 'Must include tier 10');
    assert.ok(tiers.includes(25), 'Must include tier 25');
    assert.ok(tiers.includes(50), 'Must include tier 50');

    const map = new Map(COMBAT_COMBO_STREAKS.map((s) => [s.n, s.title]));
    assert.equal(map.get(1), 'SLICE!');
    assert.equal(map.get(2), 'DOUBLE SLICE!');
    assert.equal(map.get(3), 'TRIPLE SLICE!');
    assert.equal(map.get(5), 'MULTISLICER!');
    assert.equal(map.get(10), 'ULTRASLICE!');
    assert.equal(map.get(25), 'UNSTOPPABLE!');
    assert.equal(map.get(50), 'GODLIKE CUT!');
  });
});

describe('Phase 3: Reslicing & Special Enemies', () => {
  it('max reslice is capped at 2 to prevent infinite farming', () => {
    assert.equal(MAX_RESLICE, 2, 'Reslicing must be capped at 2 generations');
  });

  it('explosive enemy has high damage risk to tower', () => {
    const exp = ENEMY_RULES.explosive;
    assert.ok(exp.towerDamageOnHit >= 2, 'Explosive enemy hit must hurt tower');
    assert.ok(exp.towerDamageOnLeak >= 3, 'Explosive leak must deal heavy damage');
    assert.ok(exp.warning.length > 0, 'Explosive enemy must have a clear warning');
  });

  it('armored enemy has high HP multiplier and score reward', () => {
    const arm = ENEMY_RULES.armored;
    assert.ok(arm.hpMultiplier >= 2.0, 'Armored enemy must have at least 2x HP');
    assert.ok(arm.scoreMultiplier >= 2.0, 'Armored enemy must give high score reward');
  });
});
