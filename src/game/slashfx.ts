import { BufferGeometry, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, DoubleSide } from 'three';

interface Flash {
  mesh: Mesh;
  life: number;
  length: number;
}

export class SlashFx {
  readonly group = new Group();
  private readonly flashes: Flash[] = [];

  constructor() {
    // A tapered cut in the arena plane, not a radial impact ring.
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute([
      -0.7, 0, 0, -0.12, 0, -0.045, 0.8, 0, 0, -0.12, 0, 0.045,
    ], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: DoubleSide });
    for (let i = 0; i < 10; i++) {
      const mesh = new Mesh(geo, mat.clone());
      mesh.visible = false;
      this.group.add(mesh);
      this.flashes.push({ mesh, life: 0, length: 1 });
    }
  }

  spawn(x: number, z: number, hex: number, dx = 1, dz = 0, length = 1): void {
    if (![x, z, dx, dz, length].every(Number.isFinite)) return;
    const flash = this.flashes.find((f) => f.life <= 0);
    if (!flash) return;
    flash.life = 0.14;
    flash.length = Math.max(0.45, Math.min(2, length));
    flash.mesh.visible = true;
    flash.mesh.position.set(x, 0.82, z);
    flash.mesh.rotation.y = -Math.atan2(dz, dx);
    flash.mesh.scale.set(flash.length, 1, 1);
    (flash.mesh.material as MeshBasicMaterial).color.setHex(hex);
    (flash.mesh.material as MeshBasicMaterial).opacity = 0.8;
  }

  update(dt: number): void {
    for (const flash of this.flashes) {
      if (flash.life <= 0) continue;
      flash.life -= dt;
      const t = Math.max(0, flash.life / 0.14);
      flash.mesh.scale.set(flash.length * (1 + (1 - t) * 0.15), 1, t);
      (flash.mesh.material as MeshBasicMaterial).opacity = t * 0.8;
      if (flash.life <= 0) flash.mesh.visible = false;
    }
  }

  reset(): void {
    for (const flash of this.flashes) {
      flash.life = 0;
      flash.mesh.visible = false;
    }
  }
}
