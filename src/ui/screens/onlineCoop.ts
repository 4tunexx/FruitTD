import { lucideIcon } from '../lucideIcon';
import { loadSave } from '../../game/save';
import { showScreenLoadFailure } from './loadFailure';
import { powerButton, updatePowerButton } from '../powerButton';
import { getAuthToken } from '../../services/auth';
import { heroAbility } from '../../game/heroAbilities';
import { el } from '../components/dom';
import { confirmModal } from '../components/surface';
import { GameButton } from '../components/primitives';
import { LoadingIndicator } from '../components/loading';
import type { PvpBattlefield } from './pvpBattlefield';
import type { CoopMatch, CoopConfig, CoopCommand } from '../../game/onlineCoop';
import { towerLevelFromXp } from '../../game/towerProgression';
import { pvpTowerLevel, pvpUpgradeCost, pvpSellRefund, PVP_MAX_TOWER_LEVEL, type PvpConfig } from '../../game/pvp';
import { turretDef, type TurretKind } from '../../game/turrets';
import type { Realtime } from 'ably';
import { recordRun } from '../../game/runStats';
import { openScreen } from './registry';
const cleanup=new WeakMap<HTMLElement,()=>void>();
let pendingInviteCode='';
export function openOnlineCoopInvite(code:string):void{if(!/^[a-f0-9]{10}$/i.test(code))return;pendingInviteCode=code.toLowerCase();openScreen('CO_OP');}
const base=(import.meta.env?.VITE_PVP_API_URL || '/api/pvp').replace(/\/pvp\/?$/,'/coop');
async function api(path:string,body?:object){
 const token=getAuthToken();
 const response=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(12000),method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json().catch(()=>null);
 if(!response.ok||!data||data.success===false)throw new Error(data?.error||'Co-op service unavailable. Please try again shortly.');
 return data;
}
export function disposeOnlineCoop(host:HTMLElement):void {cleanup.get(host)?.();cleanup.delete(host);}
export interface OnlineCoopOptions { request?:typeof api; realtime?:boolean }
export function renderOnlineCoop(host:HTMLElement,startLocal:()=>void,options:OnlineCoopOptions={}):void {
 const request=options.request??api;
 cleanup.get(host)?.();host.replaceChildren();
 const heading=el('header',{class:'ftd-pvp__heading ftd-coop-online-heading'},[
  el('button',{class:'ftd-hub-page-back',type:'button','aria-label':'Back to hub',title:'Back to hub'},[el('span',{'aria-hidden':'true',text:'←'}),el('span',{text:'Hub'})]),
  el('div',{},[el('p',{class:'ftd-pvp__eyebrow',text:'MULTIPLAYER'}),el('h1',{text:'CO-OP · DEFEND TOGETHER'}),el('p',{class:'ftd-pvp__intro',text:'Two to four online players slice together, share one wall and Fruts, and receive equal match rewards.'})]),
 ]);
 heading.querySelector('button')?.addEventListener('click',()=>openScreen('MAIN_MENU'));
 host.append(heading);
 const notice=el('p',{role:'status',class:'ftd-pvp__intro'});const body=el('div');host.append(notice,body);
 let room:CoopMatch|null=null;let balance:PvpConfig;let coop:CoopConfig;let yourId='';let scene:PvpBattlefield|null=null;let sceneId='';let sceneLoadingId='';let sceneFailure:unknown=null;let selected='guillotine';let pendingBuildCell:number|null=null;let towerManagerOpen=false;let working=false;let disposed=false;let client:Realtime|null=null;let connectedRoom='';let attaching=false;let inviteCode=pendingInviteCode;pendingInviteCode='';let attemptedInvite=false;let friendDraft='';let lobbyKey='';let leavePrompt=false;let rosterExpanded=false;
 const dispose=()=>{releaseInput();body.remove();disposed=true;clearInterval(timer);scene?.dispose();scene=null;sceneId='';client?.close();client=null;connectedRoom='';};
 const canAttachRoom=(id:string)=>Boolean(room&&room.id===id&&room.status!=='complete');
 const attach=async()=>{if(options.realtime===false||!room||room.status==='complete'||attaching||connectedRoom===room.id)return;attaching=true;const id=room.id;
  let candidate:Realtime|null=null;
  try{const {Realtime}=await import('ably');if(disposed||!body.isConnected||!canAttachRoom(id))return;client?.close();candidate=new Realtime({authCallback:(_params,callback)=>{if(disposed||!canAttachRoom(id)){callback({name:'CoopTokenError',message:'Match view closed.',code:500,statusCode:500},null);return;}request(`/${id}/token`,{}).then(data=>{if(disposed||!canAttachRoom(id))callback({name:'CoopTokenError',message:'Match view closed.',code:500,statusCode:500},null);else callback(null,data);}).catch(error=>callback({name:'CoopTokenError',message:error instanceof Error?error.message:'Co-op authentication failed.',code:500,statusCode:500},null));}});if(disposed||!body.isConnected||!canAttachRoom(id)){candidate.close();return;}client=candidate;connectedRoom=id;
  await candidate.channels.get(`fruittd-coop-${id}`).subscribe('match.snapshot',(event)=>{if(disposed||!body.isConnected||room?.id!==id)return;const incoming=event.data as CoopMatch;if(incoming.revision>=room.revision){room=incoming;render();}});
  }catch(error){if(!disposed&&room?.id===id)notice.textContent='Realtime interrupted; recovering match state from the server.';if(candidate){candidate.close();if(client===candidate)client=null;}if(connectedRoom===id)connectedRoom='';}finally{attaching=false;if(!disposed&&room&&canAttachRoom(room.id)&&room.id!==id)void attach();}};
 const refresh=async()=>{if(working||disposed)return;working=true;try{const data=await request('/status');if(disposed||!body.isConnected)return;if(!data.room&&inviteCode&&!attemptedInvite){attemptedInvite=true;const joined=await request('/join',{code:inviteCode});data.room=joined.room;inviteCode='';}if(!room||!data.room||room.id!==data.room.id||data.room.revision>=room.revision)room=data.room;balance=data.balance;coop=data.coop;yourId=data.yourId;render();}catch(error){notice.textContent=error instanceof Error?error.message:'Could not load Co-op.';if(!room&&!disposed&&body.isConnected)render();}finally{working=false;}};
 const send=async(path:string,value:object)=>{if(working||disposed)return;working=true;try{const data=await request(path,value);if(data.room&&(!room||room.id!==data.room.id||data.room.revision>=room.revision))room=data.room;notice.textContent='';}catch(error){notice.textContent=error instanceof Error?error.message:'Action failed.';}finally{working=false;await refresh();}};
 const commands: CoopCommand[] = [];
 let draining = false;
 const command = (value: CoopCommand) => {
  if (commands.length >= 8) commands.shift();
  commands.push(value);
  void drainCommands();
 };
 const drainCommands = async () => {
  if (draining || disposed || !body.isConnected) return;
  draining = true;
  try {
   while (commands.length && !disposed && body.isConnected) {
    if (working) return;
    const own = room?.players.find(p => p.userId === yourId);
    if (!room || !own || room.status === 'complete') { commands.length = 0; return; }
    const value = commands.shift()!;
    await send(`/${room.id}/command`, { sequence: own.sequence + 1, command: value });
   }
  } finally { draining = false; }
 };
 const snapshot = () => {
  if(!room)return null;
  const own=room.players.find(p=>p.userId===yourId);if(!own)return null;
  const teammates=room.players.filter(p=>p.userId!==yourId);
  return {id:room.id,revision:room.revision,map:{id:'coop-orchard',name:'Shared Orchard',width:10,height:14,pathCells:[] as number[],buildCells:Array.from({length:8},(_,i)=>121+i)},yourSide:'blue',shared:true,sharedStrokes:teammates.filter(member=>member.lastStroke).map(member=>({userId:member.userId,stroke:member.lastStroke!})),players:[{userId:room.id,name:'Team',side:'blue',hero:own.hero,wallSkin:loadSave().wallSkin,mainLevel:towerLevelFromXp(room.towerXp??0),mainLastFiredAt:room.mainLastFiredAt,powerCasts:room.powerCasts,wallHealth:room.wallHealth,towers:room.towers,attackers:room.fruits.map(f=>({...f,progress:f.y,movementSpeed:(balance.attacks[f.type]?.speed??0)*(f.boss?coop.bossSpeedMultiplier:coop.fruitSpeedMultiplier)}))}]};
 };
 const pressed=new Set<number>();let pendingRender=false;let inputTimer:ReturnType<typeof setTimeout>|undefined;
 const pointerDown=(event:PointerEvent)=>pressed.add(event.pointerId);
 const pointerUp=(event:PointerEvent)=>{pressed.delete(event.pointerId);clearTimeout(inputTimer);inputTimer=setTimeout(()=>{if(pendingRender&&!disposed)render();},0);};
 body.addEventListener('pointerdown',pointerDown);document.addEventListener('pointerup',pointerUp);document.addEventListener('pointercancel',pointerUp);
 const releaseInput=()=>{clearTimeout(inputTimer);document.removeEventListener('pointerup',pointerUp);document.removeEventListener('pointercancel',pointerUp);pressed.clear();};
 const leave=async()=>{if(leavePrompt||disposed||!room)return;leavePrompt=true;const id=room.id;try{if(await confirmModal({title:'Leave team run?',message:'Your team run will end for everyone. Leave this match?',confirmLabel:'Leave match',tone:'danger'})){if(!disposed&&room?.id===id)command({type:'leave'});}}finally{leavePrompt=false;}};
 const render=()=>{
  if(disposed)return;
  if(scene?.interacting||pressed.size){pendingRender=true;const current=snapshot();if(scene&&current)scene.update(current,balance);return;}
  pendingRender=false;
  const nextLobbyKey=!room?'lobby':room.status==='waiting'?JSON.stringify([room.id,room.status,room.players.map(p=>[p.userId,p.name,p.hero]),yourId]):'';
  if(nextLobbyKey&&nextLobbyKey===lobbyKey)return;
  lobbyKey=nextLobbyKey;
  const active=document.activeElement as HTMLInputElement|null;
  const focusedLabel=active?.tagName==='INPUT'&&body.contains(active)?active.getAttribute('aria-label'):null;
  renderContent();
  if(focusedLabel)[...body.querySelectorAll<HTMLInputElement>('input')].find(input=>input.getAttribute('aria-label')===focusedLabel)?.focus({preventScroll:true});
 };
 const renderContent=()=>{
  const inBattle=Boolean(room&&!['waiting','complete'].includes(room.status));
  const parent=inBattle?document.body:host;if(body.parentElement!==parent)parent.append(body);
  body.replaceChildren();
  body.classList.toggle('ftd-coop-battle', Boolean(room && !['waiting','complete'].includes(room.status)));
  if(!room){scene?.dispose();scene=null;sceneId='';sceneFailure=null;client?.close();client=null;connectedRoom='';
   const code=el('input',{class:'admin-input',placeholder:'10-character friend room code','aria-label':'Friend room code',maxlength:10,value:inviteCode}) as HTMLInputElement;
   code.addEventListener('input',()=>{inviteCode=code.value;});
   const localOption=(typeof window.matchMedia !== 'function' || window.matchMedia('(pointer: fine)').matches)
    ? GameButton({label:'Play locally on this PC',variant:'ghost',onClick:()=>{dispose();startLocal();}})
    : el('p',{class:'ftd-pvp__intro',text:'Local keyboard-and-mouse Co-op is available on desktop. Use an online room on this device.'});
   body.append(el('div',{class:'ftd-coop-online-actions'},[GameButton({label:'Find a team',tone:'primary',onClick:()=>void send('/create',{public:true})}),GameButton({label:'Create private room',variant:'outline',onClick:()=>void send('/create',{public:false})}),code,GameButton({label:'Join friend',variant:'outline',onClick:()=>void send('/join',{code:code.value})}),localOption]));return;
  }
  const own=room.players.find(p=>p.userId===yourId);if(!own)return;
  if(room.status==='waiting'){
   const inviteName=el('input',{class:'admin-input',placeholder:'Friend username','aria-label':'Friend username to invite','maxlength':24,value:friendDraft}) as HTMLInputElement;
   inviteName.value=friendDraft;
   inviteName.addEventListener('input',()=>{friendDraft=inviteName.value;});
   const hostPlayer=room.players[0]?.userId===yourId;
   body.append(el('h3',{text:`ROOM ${room.id.toUpperCase()} · ${room.players.length}/4 PLAYERS`}),
    el('p',{text:room.players.map(member=>`${member.name} · ${member.hero}`).join(' + ')}),
    el('p',{text:hostPlayer?'Invite up to three teammates. Start with two or three players, or the match starts when four join.':'Waiting for the host to start. The match starts automatically when four players join.'}),
    GameButton({label:'Copy room code',variant:'outline',onClick:()=>{void navigator.clipboard.writeText(room!.id).then(()=>notice.textContent='Room code copied.').catch(()=>notice.textContent='Select and copy the room code above.');}}),
    el('div',{class:'ftd-coop-online-actions'},[inviteName,GameButton({label:'Invite friend',tone:'primary',onClick:()=>{if(!inviteName.value.trim()){notice.textContent='Enter a friend username first.';return;}void send(`/${room!.id}/invite`,{username:inviteName.value.trim()});}})]));
   if(hostPlayer)body.append(GameButton({label:`Start with ${room.players.length} players`,tone:'primary',disabled:room.players.length<2,onClick:()=>command({type:'start'})}));
   body.append(GameButton({label:hostPlayer?'Close room':'Leave room',variant:'outline',onClick:()=>command({type:'leave'})}));return;
  }
  if(room.status==='complete'){scene?.dispose();scene=null;sceneId='';client?.close();client=null;connectedRoom='';
   if(room.completedWaves||room.kills)recordRun({id:`coop:${room.id}`,mode:'coop',score:room.score,wave:room.wave,combo:0,kills:room.kills,strokes:0,hits:0,completed:room.reason!=='left',date:Date.now()});
   const coins=room.completedWaves?Math.min(coop.rewardCoinCap,room.kills*coop.coinsPerKill+room.completedWaves*coop.coinsPerWave):0;
   body.append(el('section',{class:'ftd-coop-result','aria-label':'Team run result'},[
    el('p',{class:'ftd-pvp__eyebrow',text:'CO-OP · TEAM REPORT'}),
    el('h2',{text:room.reason==='wall'?'WALL BREACHED':'TEAM RUN ENDED'}),
    el('div',{class:'ftd-coop-result__stats'},[
      el('div',{},[el('strong',{text:String(room.completedWaves)}),el('small',{text:'WAVES CLEARED'})]),
      el('div',{},[el('strong',{text:String(room.kills)}),el('small',{text:'FRUIT DEFEATED'})]),
      el('div',{},[el('strong',{text:String(room.score)}),el('small',{text:'TEAM SCORE'})]),
    ]),el('p',{text:`Each account earns ${coins} coins · ${Math.floor(room.completedWaves/coop.gemsEveryWaves)} gems. Rewards appear after the run is settled.`}),
    GameButton({label:'Back to Co-op lobby',tone:'primary',block:true,onClick:()=>void send(`/${room!.id}/ack`,{})}),
   ]));return;
  }
  void attach();
  const currentSnapshot=snapshot()!;
  if(sceneId!==room.id){scene?.dispose();scene=null;sceneId=room.id;sceneLoadingId=room.id;const loadingRoom=room.id;void import('./pvpBattlefield').then(({PvpBattlefield})=>{if(disposed||!body.isConnected||room?.id!==loadingRoom||room.status==='complete'){if(sceneLoadingId===loadingRoom)sceneLoadingId='';return;}scene=new PvpBattlefield(snapshot()??currentSnapshot,balance,c=>{if(c.type==='slash'||c.type==='build')command(c);},cell=>{if(room?.towers.some(tower=>tower.cell===cell)){pendingBuildCell=null;towerManagerOpen=true;}else{pendingBuildCell=cell;}scene?.selectCell(cell);render();});sceneLoadingId='';render();}).catch(error=>{if(sceneLoadingId===loadingRoom)sceneLoadingId='';if(!disposed&&room?.id===loadingRoom){sceneFailure=error;render();}});}
  if(!scene){
   if(sceneFailure){const recovery=el('section');body.append(recovery);showScreenLoadFailure(recovery,'Co-op battlefield',sceneFailure,()=>{sceneFailure=null;sceneId='';render();});}
   else body.append(LoadingIndicator('Loading Co-op battlefield…'));
   body.append(GameButton({label:'Leave match',variant:'outline',onClick:()=>void leave()}));return;
  }
  scene.update(currentSnapshot,balance);scene.element.dataset.tower=selected;
  const leaveButton=el('button',{type:'button',class:'ftd-coop-leave','aria-label':'Leave match',title:'Leave match'},[lucideIcon('LogOut','',18)]);
  leaveButton.addEventListener('click',()=>void leave());
  body.append(el('header',{class:'ftd-coop-hud'},[
    el('div',{},[el('strong',{text:`WAVE ${room.wave}`}),el('small',{text:`Tower Lv ${towerLevelFromXp(room.towerXp??0)} · ${room.score} score`})]),
    el('div',{class:'ftd-coop-wallet'},[el('strong',{text:`${Math.floor(room.fruts)} F`}),el('small',{text:'SHARED FRUTS'})]),leaveButton,
    el('div',{class:'ftd-coop-health',role:'progressbar','aria-label':'Team wall health','aria-valuemin':0,'aria-valuemax':balance.wallHealth,'aria-valuenow':room.wallHealth},[el('i',{style:`width:${Math.max(0,Math.min(100,room.wallHealth/balance.wallHealth*100))}%`})]),
  ]));
  const roster=el('details',{class:'ftd-coop-roster',open:rosterExpanded},[
    el('summary',{text:`TEAM · ${room.players.length}/4`}),
    ...room.players.map(player=>el('p',{text:`${player.name}${player.userId===yourId?' · YOU':''}`})),
  ]);roster.addEventListener('toggle',()=>{if(roster.isConnected)rosterExpanded=roster.open;});body.append(roster);
  const powers=own.abilityLoadout??(own.hero==='jiju'?['jiju-1']:[]);
  body.append(el('div',{class:'hero-ability-bar hero-ability-bar--coop'},powers.slice(0,3).filter(id=>heroAbility(id)).map(id=>{
    const button=powerButton(id,()=>command({type:'ability',abilityId:id}));
    updatePowerButton(button,id,(own.abilityReadyAt??{})[id]??0,room!.fruts,room!.status!=='playing'&&room!.status!=='boss-intro','fruts',own.abilityRanks?.[id]??1);
    return button;
  })));
  if(room.status==='boss-intro'||room.status==='countdown')body.append(el('div',{class:'ftd-coop-phase',role:'status'},[el('strong',{text:room.status==='boss-intro'?'OVERLORD APPROACHING':'NEXT WAVE'}),el('span',{text:`${Math.max(0,Math.ceil((room.phaseUntil-Date.now())/1000))}s`})]));
  const management=el('details',{class:'ftd-coop-tower-manager',open:towerManagerOpen},[el('summary',{text:`TEAM TOWERS · ${room.towers.length}/8`})]);
  management.addEventListener('toggle',()=>{if(management.isConnected)towerManagerOpen=management.open;});
  for(const tower of room.towers){
    const stats=balance.towers[tower.type];if(!stats)continue;const level=pvpTowerLevel(tower.level);
    const cost=pvpUpgradeCost(stats.cost,level),name=turretDef(tower.type as TurretKind)?.name||tower.type;
    management.append(el('div',{},[el('strong',{text:`${name} · Pad ${tower.cell-120} · Lv ${level}`}),
      GameButton({label:level>=PVP_MAX_TOWER_LEVEL?'MAX':`Upgrade · ${cost} F`,disabled:level>=PVP_MAX_TOWER_LEVEL||room.fruts<cost,onClick:()=>command({type:'upgrade',towerId:tower.id})}),
      GameButton({label:`Sell · ${pvpSellRefund(stats.cost,level)} F`,variant:'ghost',onClick:()=>command({type:'sell',towerId:tower.id})}),
    ]));
  }
  body.append(management);
  body.append(el('div',{class:'ftd-pvp__siege-layout'},[scene.element,el('aside',{class:'ftd-pvp__siege-controls',hidden:pendingBuildCell===null},[GameButton({label:'Close',variant:'ghost',onClick:()=>{pendingBuildCell=null;scene?.selectCell(null);render();}}),el('h3',{text:'SHARED DEFENCE'}),el('p',{text:'Swipe incoming fruit. Click an empty wall pad to place the selected tower. All teammates’ blades appear live.'}),...Object.entries(balance.towers).map(([id,stats])=>GameButton({label:`${turretDef(id as TurretKind)?.name||id} · ${stats.cost} F`,variant:selected===id?'outline':'ghost',disabled:room!.fruts<stats.cost,onClick:()=>{selected=id;if(pendingBuildCell!==null){const cell=pendingBuildCell;pendingBuildCell=null;command({type:'build',tower:id,cell});}render();}}))])]));
 };
 body.append(LoadingIndicator('Connecting to online Co-op…'));
 const timer=setInterval(()=>{if(!heading.isConnected||!body.isConnected){dispose();return;}void refresh().then(()=>drainCommands());},1000);
 cleanup.set(host,dispose);void refresh();
}
