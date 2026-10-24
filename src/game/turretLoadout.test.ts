import {test} from 'node:test';
import assert from 'node:assert/strict';
import {turretOffers,equippedTurrets,withCreatorTurrets} from './turretLoadout';
import {defaultSave,writeSave,loadSave} from './save';
import {createPvpPlayer,newPvpMatch,applyPvpCommand,DEFAULT_PVP_CONFIG} from './pvp';
import {applyCoopCommand,newCoopMatch} from './onlineCoop';
import {serverOwnedSaveError,saveValidationError} from '../../server/validation';
const media:any={version:2,selectedEntity:'tower-custom-test',entities:{'tower-custom-test':{label:'Test',sheetDataUrl:null,cols:1,rows:1,clips:{},turret:{chassis:'laser',shopPrice:300,cost:70,baseDamage:15}}}};

test('published turret offers separate unlock prices from match build cost',()=>{
 const offers=turretOffers(media),save=defaultSave(),config=withCreatorTurrets(DEFAULT_PVP_CONFIG,media);
 assert.equal(offers.find(o=>o.kind==='custom-test')?.price,300);
 assert.equal(config.towers['custom-test']?.cost,70);
 assert.equal(config.towers['custom-test']?.chassis,'laser');
 save.turretLoadout=['custom-test'];assert.deepEqual(equippedTurrets(save,offers),[]);
 save.ownedTurrets=['custom-test'];assert.deepEqual(equippedTurrets(save,offers),['custom-test']);
 assert.match(serverOwnedSaveError({...save,ownedTurrets:['custom-other']},{...save})??'',/ownedTurrets/);
 assert.equal(saveValidationError(save),null);
 const storage=new Map<string,string>();(globalThis as any).localStorage={getItem:(k:string)=>storage.get(k)||null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)};
 writeSave(save);assert.deepEqual(loadSave().turretLoadout,['custom-test']);assert.deepEqual(loadSave().ownedTurrets,['custom-test']);
});

test('PvP and Co-op reject unequipped custom turrets without spending Fruts',()=>{
 const config=withCreatorTurrets(DEFAULT_PVP_CONFIG,media),one=createPvpPlayer('a','A','blue',config),two=createPvpPlayer('b','B','red',config);
 one.fruts=1000;const match=newPvpMatch('m','arena',[one,two],1000,config);match.status='active';match.map=config.map;match.endsAt=100000;
 const command={type:'build' as const,tower:'custom-test',cell:config.map.buildCells[0]!};
 assert.throws(()=>applyPvpCommand(match,'a',command,1,2000,config),/Equip/);assert.equal(one.fruts,1000);
 one.turretLoadout=['custom-test'];applyPvpCommand(match,'a',command,1,2000,config);assert.equal(one.fruts,930);
 const room=newCoopMatch('c',{userId:'a',name:'A',hero:'jiju',sequence:0,lastSeenAt:1000,lastSlashAt:0,kills:0},config);room.status='playing';room.fruts=1000;
 assert.throws(()=>applyCoopCommand(room,'a',1,{...command,cell:121},2000,config),/Equip/);assert.equal(room.fruts,1000);
 room.players[0]!.turretLoadout=['custom-test'];applyCoopCommand(room,'a',1,{...command,cell:121},2000,config);assert.equal(room.fruts,930);
});
