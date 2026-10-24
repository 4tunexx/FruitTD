import { AdditiveBlending, NormalBlending, CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Object3D, RingGeometry, SphereGeometry } from 'three';
import type { Affliction, CombatStatus } from './combatStatus';

const colors:Record<Affliction,number>={burn:0xff661c,frost:0x8deaff,shock:0x74bdff,snare:0x76d65e,haze:0xcd78ee,cut:0xd6f5ff,pierce:0xffefa6,solar:0xffd44f,crush:0xe3c6ff};
/** Small, reusable enemy attachments. Status deadlines come from the simulation. */
export class StatusVfx {
  readonly group=new Group();
  private entries=new Map<string,{group:Group;target:Object3D;kind:Affliction;until:number;phase:number}>();
  sync(id:string,target:Object3D,status:CombatStatus,now:number):void {
    const burning=(status.burnUntil??0)>now;
    const kind=burning?'burn':status.statusKind;
    const until=burning?status.burnUntil:status.statusUntil;
    if(!kind||!until||until<=now){this.remove(id);return;}
    let entry=this.entries.get(id);
    if(entry&&entry.kind!==kind){this.remove(id);entry=undefined;}
    if(!entry){
      if(this.entries.size>=64)this.remove(this.entries.keys().next().value!);
      const group=new Group();group.name=`enemy-${kind}`;
      const count=kind==='burn'?7:kind==='frost'?6:kind==='snare'?3:5;
      for(let i=0;i<count;i++){
        const geometry=kind==='snare'?new RingGeometry(.58,.64,24,1,0,Math.PI*1.6):kind==='frost'?new CircleGeometry(.24,4):kind==='burn'?new SphereGeometry(.17,5,4):new CircleGeometry(.13,kind==='shock'?3:5);
        const material=new MeshBasicMaterial({color:i%3===0&&kind==='burn'?0xffe699:colors[kind],transparent:true,opacity:.8,side:DoubleSide,depthWrite:false,blending:kind==='burn'||kind==='shock'?AdditiveBlending:NormalBlending});
        const mesh=new Mesh(geometry,material);mesh.renderOrder=40;group.add(mesh);
      }
      this.group.add(group);entry={group,target,kind,until,phase:0};this.entries.set(id,entry);
    }
    entry.target=target;entry.until=until;
  }
  update(dt:number,now:number):void {
    for(const [id,e] of this.entries){
      if(now>=e.until||!e.target.parent||!e.target.visible){this.remove(id);continue;}
      e.phase+=dt;e.target.getWorldPosition(e.group.position);
      e.group.children.forEach((object,i)=>{
        const mesh=object as Mesh,material=mesh.material as MeshBasicMaterial;
        const phase=(e.phase*(e.kind==='burn'?1.9:.8)+i/e.group.children.length)%1,angle=i*2.399+e.phase;
        if(e.kind==='burn'){
          mesh.position.set(Math.cos(angle)*.42,phase*1.65-.25,Math.sin(angle)*.3);
          mesh.scale.set(.6+(1-phase)*.7,1.4+(1-phase),.65);material.opacity=(1-phase)*.95;
        }else if(e.kind==='frost'){
          mesh.position.set(Math.cos(angle)*.65,-.25+Math.sin(angle)*.5,Math.sin(angle)*.25);mesh.rotation.z=angle;mesh.scale.set(1,1.6,1);material.opacity=.6+Math.sin(e.phase*4+i)*.2;
        }else if(e.kind==='snare'){
          mesh.rotation.set(Math.PI/2+.25*Math.sin(e.phase+i),0,angle);mesh.position.y=-.2+i*.2;mesh.scale.setScalar(.9+.1*Math.sin(e.phase*4+i));
        }else{
          mesh.position.set(Math.cos(angle)*(e.kind==='haze'?.6:.8),Math.sin(angle)*.5,0);mesh.rotation.z=angle;mesh.scale.setScalar(.5+phase);material.opacity=(1-phase)*.85;
        }
      });
    }
  }
  private remove(id:string):void {const e=this.entries.get(id);if(!e)return;e.group.removeFromParent();e.group.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();(o.material as MeshBasicMaterial).dispose();}});this.entries.delete(id);}
  clear():void {for(const id of this.entries.keys())this.remove(id);}
}
