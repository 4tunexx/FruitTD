import {
  Color,
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import {
  ARENA_D,
  ARENA_W,
  DROPLETS_MELON,
  DROPLETS_PER_SLICE,
  PARTICLE_CAP,
} from './world';
import { FRUIT_DEFS, fruitFamily, type FruitKind } from './fruits';

const _m = new Matrix4();
const _c = new Color();

interface Drop {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  r: number;
  g: number;
  b: number;
}

export type JuiceHue = 'yellow' | 'pink' | 'orange' | 'green';

export interface JuiceColorCounts {
  yellow: number;
  pink: number;
  orange: number;
  green: number;
}

export function classifyJuice(r: number, g: number, b: number): JuiceHue {
  if (r > 0.65 && g > 0.65 && b < 0.45) return 'yellow';
  if (r > 0.7 && g < 0.45) return 'pink';
  if (r > 0.7 && g > 0.25 && g < 0.72) return 'orange';
  return 'green';
}

export function juiceHueFromKind(kind: FruitKind): JuiceHue {
  if (kind === 'orange') return 'orange';
  if (kind === 'lemon' || kind === 'banana' || kind === 'pineapple') return 'yellow';
  if (kind === 'watermelon' || kind === 'strawberry') return 'pink';
  return 'green';
}

export class JuiceBank {
  yellow = 0;
  pink = 0;
  orange = 0;
  green = 0;

  reset(): void {
    this.yellow = 0;
    this.pink = 0;
    this.orange = 0;
    this.green = 0;
  }

  add(hue: JuiceHue, n: number): void {
    this[hue] = Math.min(99, this[hue] + n);
  }

  take(hue: JuiceHue, n: number): boolean {
    if (this[hue] < n) return false;
    this[hue] -= n;
    return true;
  }

  deposit(counts: JuiceColorCounts): void {
    this.add('yellow', counts.yellow);
    this.add('pink', counts.pink);
    this.add('orange', counts.orange);
    this.add('green', counts.green);
  }
}

export class JuiceSystem {
  readonly mesh: InstancedMesh;
  private readonly drops: Drop[] = [];
  private cursor = 0;
  private dirty = true;

  constructor() {
    const geo = new IcosahedronGeometry(0.055, 0);
    const mat = new MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    });
    this.mesh = new InstancedMesh(geo, mat, PARTICLE_CAP);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = PARTICLE_CAP;
    for (let i = 0; i < PARTICLE_CAP; i++) {
      this.drops.push({
        alive: false,
        x: 0,
        y: -10,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        r: 1,
        g: 1,
        b: 0.2,
      });
      _m.makeScale(0, 0, 0);
      _m.setPosition(0, -20, 0);
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.setRGB(0, 0, 0));
    }
    this.mesh.instanceColor!.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  reset(): void {
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const d = this.drops[i];
      d.alive = false;
      d.life = 0;
      _m.makeScale(0, 0, 0);
      _m.setPosition(0, -20, 0);
      this.mesh.setMatrixAt(i, _m);
    }
    this.dirty = true;
  }

  burst(x: number, y: number, z: number, kind: FruitKind, swipe: Vector3, mul = 1): void {
    const def = FRUIT_DEFS[kind];
    const base = fruitFamily(kind) === 'melon' ? DROPLETS_MELON : DROPLETS_PER_SLICE;
    const n = Math.min(36, Math.round(base * mul));
    for (let i = 0; i < n; i++) {
      _c.setHex(i % 5 === 0 ? def.juice : def.splash);
      const d = this.drops[this.cursor];
      this.cursor = (this.cursor + 1) % PARTICLE_CAP;
      d.alive = true;
      d.x = x + (Math.random() - 0.5) * 0.25;
      d.y = y + (Math.random() - 0.5) * 0.25;
      d.z = z + (Math.random() - 0.5) * 0.25;
      const spread = 1.6 + Math.random() * 1.4;
      d.vx = swipe.x * 1.2 + (Math.random() - 0.5) * spread;
      d.vy = 1.4 + Math.random() * 2;
      d.vz = swipe.z * 1.2 + (Math.random() - 0.5) * spread;
      d.life = 0.45 + Math.random() * 0.25;
      d.r = _c.r;
      d.g = _c.g;
      d.b = _c.b;
      this.mesh.setColorAt(this.cursor === 0 ? PARTICLE_CAP - 1 : this.cursor - 1, _c);
    }
    this.mesh.instanceColor!.needsUpdate = true;
    this.mesh.visible = true;
    this.dirty = true;
  }

  floorSplash(x: number, z: number, hex: number, count: number): void {
    _c.setHex(hex);
    const n = Math.min(40, count);
    for (let i = 0; i < n; i++) {
      const d = this.drops[this.cursor];
      this.cursor = (this.cursor + 1) % PARTICLE_CAP;
      d.alive = true;
      d.x = x + (Math.random() - 0.5) * 1.6;
      d.y = 0.08;
      d.z = z + (Math.random() - 0.5) * 1.1;
      d.vx = (Math.random() - 0.5) * 0.8;
      d.vy = 0.15 + Math.random() * 0.35;
      d.vz = (Math.random() - 0.5) * 0.8;
      d.life = 0.7 + Math.random() * 0.35;
      d.r = _c.r;
      d.g = _c.g;
      d.b = _c.b;
      this.mesh.setColorAt(this.cursor === 0 ? PARTICLE_CAP - 1 : this.cursor - 1, _c);
    }
    this.mesh.instanceColor!.needsUpdate = true;
    this.mesh.visible = true;
    this.dirty = true;
  }

  suckToward(ox: number, oz: number, radius: number, tx: number, ty: number, tz: number, dt: number): JuiceColorCounts {
    const got: JuiceColorCounts = { yellow: 0, pink: 0, orange: 0, green: 0 };
    const r2 = radius * radius;
    for (const d of this.drops) {
      if (!d.alive) continue;
      const dx = ox - d.x;
      const dz = oz - d.z;
      if (dx * dx + dz * dz > r2) continue;
      d.vx += (tx - d.x) * 8 * dt;
      d.vy += (ty - d.y) * 8 * dt;
      d.vz += (tz - d.z) * 8 * dt;
      d.life = Math.max(d.life, 0.2);
      if (Math.hypot(d.x - tx, d.y - ty, d.z - tz) < 0.35) {
        got[classifyJuice(d.r, d.g, d.b)] += 1;
        d.alive = false;
        d.y = -20;
      }
    }
    this.dirty = true;
    return got;
  }

  update(dt: number): void {
    const hw = ARENA_W / 2 - 0.08;
    const hd = ARENA_D / 2 - 0.08;
    const g = 22;
    let any = false;
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const d = this.drops[i];
      if (!d.alive) continue;
      any = true;
      d.life -= dt;
      d.vy -= g * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.z += d.vz * dt;

      if (d.x > hw) {
        d.x = hw;
        d.vx *= -0.45;
      } else if (d.x < -hw) {
        d.x = -hw;
        d.vx *= -0.45;
      }
      if (d.z > hd) {
        d.z = hd;
        d.vz *= -0.45;
      } else if (d.z < -hd) {
        d.z = -hd;
        d.vz *= -0.45;
      }

      if (d.y < 0.05) {
        if (d.vy < -1.4) {
          d.y = 0.05;
          d.vy *= -0.32;
          d.vx *= 0.7;
          d.vz *= 0.7;
        } else {
          d.alive = false;
          d.y = -20;
        }
      }

      if (d.life <= 0) {
        d.alive = false;
        d.y = -20;
      }

      const s = d.alive ? 0.7 + d.life * 0.25 : 0;
      _m.makeScale(s, s, s);
      _m.setPosition(d.x, d.y, d.z);
      this.mesh.setMatrixAt(i, _m);
    }
    if (any) this.dirty = true;
    this.mesh.visible = any;
  }

  commit(): void {
    if (!this.dirty) return;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.dirty = false;
  }
}
