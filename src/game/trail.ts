import { BufferGeometry, BufferAttribute, DynamicDrawUsage, Mesh, MeshBasicMaterial, DoubleSide, Points, PointsMaterial, Vector3, Color } from 'three';
import type { CatalogSlicer, SlicerFxStyle } from './slicers';
import { hexToNumber } from './slicers';

/** Visible slash glint for the equipped slicer (trail + sparkles). */
export class BladeTrail {
  readonly line: Mesh;
  readonly glowLine: Mesh;
  readonly sparks: Points;
  private readonly positions = new Float32Array(16 * 2 * 3);
  private readonly glowPositions = new Float32Array(16 * 2 * 3);
  private readonly sparkPositions = new Float32Array(48 * 3);
  private readonly sparkAges = new Float32Array(48);
  private sparkCursor = 0;
  private readonly geo: BufferGeometry;
  private readonly glowGeo: BufferGeometry;
  private readonly sparkGeo: BufferGeometry;
  private readonly mat: MeshBasicMaterial;
  private readonly glowMat: MeshBasicMaterial;
  private readonly sparkMat: PointsMaterial;
  private style: SlicerFxStyle = 'solid';
  private glint = 0.25;
  private primary = new Color(0x1d4ed8);
  private secondary = new Color(0x38bdf8);
  private width = 0.045;
  private readonly previousTip = new Vector3(Infinity, Infinity, Infinity);

  constructor() {
    this.geo = new BufferGeometry();
    // BufferAttribute shares these arrays. Float32BufferAttribute copied them,
    // leaving the previous trail's rendered vertices stuck at the origin.
    this.geo.setAttribute('position', new BufferAttribute(this.positions, 3).setUsage(DynamicDrawUsage));
    const indices: number[] = [];
    for (let i = 0; i < 15; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(indices);
    this.geo.setDrawRange(0, 0);
    this.mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false, side: DoubleSide });
    this.line = new Mesh(this.geo, this.mat);
    this.line.frustumCulled = false;

    this.glowGeo = new BufferGeometry();
    this.glowGeo.setAttribute('position', new BufferAttribute(this.glowPositions, 3).setUsage(DynamicDrawUsage));
    this.glowGeo.setIndex(indices);
    this.glowGeo.setDrawRange(0, 0);
    this.glowMat = new MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.22, depthWrite: false, side: DoubleSide });
    this.glowLine = new Mesh(this.glowGeo, this.glowMat);
    this.glowLine.frustumCulled = false;

    this.sparkGeo = new BufferGeometry();
    for (let i = 0; i < 48; i++) this.sparkPositions[i * 3 + 1] = -999;
    this.sparkGeo.setAttribute('position', new BufferAttribute(this.sparkPositions, 3).setUsage(DynamicDrawUsage));
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
    this.sparks.visible = false;
  }

  applySlicer(slicer: CatalogSlicer | null | undefined, fallbackHex = 0x1d4ed8): void {
    const color = slicer ? hexToNumber(slicer.color, fallbackHex) : fallbackHex;
    const glow = slicer ? hexToNumber(slicer.glowColor, color) : color;
    this.primary.setHex(color);
    this.secondary.setHex(glow);
    this.mat.color.copy(this.primary).lerp(new Color(0xffffff), 0.65);
    this.glowMat.color.copy(this.secondary);
    this.sparkMat.color.copy(this.secondary);
    this.style = slicer?.fxStyle || 'solid';
    this.glint = slicer?.glint ?? 0.25;
    const glowAmt = slicer?.glow ?? 0.35;
    this.width = Math.max(0.025, Math.min(0.09, 0.025 + (slicer?.trailWidth ?? 1) * 0.018));
    this.glowMat.opacity = Math.min(0.32, 0.1 + glowAmt * 0.2);
    this.mat.opacity = 0.75 + Math.min(0.25, (slicer?.trailWidth ?? 1) * 0.12);
    this.sparkMat.size = 0.05 + Math.min(0.06, this.glint * 0.06);
    this.sparkMat.opacity = 0.3 + Math.min(0.35, this.glint * 0.35);
  }

  setColor(hex: number): void {
    this.primary.setHex(hex);
    this.mat.color.copy(this.primary);
    this.glowMat.color.copy(this.primary);
    this.sparkMat.color.copy(this.primary);
  }

  sync(points: Vector3[]): void {
    const n = Math.min(16, points.length);
    const start = points.length - n;
    for (let i = 0; i < n; i++) {
      const p = points[start + i];
      const prev = points[start + Math.max(0, i - 1)];
      const next = points[start + Math.min(n - 1, i + 1)];
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const length = Math.hypot(dx, dz) || 1;
      const taper = n === 2 ? 0.35 : Math.max(0.03, Math.sin(Math.PI * i / Math.max(1, n - 1)));
      const halfWidth = this.width * taper;
      const yLift = 0.02 + (this.style === 'plasma' ? 0.03 : 0.01);
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1;
        const offset = (i * 2 + side) * 3;
        const ox = -dz / length * halfWidth * sign;
        const oz = dx / length * halfWidth * sign;
        this.positions[offset] = p.x + ox;
        this.positions[offset + 1] = p.y + yLift;
        this.positions[offset + 2] = p.z + oz;
        this.glowPositions[offset] = p.x + ox * 2.6;
        this.glowPositions[offset + 1] = p.y + yLift * 0.5;
        this.glowPositions[offset + 2] = p.z + oz * 2.6;
      }
    }
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.setDrawRange(0, Math.max(0, n - 1) * 6);
    this.glowGeo.getAttribute('position').needsUpdate = true;
    this.glowGeo.setDrawRange(0, Math.max(0, n - 1) * 6);

    if (n >= 2 && this.glint > 0.05) {
      const tip = points[points.length - 1];
      const prev = points[points.length - 2];
      const spawn = tip.distanceToSquared(this.previousTip) > 0.001 && Math.random() < this.glint * 0.3;
      this.previousTip.copy(tip);
      if (spawn) {
        const t = Math.random();
        const jx = (Math.random() - 0.5) * 0.18;
        const jz = (Math.random() - 0.5) * 0.18;
        const idx = this.sparkCursor % 48;
        this.sparkPositions[idx * 3] = prev.x + (tip.x - prev.x) * t + jx;
        this.sparkPositions[idx * 3 + 1] = tip.y + 0.08 + Math.random() * 0.12;
        this.sparkPositions[idx * 3 + 2] = prev.z + (tip.z - prev.z) * t + jz;
        this.sparkAges[idx] = 0.15 + Math.min(0.15, this.glint * 0.1);
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
    this.sparks.visible = alive > 0;
  }

  reset(): void {
    this.geo.setDrawRange(0, 0);
    this.glowGeo.setDrawRange(0, 0);
    this.sparkAges.fill(0);
    for (let i = 0; i < 48; i++) this.sparkPositions[i * 3 + 1] = -999;
    this.sparks.visible = false;
    this.previousTip.set(Infinity, Infinity, Infinity);
  }
}
