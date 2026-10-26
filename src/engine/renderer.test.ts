import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrthographicCamera, Vector3 } from 'three';
import { GameRenderer, combatViewport } from './renderer';
import { SOLO_ARENA_D } from '../game/world';

test('solo camera stays angled and anchors wall HP near the lower safe edge on every screen',()=>{
 for(const [width,height] of [[320,568],[390,760],[430,932],[844,390],[1440,900]]){
  (globalThis as any).window={innerWidth:width,innerHeight:height};
  const field:any=Object.create(GameRenderer.prototype);
  Object.assign(field,{renderer:{setSize(){}},composer:{setSize(){}},camera:new OrthographicCamera(-10,10,10,-10,.1,120),cameraBase:new Vector3(0,26,-32),panX:0,panZ:0,viewH:28});
  field.resize();
  const pitch=Math.abs(field.camera.getWorldDirection(new Vector3()).y);
  assert.ok(pitch>.8&&pitch<.9,'stable 2.5D pitch');
  const hp=new Vector3(0,.15,-10.6).project(field.camera);
  if(width/height<.82){
   const viewport=combatViewport(width,height);
   const hpScreenY=viewport.top+(1-hp.y)/2*viewport.height;
   assert.ok(Math.abs((1-hp.y)/2-.972)<.002,`portrait defence line at ${width}x${height}: ${(1-hp.y)/2}`);
   assert.ok(height-hpScreenY<28,`no dead strip below the wall at ${width}x${height}`);
   assert.equal(viewport.top+viewport.height,height,'the phone canvas reaches the screen edge');
  }
  else assert.ok(hp.y>-1&&hp.y<0,'health rail remains inside the lower half of the safe viewport');
  if(width/height<.82){
   const spawn=new Vector3(0,.7,SOLO_ARENA_D/2-SOLO_ARENA_D*.025).project(field.camera);
   assert.ok(spawn.y<1,`north spawn at ${width}x${height}: ${spawn.y}`);
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
 assert.deepEqual(combatViewport(390,844),{left:0,top:112,width:390,height:732});
});

test('blade hit camera leans alternately, eases home, and resets with the combo',()=>{
 const field:any=Object.create(GameRenderer.prototype);
 Object.assign(field,{camera:new OrthographicCamera(-10,10,10,-10,.1,220),cameraBase:new Vector3(0,26,-32),panX:0,panZ:0,lookZ:0,blastKick:0,hitZoom:0,hitRoll:0,hitFocusX:0,hitFocusZ:0,hitSide:1,hitTarget:null,hitStreak:0,hitHold:0,hitZoomGoal:0,hitRollGoal:0,canvas:null,shake:new Vector3(),shakeVel:0,shakeAmp:0,reducedMotion:{matches:false}});
 field.impulseHit(3,10,8,101);
 const firstRoll=field.hitRollGoal;
 field.update(1/60);
 assert.ok(field.camera.zoom>1 && field.camera.zoom<1.04);
 assert.ok(Math.abs(field.hitFocusX)>0);
 field.impulseHit(-2,10,9,101);
 assert.ok(field.hitRollGoal*firstRoll<0,'successive impacts lean in opposite directions');
 assert.ok(field.hitZoomGoal>.04,'same-target hits build lens zoom');
 const builtZoom=field.hitZoomGoal;
 field.impulseHit(0,8,10,202);
 assert.ok(field.hitZoomGoal>=builtZoom,'switching zombies in the chain preserves focus');
 for(let frame=0;frame<240;frame++)field.update(1/60);
 assert.ok(Math.abs(field.camera.zoom-1)<.0001,'lens settles after the streak stops');
 field.impulseHit(0,0,12);
 field.resetHitFeedback();
 assert.equal(field.camera.zoom,1);
 assert.equal(field.hitRoll,0);
 field.reducedMotion.matches=true;
 field.impulseHit(1,1,20);
 assert.equal(field.hitZoom,0,'reduced motion prevents a new camera impulse');
});
