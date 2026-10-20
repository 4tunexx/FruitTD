import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
function boot(){
 const source=readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)![1];
 const listeners=new Map<string,(event?:any)=>void>(),timers:Array<()=>void>=[],classes=new Set<string>(),buttons:any[]=[];
 const subtitle={textContent:''};let removed=false;
 const loader={classList:{contains:(name:string)=>classes.has(name),add:(name:string)=>classes.add(name)},querySelector:()=>subtitle,appendChild:(node:any)=>buttons.push(node),remove:()=>{removed=true;}};
 const window:any={addEventListener:(name:string,fn:any)=>listeners.set(name,fn),setTimeout:(fn:()=>void)=>{timers.push(fn);},location:{reload:()=>{}}};
 const document={getElementById:()=>removed?null:loader,createElement:()=>({addEventListener:()=>{}})};
 runInNewContext(source,{window,document});
 return {listeners,timers,classes,buttons,subtitle,window};
}
test('WebGL startup failure keeps a visible error and reload action instead of a dead title screen',()=>{
 const state=boot();state.listeners.get('error')!({target:state.window,message:'Error creating WebGL context.'});
 state.timers.forEach(fn=>fn());
 assert.ok(state.classes.has('is-error'));assert.equal(state.classes.has('is-done'),false);
 assert.match(state.subtitle.textContent,/WebGL/);assert.equal(state.buttons.length,1);
});
test('only successful initialization dismisses startup recovery and later errors do not reopen it',()=>{
 const state=boot();assert.equal(state.classes.has('is-done'),false);
 state.listeners.get('fruit-td-ready')!();assert.ok(state.classes.has('is-done'));
 state.timers.forEach(fn=>fn());
 state.listeners.get('error')!({target:state.window,message:'Later error'});state.timers.forEach(fn=>fn());
 assert.equal(state.buttons.length,0);
});
