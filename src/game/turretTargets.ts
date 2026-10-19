import { weaponStats, type WeaponId } from './turretWeapons';
export interface TurretTargetPoint {x:number;y:number}
/** Shared hit shapes: blast radius, aimed flame cone, piercing beam, radial tools. */
export function turretVictims<T>(type:string,origin:TurretTargetPoint,primary:T,units:T[],point:(unit:T)=>TurretTargetPoint,range:number,level=1):T[] {
 if(type==='main'||type==='catcher')return [primary];
 const target=point(primary),dx=target.x-origin.x,dy=target.y-origin.y,d=Math.hypot(dx,dy)||1;
 const blast=type==='railgun'||type==='blender'?weaponStats(type as WeaponId,level).blast:0;
 const victims=units.filter(unit=>unit!==primary).filter(unit=>{
  const p=point(unit),x=p.x-origin.x,y=p.y-origin.y,distance=Math.hypot(x,y);
  if(blast)return Math.hypot(p.x-target.x,p.y-target.y)<=blast;
  if(distance>range)return false;
  if(type==='laser'){const along=(x*dx+y*dy)/d;return along>=0&&along<=range&&Math.abs(x*dy-y*dx)/d<=.48;}
  if(type==='vortex')return distance<.001||(x*dx+y*dy)/(distance*d)>=Math.cos(Math.PI/6);
  return type==='guillotine'||type==='sprinkler';
 });
 return [primary,...victims.slice(0,24)];
}
