import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {normalizeTurretTuning} from './turretTuning';
import {TurretEffects} from './turretEffects';
import {withStudioPreview,getStudioEntityData,turretLevelTuning} from './studioRuntime';

test('visual salvo count is bounded and leaves damage tuning independent',()=>{
  const tuning=normalizeTurretTuning({projectileCount:100,damageMultiplier:2})!;
  assert.equal(tuning.projectileCount,5);assert.equal(tuning.damageMultiplier,2);
  const effects=new TurretEffects();
  effects.shot('railgun',new Vector3(),new Vector3(0,0,3),2,0xff00ff,1,undefined,3);
  assert.equal(effects.group.children.length,3);
  for(const group of effects.group.children){const projectile=group.children.find(child=>child.userData.projectile) as any;assert.equal(projectile.material.color.getHex(),0xff00ff);}
  effects.clear();assert.equal(effects.group.children.length,0);
});

test('preview level tuning is scoped and restores runtime state even after errors',()=>{
  const previous=getStudioEntityData('tower-laser-level-2');
  const entity={sheetDataUrl:null,cols:1,rows:1,frameW:0,frameH:0,clips:{},turret:normalizeTurretTuning({projectileCount:3})};
  assert.throws(()=>withStudioPreview({'tower-laser-level-2':entity},()=>{
    assert.equal(turretLevelTuning('laser',2).projectileCount,3);
    throw Error('preview closed');
  }),/preview closed/);
  assert.equal(getStudioEntityData('tower-laser-level-2'),previous);
});
