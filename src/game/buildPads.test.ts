import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,MeshBasicMaterial,OrthographicCamera,Plane,Ray,Vector3} from 'three';
import {battleMapPads,createBuildPad,BUILD_PAD_ORDER} from './buildPads';
import {defaultMapForMode,mapPointToWorld,normalizeBattleMap} from './battleMaps';
import {frameCombatCamera} from '../engine/combatCamera';
import {MAIN_INDEX,PADS} from './world';
(globalThis as any).localStorage??={getItem:()=>null,setItem:()=>{}};

test('gold build controls render above opaque skins and keep a contrasting backing',()=>{
 const pad=createBuildPad();assert.equal(pad.renderOrder,BUILD_PAD_ORDER);
 assert.equal(pad.children.filter(child=>child.name==='build-plus').length,2);
 assert.ok(pad.children.find(child=>child.name==='build-backing'));
 pad.traverse(child=>{if(child instanceof Mesh){const mat=child.material as MeshBasicMaterial;assert.equal(mat.depthTest,false);assert.equal(mat.depthWrite,false);assert.ok(child.renderOrder>=BUILD_PAD_ORDER-1);}});
});

test('every solo/local mode uses the authored pad geometry and preserves the main index',async()=>{
 const {WallBase}=await import('./wall');
 for(const mode of ['casual','horde','campaign','coop'] as const){
  const map=defaultMapForMode(mode),first=map.entities.find(e=>e.kind==='turret-slot')!;
  first.x=.17;first.y=.59;
  const wall=new WallBase();wall.applyBattleMap(map);
  const expected=mapPointToWorld(first,map),slot=wall.slots[0]!;
  assert.equal(slot.x,expected.x);assert.equal(slot.z,expected.z);
  assert.equal(slot.pad.position.x,expected.x);assert.equal(slot.pad.position.z,expected.z);
  assert.equal(wall.slots[MAIN_INDEX]!.main,true);
  assert.equal(wall.slots.filter(s=>!s.main&&s.enabled).length,8);
  assert.equal(wall.placeSlicer(0,'laser'),true);assert.equal(slot.pad.visible,false,'occupied plot hides its +');
  assert.equal(slot.turret!.group.position.x,expected.x);assert.equal(slot.turret!.group.position.z,expected.z);
  wall.sellSelected();assert.equal(slot.pad.visible,true,'selling restores its +');wall.dispose();
 }
});

test('default pad projection remains pickable above wall skins on phone and PC',async()=>{
 const {WallBase}=await import('./wall');
 for(const [w,h] of [[390,730],[950,700],[1400,850]]){
  const wall=new WallBase(),camera=new OrthographicCamera(-12,12,20,-20,.1,220);frameCombatCamera(camera,w,h,28,w>=600);
  wall.group.updateMatrixWorld(true);
  for(const slot of wall.slots.filter(s=>!s.main)){
   const projected=slot.pad.getWorldPosition(new Vector3()).project(camera);
   const origin=new Vector3(projected.x,projected.y,-1).unproject(camera),direction=camera.getWorldDirection(new Vector3());
   const hit=new Ray(origin,direction).intersectPlane(new Plane(new Vector3(0,1,0),-.75),new Vector3())!;
   assert.equal(wall.pickSlot(hit,camera),slot.index,`${w}x${h}: pad ${slot.index}`);
  }
  wall.dispose();
 }
});

test('authored pad removal/addition is bounded; disabled placeholders cannot build or be selected',async()=>{
 const {WallBase}=await import('./wall');
 const map=defaultMapForMode('horde');map.entities=[];
 const wall=new WallBase();wall.applyBattleMap(map);
 assert.equal(wall.slots.filter(s=>!s.main&&s.enabled).length,0);
 assert.equal(wall.placeSlicer(0,'laser'),false);wall.select(0);assert.equal(wall.selected,MAIN_INDEX);
 const source=defaultMapForMode('casual').entities[0]!;
 map.entities=Array.from({length:40},(_,i)=>({...source,id:`pad-${i}`,x:.1+i*.02}));
 assert.equal(battleMapPads(normalizeBattleMap(map)).filter(p=>!p.main&&p.enabled).length,32);
 wall.applyBattleMap(map);assert.equal(wall.slots.length,33);assert.equal(wall.slots[MAIN_INDEX]!.main,true);
 wall.applyBattleMap(defaultMapForMode('casual'));assert.equal(wall.slots.length,PADS.length);wall.dispose();
});

test('Creator wall and chain-burst artwork target the runtime skin and enemy key',async()=>{
 const {builtinEntityArtwork}=await import('./entityArtwork');const {WALL_SKINS}=await import('./save');
 const {enemyKindToStudioKey}=await import('./studioRuntime');
 assert.equal(builtinEntityArtwork('tower-wall')!.source,WALL_SKINS[0]!.texture);
 assert.equal(enemyKindToStudioKey('chainburst'),'enemy-chainburst');
});
