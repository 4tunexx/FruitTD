import { mapPowerEnvelope } from './powerCombat';
import { SOLO_ARENA_D } from './world';
import { towerHealthRail } from './towerHealthRail';
import { WALL_SKINS } from './save';
import { createBuildPad, battleMapPads } from './buildPads';
import type { BattleMap } from './battleMaps';
import type { PadDef } from './world';
import { TurretEffects } from './turretEffects';
import { DefenderMotion } from './defenderMotion';
import { characterPortrait } from './characterPortraits';
import { combatTokenFrame, COMBAT_GOLD } from './combatTokens';
import {
  CanvasTexture,
  Camera,
  CircleGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  RingGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three';
import { fruitAtlas } from './atlas';
import type { Fruit } from './fruits';
import type { JuiceBank, JuiceSystem } from './juice';
import { TurretRig, canPlaceTurret, sellRefund, turretRange, type TurretHit, type TurretKind } from './turrets';
import { ARENA_W, EXTRA_Z, MAIN_INDEX, MAX_TOWER_LEVEL, PADS, WALL_Z, towerStats, slotIndexAt } from './world';
import { getAdminTexture } from './adminTextureLoader';
import { getTowerXpState } from './towerProgression';
import { getTowerMilestoneBonuses } from './towerMilestones';
import { heroDef, type HeroId } from './heroes';
import {
  TOWER_STUDIO_KEY,
  createStudioAnimForKey,
  heroIdToStudioKey,
  resetStudioAnimForKey,
  sampleStudioTexture,
  getStudioEntityData,
  fireStudioEvent, playStudioSound, turretLevelTuning,
  updateStudioAnim,
  type StudioAnimState,
} from './studioRuntime';

export interface Slot {
  index: number;
  enabled: boolean;
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

const _aim = new Vector3();
const wallSkinTextures = new Map<string, Texture>();

export class WallBase {
  readonly group = new Group();
  readonly healthRail = new Group();
  readonly combatEffects=new TurretEffects();
  readonly slots: Slot[] = [];
  selected = MAIN_INDEX;
  moving = false;
  private readonly wallMesh: Mesh;
  private readonly rangeRing: Mesh;
  private readonly keepMesh: Mesh;
  private readonly towerHpFill: Mesh;
  private readonly hpRail:ReturnType<typeof towerHealthRail>;
  private wallSkinPath = '';
  private readonly fitHealthRail = () => { if(typeof window!=='undefined')this.healthRail.scale.x=window.innerWidth/window.innerHeight<.82?.82:1; };
  private readonly towerHome = new Vector3(0, 3.7, WALL_Z);
  private rangeRequested = false;
  private hitTimer = 0;
  private readonly heroMotion:DefenderMotion;
  private towerMotion:DefenderMotion|null=null;
  private currentHero: HeroId | null = null;
  private heroOnKeep = true;
  private towerStudio: StudioAnimState = createStudioAnimForKey(TOWER_STUDIO_KEY);
  private heroStudio: StudioAnimState = createStudioAnimForKey(heroIdToStudioKey('jiju'));

  constructor() {
    this.wallMesh = new Mesh(
      new PlaneGeometry(ARENA_W - 2, 1.15),
      new MeshLambertMaterial({ color: 0x9a4034, side: DoubleSide, transparent: true }),
    );
    this.wallMesh.userData.combatPortrait=true;
    this.wallMesh.position.set(0, 0.52, (WALL_Z + EXTRA_Z) / 2);
    this.group.add(this.wallMesh);

    const lip = new Mesh(
      new PlaneGeometry(ARENA_W - 1.8, 0.14),
      new MeshLambertMaterial({ color: 0xe6c98a }),
    );
    lip.position.set(0, 1.12, EXTRA_Z + 0.55);
    this.group.add(lip);

    const keepMat = new MeshLambertMaterial({ color: 0x6e3128, side: DoubleSide, transparent: true });
    this.keepMesh = new Mesh(
      new CircleGeometry(1.05, 48),
      keepMat,
    );
    this.keepMesh.userData.combatPortrait=true;
    this.keepMesh.add(combatTokenFrame(1.05, 'tower'));
    this.keepMesh.position.copy(this.towerHome);
    this.group.add(this.combatEffects.group);
    this.group.add(this.keepMesh);
    this.heroMotion=new DefenderMotion(this.keepMesh,'hero',0xffc45c);
    // A framed continuous bar sits just below the wall and remains attached to
    // the tower as the camera moves.
    const hpZ = WALL_Z - 1.45;
    this.hpRail=towerHealthRail(ARENA_W-1.95);
    this.towerHpFill=this.hpRail.fill;
    this.healthRail.add(...[...this.hpRail.group.children]);
    this.healthRail.position.z=hpZ;
    this.group.add(this.healthRail);
    if (typeof window !== 'undefined') {
      this.fitHealthRail();
      window.addEventListener('resize', this.fitHealthRail);
    }

    this.rangeRing = new Mesh(
      new RingGeometry(.98, 1, 64),
      new MeshBasicMaterial({ color: COMBAT_GOLD, transparent: true, opacity: 0.4, depthWrite: false }),
    );
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.position.y = 0.08;
    this.rangeRing.visible = false;
    this.group.add(this.rangeRing);

    PADS.forEach((def,index)=>this.createSlot(def,index));
    this.refreshPads();
    this.rangeRequested = false;
    this.refreshRange();
  }

  private createSlot(def:PadDef,index:number):void {
      const pad=createBuildPad(def.main);
      pad.position.set(def.x,.16,def.z);
      this.group.add(pad);
      const slot: Slot = {
        index,
        enabled: def.enabled !== false,
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
        slot.head = this.makeHead(0, 0, 0.68);
        slot.head.position.set(def.x, 1.3, def.z);
        this.towerMotion=new DefenderMotion(slot.head,'tower');
        this.group.add(slot.head);
      }
      this.slots.push(slot);
  }

  /** Apply the same authored slots shown by Map Creator before a new run. */
  private powerField={width:ARENA_W,depth:SOLO_ARENA_D};
  applyBattleMap(map:BattleMap):void {
    this.powerField={width:map.world.width,depth:map.world.depth};
    for(const slot of this.slots){
      slot.turret?.dispose();
      for(const object of [slot.pad,slot.head])if(object){object.removeFromParent();object.traverse(node=>{if(node instanceof Mesh){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>material.dispose());}});}
    }
    this.slots.length=0;
    battleMapPads(map).forEach((def,index)=>this.createSlot(def,index));
    this.selected=MAIN_INDEX;this.moving=false;this.rangeRequested=false;
    this.refreshTowerTexture();this.refreshPads();this.refreshRange();
  }

  applyWallSkin(hex: number, texturePath = ''): void {
    const material = this.wallMesh.material as MeshLambertMaterial;
    material.color.setHex(hex);
    this.wallSkinPath = texturePath;
    const wallSheet=(!texturePath||texturePath===WALL_SKINS[0]!.texture)?sampleStudioTexture('tower-wall','idle'):null;
    if(wallSheet){material.map=wallSheet;material.color.setHex(0xffffff);material.needsUpdate=true;return;}
    if (!texturePath) {
      material.map = null;
      if (material.map) material.color.setHex(0xffffff);
      material.needsUpdate = true;
      return;
    }
    const applyTexture = (texture: Texture) => {
      if (this.wallSkinPath !== texturePath) return;
      material.map = texture;
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
    };
    const cached = wallSkinTextures.get(texturePath);
    if (cached) { applyTexture(cached); return; }
    const image = new Image();
    image.onload = () => {
      const texture = new CanvasTexture(image);
      texture.colorSpace = SRGBColorSpace;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(8, 1);
      wallSkinTextures.set(texturePath, texture);
      applyTexture(texture);
    };
    image.onerror = () => console.warn('Tower skin texture failed to load:', texturePath);
    image.src = texturePath;
  }

  applySkins(): void {
    this.refreshTowerTexture();
    if (this.currentHero) this.refreshHeroTexture();
  }

  /** Apply Creator `tower-main` sheet (idle/walk) to the main turret head; fall back to atlas/admin PNG. */
  refreshTowerTexture(): void {
    resetStudioAnimForKey(this.towerStudio, TOWER_STUDIO_KEY);
    const main = this.slots[MAIN_INDEX]?.head;
    if (!main) return;
    const mat = main.material as MeshLambertMaterial;
    const studioTex =
      sampleStudioTexture(`${TOWER_STUDIO_KEY}-level-${this.slots[MAIN_INDEX].level}`, 'idle') || sampleStudioTexture(TOWER_STUDIO_KEY, 'idle') ||
      (this.towerStudio.active ? updateStudioAnim(this.towerStudio, 0, 0, 0) : null);
    if (studioTex) {
      this.keepMesh.visible = this.heroOnKeep;
      main.visible = true;
      mat.map = studioTex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      return;
    }
    const adminTex = getAdminTexture('tower-main');
    if (adminTex) {
      main.visible = true; this.keepMesh.visible = this.heroOnKeep;
      mat.map = adminTex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      return;
    }
    mat.map = characterPortrait('tower') || fruitAtlas.tile(0, 0);
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
  }

  setHero(heroId: HeroId): void {
    this.heroMotion.setHero(heroId,heroDef(heroId).color);
    if (this.currentHero === heroId) {
      this.refreshHeroTexture();
      return;
    }
    this.currentHero = heroId;
    this.refreshHeroTexture();
  }

  setHeroOnKeep(visible: boolean): void {
    this.heroOnKeep = visible;
    this.keepMesh.visible=visible;
    this.heroMotion.group.visible=visible;
    if (!visible) {
      const mat = this.keepMesh.material as MeshLambertMaterial;
      mat.map = characterPortrait(this.heroOnKeep && this.currentHero ? this.currentHero : 'tower');
      mat.color.setHex(mat.map ? 0xffffff : 0x34383f);
      mat.needsUpdate = true;
    } else if (this.currentHero) this.refreshHeroTexture();
  }

  /**
   * Hero avatar on the keep: prefer Creator `hero-*` sheet over single PNG upload,
   * then admin tower-main / default keep colour.
   */
  refreshHeroTexture(): void {
    if (!this.currentHero || !this.heroOnKeep) return;
    const key = heroIdToStudioKey(this.currentHero);
    resetStudioAnimForKey(this.heroStudio, key);

    const mat = this.keepMesh.material as MeshLambertMaterial;
    const studioTex =
      sampleStudioTexture(key, 'idle') ||
      (this.heroStudio.active ? updateStudioAnim(this.heroStudio, 0, 0, 0) : null);

    if (studioTex) {
      this.keepMesh.visible = this.heroOnKeep;
      mat.map = studioTex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      return;
    }

    const heroTex = getAdminTexture(`hero-${this.currentHero}` as any);
    if (heroTex) {
      this.keepMesh.visible = this.heroOnKeep;
      mat.map = heroTex;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
      return;
    }

    // A custom keep sprite must never replace a hero with no custom sheet.
    mat.map = characterPortrait(this.currentHero);
    mat.color.setHex(mat.map ? 0xffffff : 0x34383f);
    mat.needsUpdate = true;
  }

  /** Subtle idle/walk advance for Creator tower + hero packs. */
  private tickStudioSkins(dt: number): void {
    if (!this.wallSkinPath||this.wallSkinPath===WALL_SKINS[0]!.texture) {
      const wallSheet = sampleStudioTexture('tower-wall', 'idle');
      const material = this.wallMesh.material as MeshLambertMaterial;
      if (wallSheet && material.map !== wallSheet) { material.map = wallSheet; material.color.setHex(0xffffff); material.needsUpdate = true; }
    }
    const main = this.slots[MAIN_INDEX]?.head;
    const levelKey=`tower-main-level-${this.slots[MAIN_INDEX].level}`;
    const studioKey=getStudioEntityData(levelKey)?.sheetDataUrl?levelKey:TOWER_STUDIO_KEY;
    if(this.towerStudio.entityKey!==studioKey||!this.towerStudio.active)resetStudioAnimForKey(this.towerStudio,studioKey);
    if (main && this.towerStudio.active) {
      const tex = updateStudioAnim(this.towerStudio, dt, 0, 0);
      if (tex) {
        const mat = main.material as MeshLambertMaterial;
        if (mat.map !== tex) {
          mat.map = tex;
          mat.needsUpdate = true;
        } else {
          tex.needsUpdate = true;
        }
        mat.color.setHex(0xffffff);
      }
    }
    if (this.currentHero && this.heroOnKeep && this.heroStudio.active) {
      const tex = updateStudioAnim(this.heroStudio, dt, 0, 0);
      if (tex) {
        const mat = this.keepMesh.material as MeshLambertMaterial;
        if (mat.map !== tex) {
          mat.map = tex;
          mat.needsUpdate = true;
        } else {
          tex.needsUpdate = true;
        }
        mat.color.setHex(0xffffff);
      }
    }
  }

  dispose():void {
    this.wallSkinPath='';
    if(typeof window!=='undefined')window.removeEventListener('resize',this.fitHealthRail);
    this.combatEffects.clear();
    for(const slot of this.slots)slot.turret?.dispose();
    this.group.removeFromParent();
    this.group.traverse(node=>{if(node instanceof Mesh){node.geometry.dispose();const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>material.dispose());}});
    this.group.clear();
  }

  animatePreview(dt:number):void {
    this.tickStudioSkins(dt);this.heroMotion.update(dt);this.towerMotion?.update(dt);
    for(const slot of this.slots)if(slot.turret){slot.turret.animate(dt,true);}
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
          slot.turret.dispose();
          slot.turret = null;
        }
        slot.kind = null;
      }
    }
    this.combatEffects.clear();
    this.setTowerHealth(1);
    this.selected = MAIN_INDEX;
    this.moving = false;
    this.rangeRequested = false;
    this.hitTimer = 0;
    this.keepMesh.position.copy(this.towerHome);
    this.refreshPads();
    this.refreshRange();
  }

  placeSlicer(index: number, kind: TurretKind): boolean {
    const slot = this.slots[index];
    const pad = this.slots[index];
    if (!slot || !pad || !slot.enabled || slot.main || slot.filled) return false;
    if (!canPlaceTurret(kind, pad)) return false;
    slot.filled = true;
    slot.level = 1;
    slot.kind = kind;
    slot.turret = new TurretRig(kind);
    this.setTurretDisplayPosition(slot);
    this.group.add(slot.turret.group);
    this.selected = index;
    this.rangeRequested = true;
    this.refreshPads();
    this.refreshRange();
    return true;
  }

  /** Wall-mounted turrets sit above the wall cap and on its camera-facing side. */
  private setTurretDisplayPosition(slot: Slot): void {
    if (!slot.turret) return;
    slot.turret.group.position.set(slot.x, slot.floor ? 0.12 : 1.38, slot.z - (slot.floor ? 0 : 0.5));
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
    if (slot.turret) {slot.turret.group.scale.setScalar(1 + (slot.level - 1) * 0.04);slot.turret.refreshAppearance(slot.level);}
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
    const pad = this.slots[index];
    if (!this.moving || !src || !dest || !pad) return false;
    if (src.main || !src.filled || !src.kind || src.kind === 'main' || !src.turret) return false;
    if (!dest.enabled || dest.main || dest.filled) return false;
    if (!canPlaceTurret(src.kind, pad)) return false;
    dest.filled = true;
    dest.level = src.level;
    dest.kind = src.kind;
    dest.turret = src.turret;
    this.setTurretDisplayPosition(dest);
    dest.turret.group.scale.setScalar(1 + (dest.level - 1) * 0.08);
    src.filled = false;
    src.level = 0;
    src.kind = null;
    src.turret = null;
    this.selected = index;
    this.moving = false;
    this.rangeRequested = true;
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
      slot.turret.dispose();
      slot.turret = null;
    }
    slot.filled = false;
    slot.level = 0;
    slot.kind = null;
    this.moving = false;
    this.rangeRequested = false;
    this.refreshPads();
    this.refreshRange();
    return refund;
  }

  /** Hit the visible portrait before the ground pad; tall heroes no longer shift tap targets. */
  pickSlot(point:Vector3,camera:Camera):number {
    camera.updateMatrixWorld();this.group.updateMatrixWorld(true);
    const tap=point.clone().applyMatrix4(camera.matrixWorldInverse),center=new Vector3();
    // Empty build controls take priority over overlapping cosmetic tower artwork.
    for(const slot of this.slots){
      if(!slot.enabled||slot.filled||slot.main)continue;
      slot.pad.getWorldPosition(center).applyMatrix4(camera.matrixWorldInverse);
      if(Math.hypot(tap.x-center.x,tap.y-center.y)<=.78)return slot.index;
    }
    for(const slot of this.slots){
      const body=slot.head||slot.turret?.group.children[0];if(!slot.filled||!body)continue;
      body.getWorldPosition(center).applyMatrix4(camera.matrixWorldInverse);
      const radius=(slot.main?.8:.7)*(slot.head?.scale.x||slot.turret?.group.scale.x||1);
      if(Math.hypot(tap.x-center.x,tap.y-center.y)<=radius)return slot.index;
    }
    this.keepMesh.getWorldPosition(center).applyMatrix4(camera.matrixWorldInverse);
    if(this.keepMesh.visible&&Math.hypot(tap.x-center.x,tap.y-center.y)<1.2)return MAIN_INDEX;
    return slotIndexAt(point.x,point.z,this.slots);
  }

  selectedSlot(): Slot {
    return this.slots[this.selected];
  }


  get abilityEnvelope():{x:number;y:number;radius:number} {
    const slot=this.slots[MAIN_INDEX];
    return mapPowerEnvelope({x:slot.x,y:-slot.z},{minX:-this.powerField.width/2,maxX:this.powerField.width/2,minY:-this.powerField.depth/2,maxY:this.powerField.depth/2});
  }

  get powerEnvelope():{x:number;y:number;radius:number} {
    const slot=this.slots[MAIN_INDEX];
    return {x:slot.x,y:-slot.z,radius:towerStats(slot.level,true).range*turretLevelTuning('main',slot.level).rangeMultiplier};
  }

  setTowerHealth(ratio: number): void {
    this.hpRail.set(ratio);
    this.towerHpFill.userData.healthRatio=ratio;
  }

  heroAttack():void { this.heroMotion.fire(); }

  damageFeedback(): void {
    this.hitTimer = 0.24;
  }

  get hasSelection():boolean {return this.rangeRequested;}

  deselect():void {this.rangeRequested=false;this.moving=false;this.refreshPads();this.refreshRange();}

  select(index: number): void {
    if (index < 0 || !this.slots[index]?.enabled) return;
    this.moving = false;
    this.selected = index;
    this.rangeRequested = true;
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
    this.hpRail.update(dt);
    if (this.hitTimer > 0) {
      this.hitTimer = Math.max(0, this.hitTimer - dt);
      this.keepMesh.position.x = this.towerHome.x + Math.sin(this.hitTimer * 105) * 0.055 * (this.hitTimer / 0.24);
    } else {
      this.keepMesh.position.copy(this.towerHome);
    }
    this.tickStudioSkins(dt);
    this.heroMotion.update(dt);this.towerMotion?.update(dt);
    this.combatEffects.update(dt);
    let shot = false;
    for (const slot of this.slots) {
      if (!slot.filled) continue;
      if (slot.turret) {
        const fired = slot.turret.tick(slot.x, slot.z, slot.level, {
          dt: dt,
          fruits,
          juice,
          bank,
          onHit,
          shoot: (tx, tz, hex) => {const tuning=turretLevelTuning(slot.kind!,slot.level),origin=slot.turret!.group.localToWorld(new Vector3(0,.72,0));this.combatEffects.shot(slot.kind as TurretKind,origin,_aim.set(tx,1.1,tz),slot.level,tuning.effectColor?Number(tuning.effectColor.replace('#','0x')):hex,tuning.effectScale,turretRange(slot.kind as TurretKind,slot.level));},
        });
        if (fired) shot = true;
        continue;
      }
      slot.cooldown = Math.max(0, slot.cooldown - dt);
      const stats = towerStats(slot.level, slot.main);
      let best: Fruit | null = null;
      let bestD = stats.range*turretLevelTuning('main',slot.level).rangeMultiplier;
      for (const fruit of fruits) {
        if (!fruit.alive || fruit.enemyKind === 'bladebound' || fruit.enemyKind === 'ghost') continue;
        const d = Math.hypot(fruit.group.position.x - slot.x, fruit.group.position.z - slot.z);
        if (d < bestD) {
          bestD = d;
          best = fruit;
        }
      }
      if(best&&slot.head)slot.head.userData.combatAim={x:best.group.position.x-slot.x,z:best.group.position.z-slot.z};
      if (!best || slot.cooldown > 0) continue;
      const fireMul = getTowerMilestoneBonuses(getTowerXpState().level).defenceFireRateMultiplier;
      const tuning=turretLevelTuning('main',slot.level);
      slot.cooldown = tuning.cooldownMultiplier / (stats.fireRate * fireMul);
      // Portraits face the camera; projectiles aim at the actual target.
      if(slot.main)this.towerMotion?.fire();
      this.combatEffects.shot('main',new Vector3(slot.x,1.5,slot.z),best.group.position,slot.level);
      onHit({ fruit: best, damage: stats.damage*tuning.damageMultiplier });
      if(!(fireStudioEvent(`tower-main-level-${slot.level}`,'onAttack',this.towerHome)||fireStudioEvent('tower-main','onAttack',this.towerHome)))playStudioSound('turret-main');
      shot = true;
    }

    return shot;
  }

  private makeHead(col: number, row: number, radius: number): Mesh {
    const mat = new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide, transparent: true });
    const map = fruitAtlas.tile(col, row);
    if (map) {
      mat.map = map;
      mat.needsUpdate = true;
    }
    const portrait = new Mesh(new CircleGeometry(radius, 48), mat);
    portrait.userData.combatPortrait=true;
    portrait.add(combatTokenFrame(radius, 'hero'));
    return portrait;
  }

  private resizeHead(slot: Slot): void {
    if(slot.main)this.refreshTowerTexture();
    if (!slot.head) return;
    const grow = 1 + (slot.level - 1) * 0.1;
    slot.head.scale.setScalar(grow);
  }

  private refreshPads(): void {
    const movingKind = this.moving ? this.slots[this.selected]?.kind : null;
    for (const slot of this.slots) {
      slot.pad.visible=slot.enabled && !slot.main && !slot.filled;
      const mat = slot.pad.material as MeshBasicMaterial;
      for(const mark of slot.pad.children)mark.visible=!slot.filled;
      if (this.moving && movingKind && movingKind !== 'main' && !slot.filled && !slot.main) {
        mat.color.setHex(canPlaceTurret(movingKind, slot) ? 0x38bdf8 : 0x57534e);
        continue;
      }
      if (this.rangeRequested && slot.index === this.selected) mat.color.setHex(0xffc34a);
      else if (slot.main) mat.color.setHex(0xf3f4f6);
      else if (slot.filled) mat.color.setHex(0xf0b429);
      else mat.color.setHex(0xffe394);
    }
  }

  private refreshRange(): void {
    if (!this.rangeRequested) {
      this.rangeRing.visible = false;
      return;
    }
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
    const r = kind==='main'?towerStats(slot.level,true).range*turretLevelTuning('main',slot.level).rangeMultiplier:turretRange(kind,slot.level);
    this.rangeRing.visible = true;
    this.rangeRing.position.set(slot.x, 0.08, slot.z);
    this.rangeRing.scale.setScalar(r);
  }
}
