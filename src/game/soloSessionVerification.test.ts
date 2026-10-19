import assert from 'node:assert/strict';
import {test} from 'node:test';
import {performance} from 'node:perf_hooks';
(globalThis as any).localStorage??={getItem:()=>null,setItem:()=>{}};
import {FruitField} from './fruits';
import {WallBase} from './wall';
import {JuiceBank,JuiceSystem} from './juice';
import {TURRETS} from './turrets';
import {defaultMapForMode} from './battleMaps';
import {createState,resetState,damageTower} from './state';
import {planWave,wavesPerLevel} from './waves';
import {modeRules} from './modes';
import {frutsForEvent,fruitLoot} from './matchEconomy';
import {MAIN_INDEX} from './world';

for(const mode of ['casual','horde','campaign','coop'] as const)test(`${mode}: real fruit/wall session drains waves and keeps combat state bounded`,t=>{
 const started=performance.now(),map=defaultMapForMode(mode),state=createState();state.mode=mode;resetState(state);state.running=true;
 const field=new FruitField(()=>{}),wall=new WallBase(),juice=new JuiceSystem(),bank=new JuiceBank(),rules=modeRules(mode);
 field.setBattleMap(map);wall.applyBattleMap(map);wall.setHero('jiju');bank.add('yellow',rules.yellow);bank.add('pink',rules.pink);bank.add('orange',rules.orange);
 let kills=0,leaks=0,completed=0,ticks=0,built=0;
 const reward=(fruit:any,source:'blade'|'turret',damage:number)=>{
  if(!fruit.alive)return;
  if(field.hurt(fruit,damage,source)){kills++;state.waveKilled++;state.currency+=frutsForEvent({type:fruit.boss?'boss_defeated':fruit.enemyKind==='normal'?'fruit_sliced':'special_enemy_killed'},rules.currencyMul)+fruitLoot(kills).fruts;}
 };
 try{
  for(let wave=1;wave<=12&&state.lives>0;wave++){
   state.wave=wave;state.waveKilled=0;state.waveLeaks=0;
   const waveInLevel=(wave-1)%wavesPerLevel(state.level,mode)+1;
   const plan=planWave(wave,mode,state.level,waveInLevel,wavesPerLevel(state.level,mode));
   state.waveTotal=plan.items.length;field.beginWave(plan.items,plan.gap,plan.hpScale);
   let frame=0;
   while(field.waveBusy&&frame++<2400&&state.lives>0){
    const dt=.05;ticks++;
    field.update(dt,state,fruit=>{leaks++;damageTower(state,fruit.boss?8:1);});
    wall.update(dt,field.fruits,juice,bank,hit=>reward(hit.fruit,'turret',hit.damage));
    if(frame%5===0){
     const target=field.fruits.filter(fruit=>fruit.alive&&fruit.enemyKind!=='explosive').sort((a,b)=>a.group.position.z-b.group.position.z)[0];
     if(target)reward(target,'blade',35);
    }
    if(frame%10===0){
     const slot=wall.slots.find(slot=>slot.enabled&&!slot.main&&!slot.filled);
     const available=TURRETS.filter(tower=>state.currency>=tower.cost&&(!tower.floorOnly||slot?.floor)).sort((a,b)=>a.cost-b.cost);
     if(slot&&available[0]){wall.select(slot.index);if(wall.placeSlicer(slot.index,available[0].kind)){state.currency-=available[0].cost;built++;}}
    }
    assert.ok(Number.isFinite(state.currency)&&state.currency>=0);
    assert.ok(field.aliveCount<=field.fruits.length);assert.ok(wall.combatEffects.group.children.length<=32);
    assert.ok(field.fruits.filter(f=>f.alive).every(f=>Number.isFinite(f.hp)&&Number.isFinite(f.group.position.x)&&Number.isFinite(f.group.position.z)));
   }
   assert.ok(!field.waveBusy||state.lives<=0,`${mode} wave ${wave} must resolve or breach instead of stalling`);
   if(state.lives>0){completed++;state.currency+=frutsForEvent({type:'wave_cleared',wave},rules.currencyMul);}
  }
  assert.ok(completed>=2,`${mode}: opening must be playable`);assert.ok(built>=1,`${mode}: zero-Frut opening must reach a build`);assert.ok(kills>0);
  field.reset();wall.reset();assert.equal(field.aliveCount,0);assert.equal(field.queueLength,0);assert.equal(wall.slots.filter(s=>s.filled).length,1);assert.equal(wall.slots[MAIN_INDEX]!.level,1);assert.equal(wall.combatEffects.group.children.length,0);
  t.diagnostic(`${completed} waves cleared; ${kills} kills; ${leaks} leaks; ${built} builds; ${ticks} ticks; ${Math.round(performance.now()-started)} ms CPU wall time.`);
 }finally{wall.dispose();}
});
