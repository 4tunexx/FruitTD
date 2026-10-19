import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FRUIT_DEFS,setFruitBalance} from './fruitDefinitions';
import {ENEMY_RULES,setEnemyBalance} from './enemies';

test('published fruit and enemy balances apply known fields, bound unsafe values and reset deleted overrides',()=>{
 const fruit=structuredClone(FRUIT_DEFS.apple),enemy=structuredClone(ENEMY_RULES.swift);
 try {
  setFruitBalance([{id:'apple',health:123,speed:6,color:'#ffca28',radius:999,kindHack:'bomb'},{id:'__proto__',hp:1}]);
  assert.equal(FRUIT_DEFS.apple.hp,123);assert.equal(FRUIT_DEFS.apple.speed,6);assert.equal(FRUIT_DEFS.apple.color,0xffca28);assert.equal(FRUIT_DEFS.apple.radius,3);assert.equal(FRUIT_DEFS.apple.kind,'apple');
  setEnemyBalance([{type:'swift',healthMul:3,speedMul:NaN,towerDamageOnLeak:-2,label:'Custom runner'}]);
  assert.equal(ENEMY_RULES.swift.hpMultiplier,3);assert.equal(ENEMY_RULES.swift.speedMultiplier,enemy.speedMultiplier);assert.equal(ENEMY_RULES.swift.towerDamageOnLeak,0);assert.equal(ENEMY_RULES.swift.label,'Custom runner');
 } finally {setFruitBalance([]);setEnemyBalance([]);}
 assert.deepEqual(FRUIT_DEFS.apple,fruit);assert.deepEqual(ENEMY_RULES.swift,enemy);
});
