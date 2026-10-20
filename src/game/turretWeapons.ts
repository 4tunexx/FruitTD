/** Stable save/Creator IDs; names and attack rules describe the current arsenal. */
export type BuiltinWeaponId = 'guillotine'|'vortex'|'laser'|'railgun'|'sprinkler'|'blender';
export type WeaponId = BuiltinWeaponId | `custom-${string}`;
export interface WeaponDefinition {name:string;icon:string;pattern:string;color:number;range:number;rangeGrowth:number;cooldown:number;damage:number;damageGrowth:number;blast:number;chassis?:BuiltinWeaponId}

export const TURRET_WEAPONS:Record<WeaponId,WeaponDefinition> = {
  guillotine:{name:'Rotor Saw',icon:'Scissors',pattern:'radial',color:0xffd36b,range:1.6,rangeGrowth:.1,cooldown:.75,damage:24,damageGrowth:6,blast:0},
  vortex:{name:'Flamethrower',icon:'Flame',pattern:'cone',color:0xffa23d,range:3.8,rangeGrowth:.16,cooldown:.22,damage:5,damageGrowth:1.5,blast:0},
  laser:{name:'Lemon Laser',icon:'Zap',pattern:'pierce',color:0xffed91,range:7.2,rangeGrowth:.3,cooldown:.4,damage:9,damageGrowth:3,blast:0},
  railgun:{name:'Rocket Launcher',icon:'Rocket',pattern:'rocket',color:0xffbd62,range:8,rangeGrowth:.25,cooldown:2.4,damage:45,damageGrowth:11,blast:1.4},
  sprinkler:{name:'Fertiliser Sprinkler',icon:'Sprout',pattern:'radial',color:0xb9d783,range:3.6,rangeGrowth:.14,cooldown:.65,damage:4,damageGrowth:1,blast:0},
  blender:{name:'Bomb Thrower',icon:'Bomb',pattern:'bomb',color:0xffd36b,range:6,rangeGrowth:.2,cooldown:1.8,damage:32,damageGrowth:8,blast:1.8},
};
export function weaponStats(id:WeaponId,level:number) {
 const base=TURRET_WEAPONS[id],upgrade=Math.max(0,Math.min(9,Math.floor(level)-1));
 return {...base,range:base.range+base.rangeGrowth*upgrade,damage:base.damage+base.damageGrowth*upgrade,blast:base.blast?base.blast+upgrade*.08:0,cooldown:base.cooldown/(1+upgrade*.07)};
}
export function projectileTravelSeconds(id:string,distance:number):number {id=TURRET_WEAPONS[id as WeaponId]?.chassis||id;return id==='blender'?Math.min(.85,.4+distance*.035):id==='railgun'?Math.min(.6,.18+distance*.025):0;}

/** Retire only untouched old defaults; preserve any deliberately tuned Admin row. */
export function migrateLegacyWeaponBalance<T extends {cost:number;damage:number;range:number;cooldownMs:number}>(id:string,row:T|undefined):T|undefined {
 if(!row)return row;
 const old:Record<string,number[]>={vortex:[120,16,4,600],sprinkler:[150,12,3,350],blender:[200,42,2,700]};
 const current:Record<string,number[]>={vortex:[8,3.5,250],sprinkler:[5,3,650],blender:[60,5,1800]};
 const legacy=old[id];
 if(!legacy||[row.cost,row.damage,row.range,row.cooldownMs].some((value,index)=>value!==legacy[index]))return row;
 const [damage,range,cooldownMs]=current[id]!;
 return {...row,damage:damage!,range:range!,cooldownMs:cooldownMs!};
}
