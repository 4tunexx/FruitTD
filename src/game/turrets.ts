import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { Fruit } from './fruits';
import type { JuiceBank, JuiceSystem } from './juice';
import type { PadDef } from './world';

export type TurretKind = 'guillotine' | 'vortex' | 'laser' | 'railgun' | 'sprinkler' | 'blender';

export interface TurretDef {
  kind: TurretKind;
  name: string;
  cost: number;
  blurb: string;
  fuel: 'none' | 'yellow' | 'pink' | 'orange';
  floorOnly: boolean;
}

export const TURRETS: TurretDef[] = [
  { kind: 'guillotine', name: 'Fire Blade', cost: 70, blurb: 'Flaming slicer. Area split damage.', fuel: 'none', floorOnly: true },
  { kind: 'vortex', name: 'Vortex Drain', cost: 55, blurb: 'Pulls juice. Weak damage + pull.', fuel: 'none', floorOnly: false },
  { kind: 'laser', name: 'Lemon Laser', cost: 80, blurb: 'Yellow juice. Fast beam down lane.', fuel: 'yellow', floorOnly: false },
  { kind: 'railgun', name: 'Berry Cannon', cost: 90, blurb: 'Pink juice. Pierce shot + knockback.', fuel: 'pink', floorOnly: false },
  { kind: 'sprinkler', name: 'Frost Sprinkler', cost: 50, blurb: 'Orange juice. Slows + brittle.', fuel: 'orange', floorOnly: false },
  { kind: 'blender', name: 'Spike Trap', cost: 65, blurb: 'Floor trap. Press B to open/close.', fuel: 'none', floorOnly: true },
];

export function turretDef(kind: TurretKind): TurretDef {
  return TURRETS.find((t) => t.kind === kind)!;
}

export function sellRefund(kind: TurretKind, level: number): number {
  return Math.round(turretDef(kind).cost * 0.6 + Math.max(0, level - 1) * 18);
}

export function canPlaceTurret(kind: TurretKind, pad: PadDef): boolean {
  if (pad.main) return false;
  const def = turretDef(kind);
  if (def.floorOnly && !pad.floor) return false;
  return true;
}

export function turretRange(kind: TurretKind | 'main', level: number): number {
  const lv = Math.max(1, level);
  if (kind === 'main') return 5.1 + lv * 0.45;
  if (kind === 'guillotine') return 1.05 + lv * 0.12;
  if (kind === 'vortex') return 2.8 + lv * 0.28;
  if (kind === 'laser') return 7.2 + lv * 0.35;
  if (kind === 'railgun') return 8.4 + lv * 0.4;
  if (kind === 'sprinkler') return 1.9 + lv * 0.18;
  return 0.7 + lv * 0.08;
}

export interface TurretHit {
  fruit: Fruit;
  damage: number;
  split?: boolean;
  pierce?: boolean;
  puddle?: boolean;
  brittle?: boolean;
  impulseX?: number;
  impulseZ?: number;
}

export interface TurretTick {
  dt: number;
  fruits: Fruit[];
  juice: JuiceSystem;
  bank: JuiceBank;
  onHit: (hit: TurretHit) => void;
  shoot: (tx: number, tz: number, hex: number) => void;
}

export class TurretRig {
  readonly group = new Group();
  readonly kind: TurretKind;
  phase = 0;
  cooldown = 0;
  charge = 0;
  open = true;
  private readonly blade: Mesh | null = null;
  private readonly spin: Group | null = null;
  private readonly beam: Mesh | null = null;
  private readonly lid: Mesh | null = null;
  private readonly lever: Mesh | null = null;
  private readonly slug: Mesh | null = null;
  private slugZ = 0;
  private slugLive = 0;

  constructor(kind: TurretKind) {
    this.kind = kind;
    if (kind === 'guillotine') {
      const post = new Mesh(new BoxGeometry(0.18, 1.15, 0.18), new MeshLambertMaterial({ color: 0x2a1a0a }));
      post.position.y = 0.62;
      this.blade = new Mesh(new BoxGeometry(0.95, 0.07, 0.28), new MeshLambertMaterial({ color: 0xff6622, emissive: 0xff3300, emissiveIntensity: 0.6 }));
      this.blade.position.set(0.42, 0.85, 0);
      this.group.add(post, this.blade);
    } else if (kind === 'vortex') {
      const base = new Mesh(new CylinderGeometry(0.55, 0.7, 0.22, 12), new MeshLambertMaterial({ color: 0x4a5560 }));
      base.position.y = 0.12;
      this.spin = new Group();
      const ring = new Mesh(new TorusGeometry(0.48, 0.07, 8, 16), new MeshLambertMaterial({ color: 0x6ec6c0 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.55;
      const cone = new Mesh(new CylinderGeometry(0.08, 0.42, 1.1, 10, 1, true), new MeshLambertMaterial({ color: 0x8fd4cf, transparent: true, opacity: 0.55 }));
      cone.position.y = 0.7;
      this.spin.add(ring, cone);
      this.group.add(base, this.spin);
    } else if (kind === 'laser') {
      const body = new Mesh(new BoxGeometry(0.7, 0.55, 0.7), new MeshLambertMaterial({ color: 0x6b5a2a }));
      body.position.y = 0.4;
      const lens = new Mesh(new SphereGeometry(0.28, 12, 10), new MeshLambertMaterial({ color: 0xffee55 }));
      lens.position.set(0, 0.72, 0.2);
      this.beam = new Mesh(
        new CylinderGeometry(0.06, 0.06, 9.2, 8),
        new MeshBasicMaterial({ color: 0xffee44, transparent: true, opacity: 0.55 }),
      );
      this.beam.rotation.x = Math.PI / 2;
      this.beam.position.set(0, 0.72, 4.7);
      this.beam.visible = false;
      this.group.add(body, lens, this.beam);
    } else if (kind === 'railgun') {
      const mount = new Mesh(new BoxGeometry(0.55, 0.35, 0.55), new MeshLambertMaterial({ color: 0x5a2a36 }));
      mount.position.y = 0.28;
      const barrelA = new Mesh(new CylinderGeometry(0.07, 0.09, 1.8, 8), new MeshLambertMaterial({ color: 0xd48aa0 }));
      const barrelB = barrelA.clone();
      barrelA.rotation.x = Math.PI / 2;
      barrelB.rotation.x = Math.PI / 2;
      barrelA.position.set(-0.12, 0.55, 0.7);
      barrelB.position.set(0.12, 0.55, 0.7);
      this.slug = new Mesh(new SphereGeometry(0.12, 8, 8), new MeshBasicMaterial({ color: 0xff77aa }));
      this.slug.visible = false;
      this.group.add(mount, barrelA, barrelB, this.slug);
    } else if (kind === 'sprinkler') {
      const base = new Mesh(new CylinderGeometry(0.28, 0.38, 0.3, 10), new MeshLambertMaterial({ color: 0xb86a20 }));
      base.position.y = 0.16;
      this.spin = new Group();
      this.spin.position.y = 0.4;
      for (let i = 0; i < 4; i++) {
        const arm = new Mesh(new BoxGeometry(0.12, 0.08, 0.7), new MeshLambertMaterial({ color: 0xff8a2a }));
        arm.rotation.y = (i * Math.PI) / 2;
        arm.position.set(Math.sin((i * Math.PI) / 2) * 0.25, 0, Math.cos((i * Math.PI) / 2) * 0.25);
        this.spin.add(arm);
      }
      this.group.add(base, this.spin);
    } else {
      const pit = new Mesh(new CylinderGeometry(0.62, 0.62, 0.28, 14), new MeshLambertMaterial({ color: 0x3a2a2a }));
      pit.position.y = 0.08;
      const spikes = new Mesh(new CylinderGeometry(0.5, 0.5, 0.32, 8), new MeshLambertMaterial({ color: 0x888888 }));
      spikes.position.y = 0.1;
      this.lid = new Mesh(new CylinderGeometry(0.6, 0.6, 0.08, 14), new MeshLambertMaterial({ color: 0x5a4a38 }));
      this.lid.position.y = 0.24;
      this.lever = new Mesh(new BoxGeometry(0.08, 0.45, 0.08), new MeshLambertMaterial({ color: 0xaa5533 }));
      this.lever.position.set(0.72, 0.35, 0);
      this.group.add(pit, spikes, this.lid, this.lever);
    }
  }

  setOpen(open: boolean): void {
    this.open = open;
    if (this.lid) this.lid.rotation.x = open ? -1.15 : 0;
    if (this.lever) this.lever.rotation.z = open ? 0.7 : 0;
  }

  tick(x: number, z: number, level: number, ctx: TurretTick): boolean {
    const { dt, fruits, juice, bank, onHit } = ctx;
    this.phase += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    let noisy = false;

    const range = turretRange(this.kind, level);
    if (this.kind === 'guillotine') {
      const swing = Math.sin(this.phase * 3.2);
      if (this.blade) this.blade.rotation.z = -0.7 + swing * 1.15;
      if (this.cooldown <= 0) {
        const pack = fruits.filter((f) => f.alive && Math.hypot(f.group.position.x - x, f.group.position.z - z) <= range);
        if (pack.length) {
          this.cooldown = 0.7;
          for (const fruit of pack) {
            onHit({ fruit, damage: 20 + level * 7, split: true });
            ctx.shoot(fruit.group.position.x, fruit.group.position.z, 0xff5522);
          }
          juice.floorSplash(x, z, 0xff6622, 10 + pack.length * 3);
          noisy = true;
        }
      }
    } else if (this.kind === 'vortex') {
      if (this.spin) this.spin.rotation.y += dt * 5.5;
      const sucked = juice.suckToward(x, z, range, x, 0.7, z, dt);
      bank.deposit(sucked);
      if (this.cooldown <= 0) {
        const target = nearest(fruits, x, z, range);
        if (target) {
          this.cooldown = 0.55;
          onHit({ fruit: target, damage: 5 + level * 2 });
          ctx.shoot(target.group.position.x, target.group.position.z, 0x6ec6c0);
          noisy = true;
        }
      }
      for (const fruit of fruits) {
        if (!fruit.alive) continue;
        const d = Math.hypot(fruit.group.position.x - x, fruit.group.position.z - z);
        if (d < range && d > 0.2) {
          fruit.impulseX += ((x - fruit.group.position.x) / d) * 1.6 * dt;
          fruit.impulseZ += ((z - fruit.group.position.z) / d) * 1.6 * dt;
        }
      }
    } else if (this.kind === 'laser') {
      const fueled = bank.yellow > 0;
      if (this.beam) this.beam.visible = fueled;
      if (fueled && this.cooldown <= 0) {
        bank.take('yellow', 1);
        this.cooldown = Math.max(0.22, 0.38 - level * 0.03);
        for (const fruit of fruits) {
          if (!fruit.alive) continue;
          if (Math.abs(fruit.group.position.x - x) > 0.48) continue;
          if (fruit.group.position.z < z - 0.2) continue;
          if (fruit.group.position.z - z > range) continue;
          onHit({ fruit, damage: 6 + level * 3 });
          ctx.shoot(fruit.group.position.x, fruit.group.position.z, 0xffee44);
        }
        noisy = true;
      }
    } else if (this.kind === 'railgun') {
      this.charge += dt;
      const need = Math.max(1.6, 2.4 - level * 0.12);
      if (this.slug && this.slugLive > 0) {
        this.slugLive -= dt;
        this.slugZ += 22 * dt;
        this.slug.position.set(0, 0.55, this.slugZ);
        this.slug.visible = this.slugLive > 0;
        for (const fruit of fruits) {
          if (!fruit.alive) continue;
          if (Math.abs(fruit.group.position.x - x) > 0.55) continue;
          if (Math.abs(fruit.group.position.z - (z + this.slugZ)) > 0.55) continue;
          onHit({ fruit, damage: 18 + level * 7, pierce: true, impulseX: 0, impulseZ: 7 + level });
        }
        if (this.slugLive <= 0) this.slug.visible = false;
      } else if (this.charge >= need && bank.take('pink', 6)) {
        this.charge = 0;
        this.slugLive = 0.55;
        this.slugZ = 0.4;
        if (this.slug) this.slug.visible = true;
        noisy = true;
      }
    } else if (this.kind === 'sprinkler') {
      if (this.spin) this.spin.rotation.y += dt * 3.4;
      if (this.cooldown <= 0) {
        this.cooldown = 0.2;
        const ang = this.phase * 3.4;
        const reach = range;
        const rx = x + Math.sin(ang) * reach;
        const rz = z + Math.cos(ang) * reach;
        juice.floorSplash(rx, rz, 0xff8a1a, 4);
        ctx.shoot(rx, rz, 0xff8a1a);
        for (const fruit of fruits) {
          if (!fruit.alive) continue;
          if (Math.hypot(fruit.group.position.x - rx, fruit.group.position.z - rz) > 0.7) continue;
          fruit.brittle = 2.4;
          onHit({ fruit, damage: 3 + level, brittle: true });
        }
        noisy = true;
      }
    } else if (this.kind === 'blender' && this.open) {
      for (const fruit of fruits) {
        if (!fruit.alive) continue;
        const d = Math.hypot(fruit.group.position.x - x, fruit.group.position.z - z);
        if (d > range) continue;
        onHit({ fruit, damage: 999, puddle: true });
        ctx.shoot(fruit.group.position.x, fruit.group.position.z, 0xff5533);
        juice.floorSplash(x, z, 0xff3355, 32);
        noisy = true;
      }
    }

    return noisy;
  }
}

function nearest(fruits: Fruit[], x: number, z: number, range: number): Fruit | null {
  let best: Fruit | null = null;
  let bestD = range;
  for (const fruit of fruits) {
    if (!fruit.alive) continue;
    const d = Math.hypot(fruit.group.position.x - x, fruit.group.position.z - z);
    if (d < bestD) {
      bestD = d;
      best = fruit;
    }
  }
  return best;
}
