import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Mesh, CircleGeometry, MeshBasicMaterial } from 'three';
import { DefenderMotion } from './defenderMotion';
import { combatHudSlots } from '../ui/combatHudLayout';
import { purchaseHeroPerk } from './heroPerkPurchase';
import { defaultSave } from './save';
import { heroXpForLevel } from './heroes';
import { heroAbility, heroAbilityRank } from './heroAbilities';
import { powerTargets, powerStats } from './powerCombat';

(globalThis as any).localStorage??={getItem:()=>null,setItem:()=>{}};

test('HUD lanes never overlap for expanded, collapsed, boss and landscape layouts',()=>{
  for(const bottom of [48,76,140])for(const bossHeight of [0,48,76])for(const compact of [false,true]){
    const layout=combatHudSlots(bottom,30,bossHeight,compact);
    assert.ok(layout.juiceTop>=Math.max(bottom,layout.statusTop+30)+8);
    assert.ok(layout.bossTop>=layout.juiceTop+16);
    assert.ok(layout.toastTop>=layout.bossTop+bossHeight);
    const withNotice=combatHudSlots(bottom,30,bossHeight,compact,42);
    assert.ok(withNotice.toastHostTop>=withNotice.toastTop+50);
  }
});

test('defender idle, swing and muzzle recoil animate without position or scale drift',()=>{
  for(const kind of ['hero','tower'] as const){
    const portrait=new Mesh(new CircleGeometry(1),new MeshBasicMaterial());portrait.position.set(2,1,3);
    const motion=new DefenderMotion(portrait,kind);const position=portrait.position.clone();
    motion.update(.1);assert.notEqual(portrait.scale.x,1);
    motion.fire();motion.update(.01);assert.ok(portrait.scale.x>1.02);
    for(let frame=0;frame<3600;frame++)motion.update(1/60);
    assert.ok(portrait.scale.x>.97 && portrait.scale.x<1.03,'breathing must not accumulate scale');
    assert.deepEqual(portrait.position,position,'cosmetic motion never moves the combat anchor');
    portrait.scale.setScalar(1.4);motion.update(.1);assert.ok(portrait.scale.x>1.35,'upgrade scale is retained');
  }
});

test('turret-only bomb and armor outlines are round; hero powers never damage the bomb',async()=>{
  const { FruitField }=await import('./fruits');
  const field=new FruitField(()=>{}),bomb=field.spawn('bomb',false,'explosive')!;
  assert.equal(bomb.hazardRing.geometry.type,'RingGeometry');
  assert.equal((bomb.hazardRing.material as MeshBasicMaterial).wireframe,false);
  assert.equal(bomb.hazardRing.userData.combatPortrait,true);
  const hp=bomb.hp;assert.equal(field.hurt(bomb,9999,'super'),false);assert.equal(bomb.hp,hp);
  assert.equal(field.hurt(bomb,9999,'turret'),true);
});

test('solo targeted powers choose the wall threat and starter rank upgrades immediately increase damage',()=>{
  const ability=heroAbility('jiju-3')!;
  const enemies=[{z:15},{z:4},{z:-6}];
  assert.equal(powerTargets(enemies,ability,f=>({x:0,y:-f.z}),{x:0,y:9.2,radius:6})[0]!.z,-6);
  const rank=heroAbilityRank('jiju-1',{'jiju-1':0});assert.equal(rank,1);
  assert.ok(powerStats(heroAbility('jiju-1')!,rank+1).damage>powerStats(heroAbility('jiju-1')!,rank).damage);
});

test('passive mastery spending is level gated, bounded and separate from power skill points',()=>{
  const save=defaultSave();save.skillPoints=7;
  assert.ok(purchaseHeroPerk(save,'jiju','combo'));
  save.xp.jiju=heroXpForLevel(10);
  assert.equal(purchaseHeroPerk(save,'jiju','combo'),null);
  assert.equal(save.heroPerkRanks!.jiju.combo,1);
  assert.ok(purchaseHeroPerk(save,'jiju','juice'),'a later perk stays level locked');
  save.xp.jiju=heroXpForLevel(100);
  assert.equal(purchaseHeroPerk(save,'jiju','combo'),null);
  assert.equal(purchaseHeroPerk(save,'jiju','combo'),null);
  const before=structuredClone(save);
  assert.ok(purchaseHeroPerk(save,'jiju','combo'));assert.deepEqual(save,before);
  assert.ok(purchaseHeroPerk(save,'topfu','combo'),'unowned heroes cannot receive upgrades');
  assert.equal(save.skillPoints,7);
});

test('local Co-op uses animated portrait actors and smooth movement without teleporting',async()=>{
  const { CoopActors }=await import('./coopActors');const actors=new CoopActors();
  actors.setVisible(true);actors.setPlayerOneHero('lagen');
  const before=actors.playerOne.position.x;actors.movePlayerOne(5,1);
  assert.equal(actors.playerOne.position.x,before);
  actors.update(1/60);assert.ok(actors.playerOne.position.x>before && actors.playerOne.position.x<5);
  for(let i=0;i<60;i++)actors.update(1/60);
  assert.ok(Math.abs(actors.playerOne.position.x-5)<.001);
  const body=actors.playerOne.children[0] as Mesh;
  assert.equal(body.geometry.type,'CircleGeometry');assert.equal(body.userData.combatPortrait,true);
  actors.attackPlayerOne();actors.update(.01);assert.ok(body.scale.x>1.02);
});
