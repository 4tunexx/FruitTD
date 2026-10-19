import { CircleGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, SphereGeometry, Vector3 } from 'three';
import type { TurretKind } from './turrets';
import { COMBAT_GOLD } from './combatTokens';

export const TURRET_COLORS:Record<TurretKind|'main',number>={main:0xffd56a,guillotine:0xff983c,vortex:0x7ce4cc,laser:0xffef7a,railgun:0xeaa2ee,sprinkler:0x9de7ff,blender:0xffd797};
type Effect={group:Group;age:number;duration:number;kind:string;from:Vector3;to:Vector3};
/** Thick geometry stays visible on mobile; presentation never applies damage. */
export class TurretEffects {
  readonly group=new Group();
  private effects:Effect[]=[];
  private mesh(geometry:SphereGeometry|RingGeometry|CylinderGeometry|CircleGeometry,color:number,opacity=1):Mesh {
    const m=new Mesh(geometry,new MeshBasicMaterial({color,transparent:true,opacity,side:DoubleSide,depthWrite:false,depthTest:false,toneMapped:false}));
    m.renderOrder=35;return m;
  }
  shot(kind:TurretKind|'main',from:Vector3,to:Vector3,level=1,color=TURRET_COLORS[kind],scale=1):void {
    const group=new Group(),strength=(1+Math.min(9,level-1)*.08)*scale;
    const beam=(a:Vector3,b:Vector3,r:number,tint:number,opacity=1)=>{
      const d=b.clone().sub(a),m=this.mesh(new CylinderGeometry(r,r,d.length(),6),tint,opacity);
      m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new Vector3(0,1,0),d.normalize());group.add(m);return m;
    };
    const duration=kind==='railgun'?.42:kind==='laser'?.23:kind==='vortex'?.5:.32;
    if(kind==='guillotine'||kind==='blender') {
      const ring=this.mesh(new RingGeometry(kind==='guillotine'?.75:.24,kind==='guillotine'?.95:.5,32,1,0,Math.PI*1.7),color);
      ring.rotation.x=-Math.PI/2;ring.position.copy(kind==='guillotine'?from:to);ring.position.y=.9;ring.userData.spin=true;group.add(ring);
      for(let i=0;i<6;i++){const spark=this.mesh(new SphereGeometry(.08*strength,5,3),i%2?color:COMBAT_GOLD);spark.position.copy(to);spark.userData.velocity=new Vector3(Math.cos(i)*2.5,1.5,Math.sin(i)*2.5);group.add(spark);}
    } else if(kind==='laser') {
      beam(from,to,.14*strength,color,.35);beam(from,to,.045*strength,0xfffae1);
    } else if(kind==='vortex') {
      for(let i=0;i<7;i++){const mote=this.mesh(new SphereGeometry(.09*strength,5,4),color);mote.userData.mote=i/7;group.add(mote);}
    } else {
      const orb=this.mesh(new SphereGeometry((kind==='railgun'?.19:kind==='sprinkler'?.12:.11)*strength,8,6),color);orb.userData.projectile=true;group.add(orb);
      const tail=beam(from,to,(kind==='railgun'?.075:.045)*strength,color,.55);tail.userData.trail=true;
      if(kind==='sprinkler')for(let i=0;i<3;i++){const ice=this.mesh(new CircleGeometry(.11*strength,4),color,.8);ice.rotation.x=-Math.PI/2;ice.userData.projectile=true;ice.userData.offset=(i-1)*.2;group.add(ice);}
    }
    const flash=this.mesh(new SphereGeometry(.2*strength,6,4),COMBAT_GOLD);flash.position.copy(from);flash.userData.flash=true;group.add(flash);
    const impact=this.mesh(new RingGeometry(.2,.33,20),color);impact.position.copy(to);impact.rotation.x=-Math.PI/2;impact.userData.impact=true;group.add(impact);
    this.group.add(group);this.effects.push({group,age:0,duration,kind,from:from.clone(),to:to.clone()});
    while(this.effects.length>32)this.release(this.effects.shift()!.group);
  }
  burst(point:Vector3,color:number):void {
    this.shot('blender',point,point,2,color);
  }
  update(dt:number):void {
    for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i]!;e.age+=dt;const t=e.age/e.duration;
      if(t>=1){this.release(e.group);this.effects.splice(i,1);continue;}
      for(const child of e.group.children){const m=child as Mesh;const mat=m.material as MeshBasicMaterial;
        mat.opacity=Math.max(0,(m.userData.trail?.5:1)*(1-t));
        if(m.userData.projectile){m.position.copy(e.from).lerp(e.to,Math.min(1,t*1.5));m.position.x+=m.userData.offset||0;}
        if(m.userData.mote!==undefined){const p=(t+m.userData.mote)%1;m.position.copy(e.to).lerp(e.from,p);m.position.x+=Math.cos(p*18)*.2;m.position.y+=Math.sin(p*18)*.2;}
        if(m.userData.velocity)m.position.addScaledVector(m.userData.velocity,dt);
        if(m.userData.spin){m.rotation.z+=dt*18;m.scale.setScalar(1+t*.5);}
        if(m.userData.flash){m.visible=t<.28;m.scale.setScalar(1+t*2);}
        if(m.userData.impact){m.scale.setScalar(.5+t*3);mat.opacity=t<.3?0:1-t;}
      }
    }
  }
  private release(group:Group):void {group.removeFromParent();group.traverse(n=>{if(n instanceof Mesh){n.geometry.dispose();(n.material as MeshBasicMaterial).dispose();}});}
  clear():void {for(const e of this.effects)this.release(e.group);this.effects=[];}
}
