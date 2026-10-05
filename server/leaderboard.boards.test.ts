import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { createLeaderboardRouter } from './routes/leaderboard';
test('category boards use real FR, wallet fields and accepted friends, without exposing private data', async t => {
  const calls: Array<{name:string; filter:any; order?:any}> = [];
  let signedIn = true;
  const router = createLeaderboardRouter({ resolveUser:async()=>signedIn ? {userId:'me'} as any : null, catalog:async()=>({}) as any,
    collection:async(name:string)=>({find:(filter:any)=>{
      const call={name,filter,order:undefined as any}; calls.push(call);
      const rows = name==='friends' ? [{friendId:'pal'}] : name==='users' ? [{userId:'pal',username:'Friend',passwordHash:'SECRET'}] : name==='pvp_ratings' ? [{userId:'pal',points:1600,matches:3,wins:2}] : name==='cloud_saves' ? [{userId:'pal',saveData:{coins:45,gems:7,private:'SECRET'}}] : [{userId:'pal',score:900,wave:12,maxCombo:4}];
      const cursor={sort:(order:any)=>{call.order=order;return cursor;},limit:()=>cursor,toArray:async()=>rows};return cursor;
    }}) as any });
  const app=express();app.use('/api/leaderboard',router);const server=createServer(app);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const address=server.address();if(!address||typeof address==='string')throw new Error('No port');
  const get=(query:string)=>fetch(`http://127.0.0.1:${address.port}/api/leaderboard/boards?${query}`);
  const ranked=await (await get('category=ranked&scope=friends')).json();assert.equal(ranked.entries[0].value,1600);assert.equal(ranked.entries[0].name,'Friend');
  const rankQuery=calls.find(call=>call.name==='pvp_ratings')!;assert.deepEqual(rankQuery.filter.userId,{$in:['me','pal']});assert.deepEqual(rankQuery.filter.matches,{$gt:0});assert.equal(rankQuery.order.points,-1);
  for(const [category,value] of [['coins',45],['gems',7]] as const){const body=await(await get(`category=${category}`)).json();assert.equal(body.entries[0].value,value);assert.ok(!JSON.stringify(body).includes('SECRET'));}
  await get('category=horde');assert.equal(calls.filter(call=>call.name==='leaderboards').at(-1)!.order.wave,-1);
  assert.equal((await get('category=invalid')).status,400);signedIn=false;assert.equal((await get('scope=friends')).status,401);
});
