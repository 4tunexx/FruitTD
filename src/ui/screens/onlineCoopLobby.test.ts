import {register} from 'node:module';
register(`data:text/javascript,${encodeURIComponent(`export async function load(url,context,nextLoad){return url.endsWith('.css')?{format:'module',source:'export {};',shortCircuit:true}:nextLoad(url,context);}`)}`,import.meta.url);
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {installDomStub,resetDom} from '../domStub.test-helper';
installDomStub();
const [{renderOnlineCoop,disposeOnlineCoop},{DEFAULT_PVP_CONFIG},{DEFAULT_COOP_CONFIG}]=await Promise.all([import('./onlineCoop'),import('../../game/pvp'),import('../../game/onlineCoop')]);
const tick=()=>new Promise(resolve=>setTimeout(resolve,20));
test('Co-op lobby exposes the roster and wires a host-only start command',async()=>{
 resetDom();const previous=globalThis.fetch,host=document.createElement('div');document.body.appendChild(host);
 const players=['host','guest','third'].map(userId=>({userId,name:userId,hero:'jiju',sequence:0,kills:0,lastSeenAt:1000,lastSlashAt:0}));
 const room={id:'0123456789',status:'waiting',revision:0,players,fruts:0,towers:[]};
 let currentUser='host';const commands:any[]=[];
 globalThis.fetch=async(_url,options)=>{if(options?.body){const payload=JSON.parse(String(options.body));commands.push(payload);room.revision++;}
  return new Response(JSON.stringify({success:true,room,balance:DEFAULT_PVP_CONFIG,coop:DEFAULT_COOP_CONFIG,yourId:currentUser}));};
 try{
  renderOnlineCoop(host,()=>{});await tick();
  assert.match(host.textContent||'',/3\/4 PLAYERS/);
  const start=[...host.querySelectorAll('button')].find(button=>button.textContent==='Start with 3 players');assert.ok(start);assert.equal(start.disabled,false);
  start.click();await tick();assert.equal(commands[0].command.type,'start');assert.equal(commands[0].sequence,1);
  disposeOnlineCoop(host);currentUser='guest';renderOnlineCoop(host,()=>{});await tick();
  assert.equal([...host.querySelectorAll('button')].some(button=>button.textContent?.startsWith('Start with')),false);
  assert.ok([...host.querySelectorAll('button')].some(button=>button.textContent==='Leave room'));
 }finally{disposeOnlineCoop(host);globalThis.fetch=previous;resetDom();}
});

test('Co-op polling preserves room-code input and friend drafts across roster updates',async()=>{
 resetDom();const previous=globalThis.fetch,oldInterval=globalThis.setInterval;
 let poll=()=>{};globalThis.setInterval=((callback:()=>void)=>{poll=callback;return 0;}) as typeof setInterval;
 const host=document.createElement('div');document.body.appendChild(host);
 let room:any=null;
 globalThis.fetch=async()=>new Response(JSON.stringify({success:true,room,balance:DEFAULT_PVP_CONFIG,coop:DEFAULT_COOP_CONFIG,yourId:'host'}));
 try{
  renderOnlineCoop(host,()=>{});await tick();
  const code=host.querySelector<HTMLInputElement>('[aria-label="Friend room code"]')!;
  code.value='abc123';code.dispatchEvent({type:'input'} as Event);
  poll();await tick();assert.equal(host.querySelector('[aria-label="Friend room code"]'),code);assert.equal(code.value,'abc123');
  room={id:'0123456789',status:'waiting',revision:0,players:[{userId:'host',name:'Host',hero:'jiju',sequence:0}],fruts:0,towers:[]};
  poll();await tick();
  const friend=host.querySelector<HTMLInputElement>('[aria-label="Friend username to invite"]')!;
  friend.value='Teammate';friend.dispatchEvent({type:'input'} as Event);
  room.players.push({userId:'guest',name:'Guest',hero:'ki',sequence:0});room.revision++;
  poll();await tick();
  assert.equal(host.querySelector<HTMLInputElement>('[aria-label="Friend username to invite"]')!.value,'Teammate');
  assert.match(host.textContent||'',/2\/4 PLAYERS/);
 }finally{disposeOnlineCoop(host);globalThis.fetch=previous;globalThis.setInterval=oldInterval;resetDom();}
});
