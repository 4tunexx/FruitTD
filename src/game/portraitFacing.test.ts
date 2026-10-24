import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CircleGeometry, Group, Mesh, MeshBasicMaterial, OrthographicCamera, Vector3 } from 'three';
import { faceCombatPortraits } from './portraitFacing';
import { battlefieldArtSource, BATTLEFIELD_ART_URL, PORTRAIT_CELLS } from './characterPortraits';
import { HERO_ABILITIES } from './heroAbilities';
import { DEFAULT_BATTLE_MAPS, normalizeBattleMap } from './battleMaps';
import { existsSync, readFileSync } from 'node:fs';

test('portraits project as circles from both battle camera directions and retain their world hit position',()=>{
  for(const [width,height,position] of [
    [390,760,new Vector3(0,32,-24)],
    [844,390,new Vector3(0,26,-32)],
    [390,760,new Vector3(4,54,72)],
    [1440,900,new Vector3(14,54,72)],
  ] as const){
    const camera=new OrthographicCamera(-10,10,10*height/width,-10*height/width,.1,200);
    camera.position.copy(position);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
    const scene=new Group(),parent=new Group();parent.rotation.z=.12;parent.scale.setScalar(.7);scene.add(parent);
    const portrait=new Mesh(new CircleGeometry(1),new MeshBasicMaterial());
    portrait.userData.combatPortrait=true;portrait.position.set(2,.7,3);parent.add(portrait);
    const ground=new Mesh(new CircleGeometry(1));ground.rotation.x=-Math.PI/2;scene.add(ground);
    const positionBefore=portrait.position.clone(),floorBefore=ground.quaternion.clone();
    faceCombatPortraits(scene,camera);
    const project=(point:Vector3)=>point.applyMatrix4(portrait.matrixWorld).project(camera).multiply(new Vector3(width/2,height/2,1));
    const center=project(new Vector3());
    const horizontal=project(new Vector3(1,0,0)).distanceTo(center);
    const vertical=project(new Vector3(0,1,0)).distanceTo(center);
    assert.ok(Math.abs(horizontal/vertical-1)<.001,`${width}×${height}: artwork must not flatten into an oval`);
    assert.deepEqual(portrait.position,positionBefore);
    assert.ok(ground.quaternion.equals(floorBefore),'ground decals never billboard');
  }
});

test('retired sample scenery upgrades while custom admin maps retain their exact asset',()=>{
  assert.equal(battlefieldArtSource('/assets/maps/samples/casual-fallen-orchard.svg'),BATTLEFIELD_ART_URL);
  for(const source of ['/custom-map.webp','data:image/png;base64,ABC'])assert.equal(battlefieldArtSource(source),source);
  assert.ok(existsSync(`public${BATTLEFIELD_ART_URL}`));
  assert.equal(new Set(['jiju','topfu','lagen','tripos','ki'].map(hero=>String(PORTRAIT_CELLS[hero]))).size,5);
});

test('hero powers use distinct authored power artwork',()=>{
  assert.equal(new Set(HERO_ABILITIES.map(ability=>ability.iconUrl)).size,30);
  for(const ability of HERO_ABILITIES){
    assert.equal(ability.iconUrl,`/assets/powers/${ability.id}.svg`);
    const source=readFileSync(`public${ability.iconUrl}`,'utf8');
    assert.ok(source.includes('<svg'));
  }
});

test('built-in spawn lanes stay on the road and retired demo props migrate out of saved sample maps',()=>{
  for(const mode of ['casual','campaign','horde','coop'] as const){
    const map=DEFAULT_BATTLE_MAPS[mode];
    for(const route of map.routes)for(const point of route.points)assert.ok(point.x>=.22 && point.x<=.78);
  }
  const old={...DEFAULT_BATTLE_MAPS.casual,background:'/assets/maps/samples/casual-fallen-orchard.svg',
    entities:[{id:'pit-hazard',kind:'pit'},{id:'custom-rock',kind:'solid'}]};
  const migrated=normalizeBattleMap(old,'casual');
  assert.deepEqual(migrated.entities.map(entity=>entity.id),['custom-rock']);
  assert.equal(migrated.background,BATTLEFIELD_ART_URL);
  assert.deepEqual(normalizeBattleMap(migrated,'casual').routes,migrated.routes,'migration never keeps shrinking published lanes');
});
