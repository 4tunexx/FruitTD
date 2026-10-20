import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GameLoop} from './loop';

test('phone rendering is capped while fixed simulation advances, and hidden pages do no work',()=>{
 const g=globalThis as any,previous={document:g.document,matchMedia:g.matchMedia,requestAnimationFrame:g.requestAnimationFrame,cancelAnimationFrame:g.cancelAnimationFrame};
 let pending:FrameRequestCallback=()=>{},draws=0,steps=0;
 try{
  g.document={hidden:false};g.matchMedia=()=>({matches:true});
  g.requestAnimationFrame=(cb:FrameRequestCallback)=>{pending=cb;return 1;};g.cancelAnimationFrame=()=>{};
  const loop=new GameLoop(()=>steps++,()=>draws++);loop.start();const start=performance.now();
  for(let frame=1;frame<=120;frame++)pending(start+frame*1000/120);
  assert.ok(draws>=28&&draws<=31,`mobile drew ${draws} frames`);
  assert.ok(steps>=56&&steps<=61,`simulation ran ${steps} steps`);
  const before={draws,steps};g.document.hidden=true;
  for(let frame=121;frame<=240;frame++)pending(start+frame*1000/120);
  assert.deepEqual({draws,steps},before,'background tabs do not simulate or render');loop.stop();
 }finally{Object.assign(g,previous);}
});
