import { AdditiveBlending, CircleGeometry, DoubleSide, PlaneGeometry, CatmullRomCurve3, TubeGeometry, BufferGeometry, Group, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, RingGeometry, Scene, Vector3 } from 'three';
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
    const group=new Group(); group.name=`power-${ability.id}`; const color=ability.effect==='frost'?0x8deaff:heroDef(ability.hero).color;
    const ring=(point:Vector3,size:number)=>{const mesh=new Mesh(new RingGeometry(size*.88,size,40),new MeshBasicMaterial({color,transparent:true,opacity:.85,side:DoubleSide,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.copy(point);mesh.position.y=.15;mesh.userData.ring=true;group.add(mesh);};
    for(let i=1;i<variant;i++){const p=origin.clone();p.x+=Math.cos(i*Math.PI*2/variant)*1.5;p.z+=Math.sin(i*Math.PI*2/variant)*1.5;ring(p,.3+rank*.06);}
    ring(origin,(1+(rank-1)*.08)*(ability.effect==='guard'?3:1.5));
    // Cap visual targets independently of combat damage to keep busy mobile casts readable.
    const points=targets.slice(0,12);
    // Each hero has a readable signature, independent of the shared damage type:
    // blade crescents, ice crystals, lance chevrons, triple ribbons, solar rays.
    const signature=(point:Vector3)=>{
      const count=ability.hero==='tripos'?3:ability.hero==='ki'?8:ability.hero==='topfu'?6:2+variant;
      for(let i=0;i<count;i++) {
        const angle=i*Math.PI*2/count;
        const geometry=ability.hero==='jiju'?new RingGeometry(.55,.72,16,1,0,Math.PI*.8)
          :ability.hero==='topfu'?new CircleGeometry(.23,4)
          :new PlaneGeometry(ability.hero==='lagen'?.12:.09,ability.hero==='tripos'?1.8:.65);
        const mesh=new Mesh(geometry,new MeshBasicMaterial({color,transparent:true,opacity:.9,side:DoubleSide,depthWrite:false}));
        mesh.name=`${ability.hero}-signature`;mesh.position.copy(point);mesh.position.y=.3;
        const radius=ability.hero==='tripos'?.25*(i-1):.5;
        mesh.position.x+=Math.cos(angle)*radius;mesh.position.z+=Math.sin(angle)*radius;
        mesh.rotation.set(-Math.PI/2,0,angle);mesh.userData.spin=ability.hero==='jiju'?2:ability.hero==='tripos'?-1:0;
        mesh.userData.rise=ability.hero==='topfu'?.7:.12;group.add(mesh);
        if(ability.hero==='lagen') {
          const head=new Mesh(new CircleGeometry(.23,3),new MeshBasicMaterial({color:0xffedbd,side:DoubleSide,transparent:true,depthWrite:false}));
          head.position.copy(mesh.position);head.rotation.copy(mesh.rotation);head.userData.rise=.3;group.add(head);
        }
      }
    };
    signature(origin);
    // Every cast has the same orange design boundary; hero colors remain inside.
    const boundary=new Mesh(new RingGeometry(1.65,1.72,48),new MeshBasicMaterial({color:0xf48120,transparent:true,opacity:.8,side:DoubleSide,depthWrite:false}));
    boundary.rotation.x=-Math.PI/2;boundary.position.copy(origin);boundary.position.y=.12;boundary.userData.ring=true;group.add(boundary);
    for(const [index,target] of points.entries()) {
      if(index<4)signature(target);
      ring(target,ability.effect==='burst'?1.7:.65);
      const path=[origin.clone(),target.clone()];
      if(ability.effect==='shock'){
        path.splice(1,0,...Array.from({length:5},(_,i)=>{const p=origin.clone().lerp(target,(i+1)/6);p.x+=Math.sin(index*3+i*7)*.7;p.y=.7+Math.cos(i)*.15;return p;}));
      }
      if(ability.effect==='pierce'||ability.effect==='shock'||ability.hero==='tripos') {
        // WebGL line widths are usually one pixel. Actual tubes preserve a clear
        // bright core and colored halo on phone screens as well as desktop.
        const curve = new CatmullRomCurve3(path);
        for (const layer of [{ radius: .17, tint: color, opacity: .3 }, { radius: .055, tint: 0xfff9d8, opacity: .95 }]) {
          const beam = new Mesh(new TubeGeometry(curve, Math.max(6, path.length * 3), layer.radius, 4, false),
            new MeshBasicMaterial({ color: layer.tint, transparent: true, opacity: layer.opacity,
              blending: AdditiveBlending, depthWrite: false }));
          beam.userData.baseOpacity = layer.opacity;
          group.add(beam);
        }
      }
      if(ability.effect==='frost')for(let i=0;i<3;i++) {
        const a=target.clone(),b=target.clone(),angle=i*Math.PI/3;a.x-=Math.cos(angle);a.z-=Math.sin(angle);b.x+=Math.cos(angle);b.z+=Math.sin(angle);a.y=b.y=.3;
        group.add(new Line(new BufferGeometry().setFromPoints([a,b]),new LineBasicMaterial({color,transparent:true,opacity:1})));
      }
    }
    this.scene.add(group);this.casts.push({group,age,duration,effect:ability.effect});
    if(this.casts.length>8)this.release(this.casts.shift()!.group);
  }
  update(dt:number):void {
    for(let i=this.casts.length-1;i>=0;i--){const cast=this.casts[i]!;cast.age+=dt;const t=cast.age/cast.duration;
      if(t>=1){this.release(cast.group);this.casts.splice(i,1);continue;}
      cast.group.children.forEach((object,index)=>{
        if(object.userData.spin)object.rotation.z+=dt*object.userData.spin;
        if(object.userData.rise)object.position.y+=dt*object.userData.rise;
        if(object instanceof Mesh||object instanceof Line){const material=object.material as MeshBasicMaterial;material.opacity=Math.max(0,(object.userData.baseOpacity ?? 1)*(1-t)*(cast.effect==='guard'?.7+.3*Math.sin(cast.age*12):1));}
        if(object.userData.ring)object.scale.setScalar(.5+t*(cast.effect==='burst'?3:1.6)+Math.sin(cast.age*8+index)*.05);
      });
    }
  }
  private release(group:Group):void{group.removeFromParent();group.traverse(object=>{if(object instanceof Mesh||object instanceof Line){object.geometry.dispose();(object.material as MeshBasicMaterial).dispose();}});}
  clear():void{this.casts.forEach(cast=>this.release(cast.group));this.casts=[];}
}
