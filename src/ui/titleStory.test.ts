import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TitleStory} from './titleStory';

function briefing(){
 const frames:Array<{text:string;typing:boolean;ready:boolean}>=[];
 const timers:Array<{callback:()=>void;cancelled?:boolean}>=[];
 const story=new TitleStory((text,typing,ready)=>frames.push({text,typing,ready}),callback=>{
  const timer={callback};timers.push(timer);return timer as unknown as ReturnType<typeof setTimeout>;
 },timer=>{(timer as unknown as {cancelled:boolean}).cancelled=true;});
 const flush=()=>{for(let i=0;i<timers.length;i++)if(!timers[i]!.cancelled)timers[i]!.callback();};
 return {story,frames,timers,flush};
}

test('tap reveals the complete briefing and late settings cannot restart typing',()=>{
 const h=briefing();h.story.play('The orchard awakens.');
 assert.equal(h.frames.at(-1)?.typing,true);
 const stale=h.timers[0]!.callback;
 h.story.reveal();assert.deepEqual(h.frames.at(-1),{text:'The orchard awakens.',typing:false,ready:true});
 h.story.play('Published orchard briefing.');stale();h.flush();
 assert.deepEqual(h.frames.at(-1),{text:'Published orchard briefing.',typing:false,ready:true});
 assert.equal(h.story.ready,true);
});

test('repeated settings do not rewind active typing and completed text stays revealed on return',()=>{
 const h=briefing();h.story.play('Briefing');const first=h.frames.length;
 h.story.play('Briefing');assert.equal(h.frames.length,first);assert.equal(h.timers.length,1);
 h.flush();assert.equal(h.story.ready,true);
 h.story.stop();h.story.play('Briefing');
 assert.deepEqual(h.frames.at(-1),{text:'Briefing',typing:false,ready:true});
});

test('leaving the title invalidates queued ticks, and reduced motion reveals without scheduling',()=>{
 const h=briefing();h.story.play('Old text');const stale=h.timers[0]!.callback;
 h.story.stop();const count=h.frames.length;stale();assert.equal(h.frames.length,count);
 h.story.play('Updated',true);assert.deepEqual(h.frames.at(-1),{text:'Updated',typing:false,ready:true});
 assert.equal(h.timers.length,1);
});
