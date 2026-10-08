import { heroAbility, MAX_HERO_ABILITY_RANK, type HeroAbility } from './heroAbilities';
export interface PowerCast { id:string; abilityId:string; at:number; rank:number; targets:Array<{x:number;y:number;progress?:number}> }
export function powerStats(ability:HeroAbility, rawRank:number) {
  const rank=Math.max(1,Math.min(MAX_HERO_ABILITY_RANK,Math.floor(rawRank)||1));
  // Costs are temporary match resources. Permanent upgrades use skill points.
  return { rank, damage:ability.damage*(1+(rank-1)*.2), cost:ability.juiceCost,
    slowMs:ability.effect==='frost'||ability.effect==='guard'||ability.id==='topfu-6'?2000+(rank-1)*350:0,
    slowMultiplier:ability.id==='topfu-6'?.15:.45, healFraction:ability.effect==='guard'?.12+(rank-1)*.02:0 };
}
export function equippedPower(id:string,hero:string,loadout:string[]|undefined,ranks:Record<string,number>|undefined) {
  const ability=heroAbility(id); const rank=id==='jiju-1'?Math.max(1,ranks?.[id]??0):ranks?.[id]??0;
  if(!ability||ability.hero!==hero||!loadout?.includes(id)||!Number.isFinite(rank)||rank<1)throw new Error('That power is not equipped');
  return {ability,stats:powerStats(ability,rank)};
}
export function powerTargets<T>(items:T[],ability:HeroAbility,point:(item:T)=>{x:number;y:number}):T[] {
  const ordered=[...items].sort((a,b)=>point(b).y-point(a).y);
  if(ability.effect==='pierce')return ordered.slice(0,Math.max(1,Math.ceil(items.length*.4)));
  if(ability.effect==='burst'||ability.effect==='bloom') {
    const lead=ordered[0]; if(!lead)return [];
    const origin=point(lead);return ordered.filter(item=>Math.hypot(point(item).x-origin.x,point(item).y-origin.y)<=3.2);
  }
  return ordered;
}
export function appendPowerCast(casts:PowerCast[]|undefined,cast:PowerCast):PowerCast[]{return [...(casts??[]).filter(item=>cast.at-item.at<5000),cast].slice(-24);}
