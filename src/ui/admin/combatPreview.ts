import type { TurretTuning } from '../../game/turretTuning';
import { weaponStats, projectileTravelSeconds } from '../../game/turretWeapons';
import { turretLevelTuning } from '../../game/studioRuntime';
import { TurretEffects } from '../../game/turretEffects';
import { turretRange } from '../../game/turrets';
import { AmbientLight, CircleGeometry, DirectionalLight, DoubleSide, Group, Mesh, MeshLambertMaterial, OrthographicCamera, Plane, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from 'three';
import { frameCombatCamera } from '../../engine/combatCamera';
import { Field } from '../../game/field';
import { WallBase } from '../../game/wall';
import { faceCombatPortraits } from '../../game/portraitFacing';
import { TurretRig, type TurretKind } from '../../game/turrets';
import { combatTokenFrame } from '../../game/combatTokens';
import { characterPortrait } from '../../game/characterPortraits';
import { getAdminTexture } from '../../game/adminTextureLoader';
import { sampleStudioTexture } from '../../game/studioRuntime';
import { loadSave, WALL_SKINS } from '../../game/save';
import type { HeroId } from '../../game/heroes';
import type { BattleMap } from '../../game/battleMaps';

/** Isolated rendering of the actual gameplay objects. Never simulates a match or spends currency. */
export class CombatPreview {
 readonly canvas=document.createElement('canvas');
 private readonly renderer:WebGLRenderer;
 private readonly scene=new Scene();
 private readonly camera=new OrthographicCamera(-12,12,16,-16,.1,220);
 private readonly field:Field;
 private readonly wall:WallBase;
 private readonly stage=new Group();
 private readonly effects=new TurretEffects();
 private nextShot=0;private level=1;
 private draftTuning:TurretTuning|undefined;
 private entityKey='';
 private target:Mesh|null=null;private targetHp=60;private respawn=0;
 private impacts:Array<{left:number;damage:number}>=[];
 private readout=document.createElement('p');
 private rig:TurretRig|null=null;
 private frame=0;private last=0;private disposed=false;private mapMode=true;
 private observer:ResizeObserver;
 private selected:TurretKind='railgun';
 
 constructor(private readonly host:HTMLElement){
  this.canvas.className='ftd-combat-preview';this.canvas.setAttribute('aria-label','Live gameplay preview');
  this.renderer=new WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false});
  this.renderer.setClearColor(0x202529);this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  this.field=new Field();this.wall=new WallBase();
  const sun=new DirectionalLight(0xfff4d8,.85);sun.position.set(8,22,-10);
  this.scene.add(new AmbientLight(0xe8f4dc,.92),sun,this.field.group,this.wall.group,this.stage,this.effects.group);
  host.appendChild(this.canvas);this.readout.className='studio-hint';host.appendChild(this.readout);
  this.canvas.addEventListener('pointerdown',this.pick);
  this.observer=new ResizeObserver(this.resize);this.observer.observe(host);
  this.resize();
 }
 setTurret(kind:TurretKind):void {this.selected=kind;}
 setMap(map:BattleMap):void {
  this.mapMode=true;this.clearStage();this.field.group.visible=true;this.wall.group.visible=true;
  const save=loadSave(),skin=WALL_SKINS.find(s=>s.id===save.wallSkin)||WALL_SKINS[0]!;
  this.field.applyBattleMap(map);this.wall.applyBattleMap(map);this.wall.setHero(save.hero);this.wall.applyWallSkin(skin.color,skin.texture);
  this.resize();
 }
 setEntity(key:string,tuning?:TurretTuning):void {
  const same=this.entityKey===key;this.entityKey=key;this.draftTuning=tuning;
  this.mapMode=false;this.clearStage();this.field.group.visible=false;this.wall.group.visible=false;
  const match=key.match(/^tower-(guillotine|vortex|laser|railgun|sprinkler|blender|custom-[a-z0-9-]+?)(?:-level-(\d+))?$/);
  if(match){this.rig=new TurretRig(match[1] as TurretKind);const level=same?this.level:Number(match[2]||1);this.level=level;this.rig.refreshAppearance(level);this.rig.group.scale.setScalar(1+(level-1)*.04);this.stage.add(this.rig.group);
    this.target=new Mesh(new CircleGeometry(.35,24),new MeshLambertMaterial({map:characterPortrait('orange'),color:0xffffff,transparent:true,side:DoubleSide}));
    this.target.position.set(.85,.7,1.5);this.target.userData.combatPortrait=true;this.stage.add(this.target);this.targetHp=60;this.respawn=0;
  }
  else if(key.startsWith('tower-main')||key.startsWith('hero-')){
   this.wall.group.visible=true;this.wall.reset();this.wall.applySkins();this.wall.setHero((key.startsWith('hero-')?key.slice(5):loadSave().hero) as HeroId);
   const level=Number(key.match(/-level-(\d+)$/)?.[1]||1);for(let i=1;i<level;i++)this.wall.upgradeSelected();
  }else{
   const portraits:Record<string,string>={'enemy-normal':'orange','enemy-explosive':'bomb','enemy-armored':'watermelon','enemy-splitter':'kiwi','enemy-swift':'strawberry','enemy-chainburst':'apple','boss-watermelon':'boss-melon'};
   const texture=sampleStudioTexture(key)||getAdminTexture(key as Parameters<typeof getAdminTexture>[0])||characterPortrait(portraits[key]||'boss-orange');
   const mesh=new Mesh(new CircleGeometry(.7,48),new MeshLambertMaterial({map:texture,color:0xffffff,transparent:true,side:DoubleSide}));
   mesh.position.y=.7;mesh.userData.combatPortrait=true;mesh.add(combatTokenFrame(.7,key.startsWith('boss-')?'boss':'fruit'));this.stage.add(mesh);
  }
  this.resize();
 }
 setPreviewLevel(level:number):void {
  this.level=Math.max(1,Math.min(10,Math.round(level)));this.rig?.refreshAppearance(this.level);
 }
 private clearStage():void {
  this.target=null;this.impacts=[];this.readout.textContent='';
  this.effects.clear();this.nextShot=0;this.rig?.dispose();this.rig=null;
  this.stage.traverse(node=>{if(node instanceof Mesh){node.geometry.dispose();(node.material as MeshLambertMaterial).dispose();}});this.stage.clear();
 }
 private pick=(event:PointerEvent)=>{
  if(!this.mapMode)return;
  const rect=this.canvas.getBoundingClientRect(),ray=new Raycaster();
  ray.setFromCamera(new Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),this.camera);
  const point=ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),-.75),new Vector3());if(!point)return;
  const index=this.wall.pickSlot(point,this.camera);if(index<0){this.wall.deselect();return;}
  const repeated=this.wall.hasSelection&&this.wall.selected===index;this.wall.select(index);
  if(!this.wall.selectedSlot().filled)this.wall.placeSlicer(index,this.selected);
  else if(repeated)this.wall.upgradeSelected();
 };
 private resize=()=>{
  if(this.disposed)return;
  const w=Math.round(this.host.clientWidth),h=Math.round(this.host.clientHeight);if(!w||!h)return;
  this.renderer.setSize(w,h,false);
  if(this.mapMode)frameCombatCamera(this.camera,w,h,28,w>=600);
  else{
   const half=this.wall.group.visible?4:1.65,aspect=w/h;
   Object.assign(this.camera,{left:-half*aspect,right:half*aspect,top:half,bottom:-half});
   this.camera.position.set(0,8,this.wall.group.visible?-21:-12);this.camera.lookAt(0,this.wall.group.visible?2.4:.65,this.wall.group.visible?-9.2:0);this.camera.updateProjectionMatrix();
  }
  if(!this.frame){this.last=0;this.frame=requestAnimationFrame(this.tick);}
 };
 private tick=(time:number)=>{
  this.frame=0;if(this.disposed||!this.canvas.isConnected||!this.host.getClientRects().length)return;
  const dt=this.last?Math.min(.05,(time-this.last)/1000):0;this.last=time;
  this.wall.animatePreview(dt);this.rig?.aimAt(0,4);this.rig?.animate(dt,true);
  this.effects.update(dt);this.nextShot-=dt;
  if(this.nextShot<=0){
   this.nextShot=1.25;
   if(this.rig&&this.target?.visible){
    const tuning=this.draftTuning||turretLevelTuning(this.rig.kind,this.level),stats=weaponStats(this.rig.kind,this.level);
    const color=tuning.effectColor?parseInt(tuning.effectColor.slice(1),16):undefined;
    this.nextShot=stats.cooldown*tuning.cooldownMultiplier;
    this.effects.shot(this.rig.kind,new Vector3(0,.7,0),this.target.position.clone(),this.level,color,tuning.effectScale,(weaponStats(this.rig.kind,this.level).range*tuning.rangeMultiplier));
    this.impacts.push({left:projectileTravelSeconds(this.rig.kind,1.7),damage:stats.damage*tuning.damageMultiplier});
   }
   if(this.mapMode)for(const slot of this.wall.slots)if(slot.turret)this.effects.shot(slot.turret.kind,new Vector3(slot.x,1,slot.z),new Vector3(slot.x,1,slot.z+3),slot.level,undefined,1,turretRange(slot.turret.kind,slot.level));
  }
  if(this.rig&&this.target){
   const tuning=this.draftTuning||turretLevelTuning(this.rig.kind,this.level),stats=weaponStats(this.rig.kind,this.level);
   for(const hit of this.impacts)hit.left-=dt;
   const landed=this.impacts.filter(hit=>hit.left<=0);this.impacts=this.impacts.filter(hit=>hit.left>0);
   for(const hit of landed)if(this.target.visible){this.targetHp=Math.max(0,this.targetHp-hit.damage);
    if(this.targetHp<=0){this.target.visible=false;this.respawn=1;
     this.effects.burst(this.target.position,tuning.effectColor?parseInt(tuning.effectColor.slice(1),16):0xffa23d,tuning.deathEffect,tuning.deathScale||1);
    }
   }
   if(!this.target.visible){this.respawn-=dt;if(this.respawn<=0){this.target.visible=true;this.targetHp=60;}}
   const text=`Level ${this.level}/10 · ${Math.round(stats.damage*tuning.damageMultiplier)} damage · ${(stats.cooldown*tuning.cooldownMultiplier).toFixed(2)}s reload · ${(weaponStats(this.rig.kind,this.level).range*tuning.rangeMultiplier).toFixed(1)} range · Target ${Math.ceil(this.targetHp)}/60 HP`;
   if(this.readout.textContent!==text)this.readout.textContent=text;
  }
  faceCombatPortraits(this.scene,this.camera);this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(this.tick);
 };
 dispose():void {if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();this.canvas.removeEventListener('pointerdown',this.pick);this.clearStage();this.wall.dispose();this.field.dispose();this.renderer.dispose();this.canvas.remove();this.readout.remove();}
}
