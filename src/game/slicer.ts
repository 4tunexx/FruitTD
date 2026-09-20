import {
  CircleGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { fruitAtlas } from './atlas';
import { FRUIT_DEFS, type Fruit, type FruitKind } from './fruits';
import { ARENA_W, ARENA_D } from './world';

export const MAX_RESLICE = 2;

export interface Half {
  alive: boolean;
  group: Group;
  shell: Mesh;
  cap: Mesh;
  vel: Vector3;
  torque: Vector3;
  life: number;
  kind: FruitKind;
  gen: number;
  radius: number;
}

const TEMPLATE = new SphereGeometry(1, 20, 14);
const TEMPLATE_POS = TEMPLATE.attributes.position.array.slice() as Float32Array;
const CAP_GEO = new CircleGeometry(1, 28);

function makeHalf(): Half {
  const shellMat = new MeshLambertMaterial({
    color: 0xffffff,
  });
  const capMat = new MeshLambertMaterial({
    color: 0xffee44,
    side: 2,
  });
  const shell = new Mesh(TEMPLATE.clone(), shellMat);
  const cap = new Mesh(CAP_GEO.clone(), capMat);
  const group = new Group();
  group.add(shell, cap);
  group.visible = false;
  return {
    alive: false,
    group,
    shell,
    cap,
    vel: new Vector3(),
    torque: new Vector3(),
    life: 0,
    kind: 'lemon',
    gen: 0,
    radius: 0.4,
  };
}

const _n = new Vector3();
const _tmp = new Vector3();

function deformHalf(mesh: Mesh, radius: number, normal: Vector3, side: number): void {
  const pos = mesh.geometry.attributes.position;
  const src = TEMPLATE_POS;
  for (let i = 0; i < pos.count; i++) {
    const ix = i * 3;
    let x = src[ix] * radius;
    let y = src[ix + 1] * radius;
    let z = src[ix + 2] * radius;
    const d = x * normal.x + y * normal.y + z * normal.z;
    if (d * side < 0) {
      x -= normal.x * d;
      y -= normal.y * d;
      z -= normal.z * d;
    }
    pos.setXYZ(i, x, y, z);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

export class SliceDebris {
  readonly halves: Half[] = [];

  constructor(private readonly sceneAdd: (g: Group) => void) {
    for (let i = 0; i < 56; i++) {
      const half = makeHalf();
      this.halves.push(half);
      this.sceneAdd(half.group);
    }
  }

  reset(): void {
    for (const half of this.halves) {
      half.alive = false;
      half.group.visible = false;
    }
  }

  spawnPair(fruit: Fruit, swipe: Vector3, planeN: Vector3): void {
    this.spawnBits(fruit.kind, fruit.group.position, fruit.radius, fruit.vel, swipe, planeN, 0);
  }

  reslice(half: Half, swipe: Vector3, planeN: Vector3): number {
    if (!half.alive || half.gen >= MAX_RESLICE) return 0;
    const next = half.gen + 1;
    const pos = half.group.position.clone();
    const vel = half.vel.clone();
    const radius = half.radius * 0.62;
    const kind = half.kind;
    half.alive = false;
    half.group.visible = false;
    this.spawnBits(kind, pos, radius, vel, swipe, planeN, next);
    return next;
  }

  private spawnBits(
    kind: FruitKind,
    origin: Vector3,
    radius: number,
    baseVel: Vector3,
    swipe: Vector3,
    planeN: Vector3,
    gen: number,
  ): void {
    const def = FRUIT_DEFS[kind];
    _n.copy(planeN).normalize();
    if (_n.lengthSq() < 0.01) _n.set(1, 0, 0);
    const life = gen === 0 ? 3.4 : gen === 1 ? 2.8 : 1.5;
    for (const side of [-1, 1] as const) {
      const half = this.halves.find((h) => !h.alive);
      if (!half) continue;
      half.alive = true;
      half.kind = kind;
      half.gen = gen;
      half.radius = radius;
      half.life = life;
      half.group.visible = true;
      half.group.scale.setScalar(1);
      half.group.position.copy(origin);
      half.group.rotation.set(0, 0, 0);
      deformHalf(half.shell, radius, _n, side);
      half.cap.scale.setScalar(radius);
      half.cap.position.set(0, 0, 0);
      half.cap.lookAt(_tmp.copy(_n).multiplyScalar(side));
      const shellMat = half.shell.material as MeshLambertMaterial;
      const capMat = half.cap.material as MeshLambertMaterial;
      shellMat.map = fruitAtlas.tile(def.skin[0], def.skin[1]);
      capMat.map = fruitAtlas.tile(def.flesh[0], def.flesh[1]);
      shellMat.color.setHex(0xffffff);
      capMat.color.setHex(def.juice);
      capMat.needsUpdate = true;
      shellMat.needsUpdate = true;
      const kick = gen === 0 ? 3.4 : 2.4;
      half.vel
        .copy(baseVel)
        .addScaledVector(swipe, kick * side)
        .addScaledVector(_n, 1.2 * side);
      half.vel.y += 1.8 + Math.random();
      half.torque.set(
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 16 * side,
        (Math.random() - 0.5) * 12,
      );
    }
  }

  update(dt: number): void {
    for (const half of this.halves) {
      if (!half.alive) continue;
      half.life -= dt;
      half.vel.y -= 18 * dt;
      half.group.position.addScaledVector(half.vel, dt);
      half.group.rotation.x += half.torque.x * dt;
      half.group.rotation.y += half.torque.y * dt;
      half.group.rotation.z += half.torque.z * dt;

      const p = half.group.position;
      if (p.y < 0.25) {
        p.y = 0.25;
        half.vel.y *= -0.28;
        half.vel.x *= 0.72;
        half.vel.z *= 0.72;
      }
      const hw = ARENA_W / 2 - 0.3;
      const hd = ARENA_D / 2 - 0.3;
      if (p.x > hw || p.x < -hw) {
        p.x = Math.max(-hw, Math.min(hw, p.x));
        half.vel.x *= -0.4;
      }
      if (p.z > hd || p.z < -hd) {
        p.z = Math.max(-hd, Math.min(hd, p.z));
        half.vel.z *= -0.4;
      }

      if (half.life <= 0) {
        half.alive = false;
        half.group.visible = false;
      } else if (half.life < 0.35) {
        half.group.scale.setScalar(half.life / 0.35);
      } else {
        half.group.scale.setScalar(1);
      }
    }
  }
}

import type { Slash } from '../input/blade';

export function segmentHitsFruit(
  a: Vector3,
  b: Vector3,
  fruit: Fruit,
  extra = 0,
): { hit: boolean; normal: Vector3 } {
  const p = fruit.group.position;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const apz = p.z - a.z;
  const ab2 = abx * abx + aby * aby + abz * abz;
  let t = 0;
  if (ab2 > 1e-6) t = (apx * abx + apy * aby + apz * abz) / ab2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + abx * t - p.x;
  const cy = a.y + aby * t - p.y;
  const cz = a.z + abz * t - p.z;
  const distXZ2 = cx * cx + cz * cz;
  const distY = Math.abs(cy);
  const r = fruit.radius + 0.12 + extra;
  if (distXZ2 > r * r || distY > r + 0.6) return { hit: false, normal: new Vector3(1, 0, 0) };
  const swipe = new Vector3(abx, aby, abz);
  const normal = new Vector3().crossVectors(swipe, new Vector3(0, 1, 0));
  if (normal.lengthSq() < 0.0001) normal.set(1, 0, 0);
  else normal.normalize();
  return { hit: true, normal };
}

export function strokeHitsFruit(
  slash: Slash,
  fruit: Fruit,
  extra = 0,
): { hit: boolean; normal: Vector3; hitSegment?: { from: Vector3; to: Vector3 } } {
  if (slash.segments && slash.segments.length > 0) {
    for (const seg of slash.segments) {
      const res = segmentHitsFruit(seg.from, seg.to, fruit, extra);
      if (res.hit) return { hit: true, normal: res.normal, hitSegment: seg };
    }
    return { hit: false, normal: new Vector3(1, 0, 0) };
  }
  const res = segmentHitsFruit(slash.from, slash.to, fruit, extra);
  return { hit: res.hit, normal: res.normal, hitSegment: slash };
}

export function segmentHitsHalf(a: Vector3, b: Vector3, half: Half, extra = 0): boolean {
  if (!half.alive || half.gen >= MAX_RESLICE) return false;
  const p = half.group.position;
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const apx = p.x - a.x;
  const apz = p.z - a.z;
  const ab2 = abx * abx + abz * abz;
  let t = 0;
  if (ab2 > 1e-6) t = (apx * abx + apz * abz) / ab2;
  t = Math.max(0, Math.min(1, t));
  const dx = a.x + abx * t - p.x;
  const dz = a.z + abz * t - p.z;
  const r = half.radius + 0.18 + extra;
  return dx * dx + dz * dz <= r * r;
}

export function strokeHitsHalf(
  slash: Slash,
  half: Half,
  extra = 0,
): boolean {
  if (!half.alive || half.gen >= MAX_RESLICE) return false;
  if (slash.segments && slash.segments.length > 0) {
    for (const seg of slash.segments) {
      if (segmentHitsHalf(seg.from, seg.to, half, extra)) return true;
    }
    return false;
  }
  return segmentHitsHalf(slash.from, slash.to, half, extra);
}
