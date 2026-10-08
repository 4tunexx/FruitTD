import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Scene, Vector3 } from 'three';
import { HERO_ABILITIES } from './heroAbilities';
import { PowerVfx } from './powerVfx';
test('all 30 powers create animated art, expire and release their scene objects',()=>{
  const scene=new Scene(),vfx=new PowerVfx(scene);
  for(const ability of HERO_ABILITIES){vfx.spawn(ability,3,new Vector3(0,.7,10),[new Vector3(2,.7,4)]);assert.ok(scene.children.length>0);const ring=scene.children[0]!.children[0]!;const before=ring.scale.x;vfx.update(.1);assert.notEqual(ring.scale.x,before);vfx.update(4);assert.equal(scene.children.length,0);}
  vfx.spawn(HERO_ABILITIES[0]!,1,new Vector3(),[],10);assert.equal(scene.children.length,0,'old snapshots do not replay expired effects');
  vfx.spawn(HERO_ABILITIES[0]!,1,new Vector3(),[]);vfx.clear();assert.equal(scene.children.length,0);
});
