import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MongoClient} from 'mongodb';
import {SharedMongoConnection,mongoClientOptions} from './mongoConnection';

function gate<T=void>() {
  let resolve!:(value:T|PromiseLike<T>)=>void,reject!:(reason:unknown)=>void;
  const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
const flush=async()=>{for(let i=0;i<6;i++)await Promise.resolve();};

test('100 simultaneous requests share connection and initialization, then reuse the ready database',async()=>{
 const connected=gate(),initialized=gate(),database={name:'FruitTD'};let clients=0,connects=0,initializations=0,closes=0;
 const shared=new SharedMongoConnection(()=>{clients++;return{connect:async()=>{connects++;await connected.promise;},db:()=>database,close:async()=>{closes++;}};},'FruitTD',async()=>{initializations++;await initialized.promise;});
 const requests=Array.from({length:100},()=>shared.get());let settled=false;requests[0].then(()=>{settled=true;});
 assert.equal(clients,1);assert.equal(connects,1);assert.equal(initializations,0);
 connected.resolve();await flush();assert.equal(initializations,1);assert.equal(settled,false);
 initialized.resolve();const results=await Promise.all(requests);assert.ok(results.every(result=>result===database));
 assert.equal(await shared.get(),database);assert.equal(clients,1);assert.equal(initializations,1);
 await shared.close();assert.equal(closes,1);
});

test('a rejected connection is cleaned up and the next request reconnects instead of caching failure',async()=>{
 const original=new Error('temporary connection failure');let clients=0,closes=0;
 const shared=new SharedMongoConnection(()=>{const attempt=++clients;return{connect:async()=>{if(attempt===1)throw original;},db:()=>({attempt}),close:async()=>{closes++;}};},'FruitTD',async()=>{});
 const first=shared.get(),second=shared.get();assert.equal(first,second);
 await assert.rejects(first,error=>error===original);await assert.rejects(second,error=>error===original);
 assert.equal(closes,1);assert.deepEqual(await shared.get(),{attempt:2});assert.equal(clients,2);await shared.close();
});

test('failed initialization is retried and cleanup does not replace the original failure',async()=>{
 const original=new Error('initialization failed');let clients=0;
 const shared=new SharedMongoConnection(()=>{const attempt=++clients;return{connect:async()=>{},db:()=>({attempt}),close:async()=>{if(attempt===1)throw new Error('cleanup failed');}};},'FruitTD',async database=>{if(database.attempt===1)throw original;});
 await assert.rejects(shared.get(),error=>error===original);
 assert.deepEqual(await shared.get(),{attempt:2});await shared.close();
});

test('close during connection drains that attempt; new requests wait for close and use a fresh client',async()=>{
 const connect=gate(),close=gate();let clients=0,closes=0;
 const shared=new SharedMongoConnection(()=>{const attempt=++clients;return{connect:async()=>{if(attempt===1)await connect.promise;},db:()=>({attempt}),close:async()=>{closes++;if(attempt===1)await close.promise;}};},'FruitTD',async()=>{});
 const first=shared.get(),closing=shared.close(),again=shared.close(),next=shared.get();
 assert.equal(closing,again);assert.equal(clients,1);
 connect.resolve();await first;await flush();assert.equal(closes,1);assert.equal(clients,1);
 close.resolve();await closing;assert.deepEqual(await next,{attempt:2});assert.equal(clients,2);await shared.close();
});

test('constructor and close failures do not leave the cache permanently blocked',async()=>{
 let attempts=0;
 const shared=new SharedMongoConnection(()=>{const attempt=++attempts;if(attempt===1)throw new Error('invalid client');return{connect:async()=>{},db:()=>({attempt}),close:async()=>{if(attempt===2)throw new Error('close failed');}};},'FruitTD',async()=>{});
 await assert.rejects(shared.get(),/invalid client/);await shared.get();await assert.rejects(shared.close(),/close failed/);
 assert.deepEqual(await shared.get(),{attempt:3});await shared.close();
});

test('small pool options override URI pool reservations while preserving driver timeouts',()=>{
 for(const serverless of [true,false]){
  const options=mongoClientOptions(serverless),client=new MongoClient('mongodb://127.0.0.1:27017/?maxPoolSize=100&minPoolSize=10',options);
  assert.equal(client.options.maxPoolSize,serverless?5:10);assert.equal(client.options.minPoolSize,0);
  assert.equal(client.options.maxIdleTimeMS,serverless?30000:60000);
  assert.equal(client.options.serverSelectionTimeoutMS,30000);assert.equal(client.options.socketTimeoutMS,0);
 }
});

test('production getDb/getCollection wiring initializes the original indexes once for concurrent requests',async()=>{
 const proto=MongoClient.prototype as any,original={connect:proto.connect,db:proto.db,close:proto.close};
 const previous={uri:process.env.MONGODB_URI,vercel:process.env.VERCEL};
 const firstIndex=gate(),indexes:Array<{collection:string;keys:object;options:unknown}>=[];
 let connects=0,closes=0,databaseCalls=0;const database={collection:(collection:string)=>({name:collection,createIndex:async(keys:object,options:unknown)=>{indexes.push({collection,keys,options});if(indexes.length===1)await firstIndex.promise;}})};
 process.env.MONGODB_URI='mongodb://127.0.0.1:27017';process.env.VERCEL='1';
 proto.connect=async function(){connects++;assert.equal(this.options.maxPoolSize,5);return this;};
 proto.db=function(name:string){databaseCalls++;assert.equal(name,'FruitTD');return database;};proto.close=async()=>{closes++;};
 const {getDb,getCollection,closeDb}=await import('./db');
 try{
  const requests=Array.from({length:40},()=>getDb());await flush();assert.equal(connects,1);assert.equal(databaseCalls,1);assert.equal(indexes.length,1);
  firstIndex.resolve();for(const db of await Promise.all(requests))assert.equal(db,database);
  const count=indexes.length;assert.ok(count>30);assert.equal((await getCollection('users') as any).name,'users');assert.equal(indexes.length,count);
  assert.ok(indexes.some(index=>index.collection==='sessions'&&(index.options as any)?.expireAfterSeconds===0));
  assert.ok(indexes.some(index=>index.collection==='coop_matches'&&(index.options as any)?.unique===true));
  assert.ok(indexes.some(index=>index.collection==='cloud_saves'&&(index.options as any)?.unique===true));
  await closeDb();assert.equal(closes,1);
 }finally{
  firstIndex.resolve();await closeDb();Object.assign(proto,original);
  if(previous.uri===undefined)delete process.env.MONGODB_URI;else process.env.MONGODB_URI=previous.uri;
  if(previous.vercel===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous.vercel;
 }
});
