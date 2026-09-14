import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, Vector3 } from 'three';
import { fruitAtlas } from './atlas';
import { ARENA_D, ARENA_W, LEAK_Z } from './world';
import { modeRules } from './modes';
import { damageTower, toast, type GameState } from './state';
import type { Slash } from '../input/blade';
import type { SpawnItem } from './waves';
import { ENEMY_RULES, type EnemyKind } from './enemies';
import { getAdminTexture } from './adminTextureLoader';
import {
  createStudioAnimState,
  resetStudioAnimState,
  triggerStudioDeath,
  triggerStudioHit,
  triggerStudioSpawn,
  updateStudioAnim,
  type StudioAnimState,
} from './studioRuntime';

export type FruitKind = 'watermelon' | 'lemon' | 'orange' | 'banana' | 'strawberry' | 'pineapple' | 'kiwi' | 'bomb';
export type FruitFamily = 'lemon' | 'berry' | 'melon' | 'bomb';

export interface FruitDef {
  kind: FruitKind; family: FruitFamily; radius: number; speed: number; color: number; emissive: number;
  juice: number; splash: number; score: number; droplets: number; skin: [number, number]; flesh: [number, number];
  stretch: [number, number, number]; hp: number;
}

export const FRUIT_DEFS: Record<FruitKind, FruitDef> = {
  watermelon: { kind: 'watermelon', family: 'melon', radius: 1.05, speed: 2.05, color: 0x3dff7a, emissive: 0x146628, juice: 0xff3355, splash: 0x3ad15c, score: 55, droplets: 280, skin: [0, 0], flesh: [1, 0], stretch: [1, 1, 1], hp: 90 },
  lemon: { kind: 'lemon', family: 'lemon', radius: 0.72, speed: 3.2, color: 0xfff56d, emissive: 0xaa8800, juice: 0xffee33, splash: 0xfff056, score: 12, droplets: 220, skin: [4, 0], flesh: [5, 0], stretch: [1, 0.92, 1.08], hp: 24 },
  orange: { kind: 'orange', family: 'lemon', radius: 0.74, speed: 3.0, color: 0xff8a1a, emissive: 0x883300, juice: 0xff6611, splash: 0xff8a1a, score: 14, droplets: 220, skin: [0, 2], flesh: [1, 2], stretch: [1, 1, 1], hp: 30 },
  banana: { kind: 'banana', family: 'lemon', radius: 0.7, speed: 3.6, color: 0xffe566, emissive: 0x886600, juice: 0xffee88, splash: 0xffe566, score: 16, droplets: 200, skin: [1, 1], flesh: [2, 1], stretch: [0.42, 0.42, 1.35], hp: 26 },
  strawberry: { kind: 'strawberry', family: 'berry', radius: 0.58, speed: 5.1, color: 0xff3d8f, emissive: 0x880044, juice: 0xff2266, splash: 0xff3355, score: 18, droplets: 220, skin: [4, 1], flesh: [2, 4], stretch: [0.9, 1.05, 0.9], hp: 18 },
  pineapple: { kind: 'pineapple', family: 'lemon', radius: 0.82, speed: 2.6, color: 0xffd24d, emissive: 0x886600, juice: 0xffcc33, splash: 0xffd24d, score: 22, droplets: 240, skin: [6, 0], flesh: [7, 0], stretch: [0.85, 1.15, 0.85], hp: 48 },
  kiwi: { kind: 'kiwi', family: 'berry', radius: 0.6, speed: 4.4, color: 0x88aa33, emissive: 0x334400, juice: 0x88ff44, splash: 0x8fbf3a, score: 15, droplets: 200, skin: [7, 4], flesh: [3, 2], stretch: [1, 0.85, 1], hp: 22 },
  bomb: { kind: 'bomb', family: 'bomb', radius: 0.62, speed: 4.0, color: 0x2a1c14, emissive: 0x331100, juice: 0x44ff22, splash: 0x2a2a2a, score: 24, droplets: 160, skin: [4, 2], flesh: [6, 2], stretch: [1, 1, 1], hp: 55 },
};

export function fruitFamily(kind: FruitKind): FruitFamily { return FRUIT_DEFS[kind].family; }

export interface Fruit {
  alive: boolean; kind: FruitKind; enemyKind: EnemyKind; radius: number; group: Group; body: Mesh; hpBar: Mesh; hpBack: Mesh;
  squash: number; vel: Vector3; spin: Vector3; bob: number; hp: number; maxHp: number; dodgeX: number; dodgeZ: number;
  brittle: number; impulseX: number; impulseZ: number; boss: boolean; volatileTriggered: boolean;
  /** Studio clip playback; inactive when no sheet/walk clip is saved. */
  studio: StudioAnimState;
}

const BODY_GEO = new SphereGeometry(1, 18, 14);
const BAR_GEO = new BoxGeometry(1, 0.14, 0.14);

function layoutHp(fruit: Fruit, t: number): void {
  const s = Math.max(0.2, fruit.radius);
  fruit.hpBack.position.set(0, 1.35 / s, 0);
  fruit.hpBack.scale.set(1.4 / s, 0.28 / s, 0.28 / s);
  fruit.hpBar.position.set(0, 1.35 / s, 0.04 / s);
  fruit.hpBar.scale.set((1.32 * t) / s, 0.22 / s, 0.22 / s);
  const ok = fruit.boss ? 0xf4d35e : 0x3d8b2e;
  (fruit.hpBar.material as MeshBasicMaterial).color.setHex(t > 0.4 ? ok : 0xc23b3b);
}

function makeFruit(): Fruit {
  const body = new Mesh(BODY_GEO, new MeshLambertMaterial({ color: 0xffffff }));
  const hpBackMat = new MeshBasicMaterial({ color: 0x000000 });
  hpBackMat.transparent = true;
  hpBackMat.opacity = 0.85;
  const hpBack = new Mesh(BAR_GEO, hpBackMat);
  const hpBar = new Mesh(BAR_GEO, new MeshLambertMaterial({ color: 0x3d8b2e, emissive: 0x1a5015, emissiveIntensity: 0.4 }));
  const group = new Group();
  group.add(body, hpBack, hpBar);
  group.visible = false;
  return {
    alive: false, kind: 'lemon', enemyKind: 'normal', radius: 0.5, group, body, hpBar, hpBack,
    vel: new Vector3(), spin: new Vector3(), bob: 0, hp: 1, maxHp: 1, dodgeX: 0, dodgeZ: 0,
    brittle: 0, impulseX: 0, impulseZ: 0, squash: 0, boss: false, volatileTriggered: false,
    studio: createStudioAnimState('normal'),
  };
}

function paintStatic(fruit: Fruit, def: FruitDef): void {
  const mat = fruit.body.material as MeshLambertMaterial;

  let adminTexture = null;
  if (fruit.enemyKind === 'explosive') {
    adminTexture = getAdminTexture('enemy-explosive');
  } else if (fruit.enemyKind === 'armored') {
    adminTexture = getAdminTexture('enemy-armored');
  } else if (fruit.enemyKind === 'normal') {
    adminTexture = getAdminTexture('enemy-normal');
  }

  if (adminTexture) {
    mat.map = adminTexture;
  } else {
    mat.map = fruitAtlas.tile(def.skin[0], def.skin[1]);
  }

  mat.color.setHex(0xffffff);
  mat.needsUpdate = true;
}

function paint(fruit: Fruit, def: FruitDef): void {
  // Prefer studio walk clip when available; otherwise atlas / admin single PNG.
  if (fruit.studio.active) {
    const tex = updateStudioAnim(fruit.studio, 0, 0, -1);
    if (tex) {
      const mat = fruit.body.material as MeshLambertMaterial;
      mat.map = tex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      return;
    }
  }
  paintStatic(fruit, def);
}

function applyStudioTexture(fruit: Fruit, dt: number, vx: number, vz: number): void {
  const mat = fruit.body.material as MeshLambertMaterial;
  // Always tick flash timer even when studio sheets are inactive.
  if (!fruit.studio.active) {
    if (fruit.studio.flashT > 0) {
      fruit.studio.flashT = Math.max(0, fruit.studio.flashT - dt);
      mat.color.setHex(fruit.studio.flashT > 0 ? 0xffe08a : 0xffffff);
    }
    return;
  }
  const tex = updateStudioAnim(fruit.studio, dt, vx, vz);
  if (tex) {
    if (mat.map !== tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    } else {
      tex.needsUpdate = true;
    }
  }
  mat.color.setHex(fruit.studio.flashT > 0 ? 0xffe08a : 0xffffff);
}

export class FruitField {
  readonly fruits: Fruit[] = [];
  private queue: SpawnItem[] = [];
  private spawnCd = 0;
  private spawnGap = 0.7;
  private hpScale = 1;
  private activeState: GameState | null = null;
  onSpawn: ((fruit: Fruit) => void) | null = null;

  constructor(private readonly sceneAdd: (group: Group) => void) {
    for (let i = 0; i < 64; i++) {
      const fruit = makeFruit();
      this.fruits.push(fruit);
      this.sceneAdd(fruit.group);
    }
  }

  get aliveCount(): number { return this.fruits.reduce((n, f) => n + (f.alive ? 1 : 0), 0); }
  get queueLength(): number { return this.queue.length; }
  get waveBusy(): boolean { return this.queue.length > 0 || this.aliveCount > 0; }

  reset(): void {
    this.queue.length = 0; this.spawnCd = 0; this.activeState = null;
    for (const fruit of this.fruits) {
      fruit.alive = false; fruit.boss = false; fruit.enemyKind = 'normal'; fruit.volatileTriggered = false;
      resetStudioAnimState(fruit.studio, 'normal'); fruit.group.visible = false;
    }
  }

  beginWave(items: SpawnItem[], gap: number, hpScale: number): void {
    this.queue = items.slice(); this.spawnCd = 0.12; this.spawnGap = gap; this.hpScale = hpScale;
  }

  spawn(kind: FruitKind, boss = false, enemyKind: EnemyKind = 'normal'): Fruit | null {
    // Skip fruits still playing a death clip so the pool does not steal their mesh.
    const idle = this.fruits.find((f) => !f.alive);
    if (!idle) return null;
    const def = FRUIT_DEFS[kind];
    const enemy = ENEMY_RULES[enemyKind] || ENEMY_RULES.normal;
    const gate = (Math.random() * 5) | 0;
    let x = 0; let z = ARENA_D / 2 - 0.4;
    if (gate === 0) { x = -2.4 + Math.random() * 4.8; z = ARENA_D / 2 - 0.3; }
    else if (gate === 1) { x = -5.2 + Math.random() * 2; z = ARENA_D / 2 - 0.6; }
    else if (gate === 2) { x = 3.2 + Math.random() * 2; z = ARENA_D / 2 - 0.6; }
    else if (gate === 3) { x = -ARENA_W / 2 + 0.4; z = 1.5 + Math.random() * 4.5; }
    else { x = ARENA_W / 2 - 0.4; z = 1.5 + Math.random() * 4.5; }

    idle.alive = true; idle.kind = kind; idle.enemyKind = enemyKind; idle.boss = boss;
    idle.radius = def.radius * (boss ? 1.05 : 0.62);
    idle.hp = Math.max(1, Math.round(def.hp * this.hpScale * enemy.hpMultiplier * (boss ? 3.6 : 1)));
    idle.maxHp = idle.hp; idle.dodgeX = 0; idle.dodgeZ = 0; idle.brittle = 0; idle.impulseX = 0; idle.impulseZ = 0;
    idle.volatileTriggered = false;
    resetStudioAnimState(idle.studio, enemyKind, { boss, fruitKind: kind });
    idle.group.visible = true; idle.group.scale.setScalar(idle.radius);
    idle.group.position.set(x, boss ? 1.05 : 0.7, z); idle.spin.set(0, 1.4 + Math.random(), 0);
    idle.bob = Math.random() * Math.PI * 2; idle.squash = 0; layoutHp(idle, 1); paint(idle, def);
    triggerStudioSpawn(idle.studio, {
      x: idle.group.position.x,
      y: idle.group.position.y,
      z: idle.group.position.z,
    });
    this.onSpawn?.(idle);
    return idle;
  }

  hurt(fruit: Fruit, amount: number): boolean {
    if (!fruit.alive) return false;
    if (fruit.enemyKind === 'explosive' && !fruit.volatileTriggered && this.activeState) {
      const rule = ENEMY_RULES.explosive;
      fruit.volatileTriggered = true;
      const damage = damageTower(this.activeState, rule.towerDamageOnHit);
      if (damage > 0) {
        const hitLabel = rule.warning || rule.label;
        toast(this.activeState, `${hitLabel}! Tower -${damage} HP`, 1.1);
      }
    }
    fruit.hp -= amount; fruit.squash = 0.16; layoutHp(fruit, Math.max(0, fruit.hp / fruit.maxHp));
    const pos = {
      x: fruit.group.position.x,
      y: fruit.group.position.y,
      z: fruit.group.position.z,
    };
    if (fruit.hp <= 0) {
      // Death clips are intentionally not deferred: killFruit spawns debris halves
      // immediately, and keeping the body visible would fight that flow.
      triggerStudioDeath(fruit.studio, pos);
      this.kill(fruit);
      return true;
    }
    triggerStudioHit(fruit.studio, pos);
    return false;
  }

  kill(fruit: Fruit): void {
    fruit.alive = false;
    fruit.group.visible = false;
  }

  update(dt: number, state: GameState, onLeak: (fruit: Fruit) => void): void {
    this.activeState = state;
    if (this.queue.length > 0) {
      this.spawnCd -= dt;
      if (this.spawnCd <= 0) {
        this.spawnCd = this.spawnGap;
        const next = this.queue.shift();
        if (next) this.spawn(next.kind, next.boss, next.enemy ?? 'normal');
      }
    }

    const hw = ARENA_W / 2 - 0.45; const top = ARENA_D / 2 - 0.2; const rules = modeRules(state.mode);
    for (const fruit of this.fruits) {
      if (!fruit.alive) continue;
      fruit.bob += dt * 3;
      const dx = -fruit.group.position.x * 0.12; const dz = LEAK_Z - fruit.group.position.z; const dist = Math.hypot(dx, dz) || 0.0001;
      fruit.brittle = Math.max(0, fruit.brittle - dt); fruit.impulseX *= 0.88; fruit.impulseZ *= 0.88;
      const enemy = ENEMY_RULES[fruit.enemyKind] || ENEMY_RULES.normal;
      const speed = FRUIT_DEFS[fruit.kind].speed * enemy.speedMultiplier * 0.32 * rules.speedMul * (fruit.boss ? 0.58 : 1) * (fruit.brittle > 0 ? 0.48 : 1);
      fruit.dodgeX *= 0.86; fruit.dodgeZ *= 0.86;
      const moveX = (dx / dist) * speed + fruit.dodgeX + fruit.impulseX;
      const moveZ = (dz / dist) * speed + fruit.dodgeZ + fruit.impulseZ;
      fruit.group.position.x += moveX * dt;
      fruit.group.position.z += moveZ * dt;
      fruit.group.position.x = Math.max(-hw, Math.min(hw, fruit.group.position.x)); fruit.group.position.z = Math.min(top, fruit.group.position.z);
      if (fruit.group.position.z <= LEAK_Z) { this.kill(fruit); onLeak(fruit); continue; }
      fruit.squash = Math.max(0, fruit.squash - dt);
      const squash = fruit.squash > 0 ? 1 - fruit.squash * 1.4 : 1;
      fruit.group.scale.set(fruit.radius * (2 - squash), fruit.radius * squash, fruit.radius * (2 - squash));
      fruit.group.position.y = 0.62 + Math.sin(fruit.bob) * 0.06; fruit.body.rotation.y += fruit.spin.y * dt; fruit.group.rotation.set(0, 0, 0);
      layoutHp(fruit, Math.max(0, fruit.hp / fruit.maxHp));
      applyStudioTexture(fruit, dt, moveX, moveZ);
    }
  }

  dodgeSlash(slash: Slash): void {
    const abx = slash.to.x - slash.from.x; const abz = slash.to.z - slash.from.z; const ab2 = abx * abx + abz * abz;
    if (ab2 < 0.0001) return;
    for (const fruit of this.fruits) {
      if (!fruit.alive) continue;
      const apx = fruit.group.position.x - slash.from.x; const apz = fruit.group.position.z - slash.from.z;
      let t = (apx * abx + apz * abz) / ab2; t = Math.max(0, Math.min(1, t));
      const cx = slash.from.x + abx * t - fruit.group.position.x; const cz = slash.from.z + abz * t - fruit.group.position.z; const d = Math.hypot(cx, cz);
      if (d > 1.55 || d < 0.0001) continue;
      const side = abx * apz - abz * apx >= 0 ? 1 : -1; const nx = (-abz / Math.sqrt(ab2)) * side; const nz = (abx / Math.sqrt(ab2)) * side;
      const push = (1.55 - d) * 7.5; fruit.dodgeX += nx * push; fruit.dodgeZ += nz * push;
    }
  }
}
