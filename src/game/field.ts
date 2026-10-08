
import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshLambertMaterial, PlaneGeometry } from 'three';
import type { AdminConfig } from '../services/admin';
import { ARENA_D, ARENA_W } from './world';

type Appearance = AdminConfig['landscapeConfig'];
const DEFAULT: Appearance = {
 locationName:'Fallen Orchard', skyColor:'#4a5f3e', outerGroundColor:'#5a8a42', groundColor:'#6fa052',
 groundGlowColor:'#2a3a1f', foliageColor:'#3d8b3a', ambientLight:.92, sunLight:.85, foliageEnabled:true,
};
function color(value: unknown, fallback: string): string { return typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback; }
export class Field {
 readonly group=new Group();
 private readonly outer=new MeshLambertMaterial({color:DEFAULT.outerGroundColor,emissive:0x1a2a15,emissiveIntensity:.15});
 private readonly inner=new MeshLambertMaterial({color:DEFAULT.groundColor,emissive:DEFAULT.groundGlowColor,emissiveIntensity:.12});
 private readonly patches=new MeshLambertMaterial({color:0x578836,emissive:0x1f3018,emissiveIntensity:.1});
 private readonly leaves=new MeshLambertMaterial({color:DEFAULT.foliageColor});
 private readonly foliage=new Group();
 constructor(){
  const ground=new Mesh(new PlaneGeometry(ARENA_W+8,ARENA_D+8),this.outer); ground.rotation.x=-Math.PI/2; this.group.add(ground);
  const inner=new Mesh(new PlaneGeometry(ARENA_W+1.2,ARENA_D+1.2),this.inner); inner.rotation.x=-Math.PI/2; inner.position.y=.01; this.group.add(inner);
  for(const [x,z,s] of [[-6.5,3.2,3.4],[5.8,6.1,2.8],[-3.2,9.4,3.8],[7.2,-1.2,2.6]] as const){
   const patch=new Mesh(new PlaneGeometry(s,s*.7),this.patches); patch.rotation.x=-Math.PI/2; patch.position.set(x,.02,z); this.group.add(patch);
  }
  const trunks=new MeshLambertMaterial({color:0x6b4423});
  for(const [x,z] of [[-12.2,-8],[12.1,-7.4],[-11.6,4],[11.8,6.2],[-10.4,12.4],[10.8,11.6],[-8.2,14.2],[7.6,14.6]] as const){
   const trunk=new Mesh(new CylinderGeometry(.16,.22,1.1,7),trunks); trunk.position.set(x,.55,z);
   const leaf=new Mesh(new ConeGeometry(.85,1.6,8),this.leaves); leaf.position.set(x,1.7,z); this.foliage.add(trunk,leaf);
  }
  this.group.add(this.foliage);
  window.addEventListener('fruit-td-landscape-update',e=>this.applyLandscape((e as CustomEvent<Partial<Appearance>>).detail));
 }
 applyLandscape(config: Partial<Appearance>|null|undefined):void {
  const v={...DEFAULT,...(config||{})};
  this.outer.color.set(color(v.outerGroundColor,DEFAULT.outerGroundColor));
  this.inner.color.set(color(v.groundColor,DEFAULT.groundColor));
  this.inner.emissive.set(color(v.groundGlowColor,DEFAULT.groundGlowColor));
  this.leaves.color.set(color(v.foliageColor,DEFAULT.foliageColor));
  this.foliage.visible=v.foliageEnabled!==false;
 }
}
