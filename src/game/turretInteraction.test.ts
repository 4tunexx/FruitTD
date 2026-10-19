import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Group, Mesh, OrthographicCamera, Plane, Ray, Vector3 } from 'three';
import { faceCombatPortraits } from './portraitFacing';
import { TurretEffects } from './turretEffects';
import { turretVictims } from './turretTargets';
import { normalizeCreatorMedia, setPublishedCreatorMedia } from './creatorMedia';
import { loadStudioStore } from './creatorMediaModel';
import { loadSoundBank } from './studioSoundBank';
import { normalizeTurretTuning } from './turretTuning';

(globalThis as any).localStorage ??={getItem:()=>null,setItem:()=>{}};

test('a visible keep tap selects its actual tower; deselection clears the range without changing levels',async()=>{
  const {WallBase}=await import('./wall');const {MAIN_INDEX}=await import('./world');const wall=new WallBase();
  const camera=new OrthographicCamera(-11,11,20,-20,.1,200);camera.position.set(0,32,-24);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const keep=(wall as any).keepMesh as Mesh,tower=wall.slots[MAIN_INDEX]!.head!;
  assert.ok(keep.position.y>tower.position.y+2,'hero sits over the keep rather than beneath it');
  for(const body of [keep,tower]){
    const world=body.getWorldPosition(new Vector3());const projected=world.clone().project(camera);
    const origin=new Vector3(projected.x,projected.y,-1).unproject(camera),direction=camera.getWorldDirection(new Vector3());
    const tap=new Ray(origin,direction).intersectPlane(new Plane(new Vector3(0,1,0),-.75),new Vector3())!;
    assert.equal(wall.pickSlot(tap,camera),MAIN_INDEX);
  }
  wall.select(MAIN_INDEX);assert.equal(wall.hasSelection,true);assert.equal((wall as any).rangeRing.visible,true);
  wall.deselect();assert.equal(wall.hasSelection,false);assert.equal((wall as any).rangeRing.visible,false);assert.equal(wall.slots[MAIN_INDEX]!.level,1);
});

test('mechanisms aim at the projected enemy from both directions without rotating their portrait',()=>{
  for(const z of [-24,24]){
    const root=new Group(),portrait=new Mesh();portrait.userData.combatPortrait=true;portrait.userData.combatAim={x:3,z:8};root.add(portrait);
    const gun=new Group();gun.name='turret-aim';portrait.add(gun);
    const camera=new OrthographicCamera(-11,11,20,-20,.1,200);camera.position.set(0,32,z);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    faceCombatPortraits(root,camera);
    const target=new Vector3(3,0,8).applyQuaternion(camera.quaternion.clone().invert());
    const actual=new Vector3(0,1,0).applyQuaternion(gun.quaternion);
    assert.ok(actual.dot(new Vector3(target.x,target.y,0).normalize())>.999);
    assert.ok(portrait.quaternion.angleTo(camera.quaternion)<.001);
  }
});

test('each turret has visible signature effects and all transient geometry expires',()=>{
  const fx=new TurretEffects(),counts=new Set<number>();
  for(const kind of ['guillotine','vortex','laser','railgun','sprinkler','blender','main'] as const){
    fx.shot(kind,new Vector3(0,1,0),new Vector3(2,1,4),3);const effect=fx.group.children.at(-1)!;
    assert.ok(effect.children.length>=3);counts.add(effect.children.length);
    effect.traverse(node=>{if(node instanceof Mesh){assert.equal((node.material as any).depthTest,false);node.geometry.computeBoundingSphere();assert.ok(node.geometry.boundingSphere!.radius>.02);assert.ok(Number.isFinite(node.geometry.boundingSphere!.radius));}});
  }
  assert.ok(counts.size>=3,'cutters, beams, mist, cannon and vortex have distinct geometry');
  fx.update(.1);assert.ok(fx.group.children.length>0);fx.update(1);assert.equal(fx.group.children.length,0);
  for(let i=0;i<90;i++)fx.shot('main',new Vector3(),new Vector3(0,0,4));assert.equal(fx.group.children.length,32);fx.clear();assert.equal(fx.group.children.length,0);
});

test('server attack shapes distinguish piercing, splash and radial cutters',()=>{
  const a={x:0,y:2},behind={x:0,y:4},near={x:.8,y:2},off={x:3,y:4},units=[a,behind,near,off],point=(v:typeof a)=>v;
  assert.deepEqual(turretVictims('laser',{x:0,y:0},a,units,point,5),[a,behind]);
  assert.deepEqual(turretVictims('railgun',{x:0,y:0},a,units,point,5),[a,behind]);
  assert.deepEqual(turretVictims('sprinkler',{x:0,y:0},a,units,point,5),[a,near]);
  assert.deepEqual(turretVictims('vortex',{x:0,y:0},a,units,point,5),[a]);
  assert.deepEqual(turretVictims('guillotine',{x:0,y:0},a,units,point,3),[a,near]);
});

test('published turret level settings, attack hooks and audio survive server and draft normalization',()=>{
  const url='/api/media/0123456789abcdef01234567';
  const media=normalizeCreatorMedia({sounds:{'turret-laser':url},entities:{'tower-laser-level-3':{sheetDataUrl:url,cols:1,rows:1,clips:{idle:{startFrame:0,frameCount:1}},turret:{damageMultiplier:2,rangeMultiplier:1.5,cooldownMultiplier:.8,effectColor:'#ffe394',effectScale:1.4},events:{onAttack:{sfxSlot:'turret-laser'},onImpact:{sfxSlot:'lemonImpact',fx:'spark'}}}}})!;
  assert.equal(media.entities['tower-laser-level-3']!.events!.onImpact!.sfxSlot,'lemonImpact');
  assert.equal(media.entities['tower-laser-level-3']!.turret!.rangeMultiplier,1.5);
  setPublishedCreatorMedia(media);assert.equal(loadSoundBank().replacements['turret-laser'],url);
  const previous=(globalThis as any).localStorage;
  (globalThis as any).localStorage={getItem:()=>JSON.stringify(media)};
  const draft=loadStudioStore();assert.equal(draft.sounds!['turret-laser'],url);assert.equal(draft.entities['tower-laser-level-3']!.turret!.effectScale,1.4);
  (globalThis as any).localStorage=previous;setPublishedCreatorMedia(null);
  assert.throws(()=>normalizeCreatorMedia({entities:{},sounds:{bad:'javascript:alert(1)'}}));
  assert.equal(normalizeTurretTuning({damageMultiplier:999,rangeMultiplier:-4})!.damageMultiplier,10);
  assert.equal(normalizeTurretTuning({damageMultiplier:999,rangeMultiplier:-4})!.rangeMultiplier,.25);
});
