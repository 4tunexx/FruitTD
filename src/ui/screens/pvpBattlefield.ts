import type { CombatStatus } from '../../game/combatStatus';
import { StatusVfx } from '../../game/statusVfx';
import { laneFrame } from '../../engine/laneCamera';
import {TURRET_WEAPONS} from '../../game/turretWeapons';
import {towerHealthRail} from '../../game/towerHealthRail';
import { NetworkMotion } from '../../game/networkMotion';
import { NetworkMotion2D } from '../../game/networkMotion2D';
import {GraphicsRecovery} from '../../engine/graphicsRecovery';
import {TeamBladeTrails,type TeamStroke} from '../../game/teamBladeTrails';
import { createBuildPad } from '../../game/buildPads';
import { TurretEffects } from '../../game/turretEffects';
import { DefenderMotion } from '../../game/defenderMotion';
import { characterPortrait, enemyPortrait, battlefieldTexture } from '../../game/characterPortraits';
import { blendBattlefieldEdges } from '../../game/battlefieldBlend';
import { faceCombatPortraits } from '../../game/portraitFacing';
import { combatTokenFrame } from '../../game/combatTokens';
import { battleScenery } from '../../game/battleArt';
import { PowerVfx } from '../../game/powerVfx';
import { heroAbility } from '../../game/heroAbilities';
import type { PowerCast } from '../../game/powerCombat';
import { AmbientLight, BackSide, BoxGeometry, CircleGeometry, BufferGeometry, CylinderGeometry, DirectionalLight, DoubleSide, Group, Line, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshLambertMaterial, OrthographicCamera, Plane, PlaneGeometry, Raycaster, RingGeometry, Scene, SphereGeometry, Sprite, TextureLoader, SRGBColorSpace, Vector2, Vector3, WebGLRenderer } from 'three';
import { TurretRig, refreshCreatorTurrets, TURRETS, type TurretKind } from '../../game/turrets';
import { BladeTrail } from '../../game/trail';
import { FRUIT_DEFS } from '../../game/fruits';
import { fruitAtlas } from '../../game/atlas';
import { getAdminTexture } from '../../game/adminTextureLoader';
import { findCatalogItem } from '../../game/catalog';
import { loadSave, WALL_SKINS } from '../../game/save';
import { heroDef, type HeroId } from '../../game/heroes';
import { enemyKindToStudioKey, heroIdToStudioKey, sampleStudioTexture, turretLevelTuning, fireStudioEvent, playStudioSound, getStudioEntityData, createStudioAnimForKey, updateStudioAnim, type StudioAnimState } from '../../game/studioRuntime';
import { pvpTowerLevel, pvpTowerStats, pvpBuildCellAllowed, type PvpCommand, type PvpConfig, type PvpMap } from '../../game/pvp';
import { arenaTurretStats } from '../../game/pvpRebuild';
import { el } from '../components/dom';
import { sharedSfx } from '../../audio/sfx';

type Stroke = { from: { x: number; y: number }; to: { x: number; y: number }; at: number };
type PlayerView = { mainLastFiredAt?:number; powerCasts?:PowerCast[]; userId: string; name: string; side: string; wallHealth: number; wallMaxHealth?: number; mainLevel?: number; captured?: Array<{ id: string; type: string }>; hero?: string; wallSkin?: string; towers: Array<{ id: string; type: string; cell: number; level?: number;lastFiredAt?:number }>; attackers: Array<CombatStatus & { id: string; type: string; progress: number; fruitKind?:string; movementSpeed?: number; x?: number; y?: number; boss?: boolean; hp?: number; maxHp?: number; attackingTower?:boolean;lastTowerHitAt?:number;fighting?:boolean;fightTargetId?:string;lastClashAt?:number;sliceOnly?:boolean;slowUntil?:number; slowMultiplier?:number; released?: boolean }>; lastStroke?: Stroke | null };
export type BattlefieldSnapshot = { id: string; revision?: number; rulesVersion?:number; phase?:string; catchables?:Array<{id:string;type:string;fruitKind:string;x:number;y:number}>; map: PvpMap | null; yourSide: string; players: PlayerView[]; shared?: boolean; sharedStroke?: Stroke;sharedStrokes?:TeamStroke[] };
const TILE = 1.7;
const TILE_X = TILE * 1.15;
const HEX_RADIUS = TILE / 1.5;
const COLORS = { blue: 0x38bdf8, red: 0xf16a73 };

/** Both server lanes meet at the centre; the viewer's wall is always at the bottom. */
export function pvpWorldPoint(map: Pick<PvpMap, 'width'>, x: number, y: number, own: boolean): Vector3 {
  return new Vector3((x - (Math.floor(map.width / 2) - .5)) * TILE_X * (own ? 1 : -1), 0, (y + 1) * TILE * (own ? 1 : -1));
}
function arenaWorldPoint(map:PvpMap,x:number,y:number,viewerSide:string):Vector3 {
  return new Vector3((x-map.width/2)*TILE_X*(viewerSide==='blue'?1:-1),0,y*TILE*(viewerSide==='blue'?1:-1));
}
function arenaObstacle(mapId:string,seed:number):Group {
  const group=new Group();
  const add=(geometry:BoxGeometry|CylinderGeometry|SphereGeometry,color:number,x:number,y:number,z:number,sx=1,sy=1,sz=1)=>{const mesh=new Mesh(geometry,new MeshLambertMaterial({color}));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);group.add(mesh);return mesh;};
  if(mapId==='orchard-crossing'||mapId==='old-grove'){
    const old=mapId==='old-grove';
    add(new CylinderGeometry(.18,.31,old?1.9:1.45,8),0x765236,0,.83,0);
    for(let i=0;i<3;i++){const angle=i*Math.PI*2/3+seed*.4;add(new SphereGeometry(old?.68:.53,8,6),i===1?0x648a45:0x4d783e,Math.cos(angle)*.34,old?1.88:1.55,Math.sin(angle)*.3,1,.72,1);}
    if(!old)add(new SphereGeometry(.11,6,5),0xf4a33c,.3,1.42,.2);
  }else if(mapId==='windfall'){
    const log=add(new CylinderGeometry(.34,.39,1.7,10),0x765136,0,.4,0);log.rotation.z=Math.PI/2;
    for(const x of [-.84,.84]){const end=add(new CylinderGeometry(.38,.38,.04,10),0xc49b68,x,.4,0);end.rotation.z=Math.PI/2;}
    add(new BoxGeometry(1.35,.07,.09),0x9b7047,0,.72,0);
  }else if(mapId==='stone-arch'){
    for(const [x,z,scale] of [[-.37,-.18,.65],[.35,.17,.74],[0,-.02,.79]] as const){const rock=add(new SphereGeometry(1,7,5),0x83847f,x,.42*scale,z,scale,.72*scale,.83*scale);rock.rotation.y=seed*.6;}
    add(new SphereGeometry(.32,6,4),0xaba79a,-.48,.2,.32,.8,.55,.8);
  }else if(mapId==='riverbend'){
    add(new BoxGeometry(1.45,.42,.72),0x77694e,0,.25,0);
    for(const x of [-.54,.08,.52])add(new SphereGeometry(.35,7,5),0x9d8c66,x,.48,(seed%2?-.18:.18),1,.6,.8);
  }else if(mapId==='twin-rows'){
    add(new BoxGeometry(1.45,.55,.68),0x465d32,0,.38,0);
    for(const x of [-.5,0,.5])add(new SphereGeometry(.4,7,5),x===0?0x658348:0x53753d,x,.72,0,1,.7,.9);
  }else{
    add(new BoxGeometry(1.5,.13,.5),0x715532,0,.18,0);
    for(let i=0;i<5;i++){const x=(i-2)*.31;add(new CylinderGeometry(.035,.055,1.05,5),0x8d9c49,x,.74,(i%2?-.14:.14));add(new SphereGeometry(.15,6,4),0xc6a858,x,1.26,(i%2?-.14:.14),.7,1.15,.7);}
  }
  return group;
}

/** Continuous route from the sending keep, across centre, to the defending keep. */
export function pvpArmyPoint(map:PvpMap,progress:number,own:boolean):Vector3 {
  const cellPoint=(index:number,side:boolean)=>{const cell=map.pathCells[Math.max(0,Math.min(map.pathCells.length-1,index))]??0;return pvpWorldPoint(map,cell%map.width+.5,Math.floor(cell/map.width)+.5,side);};
  if(progress<0&&progress>-1)return cellPoint(0,!own).lerp(cellPoint(0,own),progress+1);
  const index=progress<=-1?-progress-1:progress,side=progress<=-1?!own:own;
  const whole=Math.floor(Math.max(0,index));return cellPoint(whole,side).lerp(cellPoint(whole+1,side),Math.max(0,index)-whole);
}

export class PvpBattlefield {
  readonly element = el('div', { class: 'ftd-pvp-scene' });
  private readonly canvas = el('canvas', { class: 'ftd-pvp-scene__canvas', 'aria-label': 'Straight orchard siege field. Your keep is at the bottom; drag up or down and tap a build marker.' });
  private readonly renderer: WebGLRenderer;
  private readonly graphicsRecovery:GraphicsRecovery;
  private readonly scene = new Scene();
  private readonly statusVfx=new StatusVfx();
  private readonly powerVfx = new PowerVfx(this.scene);
  private readonly turretEffects=new TurretEffects();
  private readonly seenCasts = new Map<string,number>();
  private readonly camera = new OrthographicCamera(-20, 20, 30, -30, 0.1, 200);
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly ray = new Raycaster();
  private readonly terrain = new Group();
  private readonly pieces = new Group();
  private readonly trail = new BladeTrail();
  private readonly remoteTrail = new BladeTrail();
  private readonly teammateTrails=new TeamBladeTrails();
  private readonly marker = new Mesh(new CircleGeometry(.58, 24), new MeshBasicMaterial({ color: 0xffca28, transparent: true, opacity: .5, side: DoubleSide }));
  private readonly observer: ResizeObserver;
  private readonly towers = new Map<string, { rig: TurretRig; type: string; own: boolean; cell: number; level?: number;lastFiredAt?:number }>();
  private readonly fruits = new Map<string, { mesh: Mesh; player: PlayerView; progress: number; x?: number; y?: number; boss?: boolean; attackingTower?:boolean;lastTowerHitAt?:number;fighting?:boolean;fightTargetId?:string;lastClashAt?:number;slowUntil?:number; slowMultiplier?:number; type: string; own: boolean }>();
  private readonly catchMeshes=new Map<string,Mesh>();
  private readonly catchMotion=new Map<string,NetworkMotion2D>();
  private captureDrag: { pointerId:number; itemId:string; from:{x:number;y:number} } | null=null;
  private readonly catchBox=el('div',{class:'ftd-arena-catch-box',text:'DRAG FRUIT HERE'});
  private readonly minimap=el('canvas',{class:'ftd-arena-minimap','aria-label':'Battlefield minimap. Tap to move the camera.'}) as HTMLCanvasElement;
  private readonly buildPads: Mesh[] = [];
  private readonly rangeMarker = new Mesh(new RingGeometry(.97,1,64),new MeshBasicMaterial({color:0xffda6b,transparent:true,opacity:.7,depthWrite:false}));
  private selectedCell: number | null = null;
  private readonly health = new Map<string, Mesh>();
  private readonly mainTowerMaterials: MeshLambertMaterial[] = [];
  private readonly wallMaterials: MeshLambertMaterial[] = [];
  private readonly heroArt: Array<{ key: string; userId:string; material: MeshBasicMaterial; motion:DefenderMotion }> = [];
  private readonly keepMotion=new Map<string,{motion:DefenderMotion;at:number;studio?:StudioAnimState}>();
  private snapshot: BattlefieldSnapshot;
  private config: Pick<PvpConfig, 'attacks' | 'towers'> & { wallHealth?: number; mainTower?:PvpConfig['mainTower'] };
  private readonly movement = new Map<string, NetworkMotion>();
  private readonly arenaMovement = new Map<string, NetworkMotion2D>();
  private previousAt = performance.now();
  private frame = 0;
  private disposed = false;
  private stroke: { id: number; from: { x: number; y: number }; points: Vector3[]; sliced?: boolean } | null = null;
  private trailUntil = 0;
  private sharedStrokeAt = 0;
  private remoteAt = 0;
  private readonly shots = new Map<string, number>();
  private readonly effects: Array<{ object: Mesh | Line; life: number; velocity?: Vector3; target?: Vector3 }> = [];
  private laneMin = 0;
  private laneMax = 0;
  private focusOwn = false;
  private framingInitialised = false;
  private cameraZ = 0;
  private readonly pointers = new Map<number, { x:number; y:number; startX:number; startY:number; moved:boolean }>();
  private gesture: { x:number; y:number; distance:number } | null = null;
  private readonly sideColors: Record<string,number> = { blue: COLORS.blue, red: COLORS.red };
  private mapKey = '';
  get interacting(): boolean { return this.stroke !== null || this.pointers.size > 0; }

  constructor(snapshot: BattlefieldSnapshot, config: Pick<PvpConfig, 'attacks' | 'towers'> & { wallHealth?: number; mainTower?:PvpConfig['mainTower'] }, private readonly command: (command: PvpCommand) => void, private readonly select?: (cell: number) => void) {
    this.snapshot = snapshot; this.config = config;
    refreshCreatorTurrets();
    for(const [id,stats] of Object.entries(config.towers)){if(!TURRET_WEAPONS[id as TurretKind]&&stats.chassis&&TURRET_WEAPONS[stats.chassis as TurretKind])TURRET_WEAPONS[id as TurretKind]={...TURRET_WEAPONS[stats.chassis as TurretKind],name:id,chassis:stats.chassis as any};}
    if (snapshot.shared) this.canvas.setAttribute('aria-label', 'Co-op battlefield. Tap a pad to build. Drag across incoming fruit to slice.');
    this.element.append(this.canvas, el('div', { class: 'ftd-pvp-scene__hint', text: snapshot.shared ? 'Tap a pad to build · Drag to slice' : 'Your keep · bottom  |  Rival keep · top  ·  Drag up / down' }));
    if (!snapshot.shared) {
      this.minimap.width=90;this.minimap.height=180;
      this.minimap.addEventListener('pointerdown',event=>{event.preventDefault();const rect=this.minimap.getBoundingClientRect();const fraction=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));this.cameraZ=(fraction-.5)*this.laneMax*2;this.resize();this.drawMinimap();});
      this.element.append(this.minimap,this.catchBox);
      const opponent = snapshot.players.find(player => player.side !== snapshot.yourSide);
      const opposingSide = opponent?.side || (snapshot.yourSide === 'blue' ? 'red' : 'blue');
      this.element.append(el('div', { class: `ftd-duel-team is-own is-${snapshot.yourSide}`, text: `YOUR TOWER` }), el('div', { class: `ftd-duel-team is-rival is-${opposingSide}`, text: `RIVAL TOWER` }));
      const focus = el('button', { class: 'ftd-duel-focus', type: 'button', 'data-testid':'arena-view-toggle', text: 'Rival base ↑', 'aria-label': 'Look up to the rival base' });
      focus.addEventListener('click', () => { this.focusOwn = !this.focusOwn; this.cameraZ=this.focusOwn?this.laneMax:this.laneMin; this.resize(); }); this.element.appendChild(focus);

    }
    const mobile=matchMedia('(pointer: coarse)').matches;
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: !mobile, alpha: true,powerPreference:mobile?'low-power':'high-performance' });
    const graphicsNotice=el('div',{class:'ftd-graphics-notice',role:'status',text:'Graphics interrupted. The live match continues while the browser recovers. Your connection remains active.',hidden:true});
    this.element.appendChild(graphicsNotice);
    this.graphicsRecovery=new GraphicsRecovery(this.canvas,{
      lost:()=>{graphicsNotice.hidden=false;this.canvas.style.pointerEvents='none';},
      restored:()=>{graphicsNotice.hidden=true;this.canvas.style.pointerEvents='';this.previousAt=performance.now();},
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches?1:1.5));
    this.renderer.setClearColor(0x202529, 0);
    this.scene.background = null;
    this.scene.add(new AmbientLight(0xc7deee, .85));
    const sun = new DirectionalLight(0xffd878, 1.75); sun.position.set(-18, 30, 12); this.scene.add(sun);
    const rim = new DirectionalLight(0x96d5ff, .55); rim.position.set(14, 12, -24); this.scene.add(rim);
    this.camera.position.set(0, 75, -48); this.camera.lookAt(0, 0, 0);
    this.marker.rotation.x = -Math.PI / 2;
    this.scene.add(this.statusVfx.group,this.teammateTrails.group,this.turretEffects.group,this.terrain, this.pieces, this.marker, this.trail.line, this.trail.glowLine, this.trail.sparks, this.remoteTrail.line, this.remoteTrail.glowLine, this.remoteTrail.sparks);
    this.marker.visible = false;
    this.rangeMarker.rotation.x = -Math.PI/2; this.rangeMarker.visible = false; this.scene.add(this.rangeMarker);
    const skin = findCatalogItem(loadSave().bladeSkin || 'blade-default');
    this.trail.applySlicer(skin?.slicer);
    this.remoteTrail.setColor(snapshot.shared ? COLORS.blue : COLORS.red);
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.element);
    this.canvas.addEventListener('pointerdown', this.pointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.pointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.pointerUp.bind(this));
    this.canvas.addEventListener('pointercancel', this.pointerCancel.bind(this));
    this.canvas.addEventListener('wheel', this.wheel, { passive: false });
    this.update(snapshot, config);
    this.frame = requestAnimationFrame(this.animate);
  }

  update(snapshot: BattlefieldSnapshot, config: Pick<PvpConfig, 'attacks' | 'towers'> & { wallHealth?: number; mainTower?:PvpConfig['mainTower'] }): void {
    const previousPhase=this.snapshot.phase;
    this.snapshot = snapshot; this.config = config;
    if(previousPhase==='capture'&&snapshot.phase!=='capture'&&this.framingInitialised){this.cameraZ=this.laneMax;this.resize();}
    this.catchBox.hidden=snapshot.phase!=='capture';this.minimap.hidden=Boolean(snapshot.shared);
    refreshCreatorTurrets();
    for(const [id,stats] of Object.entries(config.towers)){if(!TURRET_WEAPONS[id as TurretKind]&&stats.chassis&&TURRET_WEAPONS[stats.chassis as TurretKind])TURRET_WEAPONS[id as TurretKind]={...TURRET_WEAPONS[stats.chassis as TurretKind],name:id,chassis:stats.chassis as any};}
    const receivedAt = performance.now();
    const map = snapshot.map; if (!map) return;
    this.syncCatchables(map);
    this.drawMinimap();
    const terrainKey = JSON.stringify([map, snapshot.players.map(p => [p.hero, p.wallSkin, p.mainLevel])]);
    if (this.mapKey !== terrainKey) { this.mapKey = terrainKey; this.buildTerrain(map); }
    if(snapshot.sharedStrokes)this.teammateTrails.sync(snapshot.sharedStrokes,(x,y)=>{const point=pvpWorldPoint(map,x,y,true);point.y=.8;return point;});
    if (snapshot.sharedStroke && snapshot.sharedStroke.at > this.remoteAt) {
      this.remoteAt = snapshot.sharedStroke.at;
      const a = pvpWorldPoint(map, snapshot.sharedStroke.from.x, snapshot.sharedStroke.from.y, true);
      const b = pvpWorldPoint(map, snapshot.sharedStroke.to.x, snapshot.sharedStroke.to.y, true);
      a.y = b.y = .8; this.remoteTrail.sync([a, b]);
    }
    for(const pad of this.terrain.children){
      if(pad.userData.ownerId)pad.visible=!snapshot.players.find(player=>player.userId===pad.userData.ownerId)?.towers.some(tower=>tower.cell===pad.userData.cell);
    }
    const towerIds = new Set<string>(); const fruitIds = new Set<string>();
    for (const player of snapshot.players) {
      const own = player.side === snapshot.yourSide;
      for(const cast of player.powerCasts??[]){
        if(this.seenCasts.has(cast.id))continue;this.seenCasts.set(cast.id,cast.at);
        const ability=heroAbility(cast.abilityId);if(!ability)continue;
        const origin=pvpWorldPoint(map,map.width/2,map.height+1,own);origin.y=.7;
        this.heroArt.find(hero=>hero.userId===player.userId)?.motion.fire();
        this.powerVfx.spawn(ability,cast.rank,origin,cast.targets.map(point=>{const p=snapshot.rulesVersion===2?arenaWorldPoint(map,point.x,point.y,snapshot.yourSide):point.progress!==undefined?pvpArmyPoint(map,point.progress,own):pvpWorldPoint(map,point.x,point.y,own);p.y=.7;return p;}),Math.max(0,(Date.now()-cast.at)/1000));
      }
      for(const [id,at] of this.seenCasts)if(Date.now()-at>10000)this.seenCasts.delete(id);
      const keep=this.keepMotion.get(player.userId);
      if(keep && (player.mainLastFiredAt??0)>keep.at){
        keep.at=player.mainLastFiredAt!;keep.motion.fire();
        const source=new Vector3();keep.motion.group.parent?.getWorldPosition(source);
        const target=[...this.fruits.values()].filter(f=>f.own===own).sort((a,b)=>a.mesh.position.distanceTo(source)-b.mesh.position.distanceTo(source))[0];
        if(target){const d=target.mesh.position.clone().sub(source);if(keep.motion.group.parent)keep.motion.group.parent.userData.combatAim={x:d.x,z:d.z};this.turretEffects?.shot('main',source,target.mesh.position,player.mainLevel);}
      }
      const hp = this.health.get(player.userId);
      if (hp) {
        if (hp.userData.lastHealth !== undefined && player.wallHealth < hp.userData.lastHealth) {
          sharedSfx.leak();
          const origin = new Vector3(); hp.getWorldPosition(origin); origin.y = 1;
          this.showTowerDamage(origin,hp.userData.lastHealth-player.wallHealth,own);
          const count = player.wallHealth <= 0 ? 36 : 10;
          for (let i = 0; i < count; i++) {
            const shard = new Mesh(new PlaneGeometry(.18,.18), new MeshBasicMaterial({ color:i % 2 ? 0xffca28 : 0xf48120, side: DoubleSide }));
            shard.position.copy(origin); this.scene.add(shard);
            const angle = i / count * Math.PI * 2;
            this.effects.push({ object:shard, life:player.wallHealth <= 0 ? 2 : .65, velocity:new Vector3(Math.cos(angle)*6,3+i%4,Math.sin(angle)*6) });
          }
          if (player.wallHealth <= 0) hp.parent?.traverse(object => { if (object instanceof Mesh && object !== hp) object.visible = false; });
        }
        hp.userData.lastHealth = player.wallHealth;
        hp.userData.rail.set(player.wallHealth / Number(hp.userData.maxHealth));
      }
      for (const tower of player.towers) {
        towerIds.add(tower.id);
        if (!this.towers.has(tower.id) && (tower.type === 'catcher' || TURRETS.some((item) => item.kind === tower.type))) {
          const rig = new TurretRig(tower.type === 'catcher' ? 'vortex' : tower.type as TurretKind);
          if (tower.type === 'catcher') {
            while (rig.group.children.length) this.release(rig.group.children[0] as Mesh);
            const marker = new Mesh(new CircleGeometry(.6, 40), new MeshBasicMaterial({ color: 0x99b89a, side: DoubleSide })); marker.position.y = .7; marker.add(combatTokenFrame(.6, 'tower')); rig.group.add(marker);
          }
          const bodies: Mesh[] = []; rig.group.traverse((object) => { if (object instanceof Mesh) bodies.push(object); });
          for (const object of bodies) { if (object.userData.combatFrame) continue; const outline = new Mesh(object.geometry, new MeshBasicMaterial({ color: 0x07110b, side: BackSide })); outline.scale.setScalar(1.06); object.add(outline); }
          rig.group.position.copy(this.cellPoint(tower.cell, own)); rig.group.scale.setScalar(1.15);
          const pad = new Mesh(new PlaneGeometry(1.4,.2), new MeshLambertMaterial({ color: this.sideColors[player.side] ?? 0xa3e635, side: DoubleSide }));
          rig.group.add(pad); this.pieces.add(rig.group); this.towers.set(tower.id, { rig, type: tower.type, own, cell: tower.cell, level: pvpTowerLevel(tower.level) });
        }
        const entry = this.towers.get(tower.id);
        if (entry) { entry.rig.group.position.copy(this.cellPoint(tower.cell,own));entry.level = pvpTowerLevel(tower.level);entry.lastFiredAt=tower.lastFiredAt; entry.rig.group.scale.setScalar(1.15 + (entry.level - 1) * .14); }
      }
      for (const fruit of player.attackers) {
        fruitIds.add(fruit.id);
        let entry = this.fruits.get(fruit.id);
        if (!entry) {
          if(fruit.boss)sharedSfx.enemyWarning();
          const kind = (fruit.fruitKind && fruit.fruitKind in FRUIT_DEFS ? fruit.fruitKind : fruit.type === 'swift' ? 'strawberry' : fruit.type === 'armored' ? 'watermelon' : fruit.type === 'explosive' ? 'bomb' : 'orange') as keyof typeof FRUIT_DEFS;
          const def = FRUIT_DEFS[kind];
          const texture = sampleStudioTexture(enemyKindToStudioKey((fruit.sliceOnly?'bladebound':fruit.type) as Parameters<typeof enemyKindToStudioKey>[0])) || getAdminTexture(`enemy-${fruit.type}` as Parameters<typeof getAdminTexture>[0]) || enemyPortrait(kind,fruit.boss) || fruitAtlas.tile(...def.skin);
          const teamColor = player.side === 'blue' ? COLORS.red : COLORS.blue;
          const size = (fruit.type === 'armored' ? 1.36 : .96) * (fruit.boss ? 1.7 : 1);
          const mesh = new Mesh(new CircleGeometry(size / 2, 40), new MeshLambertMaterial({ color: texture ? 0xffffff : def.color, map: texture, transparent: true, side: DoubleSide, depthWrite: false }));
          mesh.userData.combatPortrait=true;
          mesh.userData.networkId=fruit.id;
          const token=combatTokenFrame(size / 2, fruit.boss ? 'boss' : 'fruit');
          if(fruit.sliceOnly){const rim=token.getObjectByName('token-rim') as Mesh;(rim.material as MeshBasicMaterial).color.setHex(0xf472b6);}
          mesh.add(token);
          const shadow = new Mesh(new CircleGeometry(fruit.type === 'armored' ? .78 : .58, 16), new MeshBasicMaterial({color:0x06130d,transparent:true,opacity:.28,depthWrite:false}));
          shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.56; mesh.add(shadow);
          if (!snapshot.shared) {
            const allegiance = new Mesh(new RingGeometry(.48,.59,16),new MeshBasicMaterial({color:teamColor,transparent:true,opacity:.9,depthWrite:false}));
            allegiance.rotation.x=-Math.PI/2;allegiance.position.y=-.54;mesh.add(allegiance);
          }
            const bar = new Group(); bar.position.y = .85;
            const back = new Mesh(new PlaneGeometry(.85, .08), new MeshBasicMaterial({ color: 0x07120b, side: DoubleSide }));
            const fill = new Mesh(new PlaneGeometry(.75, .045), new MeshBasicMaterial({ color: 0x9bd65b, side: DoubleSide }));
            bar.add(back, fill); mesh.add(bar); mesh.userData.hpBar = bar; mesh.userData.hpFill = fill;
          this.pieces.add(mesh); entry = { mesh, player, progress: fruit.progress, type: fruit.type, own }; this.fruits.set(fruit.id, entry);
        }
        const hpBar = entry.mesh.userData.hpBar as Group | undefined;
        if (hpBar) {
          const fraction = Math.max(0, Math.min(1, (fruit.hp ?? 1) / (fruit.maxHp ?? this.config.attacks[fruit.type]?.health ?? 1)));
          hpBar.visible = fraction < .99999;
          if (typeof entry.mesh.userData.hp === 'number' && (fruit.hp ?? 0) < entry.mesh.userData.hp) entry.mesh.userData.hitAt = performance.now();
          entry.mesh.userData.hp = fruit.hp;
          const fill = entry.mesh.userData.hpFill as Mesh; fill.scale.x = Math.max(.01, fraction); fill.position.x = -(1 - fraction) * .375;
        }
        this.statusVfx.sync(fruit.id,entry.mesh,fruit,Date.now());
        entry.player = player; entry.progress = fruit.progress; entry.x = fruit.x; entry.y = fruit.y; entry.boss = fruit.boss;entry.attackingTower=fruit.attackingTower;entry.lastTowerHitAt=fruit.lastTowerHitAt;entry.fighting=fruit.fighting;entry.fightTargetId=fruit.fightTargetId;entry.lastClashAt=fruit.lastClashAt;entry.slowUntil=fruit.slowUntil;entry.slowMultiplier=fruit.slowMultiplier;
        let motion = this.movement.get(fruit.id);
        if (!motion) { motion = new NetworkMotion(); this.movement.set(fruit.id, motion); }
        const slow = Date.now() < (fruit.slowUntil ?? 0) ? fruit.slowMultiplier ?? (snapshot.shared ? .45 : .55) : 1;
        const speed = fruit.fighting || fruit.attackingTower ? 0 : (fruit.movementSpeed ?? (config.attacks[fruit.type]?.speed || 0)
          * (snapshot.shared ? fruit.boss ? .35 : .65 : Math.max(1, (map.pathCells.length - 1) / 13))) * slow;
        const stamp = snapshot.revision ?? JSON.stringify([fruit.progress, fruit.x, fruit.y, fruit.fighting, fruit.attackingTower, fruit.slowUntil]);
        motion.update(snapshot.shared ? fruit.y ?? fruit.progress : fruit.progress, speed, stamp, receivedAt);
        if (snapshot.rulesVersion === 2 && fruit.x !== undefined && fruit.y !== undefined) {
          let arenaMotion = this.arenaMovement.get(fruit.id);
          if (!arenaMotion) { arenaMotion = new NetworkMotion2D(); this.arenaMovement.set(fruit.id, arenaMotion); }
          const maxSpeed = config.attacks[fruit.type]?.speed ?? 2;
          arenaMotion.update(fruit.x, fruit.y, maxSpeed, stamp, receivedAt, Boolean(fruit.fighting || fruit.attackingTower));
        }
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
      this.movement.delete(id); this.arenaMovement.delete(id);
      const captured = snapshot.players.some(player => player.captured?.some(item => item.id === `captured:${id}`));
      if (captured) {
        const cage = [...this.towers.values()].filter(tower => tower.own === entry.own && tower.type === 'catcher').sort((a, b) => a.rig.group.position.distanceTo(entry.mesh.position) - b.rig.group.position.distanceTo(entry.mesh.position))[0];
        const orb = new Mesh(new PlaneGeometry(.6, .6), new MeshBasicMaterial({ color: 0xc3ff5c, side: DoubleSide }));
        orb.position.copy(entry.mesh.position); this.scene.add(orb); this.effects.push({ object: orb, life: .5, target: cage?.rig.group.position.clone().add(new Vector3(0, .8, 0)) });
      } else if (snapshot.shared || entry.progress < map.pathCells.length - 1) {
        if(entry.type==='explosive'||entry.type==='chainburst')sharedSfx.bombExplode();else sharedSfx.play('Impact-Orange',{volume:.16});
        this.turretEffects?.burst(entry.mesh.position,0xffc95b);
        for (let i = 0; i < 6; i++) {
          const piece = new Mesh(new PlaneGeometry(.22,.22), new MeshBasicMaterial({ color: entry.type === 'armored' ? 0x8aff44 : 0xffa533, side: DoubleSide }));
          piece.position.copy(entry.mesh.position); this.scene.add(piece);
          this.effects.push({ object: piece, life: .35, velocity: new Vector3(Math.cos(i) * 3, 2, Math.sin(i) * 3) });
        }
      }
      this.release(entry.mesh); this.fruits.delete(id); this.shots.delete(id);
    }
  }

  private cellPoint(cell: number, own: boolean): Vector3 {
    const map = this.snapshot.map!;
    if(this.snapshot.rulesVersion===2){const side=own?this.snapshot.yourSide:this.snapshot.yourSide==='blue'?'red':'blue';const row=Math.floor(cell/map.width),globalRow=side==='blue'?24+row:23-row;const y=(side==='blue'?1:-1)*(row+.5);return arenaWorldPoint(map,cell%map.width+.5+(globalRow%2?.5:0),y,this.snapshot.yourSide);}
    return pvpWorldPoint(map, cell % map.width + .5, Math.floor(cell / map.width) + .5, own);
  }

  private syncCatchables(map:PvpMap):void {
    const live=new Set<string>();
    if(this.snapshot.phase==='capture')for(const item of this.snapshot.catchables??[]){
      live.add(item.id);let mesh=this.catchMeshes.get(item.id);
      if(!mesh){
        const kind=(item.fruitKind in FRUIT_DEFS?item.fruitKind:'orange') as keyof typeof FRUIT_DEFS;
        const texture=sampleStudioTexture(enemyKindToStudioKey(item.type as Parameters<typeof enemyKindToStudioKey>[0]))||enemyPortrait(kind,false)||fruitAtlas.tile(...FRUIT_DEFS[kind].skin);
        mesh=new Mesh(new CircleGeometry(.57,32),new MeshLambertMaterial({color:0xffffff,map:texture,transparent:true,side:DoubleSide,depthWrite:false}));
        mesh.userData.combatPortrait=true;mesh.add(combatTokenFrame(.57));this.pieces.add(mesh);this.catchMeshes.set(item.id,mesh);
      }
      let motion=this.catchMotion.get(item.id);if(!motion){motion=new NetworkMotion2D();this.catchMotion.set(item.id,motion);}
      motion.update(item.x,item.y,1.8,JSON.stringify([item.x,item.y]),performance.now());
      if(this.captureDrag?.itemId!==item.id){const at=motion.sample(performance.now());mesh.position.copy(pvpWorldPoint(map,at.x,at.y,true));mesh.position.y=.8;}
    }
    for(const [id,mesh] of this.catchMeshes)if(!live.has(id)){this.release(mesh);this.catchMeshes.delete(id);this.catchMotion.delete(id);}
  }
  private drawMinimap():void {
    if(this.snapshot.shared||!this.snapshot.map||!this.minimap)return;
    const map=this.snapshot.map,ctx=this.minimap.getContext('2d');if(!ctx)return;
    const w=this.minimap.width,h=this.minimap.height;ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#0a1717ec';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#deca8c99';ctx.strokeRect(.5,.5,w-1,h-1);
    ctx.strokeStyle='#eed27466';ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    const xy=(x:number,y:number)=>({x:8+x/map.width*(w-16),y:h/2-y/24*(h/2-8)});
    for(const cell of map.solidCells??[])for(const sign of [-1,1]){const p=xy(cell%map.width+.5,sign*(Math.floor(cell/map.width)+.5));ctx.fillStyle='#81765d';ctx.fillRect(p.x-2,p.y-2,4,4);}
    for(const hazard of map.hazards??[])for(const sign of [-1,1]){const p=xy(hazard.cell%map.width+.5,sign*(Math.floor(hazard.cell/map.width)+.5));ctx.fillStyle=hazard.kind==='slow'?'#69c5df':'#ec8a42';ctx.fillRect(p.x-2,p.y-1,4,2);}
    for(const player of this.snapshot.players){const own=player.side===this.snapshot.yourSide;ctx.fillStyle=own?'#49c6ff':'#ff727d';const sign=own?1:-1;
      for(const tower of player.towers){const p=xy(tower.cell%map.width+.5,sign*(Math.floor(tower.cell/map.width)+.5));ctx.fillRect(p.x-2,p.y-2,4,4);}
      for(const unit of player.attackers){if(unit.x===undefined||unit.y===undefined)continue;const p=xy(unit.x,unit.y*(this.snapshot.yourSide==='blue'?1:-1));ctx.beginPath();ctx.arc(p.x,p.y,unit.boss?3:1.5,0,Math.PI*2);ctx.fill();}
    }
    for(const side of [-1,1]){const p=xy(map.width/2,side*23);ctx.fillStyle=side===1?'#49c6ff':'#ff727d';ctx.fillRect(p.x-5,p.y-2,10,4);}
    const top=xy(5,Math.min(24,(this.cameraZ+(this.camera.top-this.camera.bottom)/1.7)/TILE));const bottom=xy(5,Math.max(-24,(this.cameraZ-(this.camera.top-this.camera.bottom)/1.7)/TILE));ctx.strokeStyle='#ffe996';ctx.strokeRect(2,Math.min(top.y,bottom.y),w-4,Math.abs(bottom.y-top.y));
  }
  private buildTerrain(map: PvpMap): void {
    while (this.terrain.children.length) this.release(this.terrain.children[0] as Group);
    this.health.clear(); this.buildPads.length = 0; this.mainTowerMaterials.length = 0; this.wallMaterials.length = 0; this.heroArt.length = 0; this.keepMotion.clear();
    const fullLength = (map.height + 4) * TILE * (this.snapshot.shared ? 1 : 2);
    const fullWidth = map.width * TILE_X + 5;
    const edgeMode = this.snapshot.shared ? 'all-edges' : 'outer-edges';
    const floor = new Mesh(new PlaneGeometry(fullWidth, fullLength), blendBattlefieldEdges(new MeshBasicMaterial({ color:0xffffff, map:battlefieldTexture(), side:DoubleSide }), edgeMode));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.05; floor.renderOrder=-100;
    if (this.snapshot.shared) floor.position.z = (map.height + 2) * TILE / 2;
    if (!this.snapshot.shared) {
      // Repeat the Casual scene once per half instead of stretching one image.
      floor.geometry.dispose(); floor.geometry = new PlaneGeometry(fullWidth, fullLength / 2);
      floor.position.z = fullLength / 4;
      const rivalFloor = new Mesh(floor.geometry.clone(), blendBattlefieldEdges((floor.material as MeshBasicMaterial).clone(), edgeMode));
      rivalFloor.rotation.set(-Math.PI / 2, 0, Math.PI); rivalFloor.position.set(0, -.05, -fullLength / 4); rivalFloor.renderOrder=-100;
      this.terrain.add(rivalFloor);
    }
    this.terrain.add(floor);
    if(this.snapshot.rulesVersion===2&&!this.snapshot.shared){
      const lines:Vector3[]=[];
      for(const player of this.snapshot.players){const own=player.side===this.snapshot.yourSide;
        for(const cell of map.buildCells){
          const row=Math.floor(cell/map.width),col=cell%map.width;
          const point=this.cellPoint(row*map.width+col,own);
          for(let edge=0;edge<6;edge++){const a=edge*Math.PI/3+Math.PI/6,b=(edge+1)*Math.PI/3+Math.PI/6;lines.push(new Vector3(point.x+Math.cos(a)*.66*TILE,.035,point.z+Math.sin(a)*.66*TILE),new Vector3(point.x+Math.cos(b)*.66*TILE,.035,point.z+Math.sin(b)*.66*TILE));}
        }
        for(const cell of map.solidCells??[]){
          const point=this.cellPoint(cell,own),solid=arenaObstacle(map.id,cell);
          solid.position.copy(point);this.terrain.add(solid);
        }
        for(const hazard of map.hazards??[]){const point=this.cellPoint(hazard.cell,own);const patch=new Mesh(new CircleGeometry(.62*TILE,6),new MeshBasicMaterial({color:hazard.kind==='slow'?0x66c5dd:0xd58b55,transparent:true,opacity:.2,side:DoubleSide,depthWrite:false}));patch.rotation.x=-Math.PI/2;patch.position.copy(point);patch.position.y=.055;this.terrain.add(patch);
          const cue=new Group();cue.position.copy(point);cue.position.y=.09;
          if(hazard.kind==='damage')for(let i=0;i<3;i++){const pebble=new Mesh(new SphereGeometry(.12+i*.035,6,4),new MeshLambertMaterial({color:i%2?0xa29378:0x6d6559}));pebble.position.set((i-1)*.34,.12,(i%2?-.24:.2));cue.add(pebble);}
          else for(let i=0;i<2;i++){const ripple=new Mesh(new RingGeometry(.26+i*.23,.29+i*.23,20),new MeshBasicMaterial({color:0x9ce7ef,transparent:true,opacity:.5,side:DoubleSide}));ripple.rotation.x=-Math.PI/2;ripple.position.set((i?-.15:.22),.01,(i?.18:-.14));cue.add(ripple);}
          this.terrain.add(cue);
        }
      }
      const grid=new LineSegments(new BufferGeometry().setFromPoints(lines),new LineBasicMaterial({color:0xe5d99b,transparent:true,opacity:.035,depthWrite:false}));this.terrain.add(grid);
    }
    if(this.snapshot.shared)this.terrain.add(battleScenery(fullWidth,fullLength,floor.position.z));

    for (const player of this.snapshot.players) {
      const own = player.side === this.snapshot.yourSide;
      const teamColor = this.snapshot.shared?0xffe394:COLORS[player.side as keyof typeof COLORS]??COLORS.blue;
      // Both players get ten readable plots; only your own plots are pickable.
      for (const cell of map.buildCells.filter(cell=>this.snapshot.shared||this.snapshot.rulesVersion===2||pvpBuildCellAllowed(map,cell))) {
        const pad=this.snapshot.rulesVersion===2&&!this.snapshot.shared?new Mesh(new RingGeometry(.52,.59,6),new MeshBasicMaterial({color:0xffdf89,transparent:true,opacity:own?.07:.025,side:DoubleSide,depthWrite:false})):createBuildPad();
        if(this.snapshot.rulesVersion===2&&!this.snapshot.shared)pad.rotation.x=-Math.PI/2;
        pad.position.copy(this.cellPoint(cell, own));pad.position.y=.16;
        pad.userData.cell=cell;pad.userData.ownerId=player.userId;
        this.terrain.add(pad);if(own)this.buildPads.push(pad);
      }

      // The shared Casual battlefield texture already contains the road.
      const endpoint = this.cellPoint(map.pathCells.at(-1) ?? (map.height - 1) * map.width + Math.floor(map.width / 2), own);
      endpoint.z += own ? TILE * 1.5 : -TILE * 1.5;
      const gateX = endpoint.x;
      const base = new Group(); base.position.copy(endpoint); base.position.x = 0;
      const wall = new Mesh(new PlaneGeometry(map.width * TILE_X, 1.05), new MeshLambertMaterial({ color: WALL_SKINS.find(skin => skin.id === player.wallSkin)?.color ?? 0x9a4034, side: DoubleSide }));
      const wallSkin = WALL_SKINS.find(skin => skin.id === player.wallSkin) || WALL_SKINS[0]!;
      if (typeof Image !== 'undefined' && wallSkin.texture) {
        const texture = new TextureLoader().load(wallSkin.texture); texture.colorSpace = SRGBColorSpace;
        (wall.material as MeshLambertMaterial).map = texture; (wall.material as MeshLambertMaterial).color.setHex(0xffffff);
      }
      wall.userData.combatPortrait = true;
      (wall.material as MeshLambertMaterial).userData.creatorWallAllowed=wallSkin.id===WALL_SKINS[0]!.id;
      this.wallMaterials.push(wall.material as MeshLambertMaterial);
      wall.position.y = .5;
      const keep = new Mesh(new CircleGeometry(1.1, 48), new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide, transparent: true }));
      this.mainTowerMaterials.push(keep.material as MeshLambertMaterial);
      keep.userData.combatPortrait=true;
      keep.add(combatTokenFrame(1.1, 'tower'));
      this.keepMotion.set(player.userId,{motion:new DefenderMotion(keep,'tower'),at:player.mainLastFiredAt??0});
      const keepLevel=this.snapshot.shared?Math.max(1,Math.min(10,Math.floor(player.mainLevel||1))):pvpTowerLevel(player.mainLevel);
      keep.position.set(gateX,1.2,0);keep.scale.setScalar(1+Math.min(4,keepLevel-1)*.12);
      const towerTexture = sampleStudioTexture(`tower-main-level-${keepLevel}`)||sampleStudioTexture('tower-main') || getAdminTexture('tower-main') || characterPortrait('tower'); if (towerTexture) (keep.material as MeshLambertMaterial).map = towerTexture;
      const hero = heroDef((player.hero || 'jiju') as HeroId);
      const heroKey = heroIdToStudioKey(hero.id);
      const heroTexture = sampleStudioTexture(heroKey, 'idle') || getAdminTexture(`hero-${hero.id}`) || characterPortrait(hero.id);
      const heroMaterial = new MeshBasicMaterial({ color: heroTexture ? 0xffffff : hero.color, map: heroTexture, transparent: true, side: DoubleSide });
      const avatar = new Mesh(new CircleGeometry(1.25, 48), heroMaterial);
      avatar.userData.combatPortrait=true;
      const avatarFrame=combatTokenFrame(1.25, 'hero');
      const rim=avatarFrame.getObjectByName('token-rim') as Mesh;
      (rim.material as MeshBasicMaterial).color.setHex(teamColor);avatar.add(avatarFrame);
      avatar.position.set(gateX, 4, 0); base.add(avatar);
      const motion=new DefenderMotion(avatar,'hero',hero.color);motion.setHero(hero.id,hero.color);
      this.heroArt.push({key:heroKey,userId:player.userId,material:heroMaterial,motion});
      const healthRail=towerHealthRail(map.width*TILE_X,teamColor);
      healthRail.group.position.z=own?1.1:-1.1;
      const rail=healthRail.fill;
      rail.userData.maxHealth=player.wallMaxHealth??this.config.wallHealth??player.wallHealth;
      rail.userData.rail=healthRail;
      this.health.set(player.userId,rail);
      base.add(wall,keep,healthRail.group);this.terrain.add(base);
    }
    if(!this.snapshot.shared){
      const seam=new Mesh(new PlaneGeometry(map.width*TILE_X,.09),new MeshBasicMaterial({color:0xffe394,transparent:true,opacity:.5}));seam.rotation.x=-Math.PI/2;seam.position.y=.025;this.terrain.add(seam);
    }
    this.resize();
  }
  private showTowerDamage(world:Vector3,amount:number,own:boolean):void {
    const point=world.clone().project(this.camera);
    if(Math.abs(point.x)>1||Math.abs(point.y)>1)return;
    const label=el('span',{class:`ftd-tower-damage ${own?'is-own':'is-rival'}`,text:`−${Math.max(1,Math.round(amount))}`,'aria-hidden':'true',style:`left:${(point.x+1)*50}%;top:${(1-point.y)*50}%`});
    this.element.querySelectorAll('.ftd-tower-damage').forEach((node,index)=>{if(index>=5)node.remove();});
    this.element.append(label);label.addEventListener('animationend',()=>label.remove(),{once:true});
  }
  private point(event: PointerEvent): { x: number; y: number } | null {
    const map = this.snapshot.map; if (!map) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
    const hit = this.ray.ray.intersectPlane(this.ground, new Vector3()); if (!hit) return null;
    const y = hit.z / TILE - 1; const x = hit.x / TILE_X + Math.floor(map.width / 2) - .5;
    return x >= -1e-6 && x <= map.width+1e-6 && y >= -1e-6 && y <= map.height+1e-6 ? { x:Math.max(0,Math.min(map.width,x)), y:Math.max(0,Math.min(map.height,y)) } : null;
  }

  private buildCell(event: PointerEvent): number | null {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), this.camera);
    const hit = this.ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -.16), new Vector3());
    if (!hit) return null;
    const radius = HEX_RADIUS * .985;
    for (const pad of this.buildPads) {
      if(!pad.visible||(!this.snapshot.shared&&this.snapshot.rulesVersion!==2&&!pvpBuildCellAllowed(this.snapshot.map!,Number(pad.userData.cell))))continue;
      const dx = hit.x - pad.position.x; const dz = hit.z - pad.position.z;
      if (Math.hypot(dx,dz) <= radius) return Number(pad.userData.cell);
    }
    return null;
  }

  private towerCell(event: PointerEvent): number | null {
    const map = this.snapshot.map; const rect = this.canvas.getBoundingClientRect();
    if (!map || !rect.width || !rect.height) return null;
    const point = new Vector3();
    this.camera.updateMatrixWorld(true);
    let nearest: { cell: number; distance: number } | null = null;
    for (const player of this.snapshot.players.filter(item => item.side === this.snapshot.yourSide)) for (const tower of player.towers) {
      point.copy(this.cellPoint(tower.cell, true)); point.y = 1.1; point.project(this.camera);
      const x = rect.left + (point.x + 1) * rect.width / 2; const y = rect.top + (1 - point.y) * rect.height / 2;
      const distance = Math.hypot(event.clientX - x, event.clientY - y);
      if (distance <= Math.max(20, Math.min(38, rect.width * .075)) && (!nearest || distance < nearest.distance)) nearest = { cell: tower.cell, distance };
    }
    if(!nearest&&!this.snapshot.shared&&map.pathCells.length){
      const base=this.cellPoint(map.pathCells.at(-1)!,true);base.z+=TILE*1.5;base.y=1.2;base.project(this.camera);
      const distance=Math.hypot(event.clientX-(rect.left+(base.x+1)*rect.width/2),event.clientY-(rect.top+(1-base.y)*rect.height/2));
      if(distance<=26)return -1;
    }
    return nearest?.cell ?? null;
  }

  private pointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    if(this.snapshot.phase==='capture'&&!this.snapshot.shared){
      const rect=this.canvas.getBoundingClientRect();let nearest:{id:string;distance:number;from:{x:number;y:number}}|null=null;
      for(const item of this.snapshot.catchables??[]){const mesh=this.catchMeshes.get(item.id);if(!mesh)continue;const at=mesh.position.clone().project(this.camera);const distance=Math.hypot(event.clientX-(rect.left+(at.x+1)*rect.width/2),event.clientY-(rect.top+(1-at.y)*rect.height/2));if(distance<42&&(!nearest||distance<nearest.distance))nearest={id:item.id,distance,from:{x:item.x,y:item.y}};}
      if(nearest){this.captureDrag={pointerId:event.pointerId,itemId:nearest.id,from:nearest.from};this.canvas.setPointerCapture(event.pointerId);this.catchBox.classList.add('is-target');return;}
    }
    if (!this.snapshot.shared) { this.canvas.setPointerCapture(event.pointerId); this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,moved:false}); this.resetGesture(); this.stroke=null; return; }
    const point = this.point(event); if (!point) return;
    this.canvas.setPointerCapture(event.pointerId);
    this.stroke = { id: event.pointerId, from: point, points: [] }; this.trail.reset();
  }
  private pointerMove(event: PointerEvent): void {
    if(this.captureDrag?.pointerId===event.pointerId){const point=this.point(event);const mesh=this.catchMeshes.get(this.captureDrag.itemId);if(point&&mesh){mesh.position.copy(pvpWorldPoint(this.snapshot.map!,point.x,point.y,true));mesh.position.y=1.3;}return;}
    if (!this.snapshot.shared && this.pointers.has(event.pointerId)) {
      const p=this.pointers.get(event.pointerId)!;p.x=event.clientX;p.y=event.clientY;const active=[...this.pointers.values()];
      if(active.length===1){const a=active[0]!;if(Math.hypot(a.x-a.startX,a.y-a.startY)>7)a.moved=true;if(a.moved)this.panBy(a.x-(this.gesture?.x??a.x),a.y-(this.gesture?.y??a.y));this.gesture={x:a.x,y:a.y,distance:0};}
      else if(active.length>=2){const a=active[0]!,c=active[1]!,x=(a.x+c.x)/2,y=(a.y+c.y)/2,d=Math.hypot(a.x-c.x,a.y-c.y);if(this.gesture&&this.gesture.distance>0){this.panBy(x-this.gesture.x,y-this.gesture.y);}a.moved=c.moved=true;this.gesture={x,y,distance:d};}return;
    }
    const point = this.point(event); const map = this.snapshot.map!;
    if (point && this.selectedCell === null) {
      const cell = this.buildCell(event);
      this.marker.visible = cell !== null;
      if (cell !== null && cell>=0) { this.marker.position.copy(this.cellPoint(cell, true)); this.marker.position.y = .21; }
    }
    if (!this.stroke || this.stroke.id !== event.pointerId || !point) return;
    if (!this.snapshot.shared) { if (Math.hypot(point.x - this.stroke.from.x, point.y - this.stroke.from.y) >= .5) this.stroke.sliced = true; return; }
    const world = pvpWorldPoint(map, point.x, point.y, true); world.y = .8;
    if (!this.stroke.points.length) { const start = pvpWorldPoint(map, this.stroke.from.x, this.stroke.from.y, true); start.y = .8; this.stroke.points.push(start); }
    this.stroke.points.push(world); if (this.stroke.points.length > 16) this.stroke.points.shift();
    this.trail.sync(this.stroke.points); this.trailUntil = performance.now() + 200;
    if (performance.now() - this.sharedStrokeAt > 120 && Math.hypot(point.x - this.stroke.from.x, point.y - this.stroke.from.y) >= .5) {
      this.selectCell(null);this.sharedStrokeAt = performance.now(); this.command({ type: 'slash', from: this.stroke.from, to: point });
      this.stroke.from = point; this.stroke.sliced = true;
    }
  }
  private pointerUp(event: PointerEvent): void {
    if(this.captureDrag?.pointerId===event.pointerId){const drag=this.captureDrag;this.captureDrag=null;this.catchBox.classList.remove('is-target');const rect=this.catchBox.getBoundingClientRect();if(event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom)this.command({type:'catch',catchableId:drag.itemId,from:drag.from,to:{x:9,y:22}});else this.syncCatchables(this.snapshot.map!);return;}
    if(!this.snapshot.shared&&this.pointers.has(event.pointerId)){const p=this.pointers.get(event.pointerId)!;const tap=!p.moved&&Math.hypot(event.clientX-p.startX,event.clientY-p.startY)<=8&&this.pointers.size===1;this.pointers.delete(event.pointerId);this.resetGesture();if(tap){const tower=this.towerCell(event);if(tower!==null){this.select?.(tower);return;}const cell=this.buildCell(event);if(cell!==null){if(this.select)this.select(cell);else this.command({type:'build',tower:this.element.dataset.tower||'guillotine',cell});}else this.selectCell(null);}return;}
    const stroke = this.stroke; this.stroke = null;
    if (!stroke || stroke.id !== event.pointerId) return;
    const to = this.point(event); if (!to) return;
    const distance = Math.hypot(to.x - stroke.from.x, to.y - stroke.from.y);
    if(this.snapshot.shared&&distance>=.5)this.selectCell(null);
    if (this.snapshot.shared && distance >= .5 && performance.now() - this.sharedStrokeAt >= 100) this.command({ type: 'slash', from: stroke.from, to });
    else if (!stroke.sliced && distance < .5) {
      const existing=this.towerCell(event);
      if(existing!==null&&this.select){this.select(existing);return;}
      const cell = this.buildCell(event);
      if (cell !== null) {
        if (this.select) this.select(cell);
        else this.command({ type: 'build', tower: this.element.dataset.tower || 'guillotine', cell });
      }else this.selectCell(null);
    }
  }
  selectCell(cell: number | null): void {
    this.selectedCell = cell; this.marker.visible = cell !== null && cell>=0;
    this.rangeMarker.visible = false;
    const own=this.snapshot.players.find(player=>player.side===this.snapshot.yourSide);
    if(cell===-1&&own&&this.snapshot.map&&this.config.mainTower){
      const end=this.snapshot.map.pathCells.at(-1);
      if(end!==undefined){this.rangeMarker.position.copy(this.cellPoint(end,true));this.rangeMarker.position.y=.18;this.rangeMarker.scale.setScalar(pvpTowerStats({...this.config.mainTower,cost:0},own.mainLevel).range*TILE);this.rangeMarker.visible=true;}
      return;
    }
    const tower = own?.towers.find(tower=>tower.cell===cell);
    const base = tower ? this.config.towers[tower.type] : undefined;
    if (cell !== null && tower && base) {
      this.rangeMarker.position.copy(this.cellPoint(cell,true));this.rangeMarker.position.y=.18;
      this.rangeMarker.scale.setScalar((this.snapshot.rulesVersion===2?arenaTurretStats(base,tower.level):pvpTowerStats(base,tower.level)).range*TILE);this.rangeMarker.visible=true;
    }
    if (cell !== null && cell>=0) { this.marker.position.copy(this.cellPoint(cell, true)); this.marker.position.y = .23; }
  }
  setAttackView(attacking: boolean): void {
    if (this.snapshot.shared) return;
    this.focusOwn = !attacking;
    this.cameraZ=attacking?this.laneMin:this.laneMax; this.resize();
  }
  private pointerCancel(event: PointerEvent): void { this.stroke=null;this.pointers.delete(event.pointerId);if(this.captureDrag?.pointerId===event.pointerId){this.captureDrag=null;this.catchBox.classList.remove('is-target');}this.resetGesture();this.trail.reset(); }
  private resetGesture(): void {const a=[...this.pointers.values()];if(a.length>=2){const [p,q]=a;this.gesture={x:(p!.x+q!.x)/2,y:(p!.y+q!.y)/2,distance:Math.hypot(p!.x-q!.x,p!.y-q!.y)};}else if(a.length===1)this.gesture={x:a[0]!.x,y:a[0]!.y,distance:0};else this.gesture=null;}
  private panBy(_dx:number,dy:number):void {
    const rect=this.canvas.getBoundingClientRect();
    this.cameraZ-=(dy/Math.max(1,rect.height))*(this.camera.top-this.camera.bottom)/.86;
    this.resize();
  }
  private wheel = (event: WheelEvent) => { event.preventDefault(); this.panBy(0,-event.deltaY); };
  private resize(): void {
    const rect = this.element.getBoundingClientRect(); if (!rect.width || !rect.height) return;
    const map=this.snapshot.map;if(!map)return;
    const extent=(map.height+4)*TILE;
    if(!this.framingInitialised){this.framingInitialised=true;this.cameraZ=this.snapshot.phase==='capture'?17*TILE:extent;this.focusOwn=true;}
    const frame=laneFrame(rect.width,rect.height,map.width*TILE_X+5,this.snapshot.shared?0:-extent,extent,this.cameraZ,this.snapshot.shared);
    this.cameraZ=frame.centerZ;this.laneMin=frame.low;this.laneMax=frame.high;
    this.focusOwn=this.cameraZ>=0;
    this.element.classList.toggle('is-focused',this.focusOwn);
    this.element.classList.remove('is-landscape');
    const focus=this.element.querySelector<HTMLElement>('.ftd-duel-focus');
    if(focus){focus.textContent=this.focusOwn?'Rival base ↑':'Your base ↓';focus.setAttribute('aria-label',this.focusOwn?'Look up to the rival base':'Return to your base');}
    this.renderer.setSize(rect.width,rect.height,false);
    this.camera.left=-frame.viewWidth/2;this.camera.right=frame.viewWidth/2;
    this.camera.top=frame.viewHeight/2;this.camera.bottom=-frame.viewHeight/2;
    this.camera.position.set(0,60,this.cameraZ+35.6);this.camera.lookAt(0,0,this.cameraZ);
    this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld(true);
    this.drawMinimap();
  }
  private animate = (now: number) => {
    if (this.disposed) return;
    if(this.graphicsRecovery.lost){this.previousAt=now;this.frame=requestAnimationFrame(this.animate);return;}
    if(document.hidden){this.previousAt=now;this.frame=requestAnimationFrame(this.animate);return;}
    if(matchMedia('(pointer: coarse)').matches && now-this.previousAt<1000/30-1){this.frame=requestAnimationFrame(this.animate);return;}
    const dt = Math.min(.05, (now - this.previousAt) / 1000); this.previousAt = now;
    for(const hp of this.health.values())hp.userData.rail?.update(dt);
    for(const [id,keep] of this.keepMotion){
      keep.motion.update(dt);
      const rawLevel=this.snapshot.players.find(player=>player.userId===id)?.mainLevel??1;
      const levelKey=`tower-main-level-${this.snapshot.shared?Math.max(1,Math.min(10,Math.floor(rawLevel))):pvpTowerLevel(rawLevel)}`;
      const key=getStudioEntityData(levelKey)?.sheetDataUrl?levelKey:'tower-main';
      if(!keep.studio||keep.studio.entityKey!==key||!keep.studio.active)keep.studio=createStudioAnimForKey(key);
      const sheet=keep.studio.active?updateStudioAnim(keep.studio,dt,0,0):sampleStudioTexture(key);
      const body=keep.motion.group.parent;
      if(sheet&&body instanceof Mesh){const material=body.material as MeshLambertMaterial;if(material.map!==sheet){material.map=sheet;material.color.setHex(0xffffff);material.needsUpdate=true;}}
    }
    const wallSheet = sampleStudioTexture('tower-wall');
    if (wallSheet) for (const material of this.wallMaterials) if (material.userData.creatorWallAllowed && material.map !== wallSheet) { material.map = wallSheet; material.color.setHex(0xffffff); material.needsUpdate = true; }
    for (const hero of this.heroArt) {
      hero.motion.update(dt);
      const sheet = sampleStudioTexture(hero.key, 'idle');
      if (sheet && hero.material.map !== sheet) { hero.material.map = sheet; hero.material.color.setHex(0xffffff); hero.material.needsUpdate = true; }
    }
    const map = this.snapshot.map;
    if(map&&this.snapshot.phase==='capture')for(const [id,mesh] of this.catchMeshes){if(this.captureDrag?.itemId===id)continue;const at=this.catchMotion.get(id)?.sample(now);if(!at)continue;mesh.position.copy(pvpWorldPoint(map,at.x,at.y,true));mesh.position.y=.78+Math.sin(now/170+at.x)*.09;}
    if (map) for (const entry of this.fruits.values()) {
      if (this.snapshot.shared && entry.x !== undefined && entry.y !== undefined) {
        const y = Math.min(13.5, this.movement.get(entry.mesh.userData.networkId)?.sample(now) ?? entry.y);
        entry.mesh.position.copy(pvpWorldPoint(map, entry.x, y, true)); entry.mesh.position.y = .65 + Math.sin(now / 140) * .07;
        entry.mesh.scale.setScalar(entry.boss ? 2.5 : 1); entry.mesh.rotation.y = 0; entry.mesh.visible = true; continue;
      }
      const modern=this.snapshot.rulesVersion===2&&entry.x!==undefined&&entry.y!==undefined;
      const progress=Math.min(map.pathCells.length-1,this.movement.get(entry.mesh.userData.networkId)?.sample(now) ?? entry.progress);
      entry.mesh.visible=modern||entry.progress>=-map.pathCells.length;
      const predicted = modern ? this.arenaMovement.get(entry.mesh.userData.networkId)?.sample(now) : undefined;
      const position = modern?arenaWorldPoint(map,predicted?.x ?? entry.x!,predicted?.y ?? entry.y!,this.snapshot.yourSide):pvpArmyPoint(map,progress,entry.own);
      const facing = entry.fightTargetId ? this.fruits.get(entry.fightTargetId)?.mesh.position : undefined;
      const ahead = facing ?? (modern?position.clone().add(new Vector3(0,0,entry.own?-1:1)):pvpArmyPoint(map,Math.min(map.pathCells.length-.99,progress+.12),entry.own));
      const direction = ahead.clone().sub(position);
      entry.mesh.rotation.y = 0;
      // A short forward strike reads as melee, not a fruit spinning in place.
      if (entry.fighting || entry.attackingTower) position.addScaledVector(direction.normalize(),Math.max(0,Math.sin(now/75))*.16);
      entry.mesh.position.copy(position);
      entry.mesh.userData.positionInitialised=true;entry.mesh.position.y=(entry.boss?1.1:.65)+Math.sin(now/(entry.fighting?65:140))*(entry.fighting?.12:.08);
      const material = entry.mesh.material as MeshLambertMaterial;
      const sheet = sampleStudioTexture(enemyKindToStudioKey(entry.type as Parameters<typeof enemyKindToStudioKey>[0]));
      if (sheet && material.map !== sheet) { material.map = sheet; material.color.setHex(0xffffff); material.needsUpdate = true; }
      const hit = Math.max(0,1-(now-(entry.mesh.userData.hitAt??-1000))/180);
      material.emissive.set(hit > 0 ? 0xffffff : entry.player.side === 'blue' ? COLORS.red : COLORS.blue);
      material.emissiveIntensity = .12 + hit*.8;
      if (entry.mesh.userData.hpBar) entry.mesh.userData.hpBar.rotation.y = -entry.mesh.rotation.y;
    }
    for(const [id,entry] of this.fruits){
      const target=entry.fightTargetId?this.fruits.get(entry.fightTargetId):null;
      const at=entry.attackingTower?entry.lastTowerHitAt:entry.lastClashAt;
      if(!at||this.shots.get(id)===at||(!entry.attackingTower&&(!entry.fighting||!target)))continue;
      this.shots.set(id,at);
      const impact=entry.attackingTower&&map?(this.snapshot.rulesVersion===2?arenaWorldPoint(map,map.width/2,entry.own?23:-23,this.snapshot.yourSide):pvpArmyPoint(map,map.pathCells.length,entry.own)):target!.mesh.position.clone();impact.y=.7;
      const beam=new Line(new BufferGeometry().setFromPoints([entry.mesh.position.clone(),impact]),new LineBasicMaterial({color:0xffca28,transparent:true,opacity:1}));this.scene.add(beam);this.effects.push({object:beam,life:.18});
      for(let i=0;i<4;i++){const spark=new Mesh(new PlaneGeometry(.12,.12),new MeshBasicMaterial({color:i%2?0xff7e32:0xffe097,side:DoubleSide}));spark.position.copy(entry.mesh.position).lerp(impact,.5);this.scene.add(spark);this.effects.push({object:spark,life:.35,velocity:new Vector3(Math.sin(i*3)*3,2,Math.cos(i*3)*3)});}
    }
    for (const entry of this.towers.values()) {
      entry.rig.refreshAppearance(entry.level);
      const target = [...this.fruits.values()].find((fruit) => fruit.own === entry.own && fruit.mesh.visible && (this.snapshot.shared || this.snapshot.rulesVersion===2 || fruit.progress >= 0) && fruit.mesh.position.distanceTo(entry.rig.group.position) < ((this.config.towers[entry.type] ? (this.snapshot.rulesVersion===2?arenaTurretStats(this.config.towers[entry.type]!, entry.level):pvpTowerStats(this.config.towers[entry.type]!, entry.level)).range : 0)) * TILE);
      if(target){const d=target.mesh.position.clone().sub(entry.rig.group.position);entry.rig.aimAt(d.x,d.z);}
      entry.rig.animate(dt,Boolean(target));
      entry.rig.group.rotation.y = 0;
      const shotId = entry.rig.group.uuid;
      if (target && (entry.lastFiredAt??0)>(this.shots.get(shotId)||0)) {
        this.shots.set(shotId,entry.lastFiredAt!);
        const a = entry.rig.group.position.clone(); a.y = 1;
        const tuning=turretLevelTuning(entry.type,entry.level||1);
        const color=tuning.effectColor?Number(tuning.effectColor.replace('#','0x')):undefined;
        if(entry.type==='catcher')this.turretEffects.capture(a,target.mesh.position);
        else this.turretEffects.shot(entry.rig.kind,a,target.mesh.position,entry.level,color,tuning.effectScale,(this.config.towers[entry.type]?pvpTowerStats(this.config.towers[entry.type]!,entry.level).range:3)*TILE);
        if(!(fireStudioEvent(`tower-${entry.type}-level-${entry.level||1}`,'onAttack',a)||fireStudioEvent(`tower-${entry.type}`,'onAttack',a)))playStudioSound(`turret-${entry.type}`);
        sharedSfx.fire();
        fireStudioEvent(`tower-${entry.type}-level-${entry.level||1}`,'onImpact',target.mesh.position)||fireStudioEvent(`tower-${entry.type}`,'onImpact',target.mesh.position);
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
    this.statusVfx.update(dt,Date.now());this.teammateTrails.update(dt);this.turretEffects.update(dt);this.powerVfx.update(dt);this.trail.update(dt); this.remoteTrail.update(dt);
    faceCombatPortraits(this.scene,this.camera);
    if(Math.floor(now/180)!==Math.floor((now-dt*1000)/180))this.drawMinimap();
    this.renderer.render(this.scene, this.camera); this.frame = requestAnimationFrame(this.animate);
  };
  private release(object: Group | Mesh | Line): void {
    object.removeFromParent();
    object.traverse((child) => { if (child instanceof Sprite) child.material.dispose(); if (child instanceof Mesh || child instanceof Line) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.dispose()); } });
  }
  dispose(): void {
    if (this.disposed) return; this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    this.release(this.terrain); this.release(this.pieces); this.movement.clear(); this.arenaMovement.clear();
    for (const trail of [this.trail, this.remoteTrail]) { this.release(trail.line); this.release(trail.glowLine); trail.sparks.geometry.dispose(); (trail.sparks.material as MeshBasicMaterial).dispose(); }
    this.statusVfx.clear();this.graphicsRecovery.dispose();this.teammateTrails.dispose();this.turretEffects.clear();this.powerVfx.clear();this.release(this.marker);this.release(this.rangeMarker); this.renderer.dispose(); this.renderer.forceContextLoss();
    this.effects.forEach((effect) => this.release(effect.object));
  }
}
