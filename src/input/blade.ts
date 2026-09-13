import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { PointerKind } from '../game/heroes';
import { SLICE_Y } from '../game/world';
import type { GameRenderer } from '../engine/renderer';

export interface Slash {
  from: Vector3;
  to: Vector3;
  speed: number;
  charge: number;
  pointer: PointerKind;
}

const plane = new Plane(new Vector3(0, 1, 0), -SLICE_Y);
const ndc = new Vector2();
const hit = new Vector3();
const raycaster = new Raycaster();

export class BladeInput {
  private readonly samples: Vector3[] = [];
  private down = false;
  private panning = false;
  private downAt = 0;
  private lastX = 0;
  private lastY = 0;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  readonly trail: Vector3[] = [];
  lastSlash: Slash | null = null;
  lastClick: Vector3 | null = null;
  lastPointer: PointerKind = 'mouse';
  lastCharge = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
    private readonly view: GameRenderer,
  ) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.view.zoom(e.deltaY > 0 ? 1.1 : -1.1);
      },
      { passive: false },
    );
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));
  }

  private kind(e: PointerEvent): PointerKind {
    return e.pointerType === 'touch' ? 'touch' : 'mouse';
  }

  private project(clientX: number, clientY: number): Vector3 | null {
    const rect = this.canvas.getBoundingClientRect();
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, this.camera);
    return raycaster.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }

  private onDown(e: PointerEvent): void {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastPointer = this.kind(e);
    this.panning = e.button === 1 || e.button === 2 || e.shiftKey || this.pointers.size >= 2;
    if (this.panning) {
      // Seed lastX/lastY from the average of all active pointers so that the
      // first pan delta from onMove is computed correctly.
      let ax = 0, ay = 0, count = 0;
      for (const p of this.pointers.values()) { ax += p.x; ay += p.y; count++; }
      this.lastX = count ? ax / count : e.clientX;
      this.lastY = count ? ay / count : e.clientY;
      this.down = false;
      return;
    }
    if (e.button !== 0) return;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.down = true;
    this.downAt = performance.now();
    this.samples.length = 0;
    this.trail.length = 0;
    const p = this.project(e.clientX, e.clientY);
    if (p) {
      this.samples.push(p);
      this.trail.push(p);
    }
  }

  private onMove(e: PointerEvent): void {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.panning || this.pointers.size >= 2) {
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.view.pan(-dx * 0.028, dy * 0.028);
      return;
    }
    const p = this.project(e.clientX, e.clientY);
    if (!p) return;
    this.trail.push(p.clone());
    if (this.trail.length > 16) this.trail.shift();
    if (!this.down) return;
    this.samples.push(p);
    if (this.samples.length > 8) this.samples.shift();
    if (this.samples.length >= 2) {
      const a = this.samples[this.samples.length - 2];
      const b = this.samples[this.samples.length - 1];
      const dist = a.distanceTo(b);
      if (dist > 0.2) {
        this.lastSlash = {
          from: a.clone(),
          to: b.clone(),
          speed: dist * 60,
          charge: (performance.now() - this.downAt) / 1000,
          pointer: this.lastPointer,
        };
      }
    }
  }

  private onUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.lastCharge = (performance.now() - this.downAt) / 1000;
    if (this.down && this.samples.length) {
      const a = this.samples[0];
      const b = this.samples[this.samples.length - 1];
      if (a.distanceTo(b) < 0.28) this.lastClick = b.clone();
    }
    this.down = false;
    this.panning = this.pointers.size >= 2;
    this.samples.length = 0;
  }

  consumeSlash(): Slash | null {
    const slash = this.lastSlash;
    this.lastSlash = null;
    return slash;
  }

  consumeClick(): Vector3 | null {
    const c = this.lastClick;
    this.lastClick = null;
    return c;
  }

  fadeTrail(): void {
    if (!this.down && this.trail.length) this.trail.shift();
  }
}
