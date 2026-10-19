import {el} from '../components/dom';
import {GameButton} from '../components/primitives';
export function isChunkLoadError(error:unknown):boolean {
 const message=error instanceof Error?error.message:String(error);
 return /failed to fetch dynamically imported module|importing a module script failed|loading chunk|unable to preload|error loading dynamically imported module/i.test(message);
}
/** Failed hashed assets cannot be recovered by importing the same cached URL. */
export function showScreenLoadFailure(host:HTMLElement,label:string,error:unknown,retry:()=>void):void {
 const updated=isChunkLoadError(error);
 host.replaceChildren(el('section',{class:'ftd-screen-load-error',role:'alert'},[
  el('h2',{text:updated?'Game update ready':`${label} could not open`}),
  el('p',{text:updated?'This page was open during an update. Reload to load the current game files.':'The screen could not start. Retry, or reload the game if it keeps happening.'}),
  GameButton({label:updated?'Reload game':'Retry',icon:updated?'RefreshCw':'RotateCcw',tone:'primary',onClick:updated?()=>window.location.reload():retry}),
 ]));
}
