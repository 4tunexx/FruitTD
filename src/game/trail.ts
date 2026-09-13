import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Vector3 } from 'three';

export class BladeTrail {
  readonly line: Line;
  private readonly positions = new Float32Array(16 * 3);
  private readonly geo: BufferGeometry;
  private readonly mat: LineBasicMaterial;

  constructor() {
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    this.geo.setDrawRange(0, 0);
    this.mat = new LineBasicMaterial({ color: 0x1d4ed8, linewidth: 2 });
    this.line = new Line(this.geo, this.mat);
    this.line.frustumCulled = false;
  }

  setColor(hex: number): void {
    this.mat.color.setHex(hex);
  }

  sync(points: Vector3[]): void {
    const n = Math.min(16, points.length);
    for (let i = 0; i < n; i++) {
      this.positions[i * 3] = points[i].x;
      this.positions[i * 3 + 1] = points[i].y + 0.02;
      this.positions[i * 3 + 2] = points[i].z;
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.setDrawRange(0, n);
  }
}
