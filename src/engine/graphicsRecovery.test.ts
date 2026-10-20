import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GraphicsRecovery} from './graphicsRecovery';
test('graphics loss is recoverable, pauses once and never auto-resumes gameplay',()=>{
 const canvas=new EventTarget();let paused=0,recovered=0;
 const recovery=new GraphicsRecovery(canvas,{lost:()=>paused++,restored:()=>recovered++});
 const event=new Event('webglcontextlost',{cancelable:true});canvas.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);assert.equal(recovery.lost,true);assert.equal(paused,1);
 canvas.dispatchEvent(new Event('webglcontextlost'));assert.equal(paused,1);
 canvas.dispatchEvent(new Event('webglcontextrestored'));assert.equal(recovery.lost,false);assert.equal(recovered,1);
 canvas.dispatchEvent(new Event('webglcontextrestored'));assert.equal(recovered,1);
 recovery.dispose();canvas.dispatchEvent(new Event('webglcontextlost'));assert.equal(paused,1);
});
