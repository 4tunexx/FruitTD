import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Group,Vector3} from 'three';
import {applyPowerStatus,applyWeaponStatus,ignite,tickBurn,type CombatStatus} from './combatStatus';
import {StatusVfx} from './statusVfx';
import {HERO_ABILITIES} from './heroAbilities';
import {POWER_PRESENTATION} from './powerPresentation';
import {PowerVfx} from './powerVfx';
import {powerStats} from './powerCombat';
import {createState,resetState,leakCost,damageTower} from './state';
import {DEFAULT_PVP_CONFIG,createPvpPlayer,newPvpMatch,applyPvpCommand} from './pvp';

test('burn integrates elapsed time once, expires exactly, and refreshes without stacking runaway DPS',()=>{
 const enemy:CombatStatus={};ignite(enemy,1000,10,2000);
 assert.equal(tickBurn(enemy,1500),5);assert.equal(tickBurn(enemy,1500),0);
 ignite(enemy,1500,5,2000);assert.equal(tickBurn(enemy,2000),5);
 assert.equal(tickBurn(enemy,9000),15);assert.equal(tickBurn(enemy,10000),0);
 ignite(enemy,11000,2,1000);assert.equal(tickBurn(enemy,12000),2);
});
test('each hero power has a unique authored motif and icon; freeze, vine and solar effects match the simulation',()=>{
 assert.equal(new Set(HERO_ABILITIES.map(a=>POWER_PRESENTATION[a.id]?.motif)).size,30);
 assert.equal(new Set(HERO_ABILITIES.map(a=>a.iconUrl)).size,30);
 const scene=new Scene(),vfx=new PowerVfx(scene);
 for(const ability of HERO_ABILITIES){
  const enemy:CombatStatus={},stats=powerStats(ability,3);applyPowerStatus(enemy,ability,1000,stats.slowMs,stats.damage);
  assert.ok(enemy.statusKind);vfx.spawn(ability,3,new Vector3(),[new Vector3(0,.7,3)]);
  assert.ok(scene.children.at(-1)?.getObjectByName(POWER_PRESENTATION[ability.id]!.motif));vfx.clear();
  if(['topfu-6','jiju-4'].includes(ability.id))assert.equal(stats.slowMultiplier,0);
  if(ability.id==='lagen-5')assert.equal(enemy.statusKind,'snare');
  if(['ki-5','ki-6'].includes(ability.id))assert.ok(tickBurn(enemy,2000)>0);
 }
});
test('enemy status attachments follow their target, survive ordinary hits, and release on expiration',()=>{
 const scene=new Scene(),target=new Group(),vfx=new StatusVfx();scene.add(target,vfx.group);
 const enemy:CombatStatus={statusKind:'frost',statusUntil:3000};applyWeaponStatus(enemy,'laser',1000,20);assert.equal(enemy.statusKind,'frost');
 vfx.sync('enemy',target,enemy,1000);target.position.set(3,1,4);vfx.update(.1,1100);
 assert.deepEqual(vfx.group.children[0]!.position.toArray(),[3,1,4]);
 let disposed=0;vfx.group.traverse((o:any)=>o.geometry?.addEventListener('dispose',()=>disposed++));vfx.update(2,3100);
 assert.equal(vfx.group.children.length,0);assert.ok(disposed>0);
});
test('solo tower starts at 100 HP, fruit breach damage varies, and arena upgrades add 25 HP',()=>{
 const state=createState();resetState(state);assert.equal(state.lives,100);assert.equal(state.maxLives,100);
 assert.notEqual(leakCost(state,'apple',false),leakCost(state,'watermelon',false));
 assert.ok(leakCost(state,'apple',true)>leakCost(state,'apple',false));
 damageTower(state,leakCost(state,'apple',false));assert.equal(state.lives,93);
 const config=structuredClone(DEFAULT_PVP_CONFIG),a=createPvpPlayer('a','A','blue',config,1000),b=createPvpPlayer('b','B','red',config,1000);
 const match=newPvpMatch('hp','arena',[a,b],1000,config);match.status='active';match.endsAt=100000;match.map=config.map;a.fruts=1000;
 applyPvpCommand(match,'a',{type:'upgrade-main'},1,2000,config);
 assert.equal(a.wallHealth,125);assert.equal(a.wallMaxHealth,125);
});
