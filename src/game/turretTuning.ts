/** Shared validation for published turret level settings. */
export interface TurretTuning { damageMultiplier:number;rangeMultiplier:number;cooldownMultiplier:number;effectColor:string;effectScale:number; }
export const DEFAULT_TURRET_TUNING:TurretTuning={damageMultiplier:1,rangeMultiplier:1,cooldownMultiplier:1,effectColor:'',effectScale:1};
export function normalizeTurretTuning(raw:unknown):TurretTuning|undefined {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return undefined;
  const r=raw as Record<string,unknown>;
  const n=(key:string,min:number,max:number)=>r[key]!==''&&Number.isFinite(Number(r[key]))?Math.max(min,Math.min(max,Number(r[key]))):DEFAULT_TURRET_TUNING[key as keyof TurretTuning] as number;
  return {damageMultiplier:n('damageMultiplier',.1,10),rangeMultiplier:n('rangeMultiplier',.25,3),cooldownMultiplier:n('cooldownMultiplier',.2,5),effectScale:n('effectScale',.5,3),effectColor:typeof r.effectColor==='string'&&/^#[a-f0-9]{6}$/i.test(r.effectColor)?r.effectColor:''};
}
