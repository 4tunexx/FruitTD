import assert from 'node:assert/strict';
import {test} from 'node:test';
import {performance} from 'node:perf_hooks';
import {DEFAULT_PVP_CONFIG as config,createPvpPlayer,newPvpMatch,advancePvpMatch,PVP_MAX_TOWER_LEVEL} from './pvp';
import {playPvpBotTurn} from './pvpBot';
import {newCoopMatch,joinCoopMatch,advanceCoopMatch,applyCoopCommand,DEFAULT_COOP_CONFIG,coopRewards,type CoopPlayer} from './onlineCoop';

test('complete simulated Arena and Ranked matches finish on all seven maps without invalid resources or unbounded units',t=>{
 const start=performance.now();let ticks=0,commands=0;
 for(const queue of ['arena','ranked'] as const)for(const map of config.maps){
  const players=[createPvpPlayer('left','Left','blue',config,1000),createPvpPlayer('right','Right','red',config,1000)] as const;
  const game=newPvpMatch(`${queue}:${map.id}`,queue,[players[0],players[1]],1000,config);game.status='active';game.map=structuredClone(map);game.endsAt=1000+config.durationSeconds*1000;
  for(let tick=1;game.status==='active'&&tick<=config.durationSeconds*10+2;tick++){
   const now=1000+tick*100;advancePvpMatch(game,.1,now,config);ticks++;
   if(game.status==='active'&&tick%5===0)for(const player of players)if(playPvpBotTurn(game,player.userId,now,config))commands++;
   if(tick%20===0)for(const player of players){
    assert.ok(Number.isFinite(player.fruts)&&player.fruts>=0);assert.ok(Number.isFinite(player.wallHealth)&&player.wallHealth>=0);
    assert.ok(player.attackers.length<=128);assert.ok(player.attackers.every(unit=>Number.isFinite(unit.hp)&&Number.isFinite(unit.progress)));
    assert.equal(new Set(player.towers.map(tower=>tower.cell)).size,player.towers.length);
    assert.ok(player.towers.every(tower=>map.buildCells.includes(tower.cell)&&Number(tower.level)<=PVP_MAX_TOWER_LEVEL));
   }
  }
  assert.equal(game.status,'complete',`${queue}/${map.id} must terminate`);assert.ok(['wall','timeout'].includes(game.resultReason!));
  const final=structuredClone(game);advancePvpMatch(game,1,game.endsAt+5000,config);assert.deepEqual(game,final,'finished matches remain settled');
 }
 t.diagnostic(`14 full matches; ${ticks} simulation ticks; ${commands} validated commands; ${Math.round(performance.now()-start)} ms CPU wall time (not GPU FPS).`);
});

for(const teamSize of [2,4])test(`online Co-op survives repeated wave/boss cycles with ${teamSize} command streams and ends cleanly`,t=>{
 const player=(id:string):CoopPlayer=>({userId:id,name:id,hero:'jiju',sequence:0,lastSeenAt:1000,lastSlashAt:0,kills:0});
 const first=player('first'),second=player('second'),game=newCoopMatch('long-coop',first,config);joinCoopMatch(game,second,1000);
 if(teamSize===4){joinCoopMatch(game,player('third'),1000);joinCoopMatch(game,player('fourth'),1000);}
 else applyCoopCommand(game,first.userId,1,{type:'start'},1000,config);
 let sawBoss=false,commands=0,ticks=0;const started=performance.now();
 for(let tick=1;tick<=2400&&game.status!=='complete';tick++){
  const now=1000+tick*250;game.players.forEach(p=>p.lastSeenAt=now);
  advanceCoopMatch(game,.25,now,config,DEFAULT_COOP_CONFIG);ticks++;
  if(game.status==='boss-intro')sawBoss=true;
  if(game.status==='playing'){
   const target=game.fruits.filter(f=>f.hp>0).sort((a,b)=>b.y-a.y)[0];
   if(target&&target.y<=14)for(const p of game.players){applyCoopCommand(game,p.userId,p.sequence+1,{type:'slash',from:{x:0,y:target.y},to:{x:10,y:target.y}},now,config);commands++;}
  }
  if(['playing','countdown','boss-intro'].includes(game.status)&&tick%20===0){
   const types=Object.keys(config.towers).filter(type=>type!=='catcher'),cell=Array.from({length:8},(_,i)=>121+i).find(cell=>!game.towers.some(tower=>tower.cell===cell));
   const type=types[game.towers.length%types.length]!;
   if(cell!==undefined&&game.fruts>=config.towers[type]!.cost){applyCoopCommand(game,first.userId,first.sequence+1,{type:'build',tower:type,cell},now,config);commands++;}
  }
  assert.ok(Number.isFinite(game.fruts)&&game.fruts>=0);assert.ok(game.fruits.every(f=>Number.isFinite(f.hp)&&Number.isFinite(f.x)&&Number.isFinite(f.y)));
  assert.ok(game.fruits.length<=100);assert.equal(new Set(game.towers.map(tower=>tower.cell)).size,game.towers.length);
 }
 assert.ok(game.completedWaves>=6,`completed ${game.completedWaves} waves`);assert.ok(sawBoss,'boss phase must occur during the simulated session');
 if(game.status!=='complete')applyCoopCommand(game,first.userId,first.sequence+1,{type:'leave'},602000,config);
 assert.equal(game.status,'complete');const final=structuredClone(game);advanceCoopMatch(game,.25,603000,config,DEFAULT_COOP_CONFIG);assert.deepEqual(game,final);
 const reward=coopRewards(game,DEFAULT_COOP_CONFIG);assert.ok(reward.coins>=0&&reward.coins<=DEFAULT_COOP_CONFIG.rewardCoinCap);
 t.diagnostic(`${ticks} ticks; ${commands} validated commands; ${game.completedWaves} completed waves; boss seen; ${Math.round(performance.now()-started)} ms CPU wall time.`);
});

test('a full opponent lane is a wait state for the server bot, not a match-ending exception',()=>{
 const players=[createPvpPlayer('bot','Bot','blue',config,1000),createPvpPlayer('rival','Rival','red',config,1000)] as const;
 const game=newPvpMatch('capacity','arena',[players[0],players[1]],1000,config);game.status='active';game.map=config.maps[0]!;game.endsAt=181000;
 players[0].fruts=40;players[0].towers=[{id:'defence',type:'guillotine',cell:game.map.buildCells[0]!,level:1,placedAt:1000}];
 players[1].attackers=Array.from({length:128},(_,i)=>({id:`full-${i}`,type:'normal',hp:100,progress:-10-i*.01}));
 assert.doesNotThrow(()=>playPvpBotTurn(game,'bot',2000,config));assert.equal(players[1].attackers.length,128);assert.equal(players[0].fruts,40);
});
