import type { HeroAbility } from './heroAbilities';

export type Affliction = 'burn'|'frost'|'shock'|'snare'|'haze'|'cut'|'pierce'|'solar'|'crush';
export interface CombatStatus {
  statusKind?:Affliction; statusUntil?:number;
  burnUntil?:number; burnDps?:number; burnTickAt?:number;
}
export function powerAffliction(ability:HeroAbility):Affliction {
  if(ability.id==='lagen-5')return 'snare';
  if(ability.id==='tripos-4')return 'haze';
  if(ability.hero==='ki')return ability.id==='ki-5'||ability.id==='ki-6'?'burn':'solar';
  if(ability.effect==='frost'||ability.id==='topfu-5')return 'frost';
  if(ability.effect==='shock')return 'shock';
  if(ability.effect==='pierce')return 'pierce';
  return ability.hero==='topfu'?'crush':'cut';
}
export function markStatus(target:CombatStatus,kind:Affliction,now:number,duration=650):void {
  if(duration<=850&&(target.statusUntil??0)>now&&['frost','snare','haze','shock'].includes(target.statusKind??''))return;
  target.statusKind=kind;target.statusUntil=now+duration;
}
export function ignite(target:CombatStatus,now:number,dps:number,duration=2200):void {
  if((target.burnUntil??0)<=now){target.burnTickAt=now;target.burnDps=dps;}
  else target.burnDps=Math.max(target.burnDps??0,dps);
  target.burnUntil=Math.max(target.burnUntil??0,now+duration);
}
/** Integrate only the live portion of the interval; repeated snapshots cannot duplicate damage. */
export function tickBurn(target:CombatStatus,now:number):number {
  const end=Math.min(now,target.burnUntil??0),start=target.burnTickAt??end;
  if(end<=start)return 0;
  target.burnTickAt=end;
  return (end-start)/1000*(target.burnDps??0);
}
export function applyPowerStatus(target:CombatStatus,ability:HeroAbility,now:number,slowMs:number,damage:number):void {
  const kind=powerAffliction(ability);
  markStatus(target,kind,now,slowMs||850);
  if(kind==='burn')ignite(target,now,damage*.12,2400);
}
export function applyWeaponStatus(target:CombatStatus,behavior:string,now:number,damage:number):void {
  if(behavior==='vortex')ignite(target,now,damage*.35);
  else markStatus(target,behavior==='sprinkler'?'haze':behavior==='laser'?'pierce':behavior==='guillotine'?'cut':'crush',now,behavior==='sprinkler'?1200:450);
}
