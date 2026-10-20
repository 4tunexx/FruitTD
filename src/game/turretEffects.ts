import { CircleGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, Vector3 } from 'three';
import type { TurretKind } from './turrets';
import { COMBAT_GOLD } from './combatTokens';
import { projectileTravelSeconds, TURRET_WEAPONS, weaponStats } from './turretWeapons';
export const TURRET_COLORS:Record<TurretKind|'main',number>={main:0xffd56a,...Object.fromEntries(Object.entries(TURRET_WEAPONS).map(([id,w])=>[id,w.color]))} as Record<TurretKind|'main',number>;
type Effect={group:Group;age:number;duration:number;travel:number;kind:string;from:Vector3;to:Vector3};
/** Presentation only. Simulation owns hits; every transient mesh has a lifetime. */
export class TurretEffects {
 readonly group=new Group();private effects:Effect[]=[];
 private mesh(geometry:SphereGeometry|RingGeometry|CylinderGeometry|CircleGeometry,color:number,opacity=1):Mesh {
  const mesh=new Mesh(geometry,new MeshBasicMaterial({color,transparent:true,opacity,side:DoubleSide,depthWrite:false,depthTest:false,toneMapped:false}));
  mesh.renderOrder=35;mesh.userData.opacity=opacity;return mesh;
 }
 shot(kind:TurretKind|'main',from:Vector3,to:Vector3,level=1,color=kind==='main'?TURRET_COLORS.main:TURRET_WEAPONS[kind].color,scale=1,radius?:number):void {
  const group=new Group(),strength=(1+Math.min(9,level-1)*.065)*scale;
  const behavior=kind==='main'?'main':TURRET_WEAPONS[kind].chassis||kind;
  const travel=projectileTravelSeconds(kind,from.distanceTo(to));
  const duration=travel?travel+.4:behavior==='laser'?.24:behavior==='sprinkler'?.7:.38;
  const stats=kind==='main'?null:weaponStats(kind,level);
  if(behavior==='laser'||behavior==='vortex'){
   const direction=to.clone().sub(from);direction.y=0;
   if(direction.lengthSq()>0)to=from.clone().addScaledVector(direction.normalize(),radius??stats!.range);
  }
  const beam=(a:Vector3,b:Vector3,r:number,tint:number,opacity=1)=>{
   const delta=b.clone().sub(a),mesh=this.mesh(new CylinderGeometry(r,r,Math.max(.01,delta.length()),6),tint,opacity);
   mesh.position.copy(a).lerp(b,.5);mesh.quaternion.setFromUnitVectors(new Vector3(0,1,0),delta.normalize());group.add(mesh);return mesh;
  };
  if(behavior==='railgun'||behavior==='blender') {
   const projectile=this.mesh(new SphereGeometry(behavior==='blender'?.19:.13,8,6),behavior==='blender'?0x272d30:COMBAT_GOLD);
   projectile.userData.projectile=true;projectile.userData.arc=behavior==='blender'?1.8:.2;group.add(projectile);
   const smoke=this.mesh(new SphereGeometry(.15,6,4),0x938674,.5);smoke.userData.exhaust=true;group.add(smoke);
   const splash=stats!.blast*scale;
   for(let i=0;i<8;i++){
    const puff=this.mesh(new SphereGeometry(.25,7,5),i%2?color:0xffebaf,.9);
    puff.userData.blast=i; puff.userData.blastRadius=splash;group.add(puff);
   }
   const shock=this.mesh(new RingGeometry(.85,.97,32),color,.85);shock.rotation.x=-Math.PI/2;shock.userData.shock=splash;group.add(shock);
  } else if(behavior==='vortex') {
   const delta=to.clone().sub(from),distance=delta.length(),direction=delta.normalize();
   const side=new Vector3(-direction.z,0,direction.x);
   for(let i=0;i<12;i++){
    const flame=this.mesh(new SphereGeometry(.09+(i/12)*.15,6,4),i%3?color:0xffedaa,.8);
    flame.userData.flame=i/12;flame.userData.direction=direction;flame.userData.side=side;flame.userData.reach=distance;group.add(flame);
   }
  } else if(behavior==='sprinkler') {
   const reach=radius??stats!.range;
   for(let i=0;i<16;i++){
    const mist=this.mesh(new SphereGeometry(.1,5,4),i%3?color:0xe4edbe,.6);
    mist.userData.mist=i/16;mist.userData.reach=reach;group.add(mist);
   }
  } else if(behavior==='guillotine') {
   const reach=radius??stats!.range;
   const arc=this.mesh(new RingGeometry(reach*.85,reach*.94,40,1,0,Math.PI*1.6),color,.8);
   arc.rotation.x=-Math.PI/2;arc.position.copy(from);arc.userData.spin=true;group.add(arc);
   beam(from,to,.035*strength,color,.6);
  } else if(behavior==='laser') {beam(from,to,.14*strength,color,.3);beam(from,to,.04*strength,0xfffae1);}
  else {const bullet=this.mesh(new SphereGeometry(.1*strength,7,5),color);bullet.userData.projectile=true;group.add(bullet);beam(from,to,.03*strength,color,.4);}
  const flash=this.mesh(new SphereGeometry(.15*strength,6,4),COMBAT_GOLD);flash.position.copy(from);flash.userData.flash=true;group.add(flash);
  const spark=this.mesh(new RingGeometry(.13,.22,20),color);spark.position.copy(to);spark.rotation.x=-Math.PI/2;spark.userData.impact=true;group.add(spark);
  this.group.add(group);this.effects.push({group,age:0,duration,travel,kind,from:from.clone(),to:to.clone()});
  while(this.effects.length>32)this.release(this.effects.shift()!.group);
 }
 burst(point:Vector3,color:number,style:'juice'|'sparks'|'pulse'='juice',scale=1):void {
  const group=new Group();
  if(style==='pulse'){const ring=this.mesh(new RingGeometry(.7,.85,24),color);ring.position.copy(point);ring.rotation.x=-Math.PI/2;ring.userData.impact=true;group.add(ring);}
  for(let i=0;i<(style==='pulse'?4:9);i++){const drop=this.mesh(new SphereGeometry((style==='sparks'?.04:.07)+(i%3)*.035,5,4),i%3?color:0xffe394);drop.position.copy(point);drop.userData.velocity=new Vector3(Math.cos(i*2.4)*(1+i%3)*scale,1.4*scale,Math.sin(i*2.4)*(1+i%3)*scale);group.add(drop);}
  this.group.add(group);this.effects.push({group,age:0,duration:.55,travel:0,kind:'burst',from:point.clone(),to:point.clone()});
  while(this.effects.length>32)this.release(this.effects.shift()!.group);
 }
 update(dt:number):void {
  for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i]!;e.age+=dt;const t=e.age/e.duration;
   if(t>=1){this.release(e.group);this.effects.splice(i,1);continue;}
   const flight=e.travel?Math.min(1,e.age/e.travel):Math.min(1,t*2),blast=e.travel?Math.max(0,(e.age-e.travel)/.4):t;
   for(const child of e.group.children){const m=child as Mesh,mat=m.material as MeshBasicMaterial;
    mat.opacity=(m.userData.opacity??1)*(1-t);
    if(m.userData.projectile||m.userData.exhaust){
     const p=m.userData.exhaust?Math.max(0,flight-.12):flight;
     m.position.copy(e.from).lerp(e.to,p);m.position.y+=Math.sin(p*Math.PI)*(m.userData.arc??.2);m.visible=!e.travel||e.age<e.travel;
     if(m.userData.exhaust)m.scale.setScalar(1+flight*2);
    }
    if(m.userData.blast!==undefined){
     const angle=m.userData.blast*Math.PI/4,distance=m.userData.blastRadius*blast;
     m.visible=e.age>=e.travel;m.position.copy(e.to).add(new Vector3(Math.cos(angle)*distance,Math.sin(blast*Math.PI)*.5,Math.sin(angle)*distance));m.scale.setScalar(.6+blast*1.8);mat.opacity=(1-blast)*.85;
    }
    if(m.userData.shock){m.visible=e.age>=e.travel;m.position.copy(e.to);m.position.y=.14;m.scale.setScalar(.1+blast*m.userData.shock);mat.opacity=(1-blast)*.7;}
    if(m.userData.flame!==undefined){const p=(t*1.2+m.userData.flame)%1;m.position.copy(e.from).addScaledVector(m.userData.direction,p*m.userData.reach).addScaledVector(m.userData.side,Math.sin(m.userData.flame*37)*p*m.userData.reach*.55);m.scale.setScalar(.4+p*1.2);mat.opacity=(1-p)*.85;}
    if(m.userData.mist!==undefined){const p=(t+m.userData.mist*.35)%1,angle=m.userData.mist*Math.PI*2+t*.5;m.position.copy(e.from).add(new Vector3(Math.cos(angle)*p*m.userData.reach,.15+Math.sin(p*Math.PI)*.3,Math.sin(angle)*p*m.userData.reach));mat.opacity=(1-p)*.5;}
    if(m.userData.velocity){m.position.addScaledVector(m.userData.velocity,dt);m.userData.velocity.y-=6*dt;}
    if(m.userData.spin)m.rotation.z+=dt*18;
    if(m.userData.flash){m.visible=t<.2;m.scale.setScalar(1+t*2);}
    if(m.userData.impact){m.visible=e.travel?e.age>=e.travel:t>.2;m.scale.setScalar(.4+blast*2);}
   }
  }
 }
 private release(group:Group):void {group.removeFromParent();group.traverse(node=>{if(node instanceof Mesh){node.geometry.dispose();(node.material as MeshBasicMaterial).dispose();}});}
 clear():void {for(const effect of this.effects)this.release(effect.group);this.effects=[];}
}
