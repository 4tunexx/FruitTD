import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, Points, PointsMaterial, Vector3, Color } from 'three';
import type { CatalogSlicer, SlicerFxStyle } from './slicers';
import { hexToNumber } from './slicers';

/** Visible slash glint for the equipped slicer (trail + sparkles). */
export class BladeTrail {
  readonly line: Line;
  readonly glowLine: Line;
  readonly sparks: Points;
  private readonly positions = new Float32Array(16 * 3);
  private readonly glowPositions = new Float32Array(16 * 3);
  private readonly sparkPositions = new Float32Array(48 * 3);
  private readonly sparkAges = new Float32Array(48);
  private sparkCursor = 0;
  private readonly geo: BufferGeometry;
  private readonly glowGeo: BufferGeometry;
  private readonly sparkGeo: BufferGeometry;
  private readonly mat: LineBasicMaterial;
  private readonly glowMat: LineBasicMaterial;
  private readonly sparkMat: PointsMaterial;
  private style: SlicerFxStyle = 'solid';
  private glint = 0.25;
  private primary = new Color(0x1d4ed8);
  private secondary = new Color(0x38bdf8);

  constructor() {
    this.geo = new BufferGeometry();
    this.geo.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    this.geo.setDrawRange(0, 0);
    this.mat = new LineBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.95 });
    this.line = new Line(this.geo, this.mat);
    this.line.frustumCulled = false;

    this.glowGeo = new BufferGeometry();
    this.glowGeo.setAttribute('position', new Float32BufferAttribute(this.glowPositions, 3));
    this.glowGeo.setDrawRange(0, 0);
    this.glowMat = new LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
    this.glowLine = new Line(this.glowGeo, this.glowMat);
    this.glowLine.frustumCulled = false;

    this.sparkGeo = new BufferGeometry();
    this.sparkGeo.setAttribute('position', new Float32BufferAttribute(this.sparkPositions, 3));
    this.sparkMat = new PointsMaterial({
      color: 0xffffff,
      size: 0.12,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.sparks = new Points(this.sparkGeo, this.sparkMat);
    this.sparks.frustumCulled = false;
  }

  applySlicer(slicer: CatalogSlicer | null | undefined, fallbackHex = 0x1d4ed8): void {
    const color = slicer ? hexToNumber(slicer.color, fallbackHex) : fallbackHex;
    const glow = slicer ? hexToNumber(slicer.glowColor, color) : color;
    this.primary.setHex(color);
    this.secondary.setHex(glow);
    this.mat.color.copy(this.primary);
    this.glowMat.color.copy(this.secondary);
    this.sparkMat.color.copy(this.secondary);
    this.style = slicer?.fxStyle || 'solid';
    this.glint = slicer?.glint ?? 0.25;
    const glowAmt = slicer?.glow ?? 0.35;
    this.glowMat.opacity = 0.18 + glowAmt * 0.55;
    this.mat.opacity = 0.75 + Math.min(0.25, (slicer?.trailWidth ?? 1) * 0.12);
    this.sparkMat.size = 0.08 + (slicer?.trailWidth ?? 1) * 0.06 + this.glint * 0.08;
    this.sparkMat.opacity = 0.35 + this.glint * 0.6;
  }

  setColor(hex: number): void {
    this.primary.setHex(hex);
    this.mat.color.copy(this.primary);
    this.glowMat.color.copy(this.primary);
    this.sparkMat.color.copy(this.primary);
  }

  sync(points: Vector3[]): void {
    const n = Math.min(16, points.length);
    for (let i = 0; i < n; i++) {
      const yLift = 0.02 + (this.style === 'plasma' ? 0.03 : 0.01);
      this.positions[i * 3] = points[i].x;
      this.positions[i * 3 + 1] = points[i].y + yLift;
      this.positions[i * 3 + 2] = points[i].z;
      this.glowPositions[i * 3] = points[i].x;
      this.glowPositions[i * 3 + 1] = points[i].y + yLift * 0.5;
      this.glowPositions[i * 3 + 2] = points[i].z;
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.setDrawRange(0, n);
    this.glowGeo.getAttribute('position').needsUpdate = true;
    this.glowGeo.setDrawRange(0, n);

    if (n >= 2 && this.glint > 0.05) {
      const tip = points[n - 1];
      const prev = points[n - 2];
      const spawn = Math.random() < this.glint * (this.style === 'solid' ? 0.35 : 0.7);
      if (spawn) {
        const t = Math.random();
        const jx = (Math.random() - 0.5) * 0.18;
        const jz = (Math.random() - 0.5) * 0.18;
        const idx = this.sparkCursor % 48;
        this.sparkPositions[idx * 3] = prev.x + (tip.x - prev.x) * t + jx;
        this.sparkPositions[idx * 3 + 1] = tip.y + 0.08 + Math.random() * 0.12;
        this.sparkPositions[idx * 3 + 2] = prev.z + (tip.z - prev.z) * t + jz;
        this.sparkAges[idx] = 0.28 + this.glint * 0.25;
        this.sparkCursor++;
      }
    }
  }

  update(dt: number): void {
    let alive = 0;
    for (let i = 0; i < 48; i++) {
      if (this.sparkAges[i] <= 0) continue;
      this.sparkAges[i] -= dt;
      if (this.sparkAges[i] <= 0) {
        this.sparkPositions[i * 3 + 1] = -999;
        continue;
      }
      this.sparkPositions[i * 3 + 1] += dt * 0.35;
      alive++;
    }
    this.sparkGeo.getAttribute('position').needsUpdate = true;
    this.sparks.visible = alive > 0 || this.glint > 0.05;
  }
}
