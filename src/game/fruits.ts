import { BackSide, BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, SphereGeometry, Vector3 } from 'three';
import { fruitAtlas } from './atlas';
import { ARENA_D, ARENA_W, LEAK_Z } from './world';
import { modeRules } from './modes';
import { damageTower, toast, type GameState } from './state';
import type { Slash } from '../input/blade';
import type { SpawnItem } from './waves';
import { dangerousLeakMultiplier, ENEMY_RULES, type EnemyKind } from './enemies';
import { getAdminTexture } from './adminTextureLoader';
import { mapPointToWorld, type BattleMap } from './battleMaps';
import {
  createStudioAnimState,
  resetStudioAnimState,
  triggerStudioDeath,
  triggerStudioHit,
  triggerStudioSpawn,
  updateStudioAnim,
  type StudioAnimState,
} from './studioRuntime';

export type FruitKind = 'watermelon' | 'lemon' | 'orange' | 'banana' | 'strawberry' | 'pineapple' | 'kiwi' | 'bomb' | 'apple';
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
  banana: { kind: 'banana', family: 'lemon', radius: 0.7, speed: 3.6, color: 0xffe566, emissive: 0x886600, juice: 0xffee88, splash: 0xffe566, score: 16, droplets: 200, skin: [2, 1], flesh: [3, 1], stretch: [0.45, 0.45, 1.35], hp: 26 },
  strawberry: { kind: 'strawberry', family: 'berry', radius: 0.58, speed: 5.1, color: 0xff3d8f, emissive: 0x880044, juice: 0xff2266, splash: 0xff3355, score: 18, droplets: 220, skin: [6, 1], flesh: [3, 3], stretch: [0.9, 1.05, 0.9], hp: 18 },
  pineapple: { kind: 'pineapple', family: 'lemon', radius: 0.82, speed: 2.6, color: 0xffd24d, emissive: 0x886600, juice: 0xffcc33, splash: 0xffd24d, score: 22, droplets: 240, skin: [6, 0], flesh: [7, 0], stretch: [0.85, 1.15, 0.85], hp: 48 },
  kiwi: { kind: 'kiwi', family: 'berry', radius: 0.6, speed: 4.4, color: 0x88aa33, emissive: 0x334400, juice: 0x88ff44, splash: 0x8fbf3a, score: 15, droplets: 200, skin: [2, 2], flesh: [3, 2], stretch: [1, 0.88, 1], hp: 22 },
  bomb: { kind: 'bomb', family: 'bomb', radius: 0.62, speed: 4.0, color: 0x2a1c14, emissive: 0x331100, juice: 0x44ff22, splash: 0x2a2a2a, score: 24, droplets: 160, skin: [6, 2], flesh: [7, 2], stretch: [1, 1, 1], hp: 55 },
  apple: { kind: 'apple', family: 'berry', radius: 0.72, speed: 3.4, color: 0xff3838, emissive: 0x660808, juice: 0xffeebb, splash: 0xff3838, score: 18, droplets: 220, skin: [4, 3], flesh: [5, 3], stretch: [1, 0.95, 1], hp: 26 },
};

export function fruitFamily(kind: FruitKind): FruitFamily { return FRUIT_DEFS[kind].family; }

export interface Fruit {
  alive: boolean; kind: FruitKind; enemyKind: EnemyKind; radius: number; group: Group; body: Mesh; outline: Mesh; hpBar: Mesh; hpBack: Mesh;
  hazardRing: Mesh; armorRing: Mesh;
  squash: number; vel: Vector3; spin: Vector3; bob: number; hp: number; maxHp: number; dodgeX: number; dodgeZ: number;
  powerSlowLeft?: number; powerSlowMultiplier?: number; brittle: number; impulseX: number; impulseZ: number; boss: boolean; volatileTriggered: boolean;
  bossEnraged?: boolean;
  /** Spawned by a Pod-Spawner death — never counted as a wave member. */
  splitChild: boolean;
  /** Generation distinguishes two occupants of the same pooled object. */
  spawnSerial?: number;
  /** Studio clip playback; inactive when no sheet/walk clip is saved. */
  studio: StudioAnimState;
  routePoints?: Array<{ x: number; z: number }>;
  routeIndex?: number;
  routeDetours?: Set<string>;
  environmentCooldown?: number;
  environmentSlow?: number;
}

const BODY_GEO = new SphereGeometry(1, 18, 14);
const BAR_GEO = new PlaneGeometry(1, 1);
const HAZARD_GEO = new SphereGeometry(1.2, 16, 12);
const ARMOR_GEO = new BoxGeometry(1.4, 0.2, 1.4);

function layoutHp(fruit: Fruit, t: number): void {
  const s = Math.max(0.2, fruit.radius);
  const barY = fruit.boss ? 1.7 / s : 1.1 / s;
  const barW = fruit.boss ? 2.3 / s : 1.05 / s;
  const barH = fruit.boss ? 0.17 / s : 0.11 / s;
  // Full ordinary bars fill the battlefield without conveying a decision.
  // Reveal ordinary bars on damage; bosses use the single HUD meter.
  fruit.hpBack.visible = fruit.hpBar.visible = !fruit.boss && t < 0.999;
  fruit.hpBack.position.set(0, barY, 0);
  fruit.hpBack.scale.set(barW, barH, 1);
  fruit.hpBar.position.set(-barW * 0.47 * (1 - t), barY, -0.025 / s);
  fruit.hpBar.scale.set(barW * 0.94 * t, barH * 0.7, 1);
  const ok = fruit.boss
    ? (t <= 0.5 ? 0xef4444 : 0xf4d35e)
    : fruit.enemyKind === 'explosive'
      ? 0xff7139
      : fruit.enemyKind === 'armored'
        ? 0x8ed1ff
        : fruit.enemyKind === 'swift'
          ? 0x58e6ff
          : 0x8eea4e;
  (fruit.hpBar.material as MeshBasicMaterial).color.setHex(t > 0.35 ? ok : 0xc23b3b);
}

function makeFruit(): Fruit {
  const body = new Mesh(BODY_GEO, new MeshLambertMaterial({ color: 0xffffff }));
  const outline = new Mesh(BODY_GEO, new MeshBasicMaterial({ color: 0x080b07, side: BackSide }));
  outline.scale.setScalar(1.075);
  outline.visible = false;
  const hpBackMat = new MeshBasicMaterial({ color: 0x140f0c, depthWrite: false, depthTest: false });
  const hpBack = new Mesh(BAR_GEO, hpBackMat);
  const hpBar = new Mesh(BAR_GEO, new MeshBasicMaterial({ color: 0x8eea4e, depthWrite: false, depthTest: false }));
  hpBack.rotation.x = hpBar.rotation.x = -2.2;
  hpBack.renderOrder = 80;
  hpBar.renderOrder = 81;
  
  // Visual hazard indicator for explosive enemies
  const hazardMat = new MeshBasicMaterial({ color: 0xff3b30, wireframe: true, transparent: true, opacity: 0.6, depthWrite: false });
  const hazardRing = new Mesh(HAZARD_GEO, hazardMat);
  hazardRing.visible = false;

  // Visual armor plating indicator
  const armorMat = new MeshLambertMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.75 });
  const armorRing = new Mesh(ARMOR_GEO, armorMat);
  armorRing.visible = false;

  const group = new Group();
  group.add(outline, body, hpBack, hpBar, hazardRing, armorRing);
  group.visible = false;
  return {
    alive: false, kind: 'lemon', enemyKind: 'normal', radius: 0.5, group, body, outline, hpBar, hpBack,
    hazardRing, armorRing,
    vel: new Vector3(), spin: new Vector3(), bob: 0, hp: 1, maxHp: 1, dodgeX: 0, dodgeZ: 0,
    brittle: 0, impulseX: 0, impulseZ: 0, squash: 0, boss: false, volatileTriggered: false, bossEnraged: false, splitChild: false,
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

  // If no admin texture, apply themed tinting so special enemies are instantly identifiable
  if (!adminTexture && fruit.enemyKind === 'explosive') {
    mat.color.setHex(0xff6644);
  } else if (!adminTexture && fruit.enemyKind === 'armored') {
    mat.color.setHex(0x9aa4b2);
  } else if (!adminTexture && fruit.enemyKind === 'swift') {
    mat.color.setHex(0x55d8ff);
  } else if (!adminTexture && fruit.enemyKind === 'chainburst') {
    mat.color.setHex(0xb4ff3a);
  } else {
    mat.color.setHex(mat.map ? 0xffffff : def.color);
  }
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
      mat.color.setHex(fruit.studio.flashT > 0 ? 0xffe08a : fruit.enemyKind === 'explosive' ? 0xff6644 : fruit.enemyKind === 'chainburst' ? 0xb4ff3a : 0xffffff);
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
  private serial = 0;
  private readonly retired = new Set<Fruit>();
  private readonly pendingChildren: Array<{ x: number; y: number; z: number; offset: number; routePoints?: Array<{ x: number; z: number }> }> = [];
  private battleMap: BattleMap | null = null;
  onSpawn: ((fruit: Fruit) => void) | null = null;
  onBossPhase: ((fruit: Fruit) => void) | null = null;
  onEnvironmentKill: ((fruit: Fruit) => void) | null = null;

  constructor(private readonly sceneAdd: (group: Group) => void) {
    for (let i = 0; i < 64; i++) {
      const fruit = makeFruit();
      this.fruits.push(fruit);
      this.sceneAdd(fruit.group);
    }
  }

  setBattleMap(map: BattleMap | null): void { this.battleMap = map; }

  get aliveCount(): number { return this.fruits.reduce((n, f) => n + (f.alive ? 1 : 0), 0); }
  get queueLength(): number { return this.queue.length; }
  get waveBusy(): boolean { return this.queue.length > 0 || this.pendingChildren.length > 0 || this.aliveCount > 0; }

  reset(): void {
    this.queue.length = 0; this.spawnCd = 0; this.activeState = null;
    this.retired.clear();
    this.pendingChildren.length = 0;
    for (const fruit of this.fruits) {
      fruit.alive = false; fruit.boss = false; fruit.enemyKind = 'normal'; fruit.volatileTriggered = false; fruit.bossEnraged = false; fruit.splitChild = false;
      resetStudioAnimState(fruit.studio, 'normal'); fruit.group.visible = false;
    }
  }

  beginWave(items: SpawnItem[], gap: number, hpScale: number): void {
    this.queue = items.slice(); this.spawnCd = 0.12; this.spawnGap = gap; this.hpScale = hpScale;
  }

  spawn(kind: FruitKind, boss = false, enemyKind: EnemyKind = 'normal', bossStage?: number): Fruit | null {
    // Keep killed objects stable until synchronous reward/debris/leak consumers finish.
    const idle = this.fruits.find((f) => !f.alive && !this.retired.has(f));
    if (!idle) return null;
    idle.spawnSerial = ++this.serial;
    const def = FRUIT_DEFS[kind];
    const enemy = ENEMY_RULES[enemyKind] || ENEMY_RULES.normal;
    let x = (Math.random() - .5) * (ARENA_W - 2); let z = ARENA_D / 2 - 0.4;
    let routePoints: Array<{ x: number; z: number }> | undefined;
    if (this.battleMap) {
      const spawns = this.battleMap.spawns.filter((spawn) => spawn.enabled && spawn.y <= .2);
      const spawn = spawns[(Math.random() * spawns.length) | 0];
      if (spawn) {
        const position = mapPointToWorld({ x: spawn.x, y: spawn.y }, this.battleMap);
        x = position.x; z = position.z;
        const route = this.battleMap.routes.find((candidate) => candidate.id === spawn.routeId);
        if (route && route.points.length > 1) {
          // Give each fruit its own lane within the authored route width. The
          // offset fades near the keep, so waves spread across the battlefield
          // and then converge on the same defense line instead of stacking.
          const laneWidth = Math.max(route.width, this.battleMap.routes.length === 1 ? ARENA_W * .72 : 0);
          const laneOffset = (Math.random() - .5) * laneWidth;
          routePoints = route.points.map((point, index) => {
            const world = mapPointToWorld(point, this.battleMap!);
            const progress = index / Math.max(1, route.points.length - 1);
            world.x += laneOffset * Math.sin(Math.PI * progress);
            return world;
          });
          const spawnSpread = this.battleMap.routes.length === 1 ? ARENA_W * .72 : Math.min(1.2, route.width * .35);
          x += (Math.random() - .5) * spawnSpread;
        }
      }
    }

    idle.outline.visible = boss;
    idle.alive = true; idle.kind = kind; idle.enemyKind = enemyKind; idle.boss = boss;
    idle.radius = def.radius * (boss ? 1.05 : 0.62);
    idle.hp = Math.max(1, Math.round(def.hp * this.hpScale * enemy.hpMultiplier * (boss ? 3.6 : 1)));
    idle.maxHp = idle.hp; idle.dodgeX = 0; idle.dodgeZ = 0; idle.powerSlowLeft = 0; idle.powerSlowMultiplier = 1; idle.brittle = 0; idle.impulseX = 0; idle.impulseZ = 0;
    idle.volatileTriggered = false; idle.bossEnraged = false;
    idle.splitChild = false;
    idle.routePoints = routePoints; idle.routeIndex = routePoints ? 1 : undefined;
    idle.routeDetours = new Set(); idle.environmentCooldown = 0; idle.environmentSlow = 0;
    resetStudioAnimState(idle.studio, enemyKind, { boss, fruitKind: kind, bossStage });
    idle.group.visible = true; idle.group.scale.setScalar(idle.radius);
    idle.hazardRing.visible = idle.enemyKind === 'explosive' || idle.enemyKind === 'chainburst';
    (idle.hazardRing.material as MeshBasicMaterial).color.setHex(idle.enemyKind === 'chainburst' ? 0xb4ff3a : 0xff3b30);
    idle.armorRing.visible = idle.enemyKind === 'armored';
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

  hurt(fruit: Fruit, amount: number, source: 'turret' | 'blade' | 'super' = 'turret'): boolean {
    if (!fruit.alive) return false;
    // Chem-Bursts are a placement challenge: blade contact hurts the wall,
    // but neither blades nor the hero super can damage or remove them.
    if (fruit.enemyKind === 'explosive' && source !== 'turret') {
      if (source !== 'blade' || !this.activeState) return false;
      const rule = ENEMY_RULES.explosive;
      fruit.volatileTriggered = true;
      const damage = damageTower(
        this.activeState,
        Math.round(rule.towerDamageOnHit * dangerousLeakMultiplier(this.activeState.wave) * modeRules(this.activeState.mode).leakMul),
      );
      if (damage > 0) {
        this.activeState.waveLeaks += 1;
        toast(this.activeState, `Chem-Burst touched! Wall −${damage} HP · TURRETS ONLY`, 1.4);
      }
      return false;
    }
    fruit.hp -= amount; fruit.squash = 0.2; layoutHp(fruit, Math.max(0, fruit.hp / fruit.maxHp));
    if (fruit.boss && !fruit.bossEnraged && fruit.hp > 0 && fruit.hp <= fruit.maxHp / 2) {
      fruit.bossEnraged = true;
      // Brood bosses release two smaller runners midway through the fight.
      if (fruit.enemyKind === 'splitter') this.spawnSplitChildren(fruit.group.position.x, fruit.group.position.y, fruit.group.position.z, fruit.routePoints?.slice(fruit.routeIndex ?? 1));
      this.onBossPhase?.(fruit);
    }
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

  kill(fruit: Fruit, split = true): void {
    if (!fruit.alive) return;
    const wasSplitter = fruit.enemyKind === 'splitter' && !fruit.splitChild;
    const { x, y, z } = fruit.group.position;
    this.retired.add(fruit);
    fruit.alive = false;
    fruit.hazardRing.visible = false;
    fruit.armorRing.visible = false;
    fruit.group.visible = false;
    if (wasSplitter && split) this.spawnSplitChildren(x, y, z, fruit.routePoints?.slice(fruit.routeIndex ?? 1));
  }

  /**
   * Pod-Spawner death releases two smaller targets.
   * Children are flagged `splitChild`, which (a) stops them splitting again —
   * no infinite recursion — and (b) keeps them out of wave accounting so a
   * perfect wave stays correctly detectable.
   */
  private spawnSplitChildren(x: number, y: number, z: number, routePoints?: Array<{ x: number; z: number }>): void {
    for (const offset of [-0.7, 0.7]) {
      this.pendingChildren.push({ x, y, z, offset, routePoints });
    }
    this.flushSplitChildren();
  }

  private flushSplitChildren(): void {
    while (this.pendingChildren.length) {
      const { x, y, z, offset, routePoints } = this.pendingChildren[0];
      const child = this.spawn('strawberry', false, 'normal');
      if (!child) break;
      this.pendingChildren.shift();
      child.splitChild = true;
      child.group.position.set(x + offset, y + 0.15, z - 0.15);
      child.routePoints = routePoints && routePoints.length > 1 ? routePoints : undefined;
      child.routeIndex = child.routePoints ? 1 : undefined;
      child.routeDetours = new Set(); child.environmentCooldown = 0; child.environmentSlow = 0;
      child.radius *= 0.72;
      child.hp = Math.max(1, Math.round(child.hp * 0.7));
      child.maxHp = child.hp;
      child.impulseX = offset * 2.4;
      child.impulseZ = 1.2;
      child.spin.set(0, 3.2, 0);
    }
  }

  update(dt: number, state: GameState, onLeak: (fruit: Fruit) => void): void {
    this.retired.clear();
    this.flushSplitChildren();
    this.activeState = state;
    if (this.queue.length > 0) {
      this.spawnCd -= dt;
      if (this.spawnCd <= 0) {
        this.spawnCd = this.spawnGap;
        const next = this.queue[0];
        if (next && this.spawn(next.kind, next.boss, next.enemy ?? 'normal', next.bossStage)) this.queue.shift();
      }
    }

    const hw = ARENA_W / 2 - 0.45; const top = ARENA_D / 2 - 0.2; const rules = modeRules(state.mode);
    for (const fruit of this.fruits) {
      if (!fruit.alive) continue;
      fruit.bob += dt * (fruit.boss ? (fruit.enemyKind === 'swift' ? 4.8 : fruit.enemyKind === 'armored' ? 2.15 : 2.8) : 3);
      const route = fruit.routePoints;
      const map = this.battleMap;
      if (route?.length) {
        while ((fruit.routeIndex ?? 1) < route.length - 1) {
          const point = route[fruit.routeIndex ?? 1]!;
          if (Math.hypot(point.x - fruit.group.position.x, point.z - fruit.group.position.z) > .42) break;
          fruit.routeIndex = (fruit.routeIndex ?? 1) + 1;
        }
      }
      let goal = route?.[(fruit.routeIndex ?? 1)];
      // Route around authored solid rectangles before steering toward the next node.
      if (route && goal && map) {
        for (const obstacle of map.entities) {
          if (obstacle.kind !== 'solid' || obstacle.collision !== 'solid' || fruit.routeDetours?.has(obstacle.id)) continue;
          const center = mapPointToWorld({ x: obstacle.x, y: obstacle.y }, map);
          const angle = obstacle.rotation * Math.PI / 180; const c = Math.cos(angle); const s = Math.sin(angle);
          const toLocal = (x: number, z: number) => ({ x: (x - center.x) * c + (z - center.z) * s, z: -(x - center.x) * s + (z - center.z) * c });
          const start = toLocal(fruit.group.position.x, fruit.group.position.z); const end = toLocal(goal.x, goal.z);
          const halfX = obstacle.width * map.world.width / 2 + fruit.radius * .65;
          const halfZ = obstacle.height * map.world.depth / 2 + fruit.radius * .65;
          const dx = end.x - start.x; const dz = end.z - start.z;
          let tMin = 0; let tMax = 1; let crosses = true;
          for (const [origin, delta, half] of [[start.x, dx, halfX], [start.z, dz, halfZ]] as const) {
            if (Math.abs(delta) < 1e-6) { if (Math.abs(origin) > half) crosses = false; continue; }
            const a = (-half - origin) / delta; const b = (half - origin) / delta;
            tMin = Math.max(tMin, Math.min(a, b)); tMax = Math.min(tMax, Math.max(a, b));
          }
          if (!crosses || tMin > tMax) continue;
          const left = -halfX - .25; const right = halfX + .25;
          const entryZ = dz <= 0 ? halfZ + .25 : -halfZ - .25; const exitZ = -entryZ;
          const side = Math.abs(start.x - left) + Math.abs(end.x - left) <= Math.abs(start.x - right) + Math.abs(end.x - right) ? left : right;
          const toWorld = (x: number, z: number) => ({ x: center.x + x * c - z * s, z: center.z + x * s + z * c });
          route.splice(fruit.routeIndex ?? 1, 0, toWorld(side, entryZ), toWorld(side, exitZ));
          fruit.routeDetours?.add(obstacle.id);
          goal = route[fruit.routeIndex ?? 1];
        }
      }
      const dx = goal ? goal.x - fruit.group.position.x : -fruit.group.position.x * 0.12;
      const dz = goal ? goal.z - fruit.group.position.z : LEAK_Z - fruit.group.position.z;
      const dist = Math.hypot(dx, dz) || 0.0001;
      fruit.powerSlowLeft = Math.max(0, (fruit.powerSlowLeft ?? 0) - dt); fruit.brittle = Math.max(0, fruit.brittle - dt); fruit.impulseX *= 0.88; fruit.impulseZ *= 0.88;
      const enemy = ENEMY_RULES[fruit.enemyKind] || ENEMY_RULES.normal;
      const speed = FRUIT_DEFS[fruit.kind].speed * enemy.speedMultiplier * (route ? .48 : .32) * rules.speedMul * (fruit.boss ? 0.58 * (fruit.bossEnraged ? 1.4 : 1) : 1) * Math.min(fruit.brittle > 0 ? .48 : 1, (fruit.powerSlowLeft ?? 0) > 0 ? fruit.powerSlowMultiplier ?? .45 : 1) * (1 - (fruit.environmentSlow ?? 0));
      fruit.dodgeX *= 0.86; fruit.dodgeZ *= 0.86;
      const moveX = (dx / dist) * speed + fruit.dodgeX + fruit.impulseX;
      const moveZ = (dz / dist) * speed + fruit.dodgeZ + fruit.impulseZ;
      fruit.group.position.x += moveX * dt;
      fruit.group.position.z += moveZ * dt;
      fruit.group.position.x = Math.max(-hw, Math.min(hw, fruit.group.position.x)); fruit.group.position.z = Math.min(top, fruit.group.position.z);
      let environmentalSlow = 0;
      fruit.environmentCooldown = Math.max(0, (fruit.environmentCooldown ?? 0) - dt);
      if (map) {
        for (const entity of map.entities) {
          if (entity.collision === 'none' || entity.kind === 'solid') continue;
          const center = mapPointToWorld({ x: entity.x, y: entity.y }, map);
          const angle = entity.rotation * Math.PI / 180; const c = Math.cos(angle); const s = Math.sin(angle);
          const dx = fruit.group.position.x - center.x; const dz = fruit.group.position.z - center.z;
          const localX = dx * c + dz * s; const localZ = -dx * s + dz * c;
          const inside = Math.abs(localX) <= entity.width * map.world.width / 2 + fruit.radius * .45
            && Math.abs(localZ) <= entity.height * map.world.depth / 2 + fruit.radius * .45;
          if (!inside) continue;
          environmentalSlow = Math.max(environmentalSlow, entity.slow);
          if (entity.kind === 'pit') {
            if (this.hurt(fruit, fruit.hp, 'turret')) this.onEnvironmentKill?.(fruit);
            break;
          }
          if (entity.kind === 'hazard' && fruit.environmentCooldown === 0) {
            fruit.environmentCooldown = .75;
            if (this.hurt(fruit, Math.max(1, entity.damage), 'turret')) { this.onEnvironmentKill?.(fruit); break; }
          }
        }
      }
      if (!fruit.alive) continue;
      fruit.environmentSlow = environmentalSlow;
      const finalPoint = route?.[route.length - 1];
      const reachedRouteEnd = finalPoint && (fruit.routeIndex ?? 1) >= route!.length - 1 && Math.hypot(finalPoint.x - fruit.group.position.x, finalPoint.z - fruit.group.position.z) <= .5;
      if (reachedRouteEnd || (!route && fruit.group.position.z <= LEAK_Z)) { this.kill(fruit, false); onLeak(fruit); continue; }
      fruit.squash = Math.max(0, fruit.squash - dt);
      const squash = fruit.squash > 0 ? 1 - fruit.squash * 1.4 : 1;
      const def = FRUIT_DEFS[fruit.kind];
      const stretch = def.stretch;
      fruit.group.scale.set(
        fruit.radius * stretch[0] * (2 - squash),
        fruit.radius * stretch[1] * squash,
        fruit.radius * stretch[2] * (2 - squash),
      );
      const stride = Math.sin(fruit.bob);
      fruit.group.position.y = (fruit.boss ? 1.05 : 0.62) + stride * (fruit.boss ? (fruit.enemyKind === 'armored' ? 0.12 : 0.09) : 0.06);
      fruit.body.rotation.y += fruit.spin.y * dt;
      // Boss gait reads differently at a glance: armored lumbers, swift darts,
      // and brood bosses sway. Keep the collision body anchored to its lane.
      fruit.group.rotation.set(0, 0, fruit.boss ? stride * (fruit.enemyKind === 'swift' ? 0.15 : fruit.enemyKind === 'splitter' ? 0.11 : 0.065) : 0);

      // Pulse hazard indicator for explosive fruits
      if (fruit.hazardRing.visible) {
        const pulse = 1 + Math.sin(state.elapsed * 8 + fruit.bob) * 0.15;
        fruit.hazardRing.scale.setScalar(pulse);
        (fruit.hazardRing.material as MeshBasicMaterial).opacity = 0.45 + Math.sin(state.elapsed * 8) * 0.25;
      }
      if (fruit.armorRing.visible) {
        fruit.armorRing.rotation.y += dt * 1.8;
      }

      layoutHp(fruit, Math.max(0, fruit.hp / fruit.maxHp));
      fruit.outline.scale.copy(fruit.body.scale).multiplyScalar(1.075);
      fruit.outline.rotation.copy(fruit.body.rotation);
      applyStudioTexture(fruit, dt, moveX, moveZ);
    }
  }

  dodgeSlash(slash: Slash): void {
    const abx = slash.to.x - slash.from.x; const abz = slash.to.z - slash.from.z; const ab2 = abx * abx + abz * abz;
    if (ab2 < 0.0001) return;
    for (const fruit of this.fruits) {
      if (!fruit.alive || fruit.enemyKind !== 'swift') continue;
      const apx = fruit.group.position.x - slash.from.x; const apz = fruit.group.position.z - slash.from.z;
      let t = (apx * abx + apz * abz) / ab2; t = Math.max(0, Math.min(1, t));
      const cx = slash.from.x + abx * t - fruit.group.position.x; const cz = slash.from.z + abz * t - fruit.group.position.z; const d = Math.hypot(cx, cz);
      if (d > 1.2 || d < 0.0001) continue;
      const side = abx * apz - abz * apx >= 0 ? 1 : -1; const nx = (-abz / Math.sqrt(ab2)) * side; const nz = (abx / Math.sqrt(ab2)) * side;
      const push = (1.2 - d) * 5.0; fruit.dodgeX += nx * push; fruit.dodgeZ += nz * push;
    }
  }
}
