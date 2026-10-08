import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HERO_ABILITIES } from './heroAbilities';
import { powerStats } from './powerCombat';
import { DEFAULT_PVP_CONFIG as cfg, createPvpPlayer, newPvpMatch, applyPvpCommand, advancePvpMatch } from './pvp';
import { newCoopMatch, applyCoopCommand, advanceCoopMatch, DEFAULT_COOP_CONFIG } from './onlineCoop';

for(const ability of HERO_ABILITIES)test(`${ability.id}: Arena and Co-op apply rank damage, costs, slow, healing and visible cast events`,()=>{
  const stats=powerStats(ability,5);
  const players=[createPvpPlayer('a','A','blue',cfg),createPvpPlayer('b','B','red',cfg)];
  const own=players[0]!;Object.assign(own,{hero:ability.hero,abilityLoadout:[ability.id],abilityRanks:{[ability.id]:5},fruts:500,wallHealth:50});
  own.attackers=[{id:'fruit',type:'armored',hp:1000,progress:4}];
  const arena=newPvpMatch('test','arena',[players[0]!,players[1]!],1000,cfg);arena.status='active';arena.map=cfg.map;arena.endsAt=100000;
  applyPvpCommand(arena,'a',{type:'ability',abilityId:ability.id},1,2000,cfg);
  assert.equal(own.fruts,500-stats.cost);assert.equal(own.attackers[0]!.hp,1000-stats.damage);
  assert.equal(own.powerCasts?.[0]?.abilityId,ability.id);assert.equal(own.powerCasts?.[0]?.targets.length,1);
  assert.ok(own.wallHealth>=50);if(stats.healFraction)assert.ok(own.wallHealth>50);
  if(stats.slowMs){assert.equal(own.attackers[0]!.slowUntil,2000+stats.slowMs);const previous=own.attackers[0]!.progress;advancePvpMatch(arena,.2,2100,cfg);assert.ok(own.attackers[0]!.progress-previous<cfg.attacks.armored!.speed*.2*Math.max(1,(cfg.map.pathCells.length-1)/13));}
  const after=structuredClone(own);assert.throws(()=>applyPvpCommand(arena,'a',{type:'ability',abilityId:ability.id},2,2100,cfg),/cooling down/);assert.deepEqual(own,after);
  const coop=newCoopMatch('coop',{userId:'a',name:'A',hero:ability.hero,abilityLoadout:[ability.id],abilityRanks:{[ability.id]:5},sequence:0,lastSeenAt:1000,lastSlashAt:0,kills:0},cfg);
  coop.status='playing';coop.fruts=500;coop.wallHealth=50;coop.remainingSpawns=1;coop.spawnAt=10000;coop.fruits=[{id:'fruit',type:'armored',x:5,y:4,hp:1000,boss:false}];
  applyCoopCommand(coop,'a',1,{type:'ability',abilityId:ability.id},2000,cfg);
  assert.equal(coop.fruts,500-stats.cost);assert.equal(coop.fruits[0]!.hp,1000-stats.damage);assert.equal(coop.powerCasts?.[0]?.abilityId,ability.id);
  if(stats.slowMs){assert.equal(coop.fruits[0]!.slowUntil,2000+stats.slowMs);advanceCoopMatch(coop,.2,2100,cfg,DEFAULT_COOP_CONFIG);assert.ok(coop.fruits[0]!.y-4<cfg.attacks.armored!.speed*.2*DEFAULT_COOP_CONFIG.fruitSpeedMultiplier);}
});
test('insufficient funds and unequipped casts leave both online match states unchanged',()=>{
  const own=createPvpPlayer('a','A','blue',cfg);Object.assign(own,{hero:'jiju',abilityLoadout:['jiju-2'],abilityRanks:{'jiju-2':1},fruts:0});
  const match=newPvpMatch('test','arena',[own,createPvpPlayer('b','B','red',cfg)],1000,cfg);match.status='active';match.map=cfg.map;match.endsAt=100000;
  const before=structuredClone(match);assert.throws(()=>applyPvpCommand(match,'a',{type:'ability',abilityId:'jiju-2'},1,2000,cfg),/Fruts/);assert.deepEqual(match,before);
  assert.throws(()=>applyPvpCommand(match,'a',{type:'ability',abilityId:'topfu-1'},1,2000,cfg),/equipped/);assert.deepEqual(match,before);
  const coop=newCoopMatch('coop',{userId:'a',name:'A',hero:'jiju',abilityLoadout:['jiju-2'],abilityRanks:{'jiju-2':1},sequence:0,lastSeenAt:1000,lastSlashAt:0,kills:0},cfg);coop.status='playing';coop.fruts=0;
  const initial=structuredClone(coop);assert.throws(()=>applyCoopCommand(coop,'a',1,{type:'ability',abilityId:'jiju-2'},2000,cfg),/Fruts/);assert.deepEqual(coop,initial);
});
