import { AmbientLight, BackSide, BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, MeshLambertMaterial, OrthographicCamera, Plane, Raycaster, Scene, SphereGeometry, Sprite, SpriteMaterial, Vector2, Vector3, WebGLRenderer } from 'three';
import { TurretRig, TURRETS, type TurretKind } from '../../game/turrets';
import { BladeTrail } from '../../game/trail';
import { FRUIT_DEFS } from '../../game/fruits';
import { fruitAtlas } from '../../game/atlas';
import { getAdminTexture } from '../../game/adminTextureLoader';
import { findCatalogItem } from '../../game/catalog';
import { loadSave, WALL_SKINS } from '../../game/save';
import { heroDef, type HeroId } from '../../game/heroes';
import { heroIdToStudioKey, sampleStudioTexture } from '../../game/studioRuntime';
import { pvpTowerLevel, pvpTowerStats, type PvpCommand, type PvpConfig, type PvpMap } from '../../game/pvp';
import { el } from '../components/dom';

type Stroke = { from: { x: number; y: number }; to: { x: number; y: number }; at: number };
type PlayerView = { userId: string; name: string; side: string; wallHealth: number; wallMaxHealth?: number; mainLevel?: number; captured?: Array<{ id: string; type: string }>; hero?: string; wallSkin?: string; towers: Array<{ id: string; type: string; cell: number; level?: number }>; attackers: Array<{ id: string; type: string; progress: number; x?: number; y?: number; boss?: boolean; hp?: number; maxHp?: number; released?: boolean }>; lastStroke?: Stroke | null };
export type BattlefieldSnapshot = { id: string; map: PvpMap | null; yourSide: string; players: PlayerView[]; shared?: boolean; sharedStroke?: Stroke };
const TILE = 1.7;
const TILE_X = Math.sqrt(3) * TILE / 1.5;
const HEX_RADIUS = TILE / 1.5;
const COLORS = { blue: 0x38bdf8, red: 0xef5350 };

/** Both server lanes meet at the centre; the viewer's wall is always at the bottom. */
export function pvpWorldPoint(map: Pick<PvpMap, 'width'>, x: number, y: number, own: boolean): Vector3 {
  return new Vector3((x + (Math.floor(y) % 2 ? .5 : 0) - map.width / 2 - .25) * TILE_X * (own ? 1 : -1), 0, (y + 1) * TILE * (own ? -1 : 1));
}

export class PvpBattlefield {
  readonly element = el('div', { class: 'ftd-pvp-scene' });
  private readonly canvas = el('canvas', { class: 'ftd-pvp-scene__canvas', 'aria-label': 'Hex arena. Choose a tower then tap a blue hex to build. Tap a placed tower to upgrade or sell.' });
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-20, 20, 30, -30, 0.1, 200);
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly ray = new Raycaster();
  private readonly terrain = new Group();
  private readonly pieces = new Group();
  private readonly trail = new BladeTrail();
  private readonly remoteTrail = new BladeTrail();
  private readonly marker = new Mesh(new CylinderGeometry(HEX_RADIUS * .95, HEX_RADIUS * .95, .07, 6), new MeshBasicMaterial({ color: 0xffca28, transparent: true, opacity: .5 }));
  private readonly observer: ResizeObserver;
  private readonly towers = new Map<string, { rig: TurretRig; type: string; own: boolean; cell: number; level?: number }>();
  private readonly fruits = new Map<string, { mesh: Mesh; player: PlayerView; progress: number; x?: number; y?: number; boss?: boolean; type: string; own: boolean }>();
  private readonly buildPads: Mesh[] = [];
  private selectedCell: number | null = null;
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
  private readonly effects: Array<{ object: Mesh | Line; life: number; velocity?: Vector3; target?: Vector3 }> = [];
  private zoom = 1;
  private focusOwn = false;
  private framingInitialised = false;
  private mapKey = '';
  get interacting(): boolean { return this.stroke !== null; }

  constructor(snapshot: BattlefieldSnapshot, config: Pick<PvpConfig, 'attacks' | 'towers'> & { wallHealth?: number }, private readonly command: (command: PvpCommand) => void, private readonly select?: (cell: number) => void) {
    this.snapshot = snapshot; this.config = config;
    if (snapshot.shared) this.canvas.setAttribute('aria-label', 'Co-op battlefield. Tap a pad to build. Drag across incoming fruit to slice.');
    this.element.append(this.canvas, el('div', { class: 'ftd-pvp-scene__hint', text: snapshot.shared ? 'Tap a pad to build · Drag to slice' : 'YOU = BLUE · ENEMY = RED · Build on blue tiles to stop RED fruit. Send BLUE fruit to destroy the RED base.' }));
    if (!snapshot.shared) {
      this.element.append(el('div', { class: 'ftd-duel-team is-own', text: 'BLUE · YOUR BASE' }), el('div', { class: 'ftd-duel-team is-rival', text: 'RED · ENEMY BASE' }));
      const focus = el('button', { class: 'ftd-duel-focus', type: 'button', 'data-testid':'arena-view-toggle', text: 'My defence', 'aria-label': 'Zoom to your build territory' });
      focus.addEventListener('click', () => { this.focusOwn = !this.focusOwn; this.zoom = 1; this.resize(); }); this.element.appendChild(focus);
    }
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene.background = new Color(snapshot.shared ? 0x102a23 : 0x202226);
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
    const terrainKey = JSON.stringify([map, snapshot.players.map(p => [p.hero, p.wallSkin, p.mainLevel])]);
    if (this.mapKey !== terrainKey) { this.mapKey = terrainKey; this.buildTerrain(map); }
    if (snapshot.sharedStroke && snapshot.sharedStroke.at > this.remoteAt) {
      this.remoteAt = snapshot.sharedStroke.at;
      const a = pvpWorldPoint(map, snapshot.sharedStroke.from.x, snapshot.sharedStroke.from.y, true);
      const b = pvpWorldPoint(map, snapshot.sharedStroke.to.x, snapshot.sharedStroke.to.y, true);
      a.y = b.y = .8; this.remoteTrail.sync([a, b]);
    }
    const towerIds = new Set<string>(); const fruitIds = new Set<string>();
    for (const player of snapshot.players) {
      const own = player.side === snapshot.yourSide;
      const hp = this.health.get(player.userId);
      if (hp) {
        if (hp.userData.lastHealth !== undefined && player.wallHealth < hp.userData.lastHealth) {
          const origin = new Vector3(); hp.getWorldPosition(origin); origin.y = 1;
          const count = player.wallHealth <= 0 ? 36 : 10;
          for (let i = 0; i < count; i++) {
            const shard = new Mesh(new BoxGeometry(.18,.18,.18), new MeshBasicMaterial({ color:i % 2 ? 0xffca28 : 0xf48120 }));
            shard.position.copy(origin); this.scene.add(shard);
            const angle = i / count * Math.PI * 2;
            this.effects.push({ object:shard, life:player.wallHealth <= 0 ? 2 : .65, velocity:new Vector3(Math.cos(angle)*6,3+i%4,Math.sin(angle)*6) });
          }
          if (player.wallHealth <= 0) hp.parent?.traverse(object => { if (object instanceof Mesh && object !== hp) object.visible = false; });
        }
        hp.userData.lastHealth = player.wallHealth;
        hp.scale.x = Math.max(.001, player.wallHealth / Number(hp.userData.maxHealth));
      }
      for (const tower of player.towers) {
        towerIds.add(tower.id);
        if (!this.towers.has(tower.id) && (tower.type === 'catcher' || TURRETS.some((item) => item.kind === tower.type))) {
          const rig = new TurretRig(tower.type === 'catcher' ? 'vortex' : tower.type as TurretKind);
          if (tower.type === 'catcher') {
            while (rig.group.children.length) this.release(rig.group.children[0] as Mesh);
            const cageMaterial = new MeshLambertMaterial({ color: 0x99b89a });
            const foot = new Mesh(new CylinderGeometry(.6, .7, .2, 8), new MeshLambertMaterial({ color: 0x51422d })); foot.position.y = .1; rig.group.add(foot);
            for (const x of [-.35, .35]) for (const z of [-.35, .35]) {
              const bar = new Mesh(new BoxGeometry(.07, 1.2, .07), cageMaterial.clone()); bar.position.set(x, .75, z); rig.group.add(bar);
            }
            const lid = new Mesh(new BoxGeometry(.85, .13, .85), cageMaterial.clone()); lid.position.y = 1.35; rig.group.add(lid);
            const core = new Mesh(new SphereGeometry(.3, 10, 8), new MeshLambertMaterial({ color: 0xadf44b, emissive: 0x5a8d1c, emissiveIntensity: .4 })); core.position.y = .75; rig.group.add(core);
          }
          const bodies: Mesh[] = []; rig.group.traverse((object) => { if (object instanceof Mesh) bodies.push(object); });
          for (const object of bodies) { const outline = new Mesh(object.geometry, new MeshBasicMaterial({ color: 0x07110b, side: BackSide })); outline.scale.setScalar(1.06); object.add(outline); }
          rig.group.position.copy(this.cellPoint(tower.cell, own)); rig.group.scale.setScalar(1.15);
          const pad = new Mesh(new CylinderGeometry(.7, .8, .12, 12), new MeshLambertMaterial({ color: own ? COLORS.blue : COLORS.red }));
          rig.group.add(pad); this.pieces.add(rig.group); this.towers.set(tower.id, { rig, type: tower.type, own, cell: tower.cell, level: pvpTowerLevel(tower.level) });
        }
        const entry = this.towers.get(tower.id);
        if (entry) { entry.level = pvpTowerLevel(tower.level); entry.rig.group.scale.setScalar(1.15 + (entry.level - 1) * .14); }
      }
      for (const fruit of player.attackers) {
        fruitIds.add(fruit.id);
        let entry = this.fruits.get(fruit.id);
        if (!entry) {
          const kind = fruit.type === 'swift' ? 'strawberry' : fruit.type === 'armored' ? 'watermelon' : fruit.type === 'explosive' ? 'bomb' : 'orange';
          const def = FRUIT_DEFS[kind];
          const texture = snapshot.shared ? getAdminTexture(`enemy-${fruit.type}` as Parameters<typeof getAdminTexture>[0]) || fruitAtlas.tile(...def.skin) : null;
          const teamColor = own ? COLORS.red : COLORS.blue;
          const mesh = new Mesh(new SphereGeometry(fruit.type === 'armored' ? .68 : .48, 14, 10), new MeshLambertMaterial({ color: snapshot.shared ? texture ? 0xffffff : def.color : teamColor, map: texture, emissive: snapshot.shared ? def.emissive : teamColor, emissiveIntensity: .22 }));
          const shell = new Mesh(mesh.geometry, new MeshBasicMaterial({ color: 0x07110c, side: BackSide })); shell.scale.setScalar(1.09); mesh.add(shell);
          const stem = new Mesh(new CylinderGeometry(.07, .05, .3, 5), new MeshLambertMaterial({ color: 0x274925 })); stem.position.y = .5; mesh.add(stem);
          for (const x of [-.16, .16]) { const eye = new Mesh(new SphereGeometry(.09, 7, 5), new MeshBasicMaterial({ color: 0xf5edb5 })); eye.position.set(x, .12, -.43); mesh.add(eye); }
          if (!snapshot.shared) {
            const bar = new Group(); bar.position.y = .85;
            const back = new Mesh(new BoxGeometry(.85, .08, .15), new MeshBasicMaterial({ color: 0x07120b }));
            const fill = new Mesh(new BoxGeometry(.75, .045, .17), new MeshBasicMaterial({ color: teamColor }));
            bar.add(back, fill); mesh.add(bar); mesh.userData.hpBar = bar; mesh.userData.hpFill = fill;
          }
          this.pieces.add(mesh); entry = { mesh, player, progress: fruit.progress, type: fruit.type, own }; this.fruits.set(fruit.id, entry);
        }
        const hpBar = entry.mesh.userData.hpBar as Group | undefined;
        if (hpBar) {
          const fraction = Math.max(0, Math.min(1, (fruit.hp ?? 1) / (fruit.maxHp ?? this.config.attacks[fruit.type]?.health ?? 1)));
          hpBar.visible = fraction < .99;
          const fill = entry.mesh.userData.hpFill as Mesh; fill.scale.x = Math.max(.01, fraction); fill.position.x = -(1 - fraction) * .375;
        }
        entry.player = player; entry.progress = fruit.progress; entry.x = fruit.x; entry.y = fruit.y; entry.boss = fruit.boss;
      }
      if (snapshot.shared && !own && player.lastStroke && player.lastStroke.at > this.remoteAt) {
        this.remoteAt = player.lastStroke.at;
        const { from, to } = player.lastStroke;
        const a = pvpWorldPoint(map, from.x, from.y, false); const b = pvpWorldPoint(map, to.x, to.y, false);
        a.y = b.y = .8; this.remoteTrail.sync([a, b]);
      }
    }
    for (const [id, entry] of this.towers) if (!towerIds.has(id)) { this.release(entry.rig.group); this.towers.delete(id); }
    for (const [id, entry] of this.fruits) if (!fruitIds.has(id)) {
      const captured = snapshot.players.some(player => player.captured?.some(item => item.id === `captured:${id}`));
      if (captured) {
        const cage = [...this.towers.values()].filter(tower => tower.own === entry.own && tower.type === 'catcher').sort((a, b) => a.rig.group.position.distanceTo(entry.mesh.position) - b.rig.group.position.distanceTo(entry.mesh.position))[0];
        const orb = new Mesh(new SphereGeometry(.3, 10, 8), new MeshBasicMaterial({ color: 0xc3ff5c }));
        orb.position.copy(entry.mesh.position); this.scene.add(orb); this.effects.push({ object: orb, life: .5, target: cage?.rig.group.position.clone().add(new Vector3(0, .8, 0)) });
      } else if (snapshot.shared || entry.progress < map.pathCells.length - 1) {
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
    this.health.clear(); this.buildPads.length = 0;
    const floor = new Mesh(new BoxGeometry(map.width * TILE_X + 5, .4, (map.height + 4) * TILE * (this.snapshot.shared ? 1 : 2)), new MeshLambertMaterial({ color: this.snapshot.shared ? 0x4d7c39 : 0x33353a }));
    floor.position.y = -.3; if (this.snapshot.shared) floor.position.z = -(map.height + 2) * TILE / 2; this.terrain.add(floor);
    for (const player of this.snapshot.players) {
      const own = player.side === this.snapshot.yourSide;
      const color = own ? COLORS.blue : COLORS.red;
      const route = new Set(map.pathCells); const builds = new Set(map.buildCells);
      for (let cell = 0; cell < map.width * map.height; cell++) {
        const isPath = route.has(cell); const build = builds.has(cell);
        const rim = new Mesh(new CylinderGeometry(HEX_RADIUS * .985, HEX_RADIUS, .16, 6), new MeshLambertMaterial({ color: isPath ? 0x4c4230 : build ? own ? 0x337589 : 0x824843 : 0x2f4831 }));
        rim.position.copy(this.cellPoint(cell, own)); rim.position.y = -.02;
        const tile = new Mesh(new CylinderGeometry(HEX_RADIUS * .90, HEX_RADIUS * .93, .08, 6), new MeshLambertMaterial({ color: isPath ? 0xcbb87b : own ? (cell % 3 ? 0x547a43 : 0x60864b) : (cell % 3 ? 0x6c773c : 0x7a8345) }));
        if (!this.snapshot.shared) (tile.material as MeshLambertMaterial).color.set(isPath ? own ? 0x193b59 : 0x542129 : own ? 0x215473 : 0x703039);
        tile.position.y = .12; rim.add(tile); this.terrain.add(rim);
        if (own && build) { rim.userData.cell = cell; this.buildPads.push(rim); }
        if (build && cell % 3 === 0) {
          const cross = new Group(); const mat = new MeshBasicMaterial({ color: own ? 0xa4e8e4 : 0xe2a89e, transparent: true, opacity: .4 });
          cross.add(new Mesh(new BoxGeometry(.4, .02, .08), mat), new Mesh(new BoxGeometry(.08, .02, .4), mat)); cross.position.y = .18; rim.add(cross);
        }
      }
      if (!this.snapshot.shared) {
        for (let index = 2; index < map.pathCells.length - 1; index += 5) {
          const from = this.cellPoint(map.pathCells[index]!, own), to = this.cellPoint(map.pathCells[index + 1]!, own);
          const arrow = new Mesh(new ConeGeometry(.32, .85, 3), new MeshBasicMaterial({ color: own ? COLORS.red : COLORS.blue, transparent: true, opacity: .8 }));
          arrow.position.copy(from); arrow.position.y = .23;
          arrow.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), to.sub(from).normalize()); this.terrain.add(arrow);
        }
      }
      // Orchard trees stand outside legal build cells, preserving every editable route.
      for (let row = 1; row < map.height; row += 3) for (const edge of [-1.3, map.width + 1.3]) {
        const tree = new Group();
        const trunk = new Mesh(new CylinderGeometry(.13, .2, 1.3, 6), new MeshLambertMaterial({ color: 0x67412a })); trunk.position.y = .65;
      const crown = new Mesh(new ConeGeometry(.9, 2.1, 7), new MeshLambertMaterial({ color: this.snapshot.shared ? 0x1d592e : 0x655032 })); crown.position.y = 1.8;
        tree.add(trunk, crown); tree.position.copy(pvpWorldPoint(map, edge, row, own)); this.terrain.add(tree);
      }
      const endpoint = this.cellPoint((map.pathCells.at(-1) ?? (map.height - 1) * map.width + Math.floor(map.width / 2)), own); endpoint.z += own ? -TILE * 1.5 : TILE * 1.5;
      const gateX = endpoint.x;
      const base = new Group(); base.position.copy(endpoint); base.position.x = 0;
      const wall = new Mesh(new BoxGeometry(map.width * TILE_X, 1.05, 1.3), new MeshLambertMaterial({ color: this.snapshot.shared ? WALL_SKINS.find(skin => skin.id === player.wallSkin)?.color ?? COLORS.blue : color })); wall.position.y = .5;
      const keep = new Mesh(new CylinderGeometry(1.05, 1.3, 2.4, 10), new MeshLambertMaterial({ color })); keep.position.set(gateX, 1.2, 0); keep.scale.setScalar(1 + (pvpTowerLevel(player.mainLevel) - 1) * .16);
      const towerTexture = getAdminTexture('tower-main'); if (towerTexture) (keep.material as MeshLambertMaterial).map = towerTexture;
      const hero = heroDef((player.hero || 'jiju') as HeroId);
      const heroTexture = sampleStudioTexture(heroIdToStudioKey(hero.id), 'idle') || getAdminTexture(`hero-${hero.id}`);
      if (heroTexture) {
        const avatar = new Sprite(new SpriteMaterial({ map: heroTexture, transparent: true }));
        avatar.position.set(gateX + 2.2, 1.7, own ? -.4 : .4); avatar.scale.set(2.5, 3, 1); base.add(avatar);
      } else {
        const actor = new Group(); actor.position.set(gateX + 2.2, 0, 0);
        const body = new Mesh(new CylinderGeometry(.42, .65, 1.4, 6), new MeshLambertMaterial({ color: hero.color })); body.position.y = .85;
        const head = new Mesh(new SphereGeometry(.38, 10, 8), new MeshLambertMaterial({ color: 0xf1d3a0 })); head.position.y = 1.95;
        actor.add(body, head); base.add(actor);
      }
      for (const x of [-map.width * TILE_X / 2 + 1, map.width * TILE_X / 2 - 1]) {
        const turret = new Mesh(new CylinderGeometry(.8, 1, 2, 6), new MeshLambertMaterial({ color: own ? 0x5e8595 : 0xb06048 })); turret.position.set(x, 1, 0); base.add(turret);
        for (let i = 0; i < 6; i++) { const crenel = new Mesh(new BoxGeometry(.3, .5, .3), new MeshLambertMaterial({ color: 0xc3c7a4 })); crenel.position.set(x + Math.sin(i * Math.PI / 3) * .75, 2.1, Math.cos(i * Math.PI / 3) * .75); base.add(crenel); }
      }
      const crown = new Mesh(new SphereGeometry(.48, 12, 8), new MeshLambertMaterial({ color: 0xf1e3bd })); crown.position.set(gateX, 2.7, 0);
      const rail = new Mesh(new BoxGeometry(map.width * TILE_X * .8, .12, .35), new MeshBasicMaterial({ color })); rail.position.set(0, .2, own ? -1.6 : 1.6); rail.userData.maxHealth = player.wallMaxHealth ?? this.config.wallHealth ?? player.wallHealth;
      this.health.set(player.userId, rail); base.add(wall, keep, crown, rail); this.terrain.add(base);
    }
    if (!this.snapshot.shared) {
      const first = map.pathCells[0]!;
      const a = this.cellPoint(first, true); const b = this.cellPoint(first, false);
      const bridge = new Mesh(new BoxGeometry(TILE_X * .75, .14, a.distanceTo(b)), new MeshLambertMaterial({ color: 0xcbb87b }));
      bridge.position.copy(a.clone().add(b).multiplyScalar(.5)); bridge.position.y = .05;
      bridge.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); this.terrain.add(bridge);
      for (const own of [true, false]) {
        const entrance = this.cellPoint(first, own);
        const team = own ? COLORS.red : COLORS.blue;
        const portal = new Mesh(new CylinderGeometry(.85, .85, .12, 12), new MeshBasicMaterial({ color: team, transparent: true, opacity: .8 }));
        portal.position.copy(entrance); portal.position.y = .22; this.terrain.add(portal);
        for (const x of [-.9, .9]) {
          const beacon = new Mesh(new BoxGeometry(.13, 1.5, .13), new MeshBasicMaterial({ color: team }));
          beacon.position.copy(entrance); beacon.position.x += x; beacon.position.y = .85; this.terrain.add(beacon);
        }
      }
    }
    this.resize();
  }

  private point(event: PointerEvent): { x: number; y: number } | null {
    const map = this.snapshot.map; if (!map) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
    const hit = this.ray.ray.intersectPlane(this.ground, new Vector3()); if (!hit) return null;
    const y = -hit.z / TILE - 1; const x = hit.x / TILE_X + map.width / 2 + .25 - (Math.floor(y) % 2 ? .5 : 0);
    return x >= 0 && x <= map.width && y >= 0 && y <= map.height ? { x, y } : null;
  }

  private buildCell(event: PointerEvent): number | null {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
    const hit = this.ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -.16), new Vector3());
    if (!hit) return null;
    const radius = HEX_RADIUS * .985;
    for (const pad of this.buildPads) {
      const dx = Math.abs(hit.x - pad.position.x); const dz = Math.abs(hit.z - pad.position.z);
      if (dx <= radius * Math.sqrt(3) / 2 && dz <= radius - dx / Math.sqrt(3)) return Number(pad.userData.cell);
    }
    return null;
  }

  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const point = this.point(event); if (!point) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.stroke = { id: event.pointerId, from: point, points: [] }; this.trail.reset();
  };
  private pointerMove = (event: PointerEvent) => {
    const point = this.point(event); const map = this.snapshot.map!;
    if (point && this.selectedCell === null) {
      const cell = this.buildCell(event);
      this.marker.visible = cell !== null;
      if (cell !== null) { this.marker.position.copy(this.cellPoint(cell, true)); this.marker.position.y = .21; }
    }
    if (!this.stroke || this.stroke.id !== event.pointerId || !point) return;
    if (!this.snapshot.shared) { if (Math.hypot(point.x - this.stroke.from.x, point.y - this.stroke.from.y) >= .5) this.stroke.sliced = true; return; }
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
    if (this.snapshot.shared && distance >= .5 && performance.now() - this.sharedStrokeAt >= 100) this.command({ type: 'slash', from: stroke.from, to });
    else if (!stroke.sliced && distance < .5) {
      const cell = this.buildCell(event);
      if (cell !== null) {
        if (this.select) this.select(cell);
        else this.command({ type: 'build', tower: this.element.dataset.tower || 'guillotine', cell });
      }
    }
  };
  selectCell(cell: number | null): void {
    this.selectedCell = cell; this.marker.visible = cell !== null;
    if (cell !== null) { this.marker.position.copy(this.cellPoint(cell, true)); this.marker.position.y = .23; }
  }
  setAttackView(attacking: boolean): void {
    if (this.snapshot.shared) return;
    this.focusOwn = !attacking && this.element.getBoundingClientRect().width < 600;
    this.zoom = 1; this.resize();
  }
  private pointerCancel = () => { this.stroke = null; this.trail.reset(); };
  private wheel = (event: WheelEvent) => { event.preventDefault(); this.zoom = Math.max(.65, Math.min(2.5, this.zoom * (event.deltaY > 0 ? .92 : 1.08))); this.resize(); };
  private resize(): void {
    const rect = this.element.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    if (this.framingInitialised === false) {
      this.framingInitialised = true;
      this.focusOwn = !this.snapshot.shared && rect.width < 600;
    }
    this.element.classList.toggle('is-focused', this.focusOwn);
    const focus = this.element.querySelector<HTMLElement>('.ftd-duel-focus');
    if (focus) { focus.textContent = this.focusOwn ? 'Whole arena' : 'My defence'; focus.setAttribute('aria-label', this.focusOwn ? 'Show both bases and attack routes' : 'Zoom to your build territory'); }
    this.renderer.setSize(rect.width, rect.height, false);
    const map = this.snapshot.map; const aspect = rect.width / rect.height;
    const landscape = aspect > 1.25 && !this.snapshot.shared && !this.focusOwn;
    this.element.classList.toggle('is-landscape', landscape);
    const length = map ? (map.height + 3.7) * TILE * (this.snapshot.shared || this.focusOwn ? .5 : 1.02) : 34;
    const breadth = map ? (map.width + 3) * TILE_X / 2 : 12;
    const half = (landscape ? Math.max(breadth, length / aspect) : Math.max(length, breadth / aspect)) / this.zoom;
    const centerZ = (this.snapshot.shared || this.focusOwn) && map ? -(map.height + 2) * TILE / 2 : 0;
    this.camera.position.set(landscape ? -48 : 0, 75, landscape ? centerZ : centerZ - 48); this.camera.lookAt(0, 0, centerZ);
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
      const progress = Math.max(0, Math.min(map.pathCells.length - 1, entry.progress + Math.min(1, (now - this.receivedAt) / 1000) * (this.config.attacks[entry.type]?.speed || 0) * Math.max(1, (map.pathCells.length - 1) / 13)));
      entry.mesh.visible = entry.progress + Math.min(1, (now - this.receivedAt) / 1000) * (this.config.attacks[entry.type]?.speed || 0) * Math.max(1, (map.pathCells.length - 1) / 13) >= 0;
      const index = Math.floor(progress); const a = this.cellPoint(map.pathCells[index]!, entry.own); const b = this.cellPoint(map.pathCells[Math.min(index + 1, map.pathCells.length - 1)]!, entry.own);
      entry.mesh.position.copy(a.lerp(b, progress - index)); entry.mesh.position.y = .65 + Math.sin(now / 140 + index) * .07; entry.mesh.rotation.y += dt;
      if (entry.mesh.userData.hpBar) entry.mesh.userData.hpBar.rotation.y = -entry.mesh.rotation.y;
    }
    for (const entry of this.towers.values()) {
      const target = [...this.fruits.values()].find((fruit) => fruit.own === entry.own && fruit.mesh.position.distanceTo(entry.rig.group.position) < ((this.config.towers[entry.type] ? pvpTowerStats(this.config.towers[entry.type]!, entry.level).range : 0)) * TILE);
      if (target) entry.rig.group.rotation.y = Math.atan2(target.mesh.position.x - entry.rig.group.position.x, target.mesh.position.z - entry.rig.group.position.z);
      if (entry.type === 'vortex') entry.rig.group.rotation.y += dt * 2;
      if (entry.type === 'guillotine' && entry.rig.group.children[1]) entry.rig.group.children[1].rotation.z = -.7 + Math.sin(now / 220) * 1.1;
      const cooldown = this.config.towers[entry.type] ? pvpTowerStats(this.config.towers[entry.type]!, entry.level).cooldownMs : 1000;
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
      if (effect.target) effect.object.position.lerp(effect.target, Math.min(1, dt * 12));
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
    object.traverse((child) => { if (child instanceof Sprite) child.material.dispose(); if (child instanceof Mesh || child instanceof Line) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.dispose()); } });
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    this.release(this.terrain); this.release(this.pieces);
    for (const trail of [this.trail, this.remoteTrail]) { this.release(trail.line); this.release(trail.glowLine); trail.sparks.geometry.dispose(); (trail.sparks.material as MeshBasicMaterial).dispose(); }
    this.release(this.marker); this.renderer.dispose(); this.renderer.forceContextLoss();
    this.effects.forEach((effect) => this.release(effect.object));
  }
}
