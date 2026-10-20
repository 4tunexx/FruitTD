import {Group,MeshBasicMaterial,PointsMaterial,Vector3} from 'three';
import {BladeTrail} from './trail';
export interface TeamStroke {userId:string;stroke:{from:{x:number;y:number};to:{x:number;y:number};at:number}}
/** One bounded trail per remote teammate; a later snapshot never erases another teammate's slash. */
export class TeamBladeTrails {
  readonly group=new Group();
  private trails=new Map<string,{trail:BladeTrail;at:number}>();
  sync(strokes:TeamStroke[],point:(x:number,y:number)=>Vector3):void {
    const active=strokes.slice(0,3),ids=new Set(active.map(entry=>entry.userId));
    for(const [id,entry] of this.trails)if(!ids.has(id)){this.release(entry.trail);this.trails.delete(id);}
    for(const entry of active){
      if(!Number.isFinite(entry.stroke.at))continue;
      let current=this.trails.get(entry.userId);
      if(!current){const trail=new BladeTrail();trail.setColor([0x7dd3fc,0xf472b6,0xa3e635][this.trails.size]!);current={trail,at:0};this.trails.set(entry.userId,current);this.group.add(trail.line,trail.glowLine,trail.sparks);}
      if(entry.stroke.at<=current.at)continue;
      current.at=entry.stroke.at;current.trail.sync([point(entry.stroke.from.x,entry.stroke.from.y),point(entry.stroke.to.x,entry.stroke.to.y)]);
    }
  }
  update(dt:number,now=Date.now()):void {
    for(const {trail,at} of this.trails.values()){if(now-at>300)trail.reset();trail.update(dt);}
  }
  private release(trail:BladeTrail):void {
    for(const mesh of [trail.line,trail.glowLine]){mesh.removeFromParent();mesh.geometry.dispose();(mesh.material as MeshBasicMaterial).dispose();}
    trail.sparks.removeFromParent();trail.sparks.geometry.dispose();(trail.sparks.material as PointsMaterial).dispose();
  }
  dispose():void {for(const {trail} of this.trails.values())this.release(trail);this.trails.clear();}
}
