import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrthographicCamera, Vector3 } from 'three';
import { GameRenderer } from './renderer';
import { SOLO_ARENA_D } from '../game/world';

test('solo camera stays angled and anchors wall HP near the lower safe edge on every screen',()=>{
 for(const [width,height] of [[390,760],[844,390],[1440,900]]){
  (globalThis as any).window={innerWidth:width,innerHeight:height};
  const field:any=Object.create(GameRenderer.prototype);
  Object.assign(field,{renderer:{setSize(){}},composer:{setSize(){}},camera:new OrthographicCamera(-10,10,10,-10,.1,120),cameraBase:new Vector3(0,26,-32),panX:0,panZ:0,viewH:28});
  field.resize();
  const pitch=Math.abs(field.camera.getWorldDirection(new Vector3()).y);
  assert.ok(width/height<.82 ? pitch>.75&&pitch<.85 : pitch>.5&&pitch<.7,'mode-appropriate 2.5D pitch');
  const hp=new Vector3(0,.15,-10.6).project(field.camera);
  const target=1-6/height;
  assert.ok(Math.abs((1-hp.y)/2-target)<.001,'health rail stays near the lower safe edge');
  if(width/height<.82){
   const spawn=new Vector3(0,.7,SOLO_ARENA_D/2-SOLO_ARENA_D*.025).project(field.camera);
   assert.ok(spawn.y<1,'north spawn edge remains in the portrait play view');
  }
  for(const x of [-6.8,6.8])assert.ok(Math.abs(new Vector3(x,0,-9.2).project(field.camera).x)<1,'all artillery pads fit');
 }
});
