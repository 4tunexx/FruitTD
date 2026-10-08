import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrthographicCamera, Vector3 } from 'three';
import { GameRenderer } from './renderer';

test('solo camera stays angled and anchors wall HP near the lower safe edge on every screen',()=>{
 for(const [width,height] of [[390,760],[844,390],[1440,900]]){
  (globalThis as any).window={innerWidth:width,innerHeight:height};
  const field:any=Object.create(GameRenderer.prototype);
  Object.assign(field,{renderer:{setSize(){}},composer:{setSize(){}},camera:new OrthographicCamera(-10,10,10,-10,.1,120),cameraBase:new Vector3(0,26,-32),panX:0,panZ:0,viewH:20});
  field.resize();
  const pitch=Math.abs(field.camera.getWorldDirection(new Vector3()).y);
  assert.ok(pitch>.5&&pitch<.7,'fixed 2.5D pitch');
  const hp=new Vector3(0,.15,-10.6).project(field.camera);
  assert.ok(Math.abs((1-hp.y)/2-.88)<.001,'health rail remains at 88% of viewport');
  for(const x of [-10,10])assert.ok(Math.abs(new Vector3(x,0,-9.2).project(field.camera).x)<1,'entire wall fits');
 }
});
