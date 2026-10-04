import { AmbientLight, BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshLambertMaterial, OrthographicCamera, Plane, Raycaster, Scene, SphereGeometry, Vector2, Vector3, WebGLRenderer } from 'three';
import { TurretRig, TURRETS, type TurretKind } from '../../game/turrets';
import { BladeTrail } from '../../game/trail';
import { FRUIT_DEFS } from '../../game/fruits';
import { fruitAtlas } from '../../game/atlas';
import { getAdminTexture } from '../../game/adminTextureLoader';
import { findCatalogItem } from '../../game/catalog';
import { loadSave } from '../../game/save';
import type { PvpCommand, PvpConfig, PvpMap } from '../../game/pvp';
import { el } from '../components/dom';

type Stroke = { from: { x: number; y: number }; to: { x: number; y: number }; at: number };
type PlayerView = { userId: string; name: string; side: string; wallHealth: number; towers: Array<{ id: string; type: string; cell: number }>; attackers: Array<{ id: string; type: string; progress: number; x?: number; y?: number; boss?: boolean; hp?: number }>; lastStroke?: Stroke | null };
export type BattlefieldSnapshot = { id: string; map: PvpMap | null; yourSide: string; players: PlayerView[]; shared?: boolean; sharedStroke?: Stroke };
const TILE = 1.8;
const TILE_X = 3.6;
const COLORS = { blue: 0x38bdf8, red: 0xef5350 };

/** Both server lanes meet at the centre; the viewer's wall is always at the bottom. */
export function pvpWorldPoint(map: Pick<PvpMap, 'width'>, x: number, y: number, own: boolean): Vector3 {
  return new Vector3((x - map.width / 2) * TILE_X * (own ? 1 : -1), 0, (y + 1) * TILE * (own ? -1 : 1));
}

export class PvpBattlefield {
  readonly element = el('div', { class: 'ftd-pvp-scene' });
  private readonly canvas = el('canvas', { class: 'ftd-pvp-scene__canvas', 'aria-label': '3D fruit siege battlefield. Click your territory to build. Drag over incoming fruit to slice.' });
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-20, 20, 30, -30, 0.1, 200);
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly ray = new Raycaster();
  private readonly terrain = new Group();
  private readonly pieces = new Group();
  private readonly trail = new BladeTrail();
  private readonly remoteTrail = new BladeTrail();
  private readonly marker = new Mesh(new BoxGeometry(TILE_X * .93, .06, TILE * .93), new MeshBasicMaterial({ color: 0xa3e635, transparent: true, opacity: .4 }));
  private readonly observer: ResizeObserver;
  private readonly towers = new Map<string, { rig: TurretRig; own: boolean; cell: number }>();
  private readonly fruits = new Map<string, { mesh: Mesh; player: PlayerView; progress: number; x?: number; y?: number; boss?: boolean; type: string; own: boolean }>();
  private readonly health = new Map<string, Mesh>();
  private snapshot: BattlefieldSnapshot;
  private config: Pick<PvpConfig, 'attacks' | 'towers'> & { wallHealth?: number };
  private receivedAt = performance.now();
  private previousAt = performance.now();
  private frame = 0;
  private disposed = false;
  private stroke: { id: number; from: { x: number; y: number }; points: Vector3[]; sliced?: boolean } | null = null;
  private trailUntil = 0;
  private sharedStrokeAt = 0;
  private remoteAt = 0;
  private readonly shots = new Map<string, number>();
  private readonly effects: Array<{ object: Mesh | Line; life: number; velocity?: Vector3 }> = [];
  private zoom = 1;
  private mapKey = '';
  get interacting(): boolean { return this.stroke !== null; }

  constructor(snapshot: BattlefieldSnapshot, config: Pick<PvpConfig, 'attacks' | 'towers'> & { wallHealth?: number }, private readonly command: (command: PvpCommand) => void) {
    this.snapshot = snapshot; this.config = config;
    this.element.append(this.canvas, el('div', { class: 'ftd-pvp-scene__hint', text: 'Click to build · Drag to slice · Scroll to zoom' }));
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene.background = new Color(0x294b32);
    this.scene.add(new AmbientLight(0xe8f4dc, 1.2));
    const sun = new DirectionalLight(0xfff1cf, 1.6); sun.position.set(12, 30, -15); this.scene.add(sun);
    this.camera.position.set(0, 75, -48); this.camera.lookAt(0, 0, 0);
    this.scene.add(this.terrain, this.pieces, this.marker, this.trail.line, this.trail.glowLine, this.trail.sparks, this.remoteTrail.line, this.remoteTrail.glowLine, this.remoteTrail.sparks);
    this.marker.visible = false;
    const skin = findCatalogItem(loadSave().bladeSkin || 'blade-default');
    this.trail.applySlicer(skin?.slicer);
    this.remoteTrail.setColor(snapshot.shared ? COLORS.blue : COLORS.red);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.element);
    this.canvas.addEventListener('pointerdown', this.pointerDown);
    this.canvas.addEventListener('pointermove', this.pointerMove);
    this.canvas.addEventListener('pointerup', this.pointerUp);
    this.canvas.addEventListener('pointercancel', this.pointerCancel);
    this.canvas.addEventListener('wheel', this.wheel, { passive: false });
    this.update(snapshot, config);
    this.frame = requestAnimationFrame(this.animate);
  }

  update(snapshot: BattlefieldSnapshot, config: Pick<PvpConfig, 'attacks' | 'towers'> & { wallHealth?: number }): void {
    this.snapshot = snapshot; this.config = config; this.receivedAt = performance.now();
    const map = snapshot.map; if (!map) return;
    if (this.mapKey !== JSON.stringify(map)) { this.mapKey = JSON.stringify(map); this.buildTerrain(map); }
    if (snapshot.sharedStroke && snapshot.sharedStroke.at > this.remoteAt) {
      this.remoteAt = snapshot.sharedStroke.at;
      const a = pvpWorldPoint(map, snapshot.sharedStroke.from.x, snapshot.sharedStroke.from.y, true);
      const b = pvpWorldPoint(map, snapshot.sharedStroke.to.x, snapshot.sharedStroke.to.y, true);
      a.y = b.y = .8; this.remoteTrail.sync([a, b]);
    }
    const towerIds = new Set<string>(); const fruitIds = new Set<string>();
    for (const player of snapshot.players) {
      const own = player.side === snapshot.yourSide;
      const hp = this.health.get(player.userId); if (hp) hp.scale.x = Math.max(.001, player.wallHealth / Number(hp.userData.maxHealth));
      for (const tower of player.towers) {
        towerIds.add(tower.id);
        if (!this.towers.has(tower.id) && TURRETS.some((item) => item.kind === tower.type)) {
          const rig = new TurretRig(tower.type as TurretKind);
          rig.group.position.copy(this.cellPoint(tower.cell, own)); rig.group.scale.setScalar(1.2);
          const pad = new Mesh(new CylinderGeometry(.7, .8, .12, 12), new MeshLambertMaterial({ color: COLORS[player.side as keyof typeof COLORS] || COLORS.blue }));
          rig.group.add(pad); this.pieces.add(rig.group); this.towers.set(tower.id, { rig, own, cell: tower.cell });
        }
      }
      for (const fruit of player.attackers) {
        fruitIds.add(fruit.id);
        let entry = this.fruits.get(fruit.id);
        if (!entry) {
          const kind = fruit.type === 'swift' ? 'strawberry' : fruit.type === 'armored' ? 'watermelon' : fruit.type === 'explosive' ? 'bomb' : 'orange';
          const def = FRUIT_DEFS[kind];
          const texture = getAdminTexture(`enemy-${fruit.type}` as Parameters<typeof getAdminTexture>[0]) || fruitAtlas.tile(...def.skin);
          const mesh = new Mesh(new SphereGeometry(fruit.type === 'armored' ? .68 : .48, 14, 10), new MeshLambertMaterial({ color: texture ? 0xffffff : def.color, map: texture, emissive: def.emissive, emissiveIntensity: .12 }));
          this.pieces.add(mesh); entry = { mesh, player, progress: fruit.progress, type: fruit.type, own }; this.fruits.set(fruit.id, entry);
        }
        entry.player = player; entry.progress = fruit.progress; entry.x = fruit.x; entry.y = fruit.y; entry.boss = fruit.boss;
      }
      if (!own && player.lastStroke && player.lastStroke.at > this.remoteAt) {
        this.remoteAt = player.lastStroke.at;
        const { from, to } = player.lastStroke;
        const a = pvpWorldPoint(map, from.x, from.y, false); const b = pvpWorldPoint(map, to.x, to.y, false);
        a.y = b.y = .8; this.remoteTrail.sync([a, b]);
      }
    }
    for (const [id, entry] of this.towers) if (!towerIds.has(id)) { this.release(entry.rig.group); this.towers.delete(id); }
    for (const [id, entry] of this.fruits) if (!fruitIds.has(id)) {
      if (snapshot.shared || entry.progress < map.pathCells.length - 1) {
        for (let i = 0; i < 6; i++) {
          const piece = new Mesh(new SphereGeometry(.11, 5, 4), new MeshBasicMaterial({ color: entry.type === 'armored' ? 0x8aff44 : 0xffa533 }));
          piece.position.copy(entry.mesh.position); this.scene.add(piece);
          this.effects.push({ object: piece, life: .35, velocity: new Vector3(Math.cos(i) * 3, 2, Math.sin(i) * 3) });
        }
      }
      this.release(entry.mesh); this.fruits.delete(id);
    }
  }

  private cellPoint(cell: number, own: boolean): Vector3 {
    const map = this.snapshot.map!;
    return pvpWorldPoint(map, cell % map.width + .5, Math.floor(cell / map.width) + .5, own);
  }

  private buildTerrain(map: PvpMap): void {
    while (this.terrain.children.length) this.release(this.terrain.children[0] as Group);
    this.health.clear();
    const floor = new Mesh(new BoxGeometry(map.width * TILE_X + 5, .4, (map.height + 4) * TILE * (this.snapshot.shared ? 1 : 2)), new MeshLambertMaterial({ color: 0x4d7c39 }));
    floor.position.y = -.3; if (this.snapshot.shared) floor.position.z = -(map.height + 2) * TILE / 2; this.terrain.add(floor);
    const river = new Mesh(new BoxGeometry(map.width * TILE_X + 5, .12, TILE), new MeshLambertMaterial({ color: 0x307e89 })); if (!this.snapshot.shared) this.terrain.add(river); else { river.geometry.dispose(); (river.material as MeshLambertMaterial).dispose(); }
    for (const player of this.snapshot.players) {
      const own = player.side === this.snapshot.yourSide;
      const color = COLORS[player.side as keyof typeof COLORS] || COLORS.blue;
      for (const cell of map.pathCells) {
        const tile = new Mesh(new BoxGeometry(TILE_X * 1.02, .09, TILE * 1.02), new MeshLambertMaterial({ color: 0xb4a36f }));
        tile.position.copy(this.cellPoint(cell, own)); tile.position.y = .04; this.terrain.add(tile);
      }
      // Orchard trees stand outside legal build cells, preserving every editable route.
      for (let row = 1; row < map.height; row += 3) for (const edge of [-1.3, map.width + 1.3]) {
        const tree = new Group();
        const trunk = new Mesh(new CylinderGeometry(.13, .2, 1.3, 6), new MeshLambertMaterial({ color: 0x67412a })); trunk.position.y = .65;
        const crown = new Mesh(new ConeGeometry(.9, 2.1, 7), new MeshLambertMaterial({ color: 0x1d592e })); crown.position.y = 1.8;
        tree.add(trunk, crown); tree.position.copy(pvpWorldPoint(map, edge, row, own)); this.terrain.add(tree);
      }
      const endpoint = this.cellPoint((map.pathCells.at(-1) ?? (map.height - 1) * map.width + Math.floor(map.width / 2)), own); endpoint.z += own ? -TILE * 1.5 : TILE * 1.5;
      const base = new Group(); base.position.copy(endpoint);
      const wall = new Mesh(new BoxGeometry(map.width * TILE_X, 1.05, 1.3), new MeshLambertMaterial({ color: own ? 0x355c91 : 0x9a4034 })); wall.position.y = .5;
      const keep = new Mesh(new CylinderGeometry(1.05, 1.3, 2.4, 10), new MeshLambertMaterial({ color })); keep.position.y = 1.2;
      const towerTexture = getAdminTexture('tower-main'); if (towerTexture) (keep.material as MeshLambertMaterial).map = towerTexture;
      const crown = new Mesh(new SphereGeometry(.48, 12, 8), new MeshLambertMaterial({ color: 0xf1e3bd })); crown.position.y = 2.7;
      const rail = new Mesh(new BoxGeometry(map.width * TILE_X * .8, .12, .35), new MeshBasicMaterial({ color })); rail.position.set(0, .2, own ? -1.6 : 1.6); rail.userData.maxHealth = this.config.wallHealth ?? player.wallHealth;
      this.health.set(player.userId, rail); base.add(wall, keep, crown, rail); this.terrain.add(base);
    }
    this.resize();
  }

  private point(event: PointerEvent): { x: number; y: number } | null {
    const map = this.snapshot.map; if (!map) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
    const hit = this.ray.ray.intersectPlane(this.ground, new Vector3()); if (!hit) return null;
    const x = hit.x / TILE_X + map.width / 2; const y = -hit.z / TILE - 1;
    return x >= 0 && x <= map.width && y >= 0 && y <= map.height ? { x, y } : null;
  }

  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const point = this.point(event); if (!point) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.stroke = { id: event.pointerId, from: point, points: [] }; this.trail.reset();
  };
  private pointerMove = (event: PointerEvent) => {
    const point = this.point(event); const map = this.snapshot.map!;
    this.marker.visible = Boolean(point && map.buildCells.includes(Math.floor(point.y) * map.width + Math.floor(point.x)));
    if (point) { this.marker.position.copy(this.cellPoint(Math.floor(point.y) * map.width + Math.floor(point.x), true)); this.marker.position.y = .1; }
    if (!this.stroke || this.stroke.id !== event.pointerId || !point) return;
    const world = pvpWorldPoint(map, point.x, point.y, true); world.y = .8;
    if (!this.stroke.points.length) { const start = pvpWorldPoint(map, this.stroke.from.x, this.stroke.from.y, true); start.y = .8; this.stroke.points.push(start); }
    this.stroke.points.push(world); if (this.stroke.points.length > 16) this.stroke.points.shift();
    this.trail.sync(this.stroke.points); this.trailUntil = performance.now() + 200;
    if (performance.now() - this.sharedStrokeAt > 120 && Math.hypot(point.x - this.stroke.from.x, point.y - this.stroke.from.y) >= .5) {
      this.sharedStrokeAt = performance.now(); this.command({ type: 'slash', from: this.stroke.from, to: point });
      this.stroke.from = point; this.stroke.sliced = true;
    }
  };
  private pointerUp = (event: PointerEvent) => {
    const stroke = this.stroke; this.stroke = null;
    if (!stroke || stroke.id !== event.pointerId) return;
    const to = this.point(event); if (!to) return;
    const distance = Math.hypot(to.x - stroke.from.x, to.y - stroke.from.y);
    if (distance >= .5 && performance.now() - this.sharedStrokeAt >= 100) this.command({ type: 'slash', from: stroke.from, to });
    else if (!stroke.sliced && distance < .5) {
      const map = this.snapshot.map!; const cell = Math.floor(to.y) * map.width + Math.floor(to.x);
      if (map.buildCells.includes(cell)) this.command({ type: 'build', tower: this.element.dataset.tower || 'guillotine', cell });
    }
  };
  private pointerCancel = () => { this.stroke = null; this.trail.reset(); };
  private wheel = (event: WheelEvent) => { event.preventDefault(); this.zoom = Math.max(.65, Math.min(2.5, this.zoom * (event.deltaY > 0 ? .92 : 1.08))); this.resize(); };
  private resize(): void {
    const rect = this.element.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    this.renderer.setSize(rect.width, rect.height, false);
    const map = this.snapshot.map; const half = (map ? (map.height + 5) * TILE * (this.snapshot.shared ? .5 : 1) : 34) / this.zoom;
    const aspect = rect.width / rect.height;
    const centerZ = this.snapshot.shared && map ? -(map.height + 2) * TILE / 2 : 0;
    this.camera.position.set(0, 75, centerZ - 48); this.camera.lookAt(0, 0, centerZ);
    this.camera.left = -half * aspect; this.camera.right = half * aspect; this.camera.top = half; this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }
  private animate = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(.05, (now - this.previousAt) / 1000); this.previousAt = now;
    const map = this.snapshot.map;
    if (map) for (const entry of this.fruits.values()) {
      if (this.snapshot.shared && entry.x !== undefined && entry.y !== undefined) {
        const y = Math.min(13.5, entry.y + Math.min(.5, (now - this.receivedAt) / 1000) * (this.config.attacks[entry.type]?.speed || 0) * (entry.boss ? .35 : .65));
        entry.mesh.position.copy(pvpWorldPoint(map, entry.x, y, true)); entry.mesh.position.y = .65 + Math.sin(now / 140) * .07;
        entry.mesh.scale.setScalar(entry.boss ? 2.5 : 1); entry.mesh.rotation.y += dt; entry.mesh.visible = true; continue;
      }
      const progress = Math.max(0, Math.min(map.pathCells.length - 1, entry.progress + Math.min(1, (now - this.receivedAt) / 1000) * (this.config.attacks[entry.type]?.speed || 0)));
      entry.mesh.visible = entry.progress + Math.min(1, (now - this.receivedAt) / 1000) * (this.config.attacks[entry.type]?.speed || 0) >= 0;
      const index = Math.floor(progress); const a = this.cellPoint(map.pathCells[index]!, entry.own); const b = this.cellPoint(map.pathCells[Math.min(index + 1, map.pathCells.length - 1)]!, entry.own);
      entry.mesh.position.copy(a.lerp(b, progress - index)); entry.mesh.position.y = .65 + Math.sin(now / 140 + index) * .07; entry.mesh.rotation.y += dt;
    }
    for (const entry of this.towers.values()) {
      const target = [...this.fruits.values()].find((fruit) => fruit.own === entry.own && fruit.mesh.position.distanceTo(entry.rig.group.position) < (this.config.towers[entry.rig.kind]?.range || 0) * TILE);
      if (target) entry.rig.group.rotation.y = Math.atan2(target.mesh.position.x - entry.rig.group.position.x, target.mesh.position.z - entry.rig.group.position.z);
      if (entry.rig.kind === 'vortex') entry.rig.group.rotation.y += dt * 2;
      if (entry.rig.kind === 'guillotine' && entry.rig.group.children[1]) entry.rig.group.children[1].rotation.z = -.7 + Math.sin(now / 220) * 1.1;
      const cooldown = this.config.towers[entry.rig.kind]?.cooldownMs || 1000;
      const shotId = entry.rig.group.uuid;
      if (target && now - (this.shots.get(shotId) || 0) >= cooldown) {
        this.shots.set(shotId, now);
        const a = entry.rig.group.position.clone(); a.y = 1;
        const beam = new Line(new BufferGeometry().setFromPoints([a, target.mesh.position.clone()]), new LineBasicMaterial({ color: entry.own ? COLORS.blue : COLORS.red, transparent: true, opacity: 1 }));
        this.scene.add(beam); this.effects.push({ object: beam, life: .16 });
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i]!; effect.life -= dt;
      if (effect.velocity) { effect.object.position.addScaledVector(effect.velocity, dt); effect.velocity.y -= dt * 12; }
      if (effect.life <= 0) { this.release(effect.object); this.effects.splice(i, 1); }
    }
    if (!this.stroke && now > this.trailUntil) this.trail.reset();
    if (Date.now() - this.remoteAt > 300) this.remoteTrail.reset();
    this.trail.update(dt); this.remoteTrail.update(dt);
    this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(this.animate);
  };
  private release(object: Group | Mesh | Line): void {
    object.removeFromParent();
    object.traverse((child) => { if (child instanceof Mesh || child instanceof Line) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.dispose()); } });
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    this.release(this.terrain); this.release(this.pieces);
    for (const trail of [this.trail, this.remoteTrail]) { this.release(trail.line); this.release(trail.glowLine); trail.sparks.geometry.dispose(); (trail.sparks.material as MeshBasicMaterial).dispose(); }
    this.release(this.marker); this.renderer.dispose(); this.renderer.forceContextLoss();
    this.effects.forEach((effect) => this.release(effect.object));
  }
}
