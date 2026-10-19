import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
function files(root:string):string[]{return readdirSync(root,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(root,entry.name)):[path.join(root,entry.name)]);}

test('every shipped raster image has its real format signature and a complete container',()=>{
 const images=files('public').filter(file=>/\.(png|webp)$/.test(file));assert.ok(images.length>300);
 for(const file of images){
  const data=readFileSync(file);
  if(file.endsWith('.webp')){
   assert.equal(data.toString('ascii',0,4),'RIFF',`${file}: invalid RIFF header`);assert.equal(data.toString('ascii',8,12),'WEBP',file);
   assert.equal(data.readUInt32LE(4)+8,data.length,`${file}: truncated WebP container`);
  }else{
   assert.deepEqual(data.subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]),file);
   let offset=8,ended=false;
   while(offset+12<=data.length){const length=data.readUInt32BE(offset),kind=data.toString('ascii',offset+4,offset+8);assert.ok(offset+12+length<=data.length,`${file}: truncated ${kind} chunk`);offset+=12+length;if(kind==='IEND'){ended=true;break;}}
   assert.ok(ended,`${file}: missing PNG end chunk`);
  }
 }
});
test('all bundled WAV sources are complete RIFF/WAVE files',()=>{
 const audio=files('Sound').filter(file=>file.endsWith('.wav'));assert.equal(audio.length,205);
 for(const file of audio){const data=readFileSync(file);assert.equal(data.toString('ascii',0,4),'RIFF',file);assert.equal(data.toString('ascii',8,12),'WAVE',file);assert.ok(data.length>=data.readUInt32LE(4)+8,`${file}: truncated WAV`);}
});
