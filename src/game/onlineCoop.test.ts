import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_PVP_CONFIG } from './pvp';
import { DEFAULT_COOP_CONFIG, newCoopMatch, joinCoopMatch, applyCoopCommand, advanceCoopMatch, coopRewards, type CoopPlayer } from './onlineCoop';
const player=(id:string):CoopPlayer=>({userId:id,name:id,hero:'jiju',sequence:0,lastSeenAt:1000,lastSlashAt:0,kills:0});
const match=()=>{const room=newCoopMatch('test',player('one'),DEFAULT_PVP_CONFIG);joinCoopMatch(room,player('two'),1000);return room;};
test('a fresh Co-op room starts with zero Fruts and tower XP; cleared waves progress only that room',()=>{
  const room=match();assert.equal(room.fruts,0);assert.equal(room.towerXp,0);
  room.status='playing';room.remainingSpawns=0;room.fruits=[];
  advanceCoopMatch(room,0,2000,DEFAULT_PVP_CONFIG,DEFAULT_COOP_CONFIG);
  assert.equal(room.towerXp,DEFAULT_COOP_CONFIG.towerXpPerWave);
  assert.equal(match().towerXp,0);
});
test('two distinct accounts join once, countdown starts, third player cannot join',()=>{const room=match();assert.equal(room.players.length,2);assert.equal(room.status,'countdown');assert.throws(()=>joinCoopMatch(room,player('three'),1000));advanceCoopMatch(room,.2,4001,DEFAULT_PVP_CONFIG,DEFAULT_COOP_CONFIG);assert.equal(room.status,'playing');assert.equal(room.fruits.length,1);});
test('both players slice the same authoritative fruit and receive equal reward totals',()=>{const room=match();room.status='playing';room.remainingSpawns=1;room.fruits=[{id:'fruit',type:'normal',x:5,y:5,hp:60,boss:false}];const cmd={type:'slash' as const,from:{x:4,y:5},to:{x:6,y:5}};applyCoopCommand(room,'one',1,cmd,2000,DEFAULT_PVP_CONFIG);assert.equal(room.fruits[0]!.hp,25);applyCoopCommand(room,'two',1,cmd,2001,DEFAULT_PVP_CONFIG);assert.equal(room.fruits.length,0);assert.equal(room.kills,1);assert.equal(room.players[1]!.kills,1);assert.equal(room.players[0]!.lastStroke?.at,2000);room.completedWaves=6;const a=coopRewards(room,DEFAULT_COOP_CONFIG);assert.deepEqual(a,coopRewards(room,DEFAULT_COOP_CONFIG));assert.equal(a.gems,1);assert.equal(a.coins,61);});
test('shared builds debit once and reject occupied pads, replays and unauthorized actions',()=>{const room=match();room.status='playing';room.fruts=100;const before=room.fruts;applyCoopCommand(room,'one',1,{type:'build',tower:'guillotine',cell:121},2000,DEFAULT_PVP_CONFIG);assert.equal(room.fruts,before-DEFAULT_PVP_CONFIG.towers.guillotine!.cost);assert.throws(()=>applyCoopCommand(room,'two',1,{type:'build',tower:'guillotine',cell:121},2000,DEFAULT_PVP_CONFIG));assert.throws(()=>applyCoopCommand(room,'one',1,{type:'build',tower:'guillotine',cell:122},2000,DEFAULT_PVP_CONFIG));assert.throws(()=>applyCoopCommand(room,'outsider',1,{type:'leave'},2000,DEFAULT_PVP_CONFIG));assert.equal(room.towers.length,1);});
test('boss introduction counts down and creates an actual high-health boss',()=>{const room=match();room.wave=7;room.status='boss-intro';room.phaseUntil=5000;advanceCoopMatch(room,.2,4900,DEFAULT_PVP_CONFIG,DEFAULT_COOP_CONFIG);assert.equal(room.fruits.length,0);advanceCoopMatch(room,.2,5001,DEFAULT_PVP_CONFIG,DEFAULT_COOP_CONFIG);assert.equal(room.status,'playing');assert.equal(room.fruits[0]!.boss,true);assert.equal(room.remainingSpawns,0);assert.ok(room.fruits[0]!.hp>DEFAULT_PVP_CONFIG.attacks.armored!.health);});
test('wall leaks end match; disconnect grace ends abandoned matches; no unearned rewards',()=>{const room=match();room.status='playing';room.wallHealth=1;room.remainingSpawns=1;room.spawnAt=10000;room.fruits=[{id:'leak',type:'normal',x:5,y:14,hp:50,boss:false}];advanceCoopMatch(room,.2,2000,DEFAULT_PVP_CONFIG,DEFAULT_COOP_CONFIG);assert.equal(room.status,'complete');assert.deepEqual(coopRewards(room,DEFAULT_COOP_CONFIG),{coins:0,gems:0,xp:0,towerXp:0});const abandoned=match();advanceCoopMatch(abandoned,.2,47000,DEFAULT_PVP_CONFIG,DEFAULT_COOP_CONFIG);assert.equal(abandoned.reason,'disconnect');});

test('equipped hero power damages the authoritative Co-op field and enforces cooldowns',()=>{const room=match();room.status='playing';room.fruits=[{id:'fruit',type:'normal',x:5,y:5,hp:100,boss:false}];const one=room.players[0]!;one.abilityLoadout=['jiju-1'];one.abilityRanks={'jiju-1':1};applyCoopCommand(room,'one',1,{type:'ability',abilityId:'jiju-1'},2000,DEFAULT_PVP_CONFIG);assert.equal(room.fruits[0]!.hp,82);assert.throws(()=>applyCoopCommand(room,'one',2,{type:'ability',abilityId:'jiju-1'},2500,DEFAULT_PVP_CONFIG),/cooling down/);});

test('shared turret upgrades spend once, change damage, cap at three and sell at a loss',()=>{
 const room=match();room.fruts=1000;room.status='countdown';
 applyCoopCommand(room,'one',1,{type:'build',tower:'guillotine',cell:121},2000,DEFAULT_PVP_CONFIG);
 const id=room.towers[0]!.id;
 applyCoopCommand(room,'two',1,{type:'upgrade',towerId:id},2100,DEFAULT_PVP_CONFIG);
 applyCoopCommand(room,'one',2,{type:'upgrade',towerId:id},2200,DEFAULT_PVP_CONFIG);
 assert.equal(room.towers[0]!.level,3);assert.equal(room.fruts,752);
 const before=structuredClone(room);
 assert.throws(()=>applyCoopCommand(room,'one',3,{type:'upgrade',towerId:id},2300,DEFAULT_PVP_CONFIG),/fully upgraded/);
 assert.deepEqual(room,before);
 room.status='playing';room.remainingSpawns=1;room.spawnAt=10000;
 room.fruits=[{id:'target',type:'normal',x:1.5,y:12.5,hp:1000,boss:false}];
 advanceCoopMatch(room,0,3000,DEFAULT_PVP_CONFIG,DEFAULT_COOP_CONFIG);
 assert.equal(room.fruits[0]!.hp,936,'upgraded turret applies rank-three damage');
 applyCoopCommand(room,'one',3,{type:'sell',towerId:id},3100,DEFAULT_PVP_CONFIG);
 assert.equal(room.towers.length,0);assert.equal(room.fruts,900,'buy/upgrade/sell cannot print Fruts');
 assert.throws(()=>applyCoopCommand(room,'two',2,{type:'sell',towerId:id},3200,DEFAULT_PVP_CONFIG),/Choose/);
});

test('Co-op bombs resist slashes and powers while empty offensive casts preserve the match',()=>{
 const room=match();room.status='playing';room.remainingSpawns=1;room.spawnAt=10000;
 room.fruits=[{id:'bomb',type:'explosive',x:5,y:5,hp:150,boss:false}];
 const one=room.players[0]!;one.abilityLoadout=['jiju-1'];one.abilityRanks={'jiju-1':1};
 const before=structuredClone(room);
 assert.throws(()=>applyCoopCommand(room,'one',1,{type:'ability',abilityId:'jiju-1'},2000,DEFAULT_PVP_CONFIG),/No vulnerable/);
 assert.deepEqual(room,before);
 applyCoopCommand(room,'one',1,{type:'slash',from:{x:4,y:5},to:{x:6,y:5}},2100,DEFAULT_PVP_CONFIG);
 assert.equal(room.fruits[0]!.hp,150);assert.equal(room.wallHealth,978);
});

test('online turret signatures change server damage shapes, slow and knockback',()=>{
 for(const type of ['laser','railgun','sprinkler','vortex','guillotine','blender']){
  const room=match();room.status='playing';room.remainingSpawns=1;room.spawnAt=100000;room.mainLastFiredAt=5000;
  room.towers=[{id:'turret',type,cell:121,level:1,lastFiredAt:0,placedBy:'one'} as any];
  room.fruits=[{id:'front',type:'normal',x:1.5,y:11.5,hp:1000,boss:false},{id:'behind',type:'normal',x:1.5,y:10.5,hp:1000,boss:false},{id:'side',type:'normal',x:2.3,y:11.5,hp:1000,boss:false}];
  advanceCoopMatch(room,0,5000,DEFAULT_PVP_CONFIG,DEFAULT_COOP_CONFIG);
  const [front,behind,side]=room.fruits;
  assert.ok(front!.hp<1000,`${type} hits its target`);
  if(type==='laser'){assert.ok(behind!.hp<1000);assert.equal(side!.hp,1000,'piercing excludes enemies outside the aim line');}
  if(type==='sprinkler'){assert.ok(side!.hp<1000);assert.ok(front!.slowUntil!>5000);}
  if(type==='vortex'){assert.ok(behind!.hp<1000);assert.equal(front!.slowUntil,undefined,'flames do damage rather than invisible passive slow');}
  if(type==='railgun'||type==='blender')assert.ok(side!.hp<1000,'explosives hit the blast zone');
  if(type==='railgun')assert.ok(front!.y<11.5,'heavy cannon pushes enemies back');
  if(type==='guillotine'||type==='blender')assert.ok(side!.hp<1000);
 }
});
