import { BufferGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, RingGeometry, Scene, Vector3 } from 'three';
import { heroDef } from './heroes';
import type { HeroAbility } from './heroAbilities';

/** Ephemeral cast art shared by local combat, Arena and Co-op. */
export class PowerVfx {
  private casts:Array<{group:Group;age:number;duration:number;effect:string}>=[];
  constructor(private scene:Scene){}
  spawn(ability:HeroAbility,rank:number,origin:Vector3,targets:Vector3[],age=0):void {
    const variant=Number(ability.id.split('-')[1])||1;
    const duration=(ability.effect==='guard'?2.1:ability.effect==='frost'?1.8:1.1)+variant*.04;
    if(age>=duration)return;
    const group=new Group(); const color=ability.effect==='frost'?0x8deaff:heroDef(ability.hero).color;
    const ring=(point:Vector3,size:number)=>{const mesh=new Mesh(new RingGeometry(size*.88,size,40),new MeshBasicMaterial({color,transparent:true,opacity:.85,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.copy(point);mesh.position.y=.15;mesh.userData.ring=true;group.add(mesh);};
    for(let i=1;i<variant;i++){const p=origin.clone();p.x+=Math.cos(i*Math.PI*2/variant)*1.5;p.z+=Math.sin(i*Math.PI*2/variant)*1.5;ring(p,.3+rank*.06);}
    ring(origin,(1+(rank-1)*.08)*(ability.effect==='guard'?3:1.5));
    const points=targets.slice(0,64);
    for(const [index,target] of points.entries()) {
      ring(target,ability.effect==='burst'?1.7:.65);
      const path=[origin.clone(),target.clone()];
      if(ability.effect==='shock'){
        path.splice(1,0,...Array.from({length:5},(_,i)=>{const p=origin.clone().lerp(target,(i+1)/6);p.x+=Math.sin(index*3+i*7)*.7;p.y=.7+Math.cos(i)*.15;return p;}));
      }
      if(ability.effect==='pierce'||ability.effect==='shock'||ability.hero==='tripos') {
        const beam=new Line(new BufferGeometry().setFromPoints(path),new LineBasicMaterial({color,transparent:true,opacity:1,depthWrite:false}));group.add(beam);
      }
      if(ability.effect==='frost')for(let i=0;i<3;i++) {
        const a=target.clone(),b=target.clone(),angle=i*Math.PI/3;a.x-=Math.cos(angle);a.z-=Math.sin(angle);b.x+=Math.cos(angle);b.z+=Math.sin(angle);a.y=b.y=.3;
        group.add(new Line(new BufferGeometry().setFromPoints([a,b]),new LineBasicMaterial({color,transparent:true,opacity:1})));
      }
    }
    this.scene.add(group);this.casts.push({group,age,duration,effect:ability.effect});
    if(this.casts.length>24)this.release(this.casts.shift()!.group);
  }
  update(dt:number):void {
    for(let i=this.casts.length-1;i>=0;i--){const cast=this.casts[i]!;cast.age+=dt;const t=cast.age/cast.duration;
      if(t>=1){this.release(cast.group);this.casts.splice(i,1);continue;}
      cast.group.children.forEach((object,index)=>{
        if(object instanceof Mesh||object instanceof Line){const material=object.material as MeshBasicMaterial;material.opacity=Math.max(0,(1-t)*(cast.effect==='guard'?.7+.3*Math.sin(cast.age*12):1));}
        if(object.userData.ring)object.scale.setScalar(.5+t*(cast.effect==='burst'?3:1.6)+Math.sin(cast.age*8+index)*.05);
      });
    }
  }
  private release(group:Group):void{group.removeFromParent();group.traverse(object=>{if(object instanceof Mesh||object instanceof Line){object.geometry.dispose();(object.material as MeshBasicMaterial).dispose();}});}
  clear():void{this.casts.forEach(cast=>this.release(cast.group));this.casts=[];}
}
