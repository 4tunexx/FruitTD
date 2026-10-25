import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';

/** Shared ground rail: dark inset, delayed damage, one continuous fill, team-colored frame. */
export function towerHealthRail(width:number,stroke=0xffe394) {
  const group=new Group();group.name='tower-health-rail';
  const plane=(w:number,h:number,color:number,order:number)=>{
    const mesh=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({color,depthWrite:false,depthTest:false}));
    mesh.rotation.x=-Math.PI/2;mesh.position.y=.12+(order-90)*.01;mesh.renderOrder=order;group.add(mesh);return mesh;
  };
  plane(width+.2,.54,stroke,90);plane(width,.35,0x17231e,91);
  const damage=plane(width,.35,0xfcd581,92),fill=plane(width,.35,0x9be458,93);
  let value=1,trail=1,delay=0;
  const scale=(mesh:Mesh,ratio:number)=>{mesh.scale.x=Math.max(.001,ratio);mesh.position.x=-width/2*(1-ratio);};
  return {group,fill,set(ratio:number){
    const next=Math.max(0,Math.min(1,ratio));if(next<value){trail=Math.max(trail,value);delay=.25;}else if(next>value){trail=next;}
    value=next;scale(fill,next);scale(damage,trail);
    (fill.material as MeshBasicMaterial).color.setHex(next<=.3?0xf04c42:next<=.6?0xf59e0b:0x9be458);
  },update(dt:number){delay=Math.max(0,delay-dt);if(!delay){trail=Math.max(value,trail-dt*.7);scale(damage,trail);}}};
}
