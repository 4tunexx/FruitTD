import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import { fruitAtlas } from './atlas';
import type { Fruit } from './fruits';
import type { JuiceBank, JuiceSystem } from './juice';
import { TurretRig, canPlaceTurret, sellRefund, turretRange, type TurretHit, type TurretKind } from './turrets';
import { ARENA_W, EXTRA_Z, MAIN_INDEX, MAX_TOWER_LEVEL, PADS, WALL_Z, towerStats } from './world';
import { getAdminTexture } from './adminTextureLoader';
import type { HeroId } from './heroes';

export interface Slot {
  index: number;
  main: boolean;
  filled: boolean;
  level: number;
  cooldown: number;
  x: number;
  z: number;
  floor: boolean;
  kind: TurretKind | 'main' | null;
  pad: Mesh;
  head: Mesh | null;
  turret: TurretRig | null;
}

interface Shot {
  mesh: Mesh;
  life: number;
  maxLife: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
}

const _aim = new Vector3();
const MAX_SHOTS = 36;

export class WallBase {
  readonly group = new Group();
  readonly slots: Slot[] = [];
  selected = MAIN_INDEX;
  moving = false;
  private readonly shots: Shot[] = [];
  private readonly wallMesh: Mesh;
  private readonly rangeRing: Mesh;
  private readonly keepMesh: Mesh;
  private currentHero: HeroId | null = null;

  constructor() {
    this.wallMesh = new Mesh(
      new BoxGeometry(ARENA_W - 2, 1.15, 2.1),
      new MeshLambertMaterial({ color: 0x9a4034 }),
    );
    this.wallMesh.position.set(0, 0.52, (WALL_Z + EXTRA_Z) / 2);
    this.group.add(this.wallMesh);

    const lip = new Mesh(
      new BoxGeometry(ARENA_W - 1.8, 0.14, 0.2),
      new MeshLambertMaterial({ color: 0xe6c98a }),
    );
    lip.position.set(0, 1.12, EXTRA_Z + 0.55);
    this.group.add(lip);

    const keepMat = new MeshLambertMaterial({ color: 0x6e3128 });
    this.keepMesh = new Mesh(
      new CylinderGeometry(1.05, 1.2, 2.1, 10),
      keepMat,
    );
    this.keepMesh.position.set(0, 1.15, WALL_Z);
    this.group.add(this.keepMesh);
    for (let i = 0; i < 6; i++) {
      const merlon = new Mesh(new BoxGeometry(0.32, 0.38, 0.28), new MeshLambertMaterial({ color: 0x5a271f }));
      const a = (i / 6) * Math.PI * 2;
      merlon.position.set(Math.sin(a) * 0.95, 2.25, WALL_Z + Math.cos(a) * 0.55);
      this.group.add(merlon);
    }
    const crown = new Mesh(new CylinderGeometry(0.42, 0.5, 0.28, 10), new MeshLambertMaterial({ color: 0xe8d7a8 }));
    crown.position.set(0, 2.35, WALL_Z);
    this.group.add(crown);

    this.rangeRing = new Mesh(
      new RingGeometry(0.7, 0.92, 40),
      new MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.position.y = 0.08;
    this.rangeRing.visible = false;
    this.group.add(this.rangeRing);

    for (let i = 0; i < PADS.length; i++) {
      const def = PADS[i];
      const rim = new Mesh(
        new CylinderGeometry(def.main ? 0.82 : 0.52, def.main ? 0.82 : 0.52, 0.12, 12),
        new MeshLambertMaterial({ color: 0x3f2a20 }),
      );
      rim.position.set(def.x, def.main ? 2.15 : 1.02, def.z);
      this.group.add(rim);
      const pad = new Mesh(
        new CylinderGeometry(def.main ? 0.7 : 0.42, def.main ? 0.7 : 0.42, 0.1, 12),
        new MeshLambertMaterial({ color: def.main ? 0xf3f4f6 : 0xd6c4a0 }),
      );
      pad.position.set(def.x, def.main ? 2.24 : 1.1, def.z);
      this.group.add(pad);
      const slot: Slot = {
        index: i,
        main: def.main,
        filled: def.main,
        level: def.main ? 1 : 0,
        cooldown: 0,
        x: def.x,
        z: def.z,
        floor: def.floor,
        kind: def.main ? 'main' : null,
        pad,
        head: null,
        turret: null,
      };
      if (def.main) {
        slot.head = this.makeHead(0, 0, 0.48);
        slot.head.position.set(def.x, 2.78, def.z);
        this.group.add(slot.head);
      }
      this.slots.push(slot);
    }
    this.refreshPads();
    this.refreshRange();
  }

  applyWallSkin(hex: number): void {
    (this.wallMesh.material as MeshLambertMaterial).color.setHex(hex);
  }

  applySkins(): void {
    const main = this.slots[MAIN_INDEX].head;
    if (main) {
      const mat = main.material as MeshLambertMaterial;
      mat.map = fruitAtlas.tile(0, 0);
      mat.needsUpdate = true;
    }
  }

  setHero(heroId: HeroId): void {
    if (this.currentHero === heroId) return;
    this.currentHero = heroId;
    this.refreshHeroTexture();
  }

  refreshHeroTexture(): void {
    if (!this.currentHero) return;
    
    const mat = this.keepMesh.material as MeshLambertMaterial;
    const heroTex = getAdminTexture(`hero-${this.currentHero}` as any);
    
    if (heroTex) {
      mat.map = heroTex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    } else {
      const defaultTowerTex = getAdminTexture('tower-main');
      if (defaultTowerTex) {
        mat.map = defaultTowerTex;
        mat.color.setHex(0xffffff);
      } else {
        mat.map = null;
        mat.color.setHex(0x6e3128);
      }
      mat.needsUpdate = true;
    }
  }

  reset(): void {
    for (const slot of this.slots) {
      slot.cooldown = 0;
      if (slot.main) {
        slot.filled = true;
        slot.level = 1;
        this.resizeHead(slot);
      } else {
        slot.filled = false;
        slot.level = 0;
        if (slot.head) {
          this.group.remove(slot.head);
          slot.head = null;
        }
        if (slot.turret) {
          this.group.remove(slot.turret.group);
          slot.turret = null;
        }
        slot.kind = null;
      }
    }
    for (const s of this.shots) this.group.remove(s.mesh);
    this.shots.length = 0;
    this.selected = MAIN_INDEX;
    this.moving = false;
    this.refreshPads();
    this.refreshRange();
  }

  placeSlicer(index: number, kind: TurretKind): boolean {
    const slot = this.slots[index];
    const pad = PADS[index];
    if (!slot || !pad || slot.main || slot.filled) return false;
    if (!canPlaceTurret(kind, pad)) return false;
    slot.filled = true;
    slot.level = 1;
    slot.kind = kind;
    slot.turret = new TurretRig(kind);
    const y = pad.floor ? 0.12 : 1.05;
    slot.turret.group.position.set(slot.x, y, slot.z);
    this.group.add(slot.turret.group);
    this.selected = index;
    this.refreshPads();
    this.refreshRange();
    return true;
  }

  toggleSelected(): boolean {
    const slot = this.slots[this.selected];
    if (!slot?.turret || slot.kind !== 'blender') return false;
    slot.turret.setOpen(!slot.turret.open);
    return true;
  }

  upgradeSelected(): boolean {
    const slot = this.slots[this.selected];
    if (!slot || !slot.filled) return false;
    if (slot.level >= MAX_TOWER_LEVEL) return false;
    slot.level += 1;
    this.resizeHead(slot);
    if (slot.turret) slot.turret.group.scale.setScalar(1 + (slot.level - 1) * 0.08);
    this.refreshRange();
    return true;
  }

  startMove(): boolean {
    const slot = this.slots[this.selected];
    if (!slot || slot.main || !slot.filled || !slot.kind || slot.kind === 'main') return false;
    this.moving = true;
    this.refreshPads();
    return true;
  }

  cancelMove(): void {
    this.moving = false;
    this.refreshPads();
  }

  moveTo(index: number): boolean {
    const src = this.slots[this.selected];
    const dest = this.slots[index];
    const pad = PADS[index];
    if (!this.moving || !src || !dest || !pad) return false;
    if (src.main || !src.filled || !src.kind || src.kind === 'main' || !src.turret) return false;
    if (dest.main || dest.filled) return false;
    if (!canPlaceTurret(src.kind, pad)) return false;
    dest.filled = true;
    dest.level = src.level;
    dest.kind = src.kind;
    dest.turret = src.turret;
    dest.turret.group.position.set(dest.x, pad.floor ? 0.12 : 1.05, dest.z);
    dest.turret.group.scale.setScalar(1 + (dest.level - 1) * 0.08);
    src.filled = false;
    src.level = 0;
    src.kind = null;
    src.turret = null;
    this.selected = index;
    this.moving = false;
    this.refreshPads();
    this.refreshRange();
    return true;
  }

  sellSelected(): number {
    const slot = this.slots[this.selected];
    if (!slot || slot.main || !slot.filled || !slot.kind || slot.kind === 'main') return 0;
    const refund = sellRefund(slot.kind, slot.level);
    if (slot.head) {
      this.group.remove(slot.head);
      slot.head = null;
    }
    if (slot.turret) {
      this.group.remove(slot.turret.group);
      slot.turret = null;
    }
    slot.filled = false;
    slot.level = 0;
    slot.kind = null;
    this.moving = false;
    this.refreshPads();
    this.refreshRange();
    return refund;
  }

  selectedSlot(): Slot {
    return this.slots[this.selected];
  }

  select(index: number): void {
    if (index < 0) return;
    this.moving = false;
    this.selected = index;
    this.refreshPads();
    this.refreshRange();
  }

  update(
    dt: number,
    fruits: Fruit[],
    juice: JuiceSystem,
    bank: JuiceBank,
    onHit: (hit: TurretHit) => void,
  ): boolean {
    let shot = false;
    for (const slot of this.slots) {
      if (!slot.filled) continue;
      if (slot.turret) {
        const fired = slot.turret.tick(slot.x, slot.z, slot.level, {
          dt,
          fruits,
          juice,
          bank,
          onHit,
          shoot: (tx, tz, hex) => this.spawnShot(slot.x, slot.z, _aim.set(tx, 1.35, tz), hex),
        });
        if (fired) shot = true;
        continue;
      }
      slot.cooldown = Math.max(0, slot.cooldown - dt);
      const stats = towerStats(slot.level, slot.main);
      let best: Fruit | null = null;
      let bestD = stats.range;
      for (const fruit of fruits) {
        if (!fruit.alive) continue;
        const d = Math.hypot(fruit.group.position.x - slot.x, fruit.group.position.z - slot.z);
        if (d < bestD) {
          bestD = d;
          best = fruit;
        }
      }
      if (!best || slot.cooldown > 0) continue;
      slot.cooldown = 1 / stats.fireRate;
      if (slot.head) slot.head.lookAt(best.group.position);
      this.spawnShot(slot.x, slot.z, best.group.position, 0xf4d35e);
      onHit({ fruit: best, damage: stats.damage });
      shot = true;
    }

    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= dt;
      const t = 1 - s.life / s.maxLife;
      s.mesh.position.set(s.x + (s.tx - s.x) * t, 1.45, s.z + (s.tz - s.z) * t);
      const fade = Math.max(0.15, s.life / s.maxLife);
      (s.mesh.material as MeshBasicMaterial).opacity = fade;
      if (s.life <= 0) {
        this.group.remove(s.mesh);
        this.shots.splice(i, 1);
      }
    }
    return shot;
  }

  private makeHead(col: number, row: number, radius: number): Mesh {
    const mat = new MeshLambertMaterial({ color: 0xffffff });
    const map = fruitAtlas.tile(col, row);
    if (map) {
      mat.map = map;
      mat.needsUpdate = true;
    }
    return new Mesh(new SphereGeometry(radius, 14, 10), mat);
  }

  private resizeHead(slot: Slot): void {
    if (!slot.head) return;
    const grow = 1 + (slot.level - 1) * 0.1;
    slot.head.scale.setScalar(grow);
  }

  private spawnShot(x: number, z: number, to: Vector3, hex = 0xf4d35e): void {
    while (this.shots.length >= MAX_SHOTS) {
      const old = this.shots.shift();
      if (old) this.group.remove(old.mesh);
    }
    const mesh = new Mesh(
      new SphereGeometry(0.14, 8, 8),
      new MeshBasicMaterial({ color: hex, transparent: true, opacity: 1, depthWrite: false }),
    );
    mesh.position.set(x, 1.45, z);
    this.group.add(mesh);
    this.shots.push({ mesh, life: 0.2, maxLife: 0.2, x, z, tx: to.x, tz: to.z });
  }

  private refreshPads(): void {
    const movingKind = this.moving ? this.slots[this.selected]?.kind : null;
    for (const slot of this.slots) {
      const mat = slot.pad.material as MeshLambertMaterial;
      if (this.moving && movingKind && movingKind !== 'main' && !slot.filled && !slot.main) {
        mat.color.setHex(canPlaceTurret(movingKind, PADS[slot.index]) ? 0x38bdf8 : 0x57534e);
        continue;
      }
      if (slot.index === this.selected) mat.color.setHex(0x4ade80);
      else if (slot.main) mat.color.setHex(0xf3f4f6);
      else if (slot.filled) mat.color.setHex(0xf0b429);
      else mat.color.setHex(0xd6c4a0);
    }
  }

  private refreshRange(): void {
    const slot = this.slots[this.selected];
    if (!slot?.filled) {
      this.rangeRing.visible = false;
      return;
    }
    const kind = slot.kind === 'main' || slot.main ? 'main' : slot.kind;
    if (!kind) {
      this.rangeRing.visible = false;
      return;
    }
    const r = turretRange(kind, slot.level);
    this.rangeRing.visible = true;
    this.rangeRing.position.set(slot.x, 0.08, slot.z);
    this.rangeRing.scale.setScalar(r);
  }
}
