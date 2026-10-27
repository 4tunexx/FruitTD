import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NetworkMotion2D} from './networkMotion2D';

test('Arena predicts both axes between snapshots without jumping on correction',()=>{
  const motion=new NetworkMotion2D();motion.update(2,10,2,1,1000);
  motion.update(2.7,9.3,2,2,1500);
  const before=motion.sample(1999);
  motion.update(3.4,8.6,2,3,2000);
  const after=motion.sample(2000);
  assert.ok(Math.hypot(after.x-before.x,after.y-before.y)<.02);
  assert.ok(motion.sample(2250).x>after.x);
  assert.ok(motion.sample(2250).y<after.y);
  motion.update(3.6,8.4,2,4,2300,true);
  const stop=motion.sample(3500);
  assert.ok(Math.abs(stop.x-3.6)<.02 && Math.abs(stop.y-8.4)<.02);
});
