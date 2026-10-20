import {test} from 'node:test';
import assert from 'node:assert/strict';
import {heroAbility,HERO_ABILITIES} from './heroAbilities';
import {powerDamageMultiplier,powerTargets,powerStats,superKillCharge,superSliceCharge} from './powerCombat';
import {DEFAULT_PVP_CONFIG as cfg,pvpBuildCellAllowed,pvpPowerEnvelope,normalizePvpMaps,createPvpPlayer,newPvpMatch,applyPvpCommand} from './pvp';
import {newCoopMatch,applyCoopCommand,advanceCoopMatch,coopMainStats,DEFAULT_COOP_CONFIG} from './onlineCoop';
import {towerHealthRail} from './towerHealthRail';

test('all 30 offensive powers obey a circular envelope, preserve close damage and weaken at the edge',()=>{
 const envelope={x:0,y:10,radius:5};
 assert.equal(powerDamageMultiplier({x:0,y:10},envelope),1);
 assert.equal(powerDamageMultiplier({x:3,y:14},envelope),.35);
 assert.equal(powerDamageMultiplier({x:0,y:4.999},envelope),0);
 assert.equal(powerDamageMultiplier({x:NaN,y:0},envelope),0);
 for(const ability of HERO_ABILITIES){
  const items=[{x:0,y:10,id:'close'},{x:0,y:5,id:'edge'},{x:0,y:4.999,id:'outside'},{x:6,y:10,id:'side-outside'}];
  const targets=powerTargets(items,ability,f=>f,envelope);
  assert.ok(targets.some(f=>f.id==='close'));assert.ok(!targets.some(f=>f.id.includes('outside')));
  const base=powerStats(ability,1),max=powerStats(ability,5);
  assert.ok(base.cooldownMs>=18000);assert.ok(max.cooldownMs>=14400);
  assert.ok(max.damage>base.damage);assert.ok(max.cooldownMs<base.cooldownMs);
 }
});

test('Arena/Ranked enforce defensive build territory even on stale maps with forward pads',()=>{
 for(const map of cfg.maps){
  assert.equal(map.height,24);assert.equal(map.buildCells.length,10);
  assert.ok(map.buildCells.every(cell=>pvpBuildCellAllowed(map,cell)));
  for(const queue of ['arena','ranked'] as const)for(const side of ['blue','red'] as const){
   const own=createPvpPlayer('a','A',side,cfg),other=createPvpPlayer('b','B',side==='blue'?'red':'blue',cfg);
   own.fruts=1000;
   const game=newPvpMatch('bounds',queue,[own,other],0,cfg);game.status='active';game.map=structuredClone(map);game.endsAt=100000;
   game.map.buildCells.push(1);
   const before=structuredClone(game);
   assert.throws(()=>applyPvpCommand(game,'a',{type:'build',tower:'laser',cell:1},1,2000,cfg),/Invalid tower/);
   assert.deepEqual(game,before);
   applyPvpCommand(game,'a',{type:'build',tower:'laser',cell:map.buildCells[0]!},1,2000,cfg);
   assert.equal(own.towers.length,1);
  }
 }
 const legacy=structuredClone(cfg.maps).map(map=>({...map,height:14,pathCells:Array.from({length:14},(_,i)=>i*10+4),buildCells:[2,6,32,36,62,66,92,96,122,126]}));
 assert.deepEqual(normalizePvpMaps(legacy),cfg.maps);
});

test('PvP powers reject distant attackers without spending, then tower upgrades extend actual reach with falloff',()=>{
 const own=createPvpPlayer('a','A','blue',cfg),other=createPvpPlayer('b','B','red',cfg);
 Object.assign(own,{hero:'jiju',abilityLoadout:['jiju-1'],abilityRanks:{'jiju-1':1},fruts:1000});
 const game=newPvpMatch('range','arena',[own,other],0,cfg);game.status='active';game.map=cfg.map;game.endsAt=100000;
 own.attackers=[{id:'outside',type:'normal',hp:100,maxHp:100,progress:cfg.map.pathCells.length-3.5}];
 const before=structuredClone(game);
 assert.throws(()=>applyPvpCommand(game,'a',{type:'ability',abilityId:'jiju-1'},1,2000,cfg),/No vulnerable/);assert.deepEqual(game,before);
 const initialRange=pvpPowerEnvelope(cfg.map,cfg,1).radius;
 applyPvpCommand(game,'a',{type:'upgrade-main'},1,2100,cfg);
 assert.ok(pvpPowerEnvelope(cfg.map,cfg,2).radius>initialRange);
 applyPvpCommand(game,'a',{type:'ability',abilityId:'jiju-1'},2,2200,cfg);
 assert.ok(own.attackers[0]!.hp<100);assert.ok(own.attackers[0]!.hp>100-heroAbility('jiju-1')!.damage);
});

test('online Co-op slice-only enemies and bosses ignore turret fire and powers but take direct blade damage',()=>{
 for(const boss of [false,true]){
  const room=newCoopMatch('slice',{userId:'a',name:'A',hero:'jiju',abilityLoadout:['jiju-1'],abilityRanks:{'jiju-1':1},sequence:0,lastSeenAt:0,lastSlashAt:0,kills:0},cfg);
  room.status='playing';room.fruts=500;room.remainingSpawns=1;room.spawnAt=99999;
  room.fruits=[{id:'bladebound',type:'normal',sliceOnly:true,boss,x:5,y:12.5,hp:100,maxHp:100}];
  assert.throws(()=>applyCoopCommand(room,'a',1,{type:'ability',abilityId:'jiju-1'},1000,cfg),/No vulnerable/);
  advanceCoopMatch(room,0,1000,cfg,DEFAULT_COOP_CONFIG);assert.equal(room.fruits[0]!.hp,100);
  applyCoopCommand(room,'a',1,{type:'slash',from:{x:4,y:12.5},to:{x:6,y:12.5}},1100,cfg);
  assert.equal(room.fruits[0]!.hp,65);
  assert.ok(coopMainStats({towerXp:6400},cfg).range>coopMainStats({towerXp:0},cfg).range);
 }
});

test('juice charging stays bounded at max flow and second-cut spam charges less than a kill',()=>{
 for(const flow of [0,5,10,1000]){
  assert.ok(superKillCharge(flow)<=2.4);assert.ok(superKillCharge(flow)>=1.6);
  assert.ok(superSliceCharge(flow,true)<superSliceCharge(flow));
  assert.ok(superSliceCharge(flow)<superKillCharge(flow));
 }
});

test('shared tower rail anchors health at the left edge and animates lost health without changing the fill',()=>{
 const rail=towerHealthRail(20,0x38bdf8);rail.set(.5);
 assert.equal(rail.fill.scale.x,.5);assert.equal(rail.fill.position.x,-5);
 const damage=rail.group.children[2] as typeof rail.fill;
 assert.equal(damage.scale.x,1);rail.update(.3);assert.ok(damage.scale.x<1);assert.ok(damage.scale.x>.5);
 rail.update(2);assert.equal(damage.scale.x,.5);assert.equal(rail.fill.scale.x,.5);
});

test('a full-health guard with no targets cannot waste currency or start a cooldown',()=>{
 const own=createPvpPlayer('a','A','blue',cfg),other=createPvpPlayer('b','B','red',cfg);
 Object.assign(own,{hero:'jiju',abilityLoadout:['jiju-5'],abilityRanks:{'jiju-5':1},fruts:1000});
 const game=newPvpMatch('empty','arena',[own,other],0,cfg);game.status='active';game.map=cfg.map;game.endsAt=100000;
 const before=structuredClone(game);assert.throws(()=>applyPvpCommand(game,'a',{type:'ability',abilityId:'jiju-5'},1,2000,cfg),/No vulnerable/);assert.deepEqual(game,before);
});
