import { weaponStats, TURRET_WEAPONS, projectileTravelSeconds } from './turretWeapons';
import { turretVictims } from './turretTargets';
import { combatTokenFrame, COMBAT_GOLD } from './combatTokens';
import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Shape, ShapeGeometry } from 'three';
import type { Fruit } from './fruits';
import type { JuiceBank, JuiceSystem } from './juice';
import type { PadDef } from './world';
import { sampleStudioTexture, fireStudioEvent, playStudioSound, turretLevelTuning, createStudioAnimForKey, resetStudioAnimForKey, updateStudioAnim } from './studioRuntime';

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
  {kind:'guillotine',name:TURRET_WEAPONS.guillotine.name,cost:70,blurb:'Close defence. Rotating blades cut every enemy inside the ring.',fuel:'none',floorOnly:true},
  {kind:'vortex',name:TURRET_WEAPONS.vortex.name,cost:85,blurb:'Aimed short-range flame cone. Burns clustered enemies, never the whole radius.',fuel:'none',floorOnly:false},
  {kind:'laser',name:TURRET_WEAPONS.laser.name,cost:80,blurb:'Long-range piercing beam. Line enemies up for maximum damage.',fuel:'yellow',floorOnly:false},
  {kind:'railgun',name:TURRET_WEAPONS.railgun.name,cost:110,blurb:'Guided rocket. Heavy splash at impact; slow reload.',fuel:'pink',floorOnly:false},
  {kind:'sprinkler',name:TURRET_WEAPONS.sprinkler.name,cost:50,blurb:'Rotating fertiliser mist. Slows and weakens enemies inside its radius.',fuel:'orange',floorOnly:false},
  {kind:'blender',name:TURRET_WEAPONS.blender.name,cost:95,blurb:'Lobs a bomb into a group. Wide explosion; fast runners can escape the landing zone.',fuel:'none',floorOnly:false},
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

function baseTurretRange(kind: TurretKind | 'main', level: number): number {
  if (kind === 'main') return 5.1 + Math.max(1,level) * .45;
  return weaponStats(kind,level).range;
}

export function turretRange(kind:TurretKind|'main',level:number):number {return baseTurretRange(kind,level)*turretLevelTuning(kind,level).rangeMultiplier;}

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
  private readonly spin: Group | null = null;
  private readonly beam: Mesh | null = null;
  private readonly lid: Mesh | null = null;
  private readonly lever: Mesh | null = null;
  private visualLevel=1;
  private readonly levelMarks:Mesh[]=[];
  private skinAnim=createStudioAnimForKey('tower-main');
  private readonly placeholder: Mesh;
  private readonly mechanism = new Group();
  private projectile: {target:Fruit;x:number;z:number;left:number;level:number} | null = null;

  constructor(kind: TurretKind) {
    this.kind = kind;
    const colors = Object.fromEntries(Object.entries(TURRET_WEAPONS).map(([id,weapon])=>[id,weapon.color])) as Record<TurretKind,number>;
    const placeholder = new Mesh(new CircleGeometry(.55, 40), new MeshBasicMaterial({ color: 0x25282c, side: DoubleSide, transparent: true, opacity: 0.98 }));
    placeholder.userData.combatPortrait=true;
    placeholder.add(combatTokenFrame(.55, 'tower'));
    placeholder.position.y = 0.6;
    this.group.add(placeholder);
    this.placeholder = placeholder;
    for(let i=0;i<9;i++){const mark=new Mesh(new CircleGeometry(.045,4),new MeshBasicMaterial({color:COMBAT_GOLD,side:DoubleSide}));mark.position.set((i-4)*.09,-.43,.16);mark.visible=false;placeholder.add(mark);this.levelMarks.push(mark);}
    placeholder.add(this.mechanism);
    this.mechanism.position.z = .07;
    this.mechanism.name='turret-aim';
    // Original, gold-contoured mechanical silhouettes; published studio art
    // replaces these parts while retaining the shared token frame.
    const part = (geometry: PlaneGeometry | CircleGeometry | RingGeometry | ShapeGeometry, color: number, x=0, y=0): Mesh => {
      const rim = new Mesh(geometry, new MeshBasicMaterial({ color: COMBAT_GOLD, side: DoubleSide }));
      rim.position.set(x,y,.02); rim.scale.setScalar(1.13);
      const face = new Mesh(geometry.clone(), new MeshBasicMaterial({ color, side: DoubleSide }));
      face.position.z=.012; face.scale.setScalar(1/1.13); rim.add(face); this.mechanism.add(rim); return rim;
    };
    part(new CircleGeometry(.36,24),0x202125);
    if(kind==='guillotine') {
      this.spin=new Group();this.spin.position.z=.08;this.mechanism.add(this.spin);
      for(let i=0;i<4;i++) {
        const shape=new Shape();shape.moveTo(-.08,0);shape.lineTo(.08,.5);shape.lineTo(.3,.34);shape.lineTo(.12,.05);shape.closePath();
        const blade=part(new ShapeGeometry(shape),0xffdb9c);blade.rotation.z=i*Math.PI/2;this.spin.attach(blade);
      }
      part(new CircleGeometry(.13,16),0xffa52e).position.z=.12;
    } else if(kind==='sprinkler') {
      this.spin=new Group();this.spin.position.z=.08;this.mechanism.add(this.spin);
      for(let i=0;i<4;i++) {const arm=part(new PlaneGeometry(.12,.4),0xb9d783,Math.sin(i*Math.PI/2)*.18,Math.cos(i*Math.PI/2)*.18);arm.rotation.z=-i*Math.PI/2;this.spin.attach(arm);}
      part(new CircleGeometry(.19,16),0x687e48).position.z=.12;
    } else if(kind==='vortex') {
      part(new PlaneGeometry(.2,.48),0x9a6331,-.24,-.12);part(new PlaneGeometry(.2,.48),0x9a6331,.24,-.12);
      part(new PlaneGeometry(.28,.6),0x42484b,0,.18);part(new PlaneGeometry(.18,.2),0xffa23d,0,.49).position.z=.06;
      this.beam=part(new CircleGeometry(.095,12),0xffdc88,0,.59);
    } else if(kind==='railgun') {
      part(new PlaneGeometry(.46,.37),0x4a5050,0,-.12);
      for(const x of [-.2,.2]) {part(new PlaneGeometry(.18,.64),0x6c735e,x,.2);part(new PlaneGeometry(.12,.13),0x111619,x,.51).position.z=.08;part(new PlaneGeometry(.12,.14),0xd5ad59,x,.02).position.z=.08;}
      part(new CircleGeometry(.11,12),0xffd36b,0,-.17).position.z=.12;
    } else if(kind==='laser') {
      part(new PlaneGeometry(.33,.54),0x34383f,0,.14);part(new PlaneGeometry(.13,.44),colors[kind],0,.25).position.z=.07;
      this.beam=part(new CircleGeometry(.13,16),0xfff2a4,0,.51);
    } else {
      part(new PlaneGeometry(.52,.38),0x62694e,0,-.15);
      part(new PlaneGeometry(.38,.47),0x3c4345,0,.14).rotation.z=-.14;
      part(new CircleGeometry(.2,20),0x141a1c,0,.39).position.z=.08;
      for(const x of [-.3,.3])part(new CircleGeometry(.12,16),0xe0b856,x,-.2).position.z=.08;

    }
  }

  dispose():void {
    this.group.removeFromParent();
    this.group.traverse(node=>{if(node instanceof Mesh){node.geometry.dispose();(node.material as MeshBasicMaterial).dispose();}});
  }

  setOpen(open: boolean): void {
    this.open = open;
    if (this.lid) this.lid.rotation.x = open ? -1.15 : 0;
    if (this.lever) this.lever.rotation.z = open ? 0.7 : 0;
  }

  aimAt(dx:number,dz:number):void { this.placeholder.userData.combatAim={x:dx,z:dz}; }

  refreshAppearance(level=this.visualLevel): void {
    this.visualLevel=Math.max(1,Math.min(10,Math.floor(level)));
    this.group.userData.level=this.visualLevel;
    this.levelMarks.forEach((mark,i)=>mark.visible=i<this.visualLevel-1);
    const key=`tower-${this.kind}`;
    const levelKey=`${key}-level-${this.visualLevel}`;
    const selected=sampleStudioTexture(levelKey)?levelKey:key;
    if(this.skinAnim.entityKey!==selected||!this.skinAnim.active)resetStudioAnimForKey(this.skinAnim,selected);
    const texture = sampleStudioTexture(selected);
    if (texture) {
      const material = this.placeholder.material as MeshBasicMaterial;
      this.mechanism.visible = false;
      if (material.map !== texture) { material.map = texture; material.color.setHex(0xffffff); material.needsUpdate = true; }
    } else {
      this.mechanism.visible = true;
      const material=this.placeholder.material as MeshBasicMaterial;
      if(material.map){material.map=null;material.color.setHex(0x34383f);material.needsUpdate=true;}
    }
  }

  /** Pure presentation: online snapshots must never run local combat rules. */
  animate(dt:number, active=false):void {
    this.phase += dt;
    const skin=this.skinAnim.active?updateStudioAnim(this.skinAnim,dt,0,0):null;
    if(skin){const mat=this.placeholder.material as MeshBasicMaterial;mat.map=skin;mat.needsUpdate=true;}
    if(this.spin)this.spin.rotation.z+=dt*(active?9+this.visualLevel*.7:0);
    this.mechanism.scale.setScalar(1+(this.visualLevel-1)*.035+(active?.045:0)*Math.sin(this.phase*22));
  }

  tick(x: number, z: number, level: number, ctx: TurretTick): boolean {
    this.refreshAppearance(level);
    const {dt,fruits,bank,juice}=ctx,tuning=turretLevelTuning(this.kind,level),stats=weaponStats(this.kind,level);
    const range=turretRange(this.kind,level);
    const tracked=nearest(fruits,x,z,range);
    if(tracked)this.aimAt(tracked.group.position.x-x,tracked.group.position.z-z);
    if(this.beam)this.beam.visible=!!tracked;
    this.animate(dt,!!tracked);this.cooldown=Math.max(0,this.cooldown-dt);this.charge+=dt;
    const onHit=(fruit:Fruit,damage:number)=>{
      ctx.onHit({fruit,damage:damage*tuning.damageMultiplier,brittle:this.kind==='sprinkler',split:this.kind==='guillotine'});
      if(this.kind!=='railgun'&&this.kind!=='blender')fireStudioEvent(`tower-${this.kind}-level-${level}`,'onImpact',fruit.group.position)||fireStudioEvent(`tower-${this.kind}`,'onImpact',fruit.group.position);
    };
    if(this.projectile){
      const shot=this.projectile;shot.left-=dt;
      if(this.kind==='railgun'&&shot.target.alive){shot.x=shot.target.group.position.x;shot.z=shot.target.group.position.z;}
      if(shot.left<=0){
        const blast=weaponStats(this.kind,shot.level).blast;
        for(const fruit of fruits)if(fruit.alive&&Math.hypot(fruit.group.position.x-shot.x,fruit.group.position.z-shot.z)<=blast)onHit(fruit,weaponStats(this.kind,shot.level).damage);
        juice.floorSplash(shot.x,shot.z,TURRET_WEAPONS[this.kind].color,12);
        if(!(fireStudioEvent(`tower-${this.kind}-level-${shot.level}`,'onImpact',{x:shot.x,y:.7,z:shot.z})||fireStudioEvent(`tower-${this.kind}`,'onImpact',{x:shot.x,y:.7,z:shot.z})))playStudioSound('bombExplode');
        this.projectile=null;
      }
    }
    let noisy=false;
    if(tracked&&this.cooldown<=0&&!this.projectile){
      const fuel=turretDef(this.kind).fuel,need=this.kind==='railgun'?6:1;
      if(fuel!=='none'&&!bank.take(fuel,need))return false;
      this.cooldown=stats.cooldown;
      const tx=tracked.group.position.x,tz=tracked.group.position.z;
      if(this.kind==='railgun'||this.kind==='blender'){
        this.projectile={target:tracked,x:tx,z:tz,left:projectileTravelSeconds(this.kind,Math.hypot(tx-x,tz-z)),level};
      }else {
        const victims=turretVictims(this.kind,{x,y:z},tracked,fruits.filter(f=>f.alive),f=>({x:f.group.position.x,y:f.group.position.z}),range,level);
        for(const fruit of victims){
          if(this.kind==='sprinkler'){fruit.brittle=1.8;juice.floorSplash(fruit.group.position.x,fruit.group.position.z,0xb9d783,2);}
          onHit(fruit,stats.damage);
        }
      }
      ctx.shoot(tx,tz,TURRET_WEAPONS[this.kind].color);noisy=true;
    }

    if(noisy){this.cooldown*=tuning.cooldownMultiplier;if(!(fireStudioEvent(`tower-${this.kind}-level-${level}`,'onAttack',{x,y:1,z})||fireStudioEvent(`tower-${this.kind}`,'onAttack',{x,y:1,z})))playStudioSound(`turret-${this.kind}`);}
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
