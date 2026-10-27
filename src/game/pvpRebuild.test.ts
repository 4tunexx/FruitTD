import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PVP_CONFIG, applyPvpCommand, createPvpPlayer, newPvpMatch, advancePvpMatch } from './pvp';
import { arenaBuildAllowed, arenaCatchables, arenaLayoutValid, arenaMap, beginArena, rebuiltPvpConfig, type ArenaMatch } from './pvpRebuild';
import { applyCoopCommand, joinCoopMatch, newCoopMatch, type CoopPlayer } from './onlineCoop';

const config=rebuiltPvpConfig(DEFAULT_PVP_CONFIG);
function arena(mapId='orchard-crossing') {
  const started=1000;
  const match=newPvpMatch('rebuilt-test','arena',[createPvpPlayer('blue','Blue','blue',config,started),createPvpPlayer('red','Red','red',config,started)],started,config) as ArenaMatch;
  match.rulesVersion=2;match.status='active';match.map=structuredClone(config.maps.find(map=>map.id===mapId)!);beginArena(match,started,config);
  return match;
}

test('seven veto maps have genuinely different solid routes and symmetric legal terrain',()=>{
  assert.equal(config.maps.length,7);
  assert.equal(new Set(config.maps.map(map=>JSON.stringify(map.solidCells))).size,7);
  for(const map of config.maps){assert.ok(map.solidCells?.length);assert.ok(map.buildCells.length>10);assert.ok(map.buildCells.every(cell=>!map.solidCells?.includes(cell)&&!map.hazards?.some(h=>h.cell===cell)));assert.deepEqual(arenaMap(map).solidCells,map.solidCells);}
});

test('catch phase mirrors fruit; each drag earns exactly one free release and siege begins with 100 Fruts',()=>{
  const match=arena();const catchable=arenaCatchables(match,1001,'blue')[0]!;
  assert.deepEqual(arenaCatchables(match,1001,'red')[0]?.id,catchable.id);
  applyPvpCommand(match,'blue',{type:'catch',catchableId:catchable.id,from:{x:catchable.x,y:catchable.y},to:{x:9,y:22}},1,1001,config);
  assert.equal(match.players[0].captured?.length,1);
  assert.throws(()=>applyPvpCommand(match,'blue',{type:'catch',catchableId:catchable.id,from:{x:catchable.x,y:catchable.y},to:{x:9,y:22}},2,1002,config),/escaped/);
  assert.throws(()=>applyPvpCommand(match,'blue',{type:'build',tower:'guillotine',cell:match.map!.buildCells[0]!},2,1002,config),/Catch fruit/);
  advancePvpMatch(match,1,21000,config);assert.equal(match.phase,'siege');assert.equal(match.players[0].fruts,100);
  applyPvpCommand(match,'blue',{type:'release',capturedId:match.players[0].captured![0]!.id},2,21001,config);
  assert.equal(match.players[0].fruts,100);assert.equal(match.players[1].attackers.length,1);
});

test('purchased fruit roam in 2D, bosses are limited, and a tied timeout enters overtime',()=>{
  const match=arena('old-grove');advancePvpMatch(match,1,21000,config);
  match.players[0].fruts=1000;
  applyPvpCommand(match,'blue',{type:'send',enemy:'normal'},1,21001,config);
  const unit=match.players[1].attackers[0]!;assert.equal(unit.boss,false);assert.equal(match.players[0].fruts,980);
  const initial={x:unit.x,y:unit.y};
  for(let i=0;i<8;i++)advancePvpMatch(match,.5,21500+i*500,config);
  assert.ok(unit.y!<initial.y!);assert.ok(Number.isFinite(unit.x));
  applyPvpCommand(match,'blue',{type:'send',enemy:'rot-king'},2,26000,config);
  assert.throws(()=>applyPvpCommand(match,'blue',{type:'send',enemy:'runner-overlord'},3,26001,config),/one active boss/);
  match.endsAt=27000;advancePvpMatch(match,.1,27000,config);assert.equal(match.phase,'overtime');assert.equal(match.status,'active');
});

test('a routed siege reaches the rival wall on every map with a legal tower placed',()=>{
  const balance=structuredClone(config);balance.mainTower.damage=0;
  for(const map of balance.maps){
    assert.ok(arenaLayoutValid(map),`${map.name} must have an open route`);
    const match=arena(map.id);advancePvpMatch(match,1,21000,balance);
    match.players[0].fruts=1000;
    const cell=map.buildCells.find(candidate=>arenaBuildAllowed(match,'blue',candidate));assert.ok(cell!==undefined,`${map.name} needs a build hex`);
    applyPvpCommand(match,'blue',{type:'build',tower:'guillotine',cell},1,21001,balance);
    applyPvpCommand(match,'blue',{type:'send',enemy:'normal'},2,21002,balance);
    for(let second=1;second<=155&&match.status==='active';second++){
      for(const player of match.players)player.lastSeenAt=21002+second*1000;
      advancePvpMatch(match,1,21002+second*1000,balance);
    }
    assert.ok(match.players[1].wallHealth<balance.wallHealth,`${map.name} must let the attacker reach the wall`);
  }
});

test('Co-op big purchase needs majority; ordinary purchase stays instant and leaving keeps teammates playing',()=>{
  const member=(id:string):CoopPlayer=>({userId:id,name:id,hero:'jiju',sequence:0,lastSeenAt:1000,lastSlashAt:0,kills:0});
  const room=newCoopMatch('voting',member('a'),DEFAULT_PVP_CONFIG);joinCoopMatch(room,member('b'),1000);room.status='playing';room.fruts=500;
  applyCoopCommand(room,'a',1,{type:'build',tower:'laser',cell:121},2000,DEFAULT_PVP_CONFIG);
  assert.equal(room.towers.length,0);assert.equal(room.proposal?.approvals.length,1);
  applyCoopCommand(room,'b',1,{type:'vote',proposalId:room.proposal!.id,approve:true},2001,DEFAULT_PVP_CONFIG);
  assert.equal(room.towers.length,1);assert.equal(room.fruts,320);
  applyCoopCommand(room,'b',2,{type:'build',tower:'guillotine',cell:122},2002,DEFAULT_PVP_CONFIG);
  assert.equal(room.towers.length,2);assert.equal(room.fruts,240);
  applyCoopCommand(room,'a',2,{type:'leave'},2003,DEFAULT_PVP_CONFIG);
  assert.equal(room.status,'playing');assert.deepEqual(room.players.map(p=>p.userId),['b']);
});

test('open ground preserves arbitrary lateral position instead of following hex centres',()=>{
  const match=arena();advancePvpMatch(match,1,21000,config);
  match.map!.solidCells=[];match.map!.hazards=[];
  match.players[1].attackers=[{id:'free',type:'normal',ownerId:'blue',hp:100,maxHp:100,x:2.137,y:8.23,progress:0}];
  const unit=match.players[1].attackers[0]!;
  advancePvpMatch(match,.5,21500,config);
  assert.ok(Math.abs(unit.x!-2.137)<1e-8);
  assert.ok(Math.abs(unit.y!-7.63)<1e-8);
});

test('off-axis opposing zombies seek one another, clash simultaneously and survivors resume',()=>{
  const balance=structuredClone(config);balance.mainTower.damage=0;
  const match=arena();advancePvpMatch(match,1,21000,balance);match.map!.solidCells=[];match.map!.hazards=[];
  match.players[1].attackers=[{id:'blue-unit',type:'normal',ownerId:'blue',hp:100,maxHp:100,x:2.15,y:1.1,progress:0}];
  match.players[0].attackers=[{id:'red-unit',type:'normal',ownerId:'red',hp:100,maxHp:100,x:3.15,y:-1.1,progress:0}];
  for(let i=1;i<=20;i++)advancePvpMatch(match,.1,21000+i*100,balance);
  const blue=match.players[1].attackers[0]!,red=match.players[0].attackers[0]!;
  assert.ok(blue.fighting&&red.fighting);assert.equal(blue.fightTargetId,red.id);
  assert.ok(blue.hp<100);assert.ok(Math.abs(blue.hp-red.hp)<1e-6);
  red.hp=0;const previous=blue.y!;
  advancePvpMatch(match,.5,23500,balance);assert.ok(blue.y!<previous);assert.equal(blue.fighting,false);
  assert.ok(match.players[0].fruts>balance.startingFruts,'defender earns match Fruts from kills and income');
});

test('long ticks cannot tunnel through a head-on rival or damage one side first',()=>{
  const balance=structuredClone(config);balance.mainTower.damage=0;
  const match=arena();advancePvpMatch(match,1,21000,balance);match.map!.solidCells=[];match.map!.hazards=[];
  for(const [i,ownerId,y] of [[0,'red',-1.4],[1,'blue',1.4]] as const)match.players[i].attackers=[{id:ownerId,type:'swift',ownerId,hp:70,maxHp:70,x:7.137,y,progress:0}];
  advancePvpMatch(match,1,22000,balance);
  const [red,blue]=match.players.map(p=>p.attackers[0]!);
  assert.ok(red!.fighting&&blue!.fighting);assert.ok(red!.y!<blue!.y!);
  assert.ok(Math.abs(red!.hp-blue!.hp)<1e-6);
});

test('capture deadline rejects late claims and does not consume siege time',()=>{
  const match=arena();const item=arenaCatchables(match,1001,'blue')[0]!;
  assert.throws(()=>applyPvpCommand(match,'blue',{type:'catch',catchableId:item.id,from:item,to:{x:9,y:22}},1,21000,config),/ended/);
  advancePvpMatch(match,1,21000,config);
  assert.equal(match.endsAt,21000+config.durationSeconds*1000);
});

test('new build cannot materialize inside a live zombie',()=>{
  const match=arena();advancePvpMatch(match,1,21000,config);
  const cell=match.map!.buildCells[0]!,row=24+Math.floor(cell/match.map!.width);
  match.players[0].attackers=[{id:'on-pad',type:'normal',ownerId:'red',hp:100,x:cell%10+.5+(row%2?.5:0),y:row+.5-24,progress:0}];
  assert.equal(arenaBuildAllowed(match,'blue',cell),false);
});
