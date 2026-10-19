export interface TurretTargetPoint {x:number;y:number}
/** Shared server rule: radial cutters, splash frost, straight piercing shots. */
export function turretVictims<T>(type:string,origin:TurretTargetPoint,primary:T,units:T[],point:(unit:T)=>TurretTargetPoint,range:number):T[] {
  if(type==='main'||type==='vortex'||type==='catcher')return [primary];
  const target=point(primary),dx=target.x-origin.x,dy=target.y===origin.y&&dx===0?1:target.y-origin.y,d=Math.hypot(dx,dy)||1;
  const others=units.filter(unit=>unit!==primary).filter(unit=>{
    const p=point(unit),x=p.x-origin.x,y=p.y-origin.y;
    if(Math.hypot(x,y)>range)return false;
    if(type==='laser'||type==='railgun'){const along=(x*dx+y*dy)/d;return along>=0&&along<=range&&Math.abs(x*dy-y*dx)/d<=.6;}
    if(type==='guillotine'||type==='blender')return Math.hypot(x,y)<=range;
    return type==='sprinkler'&&Math.hypot(p.x-target.x,p.y-target.y)<=1;
  });
  return [primary,...others.slice(0,type==='railgun'?3:type==='sprinkler'?4:12)];
}
