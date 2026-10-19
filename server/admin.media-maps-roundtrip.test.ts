import assert from 'node:assert/strict';
import {test} from 'node:test';
import express from 'express';
import {createServer} from 'node:http';
import {ObjectId} from 'mongodb';
import {createMapRouters} from './routes/maps';
import {createMediaRouters} from './routes/media';
import {defaultMapForMode} from '../src/game/battleMaps';
import {battleMapPads} from '../src/game/buildPads';

test('Admin image/audio upload and all map modes save/reload through real routes with isolated storage',async t=>{
 const maps:any[]=[],media=new Map<string,any>();
 const matches=(row:any,q:any)=>Object.entries(q).every(([key,value])=>row[key]===value);
 const mapCollection={
  findOne:async(q:any,options?:any)=>structuredClone(maps.filter(m=>matches(m,q)).sort((a,b)=>options?.sort?.updatedAt?+b.updatedAt-+a.updatedAt:0)[0]??null),
  find:()=>({sort:()=>({toArray:async()=>structuredClone(maps)})}),
  bulkWrite:async(ops:any[])=>{for(const op of ops)if(!maps.some(m=>matches(m,op.updateOne.filter)))maps.push(structuredClone(op.updateOne.update.$setOnInsert));return{};},
  insertOne:async(m:any)=>{maps.push(structuredClone(m));return{};},
  replaceOne:async(q:any,m:any)=>{const index=maps.findIndex(row=>matches(row,q));if(index<0)return{matchedCount:0};maps[index]=structuredClone(m);return{matchedCount:1};},
 };
 const authorize=async(req:express.Request)=>req.headers.authorization==='local-test-admin';
 const {mapsRouter,adminMapsRouter}=createMapRouters({authorize,collection:async()=>mapCollection as any});
 const {mediaRouter,adminMediaRouter}=createMediaRouters({authorize,collection:async()=>({insertOne:async(doc:any)=>{const id=new ObjectId();media.set(id.toHexString(),doc);return{insertedId:id};},findOne:async(q:any)=>media.get(q._id.toHexString())??null}) as any});
 const app=express();app.use(express.json({limit:'4mb'}));app.use('/api/admin/maps',adminMapsRouter);app.use('/api/maps',mapsRouter);app.use('/api/admin/media',adminMediaRouter);app.use('/api/media',mediaRouter);
 const server=createServer(app);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
 const post=(path:string,value:object,auth=true)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:'local-test-admin'}:{})},body:JSON.stringify(value)});
 assert.equal((await post('/api/admin/media',{image:'data:image/png;base64,AA=='},false)).status,403);
 const assets=[{key:'image',mime:'image/png',bytes:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB9sAAAAASUVORK5CYII=','base64')},{key:'audio',mime:'audio/wav',bytes:Buffer.from('RIFF0000WAVEfmt sample')}];
 for(const asset of assets){
  const response=await post('/api/admin/media',{[asset.key]:`data:${asset.mime};base64,${asset.bytes.toString('base64')}`});assert.equal(response.status,200);const data=await response.json();
  const file=await fetch(base+data.url);assert.equal(file.status,200);assert.equal(file.headers.get('content-type'),asset.mime);assert.equal(file.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await file.arrayBuffer()),asset.bytes);
 }
 assert.equal((await post('/api/admin/media',{image:'data:image/png;base64,PHNjcmlwdD4='})).status,400);
 assert.equal((await fetch(base+'/api/admin/maps')).status,403);
 const listing=await fetch(base+'/api/admin/maps',{headers:{Authorization:'local-test-admin'}});assert.equal(listing.status,200);assert.equal((await listing.json()).maps.length,5);
 for(const mode of ['casual','horde','campaign','coop','pvp'] as const){
  const map=defaultMapForMode(mode);map.name=`Verified ${mode}`;map.entities[0]!.x=.2;
  const response=await post('/api/admin/maps',{map,expectedRevision:1});assert.equal(response.status,200);const saved=(await response.json()).map;assert.equal(saved.revision,2);
  const publicResponse=await fetch(base+`/api/maps/${mode}`);assert.equal(publicResponse.status,200);const runtime=(await publicResponse.json()).map;
  assert.equal(runtime.name,`Verified ${mode}`);assert.equal(runtime.entities[0].x,.2);
  if(mode!=='pvp')assert.equal(battleMapPads(runtime)[0]!.x,(.2-.5)*runtime.world.width);
  assert.equal((await post('/api/admin/maps',{map,expectedRevision:1})).status,409);
 }
 assert.equal((await fetch(base+'/api/maps/not-a-mode')).status,404);
});
