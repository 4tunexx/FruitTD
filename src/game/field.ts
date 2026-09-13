import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial, PlaneGeometry } from 'three';
import { ARENA_D, ARENA_W } from './world';

export class Field {
  readonly group = new Group();

  constructor() {
    const ground = new Mesh(
      new PlaneGeometry(ARENA_W + 8, ARENA_D + 8),
      new MeshLambertMaterial({ color: 0x7db85a }),
    );
    ground.rotation.x = -Math.PI / 2;
    this.group.add(ground);

    const inner = new Mesh(
      new PlaneGeometry(ARENA_W + 1.2, ARENA_D + 1.2),
      new MeshLambertMaterial({ color: 0x8fbf6a }),
    );
    inner.rotation.x = -Math.PI / 2;
    inner.position.y = 0.01;
    this.group.add(inner);

    for (const [x, z, s] of [
      [-6.5, 3.2, 3.4],
      [5.8, 6.1, 2.8],
      [-3.2, 9.4, 3.8],
      [7.2, -1.2, 2.6],
    ] as const) {
      const patch = new Mesh(new PlaneGeometry(s, s * 0.7), new MeshLambertMaterial({ color: 0x6fa34c }));
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(x, 0.02, z);
      this.group.add(patch);
    }

    const trunkMat = new MeshLambertMaterial({ color: 0x6b4423 });
    const leafMat = new MeshLambertMaterial({ color: 0x3d8b3a });
    for (const [x, z] of [
      [-12.2, -8],
      [12.1, -7.4],
      [-11.6, 4],
      [11.8, 6.2],
      [-10.4, 12.4],
      [10.8, 11.6],
      [-8.2, 14.2],
      [7.6, 14.6],
    ] as const) {
      const trunk = new Mesh(new CylinderGeometry(0.16, 0.22, 1.1, 7), trunkMat);
      trunk.position.set(x, 0.55, z);
      const leaf = new Mesh(new ConeGeometry(0.85, 1.6, 8), leafMat);
      leaf.position.set(x, 1.7, z);
      this.group.add(trunk, leaf);
    }
  }
}
