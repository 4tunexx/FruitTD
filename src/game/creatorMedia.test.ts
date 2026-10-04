import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCreatorMedia } from './creatorMedia';
test('published Creator clips and image data survive bounded normalization',()=>{const result=normalizeCreatorMedia({entities:{'boss-stage-01':{sheetDataUrl:'data:image/png;base64,YQ==',cols:2,rows:2,clips:{walk_down:{startFrame:1,frameCount:20,fps:10}},events:{onHit:{shake:50,flash:true}}}}});assert.equal(result?.entities['boss-stage-01']?.clips.walk_down?.frameCount,3);assert.equal(result?.entities['boss-stage-01']?.events?.onHit?.shake,3);});
test('Creator publishing rejects executable URLs and oversized packs',()=>{assert.throws(()=>normalizeCreatorMedia({entities:{'enemy-normal':{sheetDataUrl:'javascript:alert(1)'}}}));assert.throws(()=>normalizeCreatorMedia({entities:Object.fromEntries(Array.from({length:201},(_,i)=>[`entity-${i}`,{}]))}));assert.equal(normalizeCreatorMedia(null),null);});
