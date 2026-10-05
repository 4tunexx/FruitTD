import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, OrthographicCamera, Raycaster, Scene } from 'three';
import { installDomStub } from '../domStub.test-helper';
installDomStub();
(globalThis as any).localStorage = { getItem: () => null };
import { PvpBattlefield, pvpWorldPoint } from './pvpBattlefield';
import { DEFAULT_PVP_CONFIG as config, createPvpPlayer } from '../../game/pvp';

test('mobile picking reaches every legal hex on all seven maps and excludes path and rival tiles', () => {
  for (const map of config.maps) for (const side of ['blue', 'red'] as const) {
    const players = [createPvpPlayer('a', 'A', 'blue', config), createPvpPlayer('b', 'B', 'red', config)];
    // Exercise terrain, camera framing and the production picker without a GPU.
    const canvas = document.createElement('div');
    (canvas as any).getBoundingClientRect = () => ({ width: 375, height: 470, left: 0, top: 0 });
    const field: any = Object.create(PvpBattlefield.prototype);
    const scene = new Scene(); const terrain = new Group(); scene.add(terrain);
    Object.assign(field, { element: canvas, canvas, snapshot: { id: 'hex-test', map, yourSide: side, players }, config, terrain, health: new Map(), buildPads: [], renderer: { setSize: () => undefined }, camera: new OrthographicCamera(-20, 20, 30, -30, .1, 200), zoom: 1, focusOwn: false, ray: new Raycaster() });
    field.buildTerrain(map); scene.updateMatrixWorld(true);
    for (const focused of [false, true]) {
      field.focusOwn = focused; field.resize(); field.camera.updateMatrixWorld();
      const pick = (cell: number, own: boolean) => {
        const point = pvpWorldPoint(map, cell % map.width + .5, Math.floor(cell / map.width) + .5, own);
        point.y = .16; point.project(field.camera);
        if (own) { assert.ok(Math.abs(point.x) < 1, `${map.id} ${cell} fits phone width`); assert.ok(Math.abs(point.y) < 1, `${map.id} ${cell} fits phone height`); }
        return field.buildCell({ clientX: (point.x + 1) * 375 / 2, clientY: (1 - point.y) * 470 / 2 });
      };
      for (const cell of map.buildCells) assert.equal(pick(cell, true), cell, `${map.id}/${side}/${focused} legal hex ${cell}`);
      for (const cell of map.pathCells) assert.equal(pick(cell, true), null, `${map.id} path is reserved`);
      for (const cell of map.buildCells) assert.equal(pick(cell, false), null, 'cannot build in rival territory');
    }
    terrain.traverse((object: any) => { object.geometry?.dispose(); if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose(); });
  }
});
