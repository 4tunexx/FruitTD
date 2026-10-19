import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installDomStub} from '../ui/domStub.test-helper';
installDomStub();
(globalThis as any).localStorage={getItem:()=>null,setItem:()=>{}};
import {TurretRig,turretRange,TURRETS} from './turrets';
import {FruitField} from './fruits';
import {JuiceBank,JuiceSystem} from './juice';
import {projectileTravelSeconds,weaponStats} from './turretWeapons';
import {turretVictims} from './turretTargets';
function scenario(kind:typeof TURRETS[number]['kind'],points:Array<[number,number]>) {
 const field=new FruitField(()=>{}),rig=new TurretRig(kind),bank=new JuiceBank(),hits=new Map();
 bank.orange=10;bank.pink=12;bank.yellow=10;
 const fruits=points.map(([x,z])=>{const f=field.spawn('orange')!;f.group.position.set(x,.7,z);return f;});
 const ctx={dt:.05,fruits,bank,juice:new JuiceSystem(),onHit:({fruit,damage}:any)=>hits.set(fruit,(hits.get(fruit)||0)+damage),shoot:()=>{}};
 return {rig,bank,fruits,hits,ctx};
}
test('flames hit their aimed cone while fertiliser covers only its displayed radius',()=>{
 const flame=scenario('vortex',[[0,2],[.4,3],[2,0],[0,-2],[0,6]]);
 flame.rig.tick(0,0,1,flame.ctx);
 assert.equal(flame.hits.size,2);assert.ok(flame.hits.has(flame.fruits[1]));assert.ok(!flame.hits.has(flame.fruits[2]));
 const spray=scenario('sprinkler',[[0,2],[-2,0],[2,0],[0,-2],[0,5]]);
 spray.rig.tick(0,0,1,spray.ctx);assert.equal(spray.hits.size,4);assert.equal(spray.bank.orange,9);
 assert.ok(spray.fruits.slice(0,4).every(f=>f.brittle>0));assert.equal(spray.fruits[4]!.brittle,0);
});
test('rockets home then explode once; bombs keep their landing zone and can miss runners',()=>{
 for(const kind of ['railgun','blender'] as const){
  const game=scenario(kind,[[0,3],[.5,3],[5,5]]);game.rig.tick(0,0,1,game.ctx);assert.equal(game.hits.size,0);
  game.fruits[0]!.group.position.x=3;
  game.ctx.dt=projectileTravelSeconds(kind,3)+.01;game.rig.tick(0,0,1,game.ctx);
  assert.equal(game.hits.has(game.fruits[0]),kind==='railgun');
  assert.equal(game.hits.has(game.fruits[1]),kind==='blender');assert.equal(game.hits.has(game.fruits[2]),false);
  const hits=new Map(game.hits);game.ctx.dt=.01;game.rig.tick(0,0,1,game.ctx);assert.deepEqual(game.hits,hits);
 }
});
test('upgrades expand weapon reach and blasts without making saws map-wide',()=>{
 for(const turret of TURRETS){assert.ok(turretRange(turret.kind,10)>turretRange(turret.kind,1));assert.ok(weaponStats(turret.kind,10).damage>weaponStats(turret.kind,1).damage);}
 assert.ok(turretRange('guillotine',10)<turretRange('vortex',1));
 assert.ok(weaponStats('blender',10).blast>weaponStats('blender',1).blast);
 const points=[{x:0,y:3},{x:1.9,y:3}];
 assert.equal(turretVictims('railgun',{x:0,y:0},points[0],points,p=>p,8,1).length,1);
 assert.equal(turretVictims('railgun',{x:0,y:0},points[0],points,p=>p,8,10).length,2);
});


test('stored retired weapon defaults migrate while custom Admin balance is preserved',async()=>{
 const {mergeAdminConfig}=await import('../services/admin');
 const old={cost:200,damage:42,range:2,cooldownMs:700};
 const config=mergeAdminConfig({pvpConfig:{towers:{blender:old}}} as any);
 assert.equal(config.pvpConfig.towers.blender!.range,5);assert.equal(config.pvpConfig.towers.blender!.cooldownMs,1800);
 const custom={...old,damage:48};
 assert.deepEqual(mergeAdminConfig({pvpConfig:{towers:{blender:custom}}} as any).pvpConfig.towers.blender,custom);
});
