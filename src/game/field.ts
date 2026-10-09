import { BoxGeometry, CircleGeometry, DodecahedronGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, PlaneGeometry, SphereGeometry, TextureLoader, SRGBColorSpace } from 'three';
import type { AdminConfig } from '../services/admin';
import { mapPointToWorld, type BattleMap } from './battleMaps';
import { SOLO_ARENA_D, ARENA_W } from './world';

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
 private readonly mapSurface=new Mesh(new PlaneGeometry(ARENA_W,SOLO_ARENA_D),this.mapMaterial);
 private readonly mapEntities=new Group();
 private mapRequest=0;
 private readonly outer=new MeshLambertMaterial({color:DEFAULT.outerGroundColor,emissive:0x1a2a15,emissiveIntensity:.15});
 private readonly inner=new MeshLambertMaterial({color:DEFAULT.groundColor,emissive:DEFAULT.groundGlowColor,emissiveIntensity:.12});
 private readonly road=new MeshLambertMaterial({color:0x554b40,emissive:0x211c18,emissiveIntensity:.12});
 constructor(){
  this.mapSurface.rotation.x=-Math.PI/2;this.mapSurface.position.y=.018;this.mapSurface.visible=false;this.group.add(this.mapSurface,this.mapEntities);
  // A quiet apocalyptic fallback while an authored 2D map texture loads (or
  // if an upload is missing). Never show the retired 3D orchard/trees here.
  const ground=new Mesh(new PlaneGeometry(ARENA_W+8,SOLO_ARENA_D+8),this.outer);ground.rotation.x=-Math.PI/2;this.legacyGroup.add(ground);
  const inner=new Mesh(new PlaneGeometry(ARENA_W,SOLO_ARENA_D),this.inner);inner.rotation.x=-Math.PI/2;inner.position.y=.01;this.legacyGroup.add(inner);
  const lane=new Mesh(new PlaneGeometry(ARENA_W*.46,SOLO_ARENA_D),this.road);lane.rotation.x=-Math.PI/2;lane.position.set(0,.035,0);this.legacyGroup.add(lane);
  const rim=new Mesh(new BoxGeometry(ARENA_W+1,.6,SOLO_ARENA_D+1),new MeshLambertMaterial({color:0x302c29}));rim.position.y=-.34;this.legacyGroup.add(rim);
  this.group.add(this.legacyGroup);
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
    const block=new Mesh(new DodecahedronGeometry(.55,0),new MeshLambertMaterial({color:entity.kind==='prop'?0x71786b:0x69645b,flatShading:true}));block.scale.set(width,height,depth);
    block.position.y=height/2;visual.add(block);
   }else if(entity.kind==='pit'||entity.kind==='hazard'){
    const color=entity.kind==='pit'?0x090a0c:0xff542c;
    const decal=new Mesh(new CircleGeometry(.5,32),new MeshBasicMaterial({color,transparent:true,opacity:entity.kind==='pit'?.9:.46,side:DoubleSide,depthWrite:false}));
    decal.scale.set(width,depth,1);decal.rotation.x=-Math.PI/2;decal.position.y=.04;visual.add(decal);
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
  // foliageEnabled remains in the admin schema for old saves; current maps are
  // authored 2D textures and the fallback intentionally has no 3D trees.
 }
}
