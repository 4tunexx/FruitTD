import {register} from 'node:module';
// Node 20 has asynchronous loader registration but no registerHooks. Register
// before dynamically importing screen modules so CSS imports stay testable.
register(`data:text/javascript,${encodeURIComponent(`export async function load(url, context, nextLoad) {
  return url.endsWith('.css')
    ? { format: 'module', source: 'export {};', shortCircuit: true }
    : nextLoad(url, context);
}`)}`, import.meta.url);
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {installDomStub,resetDom} from '../domStub.test-helper';
installDomStub();
const storage=new Map<string,string>();
(globalThis as any).localStorage={getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)};
const [{GameButton}, {isChunkLoadError,showScreenLoadFailure}, {renderLeaderboards},
  {menuHubTabs}, {disposePvpHub}, {setAuthToken}, {DEFAULT_PVP_CONFIG}] = await Promise.all([
    import('../components/primitives'), import('./loadFailure'), import('./leaderboards'),
    import('./menuHubTabs'), import('./pvp'), import('../../services/auth'), import('../../game/pvp'),
  ]);
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
test('notification centre daily-reward action reaches the real hub daily handler',async()=>{
 resetDom();setAuthToken('test-only');const root=host(),oldFetch=globalThis.fetch;let daily=0;
 globalThis.fetch=async url=>{
  const path=String(url);
  return new Response(JSON.stringify(path.endsWith('/friends')?{friends:[]}:path.endsWith('/forum')?{posts:[]}:path.endsWith('/notifications')?{unread:1,notifications:[{notificationId:'daily-test',type:'daily_reward',title:'Daily supply ready',body:'Claim your supply',actorName:'FruitTD',createdAt:new Date().toISOString()}]}:{success:true}));
 };
 try{
  const tabs=menuHubTabs({onOpenDaily:()=>daily++,onToggleSound:()=>{},onLogout:()=>{},onStartCampaign:()=>{},showLobbyPage:()=>{}});
  const {defaultSave}=await import('../../game/save');tabs.find(tab=>tab.id==='NOTIFICATIONS')!.renderMain(root,defaultSave());for(let i=0;i<20&&!root.querySelector('.ftd-social__notification-actions');i++)await new Promise(r=>setTimeout(r,10));
  const action=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='View daily rewards');assert.ok(action,root.innerHTML);action.click();await flush();assert.equal(daily,1);
 }finally{globalThis.fetch=oldFetch;setAuthToken(null);resetDom();}
});
test('Arena context shows the selected defender and every destination button routes correctly',async()=>{
 resetDom();const {navigation}=await import('../../game/navigation');const {defaultSave}=await import('../../game/save');const save=defaultSave();
 const tabs=menuHubTabs({onOpenDaily:()=>{},onToggleSound:()=>{},onLogout:()=>{},onStartCampaign:()=>{},showLobbyPage:()=>{}});
 for(const id of ['ARENA','RANKED']){
  const root=host();tabs.find(tab=>tab.id===id)!.renderSub!(root,save);
  assert.ok(root.querySelector('.ftd-hero-portrait'));assert.match(root.textContent!,/10 per player/);
  const targets=['HEROES','LEADERBOARD','SOCIAL'];const buttons=[...root.querySelectorAll<HTMLButtonElement>('button')];
  assert.equal(buttons.length,targets.length);
  buttons.forEach((button,index)=>{navigation.home();button.click();assert.equal(navigation.state,targets[index]);});
  root.remove();
 }
 navigation.home();resetDom();
});
test('all 18 hub page adapters render both panels for a new account without a blank/error page',async()=>{
 resetDom();setAuthToken(null);const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(JSON.stringify({entries:[],metric:'Score',friends:[],posts:[],notifications:[],unread:0}));
 try{
  const {defaultSave}=await import('../../game/save');const save=defaultSave();
  const {homeHubTab,heroesHubTab,inventoryHubTab,shopHubTab,profileHubTab,coopHubTab}=await import('./hubTabs');
  const noop=()=>{};
  const tabs=[homeHubTab(noop),heroesHubTab({onEquip:noop,onBuy:noop}),inventoryHubTab({onEquip:noop,onSell:noop}),shopHubTab({onBuy:noop}),profileHubTab(()=>({})),coopHubTab(noop),...menuHubTabs({onOpenDaily:noop,onToggleSound:noop,onLogout:noop,onStartCampaign:noop,showLobbyPage:noop})];
  assert.equal(tabs.length,18);assert.equal(new Set(tabs.map(t=>t.id)).size,18);
  for(const tab of tabs){
   const workspace=host();workspace.className='ftd-hub';const root=document.createElement('main'),side=document.createElement('aside');root.className='ftd-hub__main';side.className='ftd-hub__sub';workspace.append(root,side);
   tab.renderMain(root,save);tab.renderSub?.(side,save);
   for(let i=0;i<30&&(!root.textContent||root.querySelector('.ftd-loading'));i++)await new Promise(r=>setTimeout(r,10));
   assert.ok(root.textContent!.trim(),`${tab.id} must show content or a sign-in gate`);
   assert.ok(side.textContent!.trim(),`${tab.id} must provide contextual content`);
   assert.equal(root.querySelector('.ftd-screen-load-error'),null,`${tab.id} failed to render`);
   assert.equal(root.querySelector('.ftd-loading'),null,`${tab.id} left a loading indicator`);
   if(tab.id==='ARENA'||tab.id==='RANKED')disposePvpHub(root.children[0] as HTMLElement);
   workspace.remove();
  }
 }finally{globalThis.fetch=oldFetch;resetDom();}
});
