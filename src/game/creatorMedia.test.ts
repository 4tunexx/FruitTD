import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCreatorMedia } from './creatorMedia';
test('published Creator clips and image data survive bounded normalization',()=>{const result=normalizeCreatorMedia({entities:{'boss-stage-01':{sheetDataUrl:'data:image/png;base64,YQ==',cols:2,rows:2,clips:{walk_down:{startFrame:1,frameCount:20,fps:10}},events:{onHit:{shake:50,flash:true}}}}});assert.equal(result?.entities['boss-stage-01']?.clips.walk_down?.frameCount,3);assert.equal(result?.entities['boss-stage-01']?.events?.onHit?.shake,3);});
test('Creator publishing rejects executable URLs and oversized packs',()=>{assert.throws(()=>normalizeCreatorMedia({entities:{'enemy-normal':{sheetDataUrl:'javascript:alert(1)'}}}));assert.throws(()=>normalizeCreatorMedia({entities:Object.fromEntries(Array.from({length:201},(_,i)=>[`entity-${i}`,{}]))}));assert.equal(normalizeCreatorMedia(null),null);});
test('publishing preserves idle, hit and death clips used by uploaded tower sheets',()=>{
  const clips={idle:{startFrame:0,frameCount:1},hit:{startFrame:1,frameCount:1},death:{startFrame:2,frameCount:1},walk_down:{startFrame:3,frameCount:1}};
  const result=normalizeCreatorMedia({entities:{'tower-guillotine':{sheetDataUrl:'data:image/png;base64,YQ==',cols:2,rows:2,clips}}});
  assert.deepEqual(Object.keys(result!.entities['tower-guillotine'].clips).sort(),Object.keys(clips).sort());
});
test('published packs can reference separately stored Admin image assets',()=>{
  const url='/api/media/507f1f77bcf86cd799439011';
  assert.equal(normalizeCreatorMedia({entities:{'boss-stage-100':{sheetDataUrl:url,cols:1,rows:1,clips:{idle:{startFrame:0,frameCount:1}}}}})?.entities['boss-stage-100'].sheetDataUrl,url);
  assert.throws(()=>normalizeCreatorMedia({entities:{'boss-stage-100':{sheetDataUrl:'https://untrusted.example/asset.png'}}}));
});
