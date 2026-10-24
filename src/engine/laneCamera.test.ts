import {test} from 'node:test';
import assert from 'node:assert/strict';
import {laneFrame} from './laneCamera';
test('arena lens fits width on phones and desktops and bounds vertical travel at both ends',()=>{
 for(const [w,h] of [[320,480],[390,640],[768,700],[1200,690],[844,230]]){
  const south=laneFrame(w,h,22,-48,48,10000),north=laneFrame(w,h,22,-48,48,-10000);
  assert.ok(south.viewWidth>=22);assert.ok(south.viewWidth<=22*1.35);
  assert.equal(south.centerZ,south.high);assert.equal(north.centerZ,north.low);
  assert.equal(south.viewWidth,north.viewWidth);assert.equal(south.viewHeight,north.viewHeight);
  assert.ok(south.high<=48&&north.low>=-48);
 }
});
