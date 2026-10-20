import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FruitField} from './fruits';
import {planBossWave} from './waves';
import {normalizeCreatorMedia,setPublishedCreatorMedia} from './creatorMedia';
import {refreshCreatorTurrets,TurretRig,turretDef,turretRange} from './turrets';
import {weaponStats} from './turretWeapons';
import {JuiceBank,JuiceSystem} from './juice';
import {turretVictims} from './turretTargets';
(globalThis as any).localStorage??={getItem:()=>null,setItem:()=>{}};

test('Bladebound ordinary enemies and bosses ignore turret and power damage but direct slices kill',()=>{
 for(const boss of [false,true]){
  const field=new FruitField(()=>{}),fruit=field.spawn('orange',boss,'bladebound')!,hp=fruit.hp;
  assert.equal(field.hurt(fruit,10000,'turret'),false);assert.equal(fruit.hp,hp);
  assert.equal(field.hurt(fruit,10000,'super'),false);assert.equal(fruit.hp,hp);
  assert.equal(field.hurt(fruit,NaN,'blade'),false);assert.equal(fruit.hp,hp);
  assert.equal(field.hurt(fruit,10000,'blade'),true);assert.equal(fruit.alive,false);
 }
 assert.equal(planBossWave(6,'campaign',5).items[0].enemy,'bladebound');
});

test('custom published turret survives normalization, builds, upgrades and uses its inherited attack shape',()=>{
 const media=normalizeCreatorMedia({entities:{'tower-custom-orchard':{label:'Orchard Defender',turret:{chassis:'laser',baseDamage:20,damageGrowth:5,baseRange:6,rangeGrowth:.2,baseCooldown:.5,cost:95,deathEffect:'pulse',deathScale:2},cols:1,rows:1,clips:{}}}})!;
 assert.equal(media.entities['tower-custom-orchard'].turret?.deathEffect,'pulse');
 setPublishedCreatorMedia(media);refreshCreatorTurrets();
 const kind='custom-orchard' as const;
 assert.equal(turretDef(kind).name,'Orchard Defender');assert.equal(turretDef(kind).cost,95);
 assert.equal(weaponStats(kind,1).damage,20);assert.equal(weaponStats(kind,10).damage,65);
 assert.equal(turretRange(kind,1),6);assert.ok(turretRange(kind,10)>6);
 const rig=new TurretRig(kind),field=new FruitField(()=>{}),target=field.spawn('orange')!;
 const shielded=field.spawn('orange',false,'bladebound')!;
 target.group.position.set(0,.7,2);shielded.group.position.set(.1,.7,1);
 const hits:string[]=[];
 rig.tick(1,0,1,{dt:.6,fruits:[shielded,target],juice:new JuiceSystem(),bank:new JuiceBank(),shoot:()=>{},onHit:hit=>{if(hit.fruit.enemyKind!=='bladebound')hits.push(hit.kind!);}});
 assert.ok(hits.includes(kind),'custom turret inherits laser damage');
 const first={x:0,y:2},behind={x:0,y:4},off={x:3,y:2};
 assert.deepEqual(turretVictims(kind,{x:0,y:0},first,[first,behind,off],p=>p,6),[first,behind]);
 rig.dispose();setPublishedCreatorMedia(null);refreshCreatorTurrets();
 assert.equal(weaponStats('laser',1).damage,9,'unpublishing restores builtin stats');
});

test('turrets never select a Bladebound enemy as their primary target',()=>{
 const rig=new TurretRig('laser'),field=new FruitField(()=>{}),fruit=field.spawn('orange',false,'bladebound')!;
 fruit.group.position.set(0,.7,1);let shots=0;
 rig.tick(0,0,1,{dt:1,fruits:[fruit],juice:new JuiceSystem(),bank:new JuiceBank(),shoot:()=>shots++,onHit:()=>assert.fail('immune enemy received turret hit')});
 assert.equal(shots,0);rig.dispose();
});
