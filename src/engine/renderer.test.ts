import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrthographicCamera, Vector3 } from 'three';
import { GameRenderer, combatViewport } from './renderer';
import { SOLO_ARENA_D } from '../game/world';

test('solo camera stays angled and anchors wall HP near the lower safe edge on every screen',()=>{
 for(const [width,height] of [[390,760],[844,390],[1440,900]]){
  (globalThis as any).window={innerWidth:width,innerHeight:height};
  const field:any=Object.create(GameRenderer.prototype);
  Object.assign(field,{renderer:{setSize(){}},composer:{setSize(){}},camera:new OrthographicCamera(-10,10,10,-10,.1,120),cameraBase:new Vector3(0,26,-32),panX:0,panZ:0,viewH:28});
  field.resize();
  const pitch=Math.abs(field.camera.getWorldDirection(new Vector3()).y);
  assert.ok(pitch>.8&&pitch<.9,'stable 2.5D pitch');
  const hp=new Vector3(0,.15,-10.6).project(field.camera);
  assert.ok(hp.y>-1&&hp.y<0,'health rail remains inside the lower half of the safe viewport');
  if(width/height<.82){
   const spawn=new Vector3(0,.7,SOLO_ARENA_D/2-SOLO_ARENA_D*.025).project(field.camera);
   assert.ok(spawn.y<1,'north spawn edge remains in the portrait play view');
  }
  for(const x of [-6.8,6.8])assert.ok(Math.abs(new Vector3(x,0,-9.2).project(field.camera).x)<1,'all artillery pads fit');
 }
});

test('PC combat stage leaves real side-panel space and keeps the approach visible',()=>{
 for(const [width,height] of [[1280,720],[1920,1080],[2560,1440]]){
  const viewport=combatViewport(width,height);
  assert.ok(viewport.left>=220);assert.ok(width-viewport.left-viewport.width>=0);
  assert.equal(viewport.top,78);assert.equal(viewport.height,height-178);
  (globalThis as any).window={innerWidth:width,innerHeight:height};
  const field:any=Object.create(GameRenderer.prototype);
  Object.assign(field,{renderer:{setSize(){}},camera:new OrthographicCamera(-10,10,10,-10,.1,220),cameraBase:new Vector3(0,26,-32),panX:0,panZ:0,viewH:28});
  field.resize();
  const spawn=new Vector3(0,.7,SOLO_ARENA_D/2-SOLO_ARENA_D*.025).project(field.camera);
  field.pan(999,12);field.resize();
  const north=new Vector3(0,.7,SOLO_ARENA_D/2-SOLO_ARENA_D*.025).project(field.camera);
  assert.ok(north.y<1,'north spawn is reachable with bounded vertical movement');assert.equal(field.panX,0);assert.ok(Number.isFinite(spawn.y));
 }
 assert.deepEqual(combatViewport(390,844),{left:0,top:112,width:390,height:636});
});
