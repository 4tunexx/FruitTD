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
  { kind: 'guillotine', name: 'Fire Blade', cost: 70, blurb: 'Flaming slicer. Area split damage.', fuel: 'none', floorOnly: true },
  { kind: 'vortex', name: 'Vortex Drain', cost: 55, blurb: 'Pulls juice. Weak damage + pull.', fuel: 'none', floorOnly: false },
  { kind: 'laser', name: 'Lemon Laser', cost: 80, blurb: 'Yellow juice. Fast beam down lane.', fuel: 'yellow', floorOnly: false },
  { kind: 'railgun', name: 'Berry Cannon', cost: 90, blurb: 'Pink juice. Pierce shot + knockback.', fuel: 'pink', floorOnly: false },
  { kind: 'sprinkler', name: 'Frost Sprinkler', cost: 50, blurb: 'Orange juice. Slows + brittle.', fuel: 'orange', floorOnly: false },
  { kind: 'blender', name: 'Spike Trap', cost: 65, blurb: 'Close-range spikes. Open/close from its controls.', fuel: 'none', floorOnly: true },
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
  const lv = Math.max(1, level);
  if (kind === 'main') return 5.1 + lv * 0.45;
  if (kind === 'guillotine') return 1.05 + lv * 0.12;
  if (kind === 'vortex') return 2.8 + lv * 0.28;
  if (kind === 'laser') return 7.2 + lv * 0.35;
  if (kind === 'railgun') return 8.4 + lv * 0.4;
  if (kind === 'sprinkler') return 1.9 + lv * 0.18;
  return 0.7 + lv * 0.08;
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
  private readonly slug: Mesh | null = null;
  private slugZ = 0;
  private slugDx=0;
  private slugDz=1;
  private visualLevel=1;
  private readonly levelMarks:Mesh[]=[];
  private skinAnim=createStudioAnimForKey('tower-main');
  private slugLive = 0;
  private readonly placeholder: Mesh;
  private readonly mechanism = new Group();
  private readonly slugHits = new Set<Fruit>();

  constructor(kind: TurretKind) {
    this.kind = kind;
    const colors: Record<TurretKind, number> = { guillotine: 0xff6622, vortex: 0x6ec6c0, laser: 0xffee55, railgun: 0xd48aa0, sprinkler: 0xff8a2a, blender: 0x888888 };
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
    } else if(kind==='vortex'||kind==='sprinkler') {
      this.spin=new Group(); this.spin.position.z=.06; this.mechanism.add(this.spin);
      for(let i=0;i<4;i++) {
        const arm=part(new PlaneGeometry(.16,.43),colors[kind],Math.sin(i*Math.PI/2)*.19,Math.cos(i*Math.PI/2)*.19);
        arm.rotation.z=-i*Math.PI/2+.4; this.spin.attach(arm);
      }
      part(new CircleGeometry(.12,16),0xffedc2).position.z=.1;
    } else if(kind==='laser'||kind==='railgun') {
      part(new PlaneGeometry(.3,.58),0x34383f,0,.2);
      part(new PlaneGeometry(.13,.45),colors[kind],0,.28).position.z=.07;
      this.beam=part(new CircleGeometry(.11,16),0xfff2a4,0,.53);
      if(kind==='railgun') {
        this.slug=new Mesh(new CircleGeometry(.15,16),new MeshBasicMaterial({color:0xffb8db,side:DoubleSide}));
        this.slug.visible=false; this.group.add(this.slug);
      }
    } else {
      this.lid=part(new PlaneGeometry(.66,.18),0x4a4d52,0,-.22);
      this.lever=part(new PlaneGeometry(.1,.43),0xffde98,.27,.02);
      for(let i=0;i<3;i++) {
        const spike=new Shape();spike.moveTo(-.09,0);spike.lineTo(0,.36);spike.lineTo(.09,0);spike.closePath();
        part(new ShapeGeometry(spike),0xffe7a9,(i-1)*.2,0);
      }
      this.setOpen(true);
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
    const { dt, fruits, juice, bank } = ctx;
    const tuning=turretLevelTuning(this.kind,level);
    const onHit=(hit:TurretHit)=>{ctx.onHit({...hit,damage:hit.damage*tuning.damageMultiplier});fireStudioEvent(`tower-${this.kind}-level-${level}`,'onImpact',hit.fruit.group.position)||fireStudioEvent(`tower-${this.kind}`,'onImpact',hit.fruit.group.position);};
    const tracked=nearest(fruits,x,z,turretRange(this.kind,level));
    if(tracked)this.aimAt(tracked.group.position.x-x,tracked.group.position.z-z);
    this.animate(dt, fruits.some(f=>f.alive && Math.hypot(f.group.position.x-x,f.group.position.z-z)<turretRange(this.kind,level)));
    this.cooldown = Math.max(0, this.cooldown - dt);
    let noisy = false;

    const range = turretRange(this.kind, level);
    if (this.kind === 'guillotine') {
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
      const target=nearest(fruits,x,z,range);
      const fueled = bank.yellow > 0;
      if (this.beam) this.beam.visible = fueled;
      if (target && fueled && this.cooldown <= 0 && bank.take('yellow',1)) {
        this.cooldown=Math.max(.18,.38-level*.03);
        const dx=target.group.position.x-x,dz=target.group.position.z-z,d=Math.hypot(dx,dz),ux=d?dx/d:0,uz=d?dz/d:1;
        for(const fruit of fruits) {
          if(!fruit.alive)continue;
          const fx=fruit.group.position.x-x,fz=fruit.group.position.z-z,along=fx*ux+fz*uz;
          if(along<0||along>range||Math.abs(fx*uz-fz*ux)>.48)continue;
          onHit({fruit,damage:6+level*3});
        }
        ctx.shoot(x+ux*range,z+uz*range,0xffee44);noisy=true;
      }
    } else if (this.kind === 'railgun') {
      this.charge += dt;
      const need = Math.max(1.6, 2.4 - level * 0.12)*tuning.cooldownMultiplier;
      if (this.slugLive > 0) {
        this.slugLive -= dt;
        const previousZ=this.slugZ;
        this.slugZ += 22 * dt;
        if (this.slug) {
          this.slug.position.set(this.slugDx*this.slugZ, 0.95, this.slugDz*this.slugZ);
          this.slug.userData.combatPortrait=true;
          this.slug.visible = this.slugLive > 0;
        }
        for (const fruit of fruits) {
          if (!fruit.alive) continue;
          const fx=fruit.group.position.x-x,fz=fruit.group.position.z-z;
          if(Math.abs(fx*this.slugDz-fz*this.slugDx)>.55)continue;
          const localZ=fx*this.slugDx+fz*this.slugDz;
          if (localZ<previousZ-.55 || localZ>this.slugZ+.55 || localZ>range) continue;
          if(this.slugHits.has(fruit))continue;
          this.slugHits.add(fruit);
          onHit({ fruit, damage: 18 + level * 7, pierce: true, impulseX: this.slugDx*(7+level), impulseZ: this.slugDz*(7+level) });
        }
        if (this.slug && this.slugLive <= 0) this.slug.visible = false;
      } else if (tracked && this.charge >= need && bank.take('pink', 6)) {
        const dx=tracked.group.position.x-x,dz=tracked.group.position.z-z,d=Math.hypot(dx,dz);
        this.slugDx=d?dx/d:0;this.slugDz=d?dz/d:1;
        this.charge = 0;
        this.slugHits.clear();
        this.slugLive = 0.55;
        this.slugZ = 0.4;
        ctx.shoot(x+this.slugDx*range,z+this.slugDz*range,0xeaa2ee);
        if (this.slug) { this.slug.position.set(this.slugDx*this.slugZ,.95,this.slugDz*this.slugZ); this.slug.visible = true; }
        noisy = true;
      }
    } else if (this.kind === 'sprinkler') {
      if (tracked && this.cooldown <= 0 && bank.take('orange', 1)) {
        this.cooldown = 0.2;
        const ang = tracked?Math.atan2(tracked.group.position.x-x,tracked.group.position.z-z):this.phase*3.4;
        const reach = tracked?Math.min(range,Math.hypot(tracked.group.position.x-x,tracked.group.position.z-z)):range;
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
