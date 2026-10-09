import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BATTLE_MAPS, defaultMapForMode, mapPointToWorld, normalizeBattleMap } from './battleMaps';

describe('authored battle map skeletons', () => {
  it('provides independent maps for each shared game mode with top spawns', () => {
    for (const mode of ['casual', 'horde', 'campaign', 'coop', 'pvp'] as const) {
      const map = DEFAULT_BATTLE_MAPS[mode];
      assert.equal(map.mode, mode);
      assert.ok(map.background.endsWith('.svg'));
      assert.equal(map.world.depth, mode === 'pvp' ? 132 : 44);
      assert.ok(map.routes.every((route) => route.points.length >= 2));
      assert.ok(map.spawns.every((spawn) => spawn.y < .1));
    }
    for (const mode of ['casual', 'horde', 'campaign'] as const) {
      const map = DEFAULT_BATTLE_MAPS[mode];
      assert.ok(map.routes.length >= 5, `${mode} has multiple playable lanes`);
      assert.ok(map.spawns.length >= 5, `${mode} has spread-out top spawn gates`);
      assert.ok(new Set(map.spawns.map((spawn) => spawn.x)).size >= 5);
      assert.ok(map.spawns.every((spawn) => spawn.y <= .03), `${mode} spawns only at the top`);
    }
    assert.equal(DEFAULT_BATTLE_MAPS.pvp.opponentTower?.y, .06);
    assert.equal(DEFAULT_BATTLE_MAPS.coop.routes.length, 2);
  });

  it('maps normalized image points into the same world coordinate frame at every viewport size', () => {
    const map = defaultMapForMode('casual');
    assert.deepEqual(mapPointToWorld({ x: 0, y: 0 }, map), { x: -map.world.width / 2, z: map.world.depth / 2 });
    assert.deepEqual(mapPointToWorld({ x: .5, y: .5 }, map), { x: 0, z: 0 });
    assert.deepEqual(mapPointToWorld({ x: 1, y: 1 }, map), { x: map.world.width / 2, z: -map.world.depth / 2 });
  });

  it('bounds untrusted editor fields and drops unsafe asset values', () => {
    const map = normalizeBattleMap({
      mode: 'casual', background: 'javascript:alert(1)', world: { width: 900, depth: 1 },
      routes: [{ id: 'main', points: [{ x: 12, y: -3 }, { x: .2, y: .4 }] }],
      entities: [{ id: 'block', kind: 'solid', x: 2, y: -1, width: 90, height: 0, asset: 'javascript:alert(1)' }],
    });
    assert.equal(map.background, DEFAULT_BATTLE_MAPS.casual.background);
    assert.equal(map.world.width, 22);
    assert.equal(map.world.depth, 44);
    assert.equal(map.routes[0]?.points[0]?.y, .025);
    assert.ok(Math.abs(map.routes[0]!.points[0]!.y - map.spawns[0]!.y) < .002);
    assert.deepEqual(map.routes[0]?.points[0], { x: 1, y: .025 });
    assert.equal(map.entities[0]?.asset, '');
    assert.equal(map.entities[0]?.width, 1);
    assert.equal(map.entities[0]?.height, .005);
  });

  it('migrates old 66-unit routes to the compact field without moving their gates off the top', () => {
    const map = normalizeBattleMap({
      mode: 'casual', world: { width: 22, depth: 66, columns: 11, rows: 66 },
      routes: [{ id: 'legacy', name: 'Legacy', width: 4, points: [{ x: .5, y: .03 }, { x: .5, y: .614 }] }],
      spawns: [{ id: 'old-gate', routeId: 'legacy', x: .5, y: .03, enabled: true, label: 'Old gate' }],
    });
    assert.equal(map.world.depth, 44);
    assert.ok(map.spawns[0]!.y <= .03, 'legacy spawn stays at the north edge');
    assert.ok(Math.abs(map.routes[0]!.points.at(-1)!.y - (.5 + 7.5 / 44)) < .002);
  });
});
