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

 test('a newly released zombie does not extrapolate away from its spawn',()=>{
  const motion=new NetworkMotion2D();motion.update(5,22,2,1,1000);
  assert.deepEqual(motion.sample(1500),{x:5,y:22});
 });

test('siege movement never predicts beyond a snapshot or pulls back after a stop',()=>{
  const motion=new NetworkMotion2D(true);
  motion.update(5,22,2,1,1000);
  motion.update(5,21,2,2,1500);
  let prior=22;
  for(let at=1500;at<=2400;at+=16){
    const next=motion.sample(at);
    assert.ok(next.y<=prior+1e-8 && next.y>=21);
    assert.ok(prior-next.y<=2*.016+1e-8);
    prior=next.y;
  }
  motion.update(5,21,2,3,2400,true);
  assert.deepEqual(motion.sample(3400),{x:5,y:21});
});
test('siege direction changes preserve the displayed position',()=>{
  const motion=new NetworkMotion2D(true);
  motion.update(2,10,2,1,1000);
  motion.update(2,9,2,2,1500);
  const before=motion.sample(1750);
  motion.update(3,9,2,3,1750);
  assert.deepEqual(motion.sample(1750),before);
  for(let at=1750;at<=3000;at+=16){
    const p=motion.sample(at);assert.ok(p.x>=2&&p.x<=3&&p.y>=9&&p.y<=10);
  }
});
