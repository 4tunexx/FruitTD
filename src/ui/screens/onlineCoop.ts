import { powerButton, updatePowerButton } from '../powerButton';
import { getAuthToken } from '../../services/auth';
import { heroAbility } from '../../game/heroAbilities';
import { el } from '../components/dom';
import { GameButton } from '../components/primitives';
import { LoadingIndicator } from '../components/loading';
import { PvpBattlefield } from './pvpBattlefield';
import type { CoopMatch, CoopConfig, CoopCommand } from '../../game/onlineCoop';
import type { PvpConfig } from '../../game/pvp';
import { turretDef, type TurretKind } from '../../game/turrets';
import type { Realtime } from 'ably';
import { recordRun } from '../../game/runStats';
import { openScreen } from './registry';
const cleanup=new WeakMap<HTMLElement,()=>void>();
let pendingInviteCode='';
export function openOnlineCoopInvite(code:string):void{if(!/^[a-f0-9]{10}$/i.test(code))return;pendingInviteCode=code.toLowerCase();openScreen('CO_OP');}
const base=(import.meta.env?.VITE_PVP_API_URL || '/api/pvp').replace(/\/pvp\/?$/,'/coop');
async function api(path:string,body?:object){const token=getAuthToken();const response=await fetch(`${base}${path}`,{signal:AbortSignal.timeout(12000),method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok||data.success===false)throw new Error(data.error||'Co-op service unavailable.');return data;}
export function renderOnlineCoop(host:HTMLElement,startLocal:()=>void):void {
 cleanup.get(host)?.();host.replaceChildren();
 const heading=el('header',{class:'ftd-pvp__heading ftd-coop-online-heading'},[
  el('button',{class:'ftd-hub-page-back',type:'button','aria-label':'Back to hub',title:'Back to hub'},[el('span',{'aria-hidden':'true',text:'←'}),el('span',{text:'Hub'})]),
  el('div',{},[el('p',{class:'ftd-pvp__eyebrow',text:'MULTIPLAYER'}),el('h1',{text:'CO-OP · DEFEND TOGETHER'}),el('p',{class:'ftd-pvp__intro',text:'Two online players slice together, share one wall and Fruts, and receive equal match rewards.'})]),
 ]);
 heading.querySelector('button')?.addEventListener('click',()=>openScreen('MAIN_MENU'));
 host.append(heading);
 const notice=el('p',{role:'status',class:'ftd-pvp__intro'});const body=el('div');host.append(notice,body);
 let room:CoopMatch|null=null;let balance:PvpConfig;let coop:CoopConfig;let yourId='';let scene:PvpBattlefield|null=null;let sceneId='';let selected='guillotine';let working=false;let disposed=false;let client:Realtime|null=null;let connectedRoom='';let attaching=false;let inviteCode=pendingInviteCode;pendingInviteCode='';let attemptedInvite=false;
 const dispose=()=>{disposed=true;clearInterval(timer);scene?.dispose();client?.close();client=null;connectedRoom='';};
 const canAttachRoom=(id:string)=>Boolean(room&&room.id===id&&room.status!=='complete');
 const attach=async()=>{if(!room||room.status==='complete'||attaching||connectedRoom===room.id)return;attaching=true;const id=room.id;
  let candidate:Realtime|null=null;
  try{const {Realtime}=await import('ably');if(disposed||!body.isConnected||!canAttachRoom(id))return;client?.close();candidate=new Realtime({authCallback:(_params,callback)=>{if(disposed||!canAttachRoom(id)){callback({name:'CoopTokenError',message:'Match view closed.',code:500,statusCode:500},null);return;}api(`/${id}/token`,{}).then(data=>{if(disposed||!canAttachRoom(id))callback({name:'CoopTokenError',message:'Match view closed.',code:500,statusCode:500},null);else callback(null,data);}).catch(error=>callback({name:'CoopTokenError',message:error instanceof Error?error.message:'Co-op authentication failed.',code:500,statusCode:500},null));}});if(disposed||!body.isConnected||!canAttachRoom(id)){candidate.close();return;}client=candidate;connectedRoom=id;
  await candidate.channels.get(`fruittd-coop-${id}`).subscribe('match.snapshot',(event)=>{if(disposed||!body.isConnected||room?.id!==id)return;const incoming=event.data as CoopMatch;if(incoming.revision>=room.revision){room=incoming;render();}});
  }catch(error){if(!disposed&&room?.id===id)notice.textContent='Realtime interrupted; recovering match state from the server.';if(candidate){candidate.close();if(client===candidate)client=null;}if(connectedRoom===id)connectedRoom='';}finally{attaching=false;if(!disposed&&room&&canAttachRoom(room.id)&&room.id!==id)void attach();}};
 const refresh=async()=>{if(working||disposed)return;working=true;try{const data=await api('/status');if(disposed||!body.isConnected)return;if(!data.room&&inviteCode&&!attemptedInvite){attemptedInvite=true;const joined=await api('/join',{code:inviteCode});data.room=joined.room;inviteCode='';}if(!room||!data.room||room.id!==data.room.id||data.room.revision>=room.revision)room=data.room;balance=data.balance;coop=data.coop;yourId=data.yourId;render();}catch(error){notice.textContent=error instanceof Error?error.message:'Could not load Co-op.';if(!room&&!disposed&&body.isConnected)render();}finally{working=false;}};
 const send=async(path:string,value:object)=>{if(working||disposed)return;working=true;try{const data=await api(path,value);if(data.room&&(!room||room.id!==data.room.id||data.room.revision>=room.revision))room=data.room;notice.textContent='';}catch(error){notice.textContent=error instanceof Error?error.message:'Action failed.';}finally{working=false;await refresh();}};
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
 const render=()=>{
  if(disposed||scene?.interacting)return;
  body.replaceChildren();
  body.classList.toggle('ftd-coop-battle', Boolean(room && !['waiting','complete'].includes(room.status)));
  if(!room){scene?.dispose();scene=null;client?.close();client=null;connectedRoom='';
   const code=el('input',{class:'admin-input',placeholder:'10-character friend room code','aria-label':'Friend room code',maxlength:10,value:inviteCode}) as HTMLInputElement;
   body.append(el('div',{class:'ftd-coop-online-actions'},[GameButton({label:'Find a teammate',tone:'primary',onClick:()=>void send('/create',{public:true})}),GameButton({label:'Create private room',variant:'outline',onClick:()=>void send('/create',{public:false})}),code,GameButton({label:'Join friend',variant:'outline',onClick:()=>void send('/join',{code:code.value})}),GameButton({label:'Play locally on this PC',variant:'ghost',onClick:()=>{dispose();startLocal();}})]));return;
  }
  const own=room.players.find(p=>p.userId===yourId);if(!own)return;
  if(room.status==='waiting'){const inviteName=el('input',{class:'admin-input',placeholder:'Friend username','aria-label':'Friend username to invite','maxlength':24}) as HTMLInputElement;body.append(el('h3',{text:`ROOM ${room.id.toUpperCase()}`}),LoadingIndicator('Waiting for your teammate…'),el('p',{text:'Share this code with a friend. Public rooms also accept the next available player.'}),GameButton({label:'Copy room code',variant:'outline',onClick:()=>{void navigator.clipboard.writeText(room!.id).then(()=>notice.textContent='Room code copied.').catch(()=>notice.textContent='Select and copy the room code above.');}}),el('div',{class:'ftd-coop-online-actions'},[inviteName,GameButton({label:'Invite friend',tone:'primary',onClick:()=>{if(!inviteName.value.trim()){notice.textContent='Enter a friend username first.';return;}void send(`/${room!.id}/invite`,{username:inviteName.value.trim()});}})]),GameButton({label:'Delete room',variant:'outline',onClick:()=>command({type:'leave'})}));return;}
  if(room.status==='complete'){scene?.dispose();scene=null;client?.close();client=null;connectedRoom='';
   if(room.completedWaves||room.kills)recordRun({id:`coop:${room.id}`,mode:'coop',score:room.score,wave:room.wave,combo:0,kills:room.kills,strokes:0,hits:0,completed:room.reason!=='left',date:Date.now()});
   const coins=room.completedWaves?Math.min(coop.rewardCoinCap,room.kills*coop.coinsPerKill+room.completedWaves*coop.coinsPerWave):0;
   body.append(el('h3',{text:room.reason==='wall'?'WALL BREACHED':'TEAM RUN ENDED'}),el('p',{text:`${room.completedWaves} waves · ${room.kills} fruit · ${room.score} score`}),el('p',{text:`Each account earns ${coins} coins · ${Math.floor(room.completedWaves/coop.gemsEveryWaves)} gems. Server settlement applies XP and team achievements.`}),GameButton({label:'Back to Co-op lobby',tone:'primary',onClick:()=>void send(`/${room!.id}/ack`,{})}));return;
  }
  void attach();
  const other=room.players.find(p=>p.userId!==yourId);
  const snapshot={id:room.id,map:{id:'coop-orchard',name:'Shared Orchard',width:10,height:14,pathCells:[],buildCells:Array.from({length:8},(_,i)=>121+i)},yourSide:'blue',shared:true,sharedStroke:other?.lastStroke,players:[{userId:room.id,name:'Team',side:'blue',hero:own.hero,powerCasts:room.powerCasts,wallHealth:room.wallHealth,towers:room.towers,attackers:room.fruits.map(f=>({...f,progress:f.y}))}]};
  if(!scene||sceneId!==room.id){scene?.dispose();scene=new PvpBattlefield(snapshot,balance,c=>{if(c.type==='slash'||c.type==='build')command(c);});sceneId=room.id;}
  scene.update(snapshot,balance);scene.element.dataset.tower=selected;
  body.append(el('div',{class:'ftd-pvp__matchbar'},[el('strong',{text:`WAVE ${room.wave}`}),el('span',{text:`Wall ${room.wallHealth}/${balance.wallHealth} · ${Math.floor(room.fruts)} shared Fruts · ${room.score} score`}),el('span',{text:room.players.map(p=>`${p.name} · ${p.hero}`).join(' + ')}),GameButton({label:'Leave match',variant:'outline',onClick:()=>command({type:'leave'})})]));
  const powers=own.abilityLoadout??(own.hero==='jiju'?['jiju-1']:[]);
  body.append(el('div',{class:'hero-ability-bar hero-ability-bar--coop'},powers.slice(0,3).filter(id=>heroAbility(id)).map(id=>{
    const button=powerButton(id,()=>command({type:'ability',abilityId:id}));
    updatePowerButton(button,id,(own.abilityReadyAt??{})[id]??0,room!.fruts);
    return button;
  })));
  if(room.status==='boss-intro'||room.status==='countdown')body.append(el('div',{class:'ftd-coop-phase',role:'status'},[el('strong',{text:room.status==='boss-intro'?'OVERLORD APPROACHING':'NEXT WAVE'}),el('span',{text:`${Math.max(0,Math.ceil((room.phaseUntil-Date.now())/1000))}s`})]));
  body.append(el('div',{class:'ftd-pvp__siege-layout'},[scene.element,el('aside',{class:'ftd-pvp__siege-controls'},[el('h3',{text:'SHARED DEFENCE'}),el('p',{text:'Swipe incoming fruit. Click an empty wall pad to place the selected tower. Both blades appear live.'}),...Object.entries(balance.towers).map(([id,stats])=>GameButton({label:`${turretDef(id as TurretKind)?.name||id} · ${stats.cost} F`,variant:selected===id?'outline':'ghost',disabled:room!.fruts<stats.cost,onClick:()=>{selected=id;render();}}))])]));
 };
 body.append(LoadingIndicator('Connecting to online Co-op…'));
 const timer=setInterval(()=>{if(!body.isConnected){dispose();return;}void refresh().then(()=>drainCommands());},1000);
 cleanup.set(host,dispose);void refresh();
}
