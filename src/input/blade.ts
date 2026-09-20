import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
import type { PointerKind } from '../game/heroes';
import { SLICE_Y } from '../game/world';
import type { GameRenderer } from '../engine/renderer';

export interface SlashSegment {
  from: Vector3;
  to: Vector3;
  speed: number;
}

export interface Slash {
  id: number;
  from: Vector3;
  to: Vector3;
  segments: SlashSegment[];
  speed: number;
  charge: number;
  pointer: PointerKind;
}

/** Minimum speed in world units/sec to trigger a slice (filters accidental slow drags). */
export const MIN_SLICE_SPEED = 3.0;

const plane = new Plane(new Vector3(0, 1, 0), -SLICE_Y);
const ndc = new Vector2();
const hit = new Vector3();
const raycaster = new Raycaster();

export class BladeInput {
  private readonly samples: Vector3[] = [];
  private readonly pendingSegments: SlashSegment[] = [];
  private down = false;
  private panning = false;
  private downAt = 0;
  private lastSampleTime = 0;
  private lastX = 0;
  private lastY = 0;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  readonly trail: Vector3[] = [];
  lastSlash: Slash | null = null;
  lastClick: Vector3 | null = null;
  lastPointer: PointerKind = 'mouse';
  lastCharge = 0;
  private strokeSerial = 0;
  private currentStrokeId = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: Camera,
    private readonly view: GameRenderer,
  ) {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.view.zoom(e.deltaY > 0 ? 1.1 : -1.1);
    }, { passive: false });

    // Mobile gesture lockdown: prevent pull-to-refresh and native scroll on the canvas
    canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    canvas.style.touchAction = 'none';

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

  private queueSegment(a: Vector3, b: Vector3, now: number): void {
    const dist = a.distanceTo(b);
    if (dist <= 0.08) return;
    const dt = Math.max(0.001, (now - this.lastSampleTime) / 1000);
    const speed = dist / dt;
    this.pendingSegments.push({
      from: a.clone(),
      to: b.clone(),
      speed,
    });
    if (this.pendingSegments.length > 64) {
      this.pendingSegments.splice(0, this.pendingSegments.length - 64);
    }
  }

  private onDown(e: PointerEvent): void {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.lastPointer = this.kind(e);
    this.panning = e.button === 1 || e.button === 2 || e.shiftKey || this.pointers.size >= 2;
    if (this.panning) {
      let ax = 0;
      let ay = 0;
      let count = 0;
      for (const p of this.pointers.values()) {
        ax += p.x;
        ay += p.y;
        count++;
      }
      this.lastX = count ? ax / count : e.clientX;
      this.lastY = count ? ay / count : e.clientY;
      this.down = false;
      return;
    }
    if (e.button !== 0) return;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.down = true;
    const now = performance.now();
    this.downAt = now;
    this.lastSampleTime = now;
    this.currentStrokeId = ++this.strokeSerial;
    this.samples.length = 0;
    this.pendingSegments.length = 0;
    this.lastSlash = null;
    this.trail.length = 0;
    const p = this.project(e.clientX, e.clientY);
    if (p) {
      this.samples.push(p);
      this.trail.push(p);
    }
  }

  private onMove(e: PointerEvent): void {
    if (this.pointers.has(e.pointerId)) {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
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
    if (this.trail.length > 28) this.trail.shift();
    if (!this.down) return;

    const now = performance.now();
    const previous = this.samples[this.samples.length - 1];
    if (previous) {
      this.queueSegment(previous, p, now);
    }
    this.lastSampleTime = now;
    this.samples.push(p);
    if (this.samples.length > 16) this.samples.shift();
  }

  private onUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.down) {
      this.lastCharge = (performance.now() - this.downAt) / 1000;
    }
    if (this.down && this.samples.length) {
      const a = this.samples[0];
      const b = this.samples[this.samples.length - 1];
      if (a.distanceTo(b) < 0.28) {
        this.lastClick = b.clone();
      }
    }
    this.down = false;
    this.panning = this.pointers.size >= 2;
    this.samples.length = 0;
  }

  consumeSlash(): Slash | null {
    if (!this.pendingSegments.length) return null;
    const segments = this.pendingSegments.slice();
    this.pendingSegments.length = 0;

    const first = segments[0];
    const last = segments[segments.length - 1];
    let maxSpeed = first.speed;
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].speed > maxSpeed) maxSpeed = segments[i].speed;
    }
    const charge = Math.max(0, (performance.now() - this.downAt) / 1000);
    const slash: Slash = {
      id: this.currentStrokeId,
      from: first.from.clone(),
      to: last.to.clone(),
      segments,
      speed: maxSpeed,
      charge,
      pointer: this.lastPointer,
    };
    this.lastSlash = slash;

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fruit-td-slash-start', { detail: { serial: slash.id } }));
    }
    return slash;
  }

  consumeSlashes(): Slash[] {
    const s = this.consumeSlash();
    return s ? [s] : [];
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
