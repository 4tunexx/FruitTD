import { CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from 'three';

/** Short lived transparent splashes stay on the ground as the camera moves. */
export class JuiceStains {
  readonly group=new Group();
  private readonly stains:Array<{mesh:Mesh;life:number}>=[];
  splash(x:number,z:number,color=0x78e869,burst=1):void {
    if(this.stains.length>=48)this.remove(this.stains[0]!);
    const shape=new CircleGeometry(1,7+Math.floor(Math.random()*4));
    const material=new MeshBasicMaterial({color,transparent:true,opacity:.34,depthWrite:false,side:DoubleSide});
    const mesh=new Mesh(shape,material);mesh.rotation.x=-Math.PI/2;
    mesh.rotation.z=Math.random()*Math.PI*2;mesh.scale.set(.45*burst+Math.random()*.4,.32*burst+Math.random()*.4,1);
    mesh.position.set(x,.035+this.stains.length*.0002,z);
    this.group.add(mesh);this.stains.push({mesh,life:2});
  }
  update(dt:number):void {
    for(let i=this.stains.length-1;i>=0;i--){const stain=this.stains[i]!;stain.life-=dt;
      (stain.mesh.material as MeshBasicMaterial).opacity=.34*Math.max(0,Math.min(1,stain.life/.75));
      if(stain.life<=0)this.remove(stain);
    }
  }
  private remove(stain:{mesh:Mesh;life:number}):void {
    this.group.remove(stain.mesh);stain.mesh.geometry.dispose();(stain.mesh.material as MeshBasicMaterial).dispose();
    this.stains.splice(this.stains.indexOf(stain),1);
  }
}
