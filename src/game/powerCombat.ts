import { heroAbility, MAX_HERO_ABILITY_RANK, type HeroAbility } from './heroAbilities';
export interface PowerCast { id:string; abilityId:string; at:number; rank:number; targets:Array<{x:number;y:number;progress?:number}> }
export function powerStats(ability:HeroAbility, rawRank:number) {
  const rank=Math.max(1,Math.min(MAX_HERO_ABILITY_RANK,Math.floor(rawRank)||1));
  // Costs are temporary match resources. Permanent upgrades use skill points.
  return { rank, damage:ability.damage*(1+(rank-1)*.2), cost:ability.juiceCost, cooldownMs:Math.round(ability.cooldownMs*(1-(rank-1)*.05)),
    slowMs:ability.effect==='shock'?450+(rank-1)*75:ability.effect==='frost'||ability.effect==='guard'||ability.id==='topfu-6'?2000+(rank-1)*350:0,
    slowMultiplier:ability.effect==='shock'?.1:ability.id==='topfu-6'||ability.id==='jiju-4'?0:.45, healFraction:ability.effect==='guard'?.12+(rank-1)*.02:0 };
}
export function equippedPower(id:string,hero:string,loadout:string[]|undefined,ranks:Record<string,number>|undefined) {
  const ability=heroAbility(id); const rank=id==='jiju-1'?Math.max(1,ranks?.[id]??0):ranks?.[id]??0;
  if(!ability||ability.hero!==hero||!loadout?.includes(id)||!Number.isFinite(rank)||rank<1)throw new Error('That power is not equipped');
  return {ability,stats:powerStats(ability,rank)};
}
export interface PowerEnvelope { x:number; y:number; radius:number }
/** Full power near the keep; 35% at its range edge, zero outside. */
export function powerDamageMultiplier(point:{x:number;y:number}, envelope:PowerEnvelope):number {
  const distance=Math.hypot(point.x-envelope.x,point.y-envelope.y);
  if(!Number.isFinite(distance)||!Number.isFinite(envelope.radius)||envelope.radius<=0||distance>envelope.radius)return 0;
  const fraction=distance/envelope.radius;
  return 1-.65*fraction*fraction;
}
export function superKillCharge(flow:number):number { return Math.min(2.4,1.6+Math.max(0,Math.min(10,flow||0))*.08); }
export function superSliceCharge(flow:number,secondCut=false):number { return (secondCut?.12:.35)+Math.max(0,Math.min(10,flow||0))*.015; }
export function powerTargets<T>(items:T[],ability:HeroAbility,point:(item:T)=>{x:number;y:number},envelope:PowerEnvelope):T[] {
  const eligible=items.filter(item=>powerDamageMultiplier(point(item),envelope)>0);
  const ordered=[...eligible].sort((a,b)=>point(b).y-point(a).y);
  if(ability.effect==='pierce')return ordered.slice(0,Math.max(1,Math.ceil(eligible.length*.4)));
  if(ability.effect==='burst'||ability.effect==='bloom') {
    const lead=ordered[0]; if(!lead)return [];
    const origin=point(lead);return ordered.filter(item=>Math.hypot(point(item).x-origin.x,point(item).y-origin.y)<=3.2);
  }
  return ordered;
}
export function appendPowerCast(casts:PowerCast[]|undefined,cast:PowerCast):PowerCast[]{return [...(casts??[]).filter(item=>cast.at-item.at<5000),cast].slice(-24);}

/** Cover the authored field without tying hero reach to a turret's firing radius. */
export function mapPowerEnvelope(origin:{x:number;y:number}, bounds:{minX:number;maxX:number;minY:number;maxY:number}):PowerEnvelope {
  return {...origin,radius:Math.max(...[bounds.minX,bounds.maxX].flatMap(x=>[bounds.minY,bounds.maxY].map(y=>Math.hypot(x-origin.x,y-origin.y))))};
}
