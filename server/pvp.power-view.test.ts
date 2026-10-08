import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicMatch } from './routes/pvp';
import { DEFAULT_PVP_CONFIG as cfg, newPvpMatch, createPvpPlayer, applyPvpCommand } from '../src/game/pvp';
test('both Arena clients receive authoritative cast effects while private loadouts remain hidden',()=>{
  const own=createPvpPlayer('one','One','blue',cfg),rival=createPvpPlayer('two','Two','red',cfg);
  Object.assign(own,{hero:'jiju',abilityLoadout:['jiju-1'],abilityRanks:{'jiju-1':1}});
  own.attackers=[{id:'target',type:'normal',hp:100,progress:4}];
  const match={...newPvpMatch('room','arena',[own,rival],1000,cfg),updatedAt:new Date()};match.status='active';match.map=cfg.map;match.endsAt=100000;
  applyPvpCommand(match,'one',{type:'ability',abilityId:'jiju-1'},1,2000,cfg);
  const a=publicMatch(match,'one')!,b=publicMatch(match,'two')!;
  assert.deepEqual(a.players[0]!.powerCasts,b.players[0]!.powerCasts);
  assert.equal(b.players[0]!.powerCasts?.[0]?.targets.length,1);
  assert.deepEqual(a.players[0]!.abilityLoadout,['jiju-1']);assert.equal(b.players[0]!.abilityLoadout,undefined);
  assert.equal(publicMatch(match,'outsider'),null);
});
