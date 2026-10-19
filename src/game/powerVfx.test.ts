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

test('hero signatures remain distinct and overlapping casts release GPU resources at the mobile cap',()=>{
  const scene=new Scene(),vfx=new PowerVfx(scene);
  for(const hero of ['jiju','topfu','lagen','tripos','ki']) {
    const ability=HERO_ABILITIES.find(ability=>ability.hero===hero)!;
    vfx.spawn(ability,1,new Vector3(),[new Vector3(1,.7,2)]);
    const cast=scene.children.at(-1)!;
    assert.ok(cast.getObjectByName(`${hero}-signature`));
    assert.equal(cast.getObjectByName('jiju-signature')!==undefined,hero==='jiju');
  }
  let released=0;
  scene.children[0]!.traverse(object=>{
    const geometry=(object as any).geometry;
    geometry?.addEventListener('dispose',()=>released++);
  });
  for(let i=0;i<15;i++)vfx.spawn(HERO_ABILITIES[0]!,5,new Vector3(),Array.from({length:100},()=>new Vector3(2,.7,4)));
  assert.equal(scene.children.length,8);
  assert.ok(released>0,'evicted effects release their geometry');
  vfx.clear();assert.equal(scene.children.length,0);
});
