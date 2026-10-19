import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installDomStub,resetDom} from '../domStub.test-helper';
installDomStub();
const storage=new Map<string,string>();
(globalThis as any).localStorage={getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)};
import {GameButton} from '../components/primitives';
import {isChunkLoadError,showScreenLoadFailure} from './loadFailure';
import {renderLeaderboards} from './leaderboards';
import {menuHubTabs} from './menuHubTabs';
import {disposePvpHub} from './pvp';
import {setAuthToken} from '../../services/auth';
import {DEFAULT_PVP_CONFIG} from '../../game/pvp';
const flush=async()=>{for(let i=0;i<8;i++)await new Promise<void>(r=>setImmediate(r));};
function host(){const root=document.createElement('div');document.body.appendChild(root);return root;}
test('numbered Lucide names render an icon instead of leaking Globe2 into the label',()=>{
 const button=GameButton({label:'Everyone',icon:'Globe2'});
 assert.equal(button.textContent,'Everyone');assert.equal(button.querySelector('[data-icon-role]')!.getAttribute('data-icon-role'),'Globe2');
});
test('stale chunk errors offer an update reload; ordinary failures offer a real retry',()=>{
 resetDom();const root=host();let retries=0;
 assert.ok(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/pvp-old.js')));
 assert.equal(isChunkLoadError(new Error('WebGL unavailable')),false);
 showScreenLoadFailure(root,'Arena',new Error('WebGL unavailable'),()=>retries++);
 root.querySelector<HTMLButtonElement>('button')!.click();assert.equal(retries,1);
 showScreenLoadFailure(root,'Arena',new Error('Failed to fetch dynamically imported module: /assets/pvp-old.js'),()=>retries++);
 assert.match(root.textContent!,/Game update ready/);assert.match(root.textContent!,/Reload game/);
});
test('leaderboard keeps a desktop table header and correct icons in empty and populated views',async()=>{
 resetDom();const root=host(),oldFetch=globalThis.fetch;
 globalThis.fetch=async url=>new Response(JSON.stringify({entries:String(url).includes('category=casual')?[{rank:1,name:'Defender',value:1234,detail:'Wave 8'}]:[],metric:'Score'}));
 try {
  renderLeaderboards(root);await flush();
  assert.equal(root.querySelectorAll('.ftd-board-toolbar').length,1);assert.equal(root.querySelector('.ftd-board-columns')!.children.length,3);
  assert.equal(root.querySelectorAll('.ftd-board-empty').length,1);
  assert.doesNotMatch(root.querySelector('.ftd-board-tabs--scope')!.textContent!,/Globe2/);
  [...root.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.dataset.category==='casual')!.click();await flush();
  assert.equal(root.querySelectorAll('.ftd-board-row').length,1);assert.match(root.textContent!,/Defender/);assert.match(root.textContent!,/1,234/);
  assert.equal(root.querySelector('.ftd-board-content')!.getAttribute('aria-busy'),'false');
 } finally {globalThis.fetch=oldFetch;resetDom();}
});
test('actual Arena hub entry opens core UI without fetching a retired Arena module',async()=>{
 resetDom();setAuthToken('test-only');const root=host(),oldFetch=globalThis.fetch,requests:string[]=[];
 globalThis.fetch=async url=>{requests.push(String(url));return new Response(JSON.stringify(String(url).includes('/friends')?{friends:[]}:{success:true,config:DEFAULT_PVP_CONFIG,match:null}));};
 try {
  const tabs=menuHubTabs({onOpenDaily:()=>{},onToggleSound:()=>{},onLogout:()=>{},onStartCampaign:()=>{},showLobbyPage:()=>{}});
  const {defaultSave}=await import('../../game/save');tabs.find(tab=>tab.id==='ARENA')!.renderMain(root,defaultSave());await flush();
  assert.ok(root.querySelector('.ftd-pvp'));assert.ok(root.querySelector('[data-testid="arena-queue-arena"]'));
  assert.equal(requests.some(url=>/\/assets\/.*pvp/.test(url)),false);
  assert.equal(root.querySelector('.ftd-screen-load-error'),null);
 } finally {disposePvpHub(root.children[0] as HTMLElement);globalThis.fetch=oldFetch;setAuthToken(null);resetDom();}
});
