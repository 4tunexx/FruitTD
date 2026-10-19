import { AdditiveBlending, CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Shape, ShapeGeometry } from 'three';
import { COMBAT_GOLD } from './combatTokens';

/** Layered moving parts keep portrait art alive without changing combat positions. */
export class DefenderMotion {
  readonly group=new Group();
  private age=0;
  private kick=0;
  private readonly barrels:Mesh[]=[];
  private readonly flashes:Mesh[]=[];
  private readonly arc:Mesh;
  private baseScale=1;
  private style='jiju';
  private readonly extraWeapons:Mesh[]=[];
  private lastScale=NaN;

  constructor(private portrait:Mesh,private kind:'hero'|'tower',color=COMBAT_GOLD) {
    this.group.name=`${kind}-mechanism`;this.group.position.z=.09;portrait.add(this.group);
    const part=(w:number,h:number,x:number,y:number)=>{
      const rim=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({color:COMBAT_GOLD,side:DoubleSide}));
      rim.position.set(x,y,.015);
      const face=new Mesh(new PlaneGeometry(w*.8,h*.85),new MeshBasicMaterial({color:0x25292e,side:DoubleSide}));
      face.position.z=.008;rim.add(face);this.group.add(rim);return rim;
    };
    if(kind==='tower') {
      const keep=new Shape();keep.moveTo(-1.2,-.95);keep.lineTo(-1.2,.45);keep.lineTo(-.82,.45);keep.lineTo(-.82,.12);keep.lineTo(-.42,.12);keep.lineTo(-.42,.45);keep.lineTo(.42,.45);keep.lineTo(.42,.12);keep.lineTo(.82,.12);keep.lineTo(.82,.45);keep.lineTo(1.2,.45);keep.lineTo(1.2,-.95);keep.closePath();
      const rim=new Mesh(new ShapeGeometry(keep),new MeshBasicMaterial({color:COMBAT_GOLD,side:DoubleSide}));rim.position.z=-.13;
      const face=new Mesh(rim.geometry.clone(),new MeshBasicMaterial({color:0x24282c,side:DoubleSide}));face.scale.set(.93,.91,1);face.position.z=.015;rim.add(face);this.group.add(rim);

      part(1.6,.24,0,-.9);
      for(const x of [-.72,.72]) {
        const barrel=part(.24,.78,x,.28);this.barrels.push(barrel);
        const flash=new Mesh(new CircleGeometry(.21,6),new MeshBasicMaterial({color:0xffedb4,side:DoubleSide,
          transparent:true,blending:AdditiveBlending,depthWrite:false}));
        flash.position.set(x,.79,.08);flash.visible=false;this.group.add(flash);this.flashes.push(flash);
      }
    } else {
      // A carried blade and animated slash make manual attacks visible on the hero.
      const blade=part(.11,.78,.91,-.05);blade.rotation.z=-.42;this.barrels.push(blade);
      for(const x of [.76,1.07]){const extra=part(.08,.65,x,-.05);extra.visible=false;this.extraWeapons.push(extra);}

    }
    this.arc=new Mesh(new RingGeometry(1.04,1.13,32,1,0,Math.PI*1.1),new MeshBasicMaterial({color,
      transparent:true,opacity:.55,side:DoubleSide,depthWrite:false}));
    this.arc.position.z=.03;this.group.add(this.arc);
  }

  setHero(id:string,color:number):void {
    this.style=id;(this.arc.material as MeshBasicMaterial).color.setHex(color);
    const blade=this.barrels[0];
    if(this.kind==='hero'&&blade){blade.scale.set(id==='topfu'?2.4:1,id==='lagen'?1.6:id==='topfu'?.65:1,1);blade.visible=id!=='ki';}
    for(const extra of this.extraWeapons)extra.visible=id==='tripos';
  }

  fire():void { this.kick=1; }

  update(dt:number):void {
    this.age+=dt;this.kick=Math.max(0,this.kick-dt*4.5);
    if(this.portrait.scale.x!==this.lastScale)this.baseScale=this.portrait.scale.x;
    const breathing=this.kind==='hero'?Math.sin(this.age*2.7)*.018:Math.sin(this.age*2)*.006;
    this.lastScale=this.baseScale*(1+breathing+this.kick*.045);
    this.portrait.scale.setScalar(this.lastScale);
    this.portrait.userData.combatRoll=this.kind==='hero'?Math.sin(this.age*1.7)*.018+Math.sin(this.kick*Math.PI)*.12:0;
    this.arc.rotation.z=this.age*(this.kind==='hero'?.3:-.18)+this.kick*1.8;
    (this.arc.material as MeshBasicMaterial).opacity=.3+this.kick*.65;
    for(const barrel of this.barrels) {
      if(this.kind==='tower')barrel.position.y=.28-this.kick*.18;
      else barrel.rotation.z=-.42+Math.sin(this.kick*Math.PI)*(this.style==='lagen'?.55:this.style==='topfu'?.8:1.25)+Math.sin(this.age*2)*.04;
    }
    for(const extra of this.extraWeapons)extra.rotation.z=-.42+Math.sin(this.kick*Math.PI)*1.25;
    for(const flash of this.flashes){flash.visible=this.kick>.55;flash.scale.setScalar(.7+this.kick*.6);}
  }
}
