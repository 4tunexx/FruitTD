import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PVP_CONFIG,createPvpPlayer,newPvpMatch,applyPvpCommand,advancePvpMatch } from './pvp';
const config=structuredClone(DEFAULT_PVP_CONFIG);config.mainTower.damage=0;config.reconnectGraceSeconds=1000;
function battle(){const m=newPvpMatch('clash','arena',[createPvpPlayer('a','A','blue',config),createPvpPlayer('b','B','red',config)],1000,config);m.status='active';m.map=config.map;m.endsAt=500000;return m;}
test('released squads start at their own keep, meet and stop rather than walking through one another',()=>{
  const m=battle();applyPvpCommand(m,'a',{type:'send',enemy:'normal'},1,1001,config);applyPvpCommand(m,'b',{type:'send',enemy:'normal'},1,1001,config);
  assert.equal(m.players[0].attackers[0]!.progress,-config.map.pathCells.length);
  let met=false;
  for(let step=1;step<=100;step++){advancePvpMatch(m,.1,1001+step*100,config);if(m.players[0].attackers.some(u=>u.fighting)){met=true;break;}}
  assert.ok(met);const unit=m.players[0].attackers.find(u=>u.fighting)!,p=unit.progress,hp=unit.hp;
  advancePvpMatch(m,.1,12000,config);assert.equal(unit.progress,p);assert.ok(unit.hp<hp);assert.ok(unit.fightTargetId);
  assert.equal(m.players[0].wallHealth,config.wallHealth);assert.equal(m.players[1].wallHealth,config.wallHealth);
});
test('stronger squads win melee, resume their push and eventually damage the opposing keep',()=>{
  const m=battle();m.players[0].attackers=[{id:'blue-target',type:'armored',hp:260,maxHp:260,progress:-1}];m.players[1].attackers=[{id:'red-target',type:'normal',hp:100,maxHp:100,progress:-1}];
  let won=false;
  for(let step=1;step<=1000;step++){advancePvpMatch(m,.1,1000+step*100,config);if(!m.players[1].attackers.length&&m.players[0].attackers.length)won=true;if(m.players[0].wallHealth<config.wallHealth)break;}
  assert.ok(won);assert.equal(m.players[0].wallHealth,config.wallHealth-config.attacks.armored!.wallDamage);assert.equal(m.players[1].wallHealth,config.wallHealth);
});
test('equal opposing fighters die simultaneously with no blue or red damage advantage',()=>{
  const m=battle();for(const p of m.players)p.attackers=[{id:p.userId,type:'normal',hp:100,maxHp:100,progress:-.5}];
  for(let step=1;step<=100;step++)advancePvpMatch(m,.1,1000+step*100,config);
  assert.equal(m.players[0].attackers.length,0);assert.equal(m.players[1].attackers.length,0);assert.equal(m.players[0].score,m.players[1].score);assert.equal(m.players[0].wallHealth,m.players[1].wallHealth);
});
test('long server ticks cannot let fast opposing units tunnel past each other',()=>{
  const m=battle();for(const p of m.players)p.attackers=[{id:p.userId,type:'swift',hp:70,progress:-1.5}];advancePvpMatch(m,1,2000,config);assert.ok(m.players.every(p=>p.attackers[0]!.fighting));assert.ok(m.players.every(p=>p.attackers[0]!.progress<0));
});
test('surviving squads keep attacking the tower on a timed cadence rather than disappearing',()=>{
  const m=battle();m.players[0].attackers=[{id:'siege',type:'normal',hp:100,progress:config.map.pathCells.length-1}];
  advancePvpMatch(m,.1,2000,config);assert.equal(m.players[0].wallHealth,config.wallHealth-25);assert.equal(m.players[0].attackers.length,1);
  advancePvpMatch(m,.1,2100,config);assert.equal(m.players[0].wallHealth,config.wallHealth-25);
  advancePvpMatch(m,.1,3000,config);assert.equal(m.players[0].wallHealth,config.wallHealth-50);assert.ok(m.players[0].attackers[0]!.attackingTower);
});
test('queued pack members cannot fight before they visibly spawn at their keep',()=>{
  const m=battle();m.players[0].attackers=[{id:'siege',type:'normal',hp:100,progress:config.map.pathCells.length-1}];
  m.players[1].attackers=[{id:'queued',type:'normal',hp:100,progress:-config.map.pathCells.length-.8}];advancePvpMatch(m,.1,2000,config);
  assert.ok(m.players[1].attackers[0]!.progress<-config.map.pathCells.length);assert.equal(m.players[1].attackers[0]!.hp,100);assert.equal(m.players[0].attackers[0]!.hp,100);assert.equal(m.players[1].attackers[0]!.fighting,false);
});
