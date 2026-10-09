import { battleScenery, battleTexture } from './battleArt';

import { BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, SphereGeometry, TextureLoader, SRGBColorSpace } from 'three';
import type { AdminConfig } from '../services/admin';
import { mapPointToWorld, type BattleMap } from './battleMaps';
import { ARENA_D, ARENA_W } from './world';

type Appearance = AdminConfig['landscapeConfig'];
const DEFAULT: Appearance = {
 locationName:'Fallen Orchard', skyColor:'#4a5f3e', outerGroundColor:'#5a8a42', groundColor:'#6fa052',
 groundGlowColor:'#2a3a1f', foliageColor:'#3d8b3a', ambientLight:.92, sunLight:.85, foliageEnabled:true,
};
function color(value: unknown, fallback: string): string { return typeof value==='string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback; }
export class Field {
 readonly group=new Group();
 private readonly legacyGroup=new Group();
 private readonly mapMaterial=new MeshBasicMaterial({ color:0xffffff, toneMapped:false });
 private readonly mapSurface=new Mesh(new PlaneGeometry(ARENA_W,ARENA_D),this.mapMaterial);
 private readonly mapEntities=new Group();
 private mapRequest=0;
 private readonly outer=new MeshLambertMaterial({color:DEFAULT.outerGroundColor,emissive:0x1a2a15,emissiveIntensity:.15});
 private readonly inner=new MeshLambertMaterial({color:DEFAULT.groundColor,emissive:DEFAULT.groundGlowColor,emissiveIntensity:.12});
 private readonly patches=new MeshLambertMaterial({color:0x578836,emissive:0x1f3018,emissiveIntensity:.1});
 private readonly road=new MeshLambertMaterial({color:0x9c7548,emissive:0x352211,emissiveIntensity:.08});
 private readonly roadMark=new MeshLambertMaterial({color:0xe3c88c,emissive:0x6e4d26,emissiveIntensity:.1});
 private readonly leaves=new MeshLambertMaterial({color:DEFAULT.foliageColor});
 private readonly foliage=new Group();
 constructor(){
  this.inner.map=battleTexture('ground');this.road.map=battleTexture('stone');
  this.legacyGroup.add(battleScenery(ARENA_W,ARENA_D));
  this.mapSurface.rotation.x=-Math.PI/2;this.mapSurface.position.y=.018;this.mapSurface.visible=false;this.group.add(this.mapSurface,this.mapEntities);
  // Distant orchard silhouettes fill portrait headroom; gameplay stays unobscured.
  const horizonMaterial=new MeshLambertMaterial({color:0x263e36,flatShading:true});
  for(let i=0;i<9;i++){
   const hill=new Mesh(new ConeGeometry(6+(i%3),5+(i%4)*2,5),horizonMaterial);
   hill.position.set((i-4)*7,1,34+(i%3)*7);hill.rotation.y=i*.9;this.legacyGroup.add(hill);
  }
  const ground=new Mesh(new PlaneGeometry(ARENA_W+8,ARENA_D+8),this.outer); ground.rotation.x=-Math.PI/2; this.legacyGroup.add(ground);
  const inner=new Mesh(new PlaneGeometry(ARENA_W+1.2,ARENA_D+1.2),this.inner); inner.rotation.x=-Math.PI/2; inner.position.y=.01; this.legacyGroup.add(inner);
  // Broad orchard lane leads incoming waves from the far edge to the bottom keep.
  const laneLength=ARENA_D+1;
  const lane=new Mesh(new PlaneGeometry(7.2,laneLength),this.road); lane.rotation.x=-Math.PI/2; lane.position.set(0,.035,2.4); this.legacyGroup.add(lane);
  const verge=new MeshLambertMaterial({color:0x668b42});
  for(const x of [-3.72,3.72]){const edge=new Mesh(new PlaneGeometry(.24,laneLength),verge);edge.rotation.x=-Math.PI/2;edge.position.set(x,.05,2.4);this.legacyGroup.add(edge);}
  // Broken paving stones lead toward the keep without a road-divider stripe.
  for (let z=-8;z<17;z+=2.4) for (const x of [-1.7,1.7]) {
   const stone=new Mesh(new BoxGeometry(1.25,.06,.85),this.roadMark);stone.position.set(x,.065,z+(x>0?.55:0));stone.rotation.y=Math.sin(z)*.12;this.legacyGroup.add(stone);
  }
  const rim=new Mesh(new BoxGeometry(ARENA_W+1.3,.8,ARENA_D+1.3),new MeshLambertMaterial({color:0x384332}));rim.position.y=-.44;this.legacyGroup.add(rim);
  for(const [x,z,s] of [[-6.5,3.2,3.4],[5.8,6.1,2.8],[-3.2,9.4,3.8],[7.2,-1.2,2.6]] as const){
   const patch=new Mesh(new PlaneGeometry(s,s*.7),this.patches); patch.rotation.x=-Math.PI/2; patch.position.set(x,.02,z); this.legacyGroup.add(patch);
  }
  const trunks=new MeshLambertMaterial({color:0x6b4423});
  const orchardTrees: Array<readonly [number,number]> = [];
  for(const side of [-1,1]) for(const z of [-7,-2,3,8,13]) orchardTrees.push([side*(9.4+(z%2?0:.8)),z]);
  for(const [x,z] of orchardTrees){
   const trunk=new Mesh(new CylinderGeometry(.16,.22,1.1,7),trunks); trunk.position.set(x,.55,z);
   const crown=new Group(); crown.position.set(x,1.8,z); crown.scale.set(1.18,1.05,1.1);
   for(const [dx,dy,dz,r] of [[0,0,0,.78],[-.48,-.08,.1,.48],[.42,.02,-.12,.52],[.04,.28,.32,.47]] as const){const leaf=new Mesh(new SphereGeometry(r,10,8),this.leaves.clone());leaf.position.set(dx,dy,dz);crown.add(leaf);}
   const shadow=new Mesh(new CircleGeometry(1.15,12),new MeshBasicMaterial({color:0x112516,transparent:true,opacity:.24,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.set(x+.3,.04,z+.3);
   this.foliage.add(trunk,crown,shadow);
  }
  this.legacyGroup.add(this.foliage);this.group.add(this.legacyGroup);
  window.addEventListener('fruit-td-landscape-update',e=>this.applyLandscape((e as CustomEvent<Partial<Appearance>>).detail));
 }
 applyBattleMap(map: BattleMap):void {
  const request=++this.mapRequest;
  this.renderMapEntities(map,request);
  const loader=new TextureLoader();
  loader.load(map.background,(texture)=>{
   if(request!==this.mapRequest){texture.dispose();return;}
   texture.colorSpace=SRGBColorSpace;
   // Plane UVs are reversed along world Z after rotation; this keeps image top north.
   texture.flipY=false;
   this.mapMaterial.map?.dispose();this.mapMaterial.map=texture;this.mapMaterial.needsUpdate=true;
   this.mapSurface.geometry.dispose();this.mapSurface.geometry=new PlaneGeometry(map.world.width,map.world.depth);
   this.mapSurface.visible=true;this.legacyGroup.visible=false;
  },undefined,()=>{
   if(request===this.mapRequest){this.mapSurface.visible=false;this.legacyGroup.visible=true;}
  });
 }
 private renderMapEntities(map: BattleMap,request:number):void {
  for(const child of this.mapEntities.children){
   child.traverse((node)=>{
    const mesh=node as Mesh;
    mesh.geometry?.dispose?.();
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
    for(const material of materials){if(!material)continue;(material as MeshBasicMaterial).map?.dispose?.();material.dispose?.();}
   });
  }
  this.mapEntities.clear();
  for(const entity of map.entities){
   if(!entity.visible||entity.kind==='spawn'||entity.kind==='turret-slot')continue;
   const position=mapPointToWorld({x:entity.x,y:entity.y},map);
   const width=Math.max(.25,entity.width*map.world.width);
   const depth=Math.max(.25,entity.height*map.world.depth);
   if(entity.kind==='light'){
    const lamp=new Mesh(new SphereGeometry(.24,12,10),new MeshBasicMaterial({color:0xffc35a}));
    lamp.position.set(position.x,.28,position.z);this.mapEntities.add(lamp);continue;
   }
   const visual=new Group();visual.position.set(position.x,0,position.z);visual.rotation.y=entity.rotation*Math.PI/180;
   if((entity.kind==='solid'||entity.kind==='prop')&&!entity.asset){
    const height=entity.kind==='prop'?1.1:1.5;
    const block=new Mesh(new BoxGeometry(width,height,depth),new MeshLambertMaterial({color:entity.kind==='prop'?0x51463c:0x69645b,flatShading:true}));
    block.position.y=height/2;visual.add(block);
   }else if(entity.kind==='pit'||entity.kind==='hazard'){
    const color=entity.kind==='pit'?0x090a0c:0xff542c;
    const decal=new Mesh(new PlaneGeometry(width,depth),new MeshBasicMaterial({color,transparent:true,opacity:entity.kind==='pit'?.9:.46,side:DoubleSide,depthWrite:false}));
    decal.rotation.x=-Math.PI/2;decal.position.y=.04;visual.add(decal);
   }
   if(entity.asset){
    const spriteWidth=width;const spriteHeight=Math.max(.35,depth);
    const sprite=new Mesh(new PlaneGeometry(spriteWidth,spriteHeight),new MeshBasicMaterial({color:0xffffff,transparent:true,side:DoubleSide,depthWrite:false,toneMapped:false}));
    sprite.position.y=entity.kind==='pit'||entity.kind==='hazard'?.055:spriteHeight/2;
    if(entity.kind==='pit'||entity.kind==='hazard')sprite.rotation.x=-Math.PI/2;
    visual.add(sprite);
    new TextureLoader().load(entity.asset,(texture)=>{
     if(request!==this.mapRequest){texture.dispose();return;}
     texture.colorSpace=SRGBColorSpace;
     (sprite.material as MeshBasicMaterial).map=texture;(sprite.material as MeshBasicMaterial).needsUpdate=true;
    },undefined,()=>{sprite.visible=false;});
   }
   this.mapEntities.add(visual);
  }
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
