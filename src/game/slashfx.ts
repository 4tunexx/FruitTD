import { Group, Mesh, MeshBasicMaterial, RingGeometry } from 'three';

interface Flash {
  mesh: Mesh;
  life: number;
}

export class SlashFx {
  readonly group = new Group();
  private readonly flashes: Flash[] = [];

  constructor() {
    const geo = new RingGeometry(0.12, 0.38, 18);
    const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 10; i++) {
      const mesh = new Mesh(geo, mat.clone());
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.group.add(mesh);
      this.flashes.push({ mesh, life: 0 });
    }
  }

  spawn(x: number, z: number, hex: number): void {
    const flash = this.flashes.find((f) => f.life <= 0);
    if (!flash) return;
    flash.life = 0.22;
    flash.mesh.visible = true;
    flash.mesh.position.set(x, 0.82, z);
    flash.mesh.scale.setScalar(0.7);
    (flash.mesh.material as MeshBasicMaterial).color.setHex(hex);
    (flash.mesh.material as MeshBasicMaterial).opacity = 0.7;
  }

  update(dt: number): void {
    for (const flash of this.flashes) {
      if (flash.life <= 0) continue;
      flash.life -= dt;
      const t = Math.max(0, flash.life / 0.22);
      flash.mesh.scale.setScalar(0.7 + (1 - t) * 1.4);
      (flash.mesh.material as MeshBasicMaterial).opacity = t * 0.7;
      if (flash.life <= 0) flash.mesh.visible = false;
    }
  }
}
