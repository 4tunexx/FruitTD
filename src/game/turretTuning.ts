import type { BuiltinWeaponId } from './turretWeapons';
/** Shared validation for published turret level settings. */
export interface TurretTuning { damageMultiplier:number;rangeMultiplier:number;cooldownMultiplier:number;effectColor:string;effectScale:number; chassis?:BuiltinWeaponId;baseDamage?:number;damageGrowth?:number;baseRange?:number;rangeGrowth?:number;baseCooldown?:number;cost?:number;deathEffect?:'juice'|'sparks'|'pulse';deathScale?:number; }
export const DEFAULT_TURRET_TUNING:TurretTuning={damageMultiplier:1,rangeMultiplier:1,cooldownMultiplier:1,effectColor:'',effectScale:1};
export function normalizeTurretTuning(raw:unknown):TurretTuning|undefined {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return undefined;
  const r=raw as Record<string,unknown>;
  const n=(key:string,min:number,max:number)=>r[key]!==''&&Number.isFinite(Number(r[key]))?Math.max(min,Math.min(max,Number(r[key]))):DEFAULT_TURRET_TUNING[key as keyof TurretTuning] as number;
  const extra:Partial<TurretTuning>={};
  if(['juice','sparks','pulse'].includes(String(r.deathEffect)))extra.deathEffect=r.deathEffect as TurretTuning['deathEffect'];
  if(typeof r.chassis==='string'&&['guillotine','vortex','laser','railgun','sprinkler','blender'].includes(r.chassis))extra.chassis=r.chassis as BuiltinWeaponId;
  for(const [key,min,max] of [['baseDamage',.1,500],['damageGrowth',0,100],['baseRange',.5,15],['rangeGrowth',0,1],['baseCooldown',.1,10],['cost',1,5000],['deathScale',.5,3]] as const){if(r[key]!==undefined&&r[key]!==''&&Number.isFinite(Number(r[key])))extra[key]=Math.max(min,Math.min(max,Number(r[key])));}
  return {...extra,damageMultiplier:n('damageMultiplier',.1,10),rangeMultiplier:n('rangeMultiplier',.25,3),cooldownMultiplier:n('cooldownMultiplier',.2,5),effectScale:n('effectScale',.5,3),effectColor:typeof r.effectColor==='string'&&/^#[a-f0-9]{6}$/i.test(r.effectColor)?r.effectColor:''};
}
