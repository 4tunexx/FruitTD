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

/**
 * Pointer sampling is deliberately kept separate from the combat resolver.
 * Every meaningful pointer segment becomes a hit-scan segment instead of
 * overwriting the previous segment. This prevents fast swipes from skipping
 * targets between render frames and makes multi-target slicing reliable.
 */
export class BladeInput {
  private readonly samples: Vector3[] = [];
  private readonly slashQueue: Slash[] = [];
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

  private queueSegment(a: Vector3, b: Vector3): void {
    const dist = a.distanceTo(b);
    if (dist <= 0.2) return;
    const now = performance.now();
    const slash: Slash = {
      from: a.clone(),
      to: b.clone(),
      speed: dist * 60,
      charge: Math.max(0, (now - this.downAt) / 1000),
      pointer: this.lastPointer,
    };
    this.lastSlash = slash;
    this.slashQueue.push(slash);
    if (this.slashQueue.length > 48) this.slashQueue.splice(0, this.slashQueue.length - 48);
  }

  private onDown(e: PointerEvent): void {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastPointer = this.kind(e);
    this.panning = e.button === 1 || e.button === 2 || e.shiftKey || this.pointers.size >= 2;
    if (this.panning) {
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
    this.slashQueue.length = 0;
    this.lastSlash = null;
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
    if (this.trail.length > 24) this.trail.shift();
    if (!this.down) return;
    const previous = this.samples[this.samples.length - 1];
    if (previous) this.queueSegment(previous, p);
    this.samples.push(p);
    if (this.samples.length > 12) this.samples.shift();
  }

  private onUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.down) this.lastCharge = (performance.now() - this.downAt) / 1000;
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
    const slash = this.slashQueue.shift() ?? null;
    if (!this.slashQueue.length) this.lastSlash = null;
    return slash;
  }

  /** Drain all queued hit-scan segments generated since the previous tick. */
  consumeSlashes(max = 16): Slash[] {
    const out: Slash[] = [];
    const count = Math.min(max, this.slashQueue.length);
    for (let i = 0; i < count; i++) {
      const slash = this.slashQueue.shift();
      if (slash) out.push(slash);
    }
    if (!this.slashQueue.length) this.lastSlash = null;
    return out;
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
