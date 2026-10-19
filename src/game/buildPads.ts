import { CircleGeometry, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry } from 'three';
import { mapPointToWorld, type BattleMap } from './battleMaps';
import { MAIN_INDEX, PADS, WALL_Z, type PadDef } from './world';

export const BUILD_PAD_ORDER = 110;
/** Gameplay controls are drawn above cosmetic wall/terrain art, with a dark backing. */
export function createBuildPad(main = false): Mesh {
 const material = new MeshBasicMaterial({color:0xffe394,side:DoubleSide,depthTest:false,depthWrite:false,transparent:true});
 const pad = new Mesh(new RingGeometry(main?.66:.48,main?.75:.6,48),material);
 pad.rotation.x=-Math.PI/2;pad.renderOrder=BUILD_PAD_ORDER;
 if(!main){
  const back=new Mesh(new CircleGeometry(.48,40),new MeshBasicMaterial({color:0x202125,side:DoubleSide,depthTest:false,depthWrite:false,transparent:true,opacity:.94}));
  back.name='build-backing';back.renderOrder=BUILD_PAD_ORDER-1;pad.add(back);
  for(const angle of [0,Math.PI/2]){
   const plus=new Mesh(new PlaneGeometry(.42,.085),material.clone());plus.name='build-plus';plus.rotation.z=angle;plus.renderOrder=BUILD_PAD_ORDER+1;pad.add(plus);
  }
 }
 return pad;
}
/** Keep the stable main index while allowing up to 32 authored build pads. */
export function battleMapPads(map:BattleMap):PadDef[]{
 const pads=map.entities.filter(e=>e.kind==='turret-slot'&&e.visible).slice(0,32).map(entity=>{
  const point=mapPointToWorld(entity,map);return {...point,main:false,floor:point.z>WALL_Z+.5,enabled:true};
 });
 while(pads.length<MAIN_INDEX)pads.push({x:0,z:WALL_Z,main:false,floor:false,enabled:false});
 pads.splice(MAIN_INDEX,0,{...PADS[MAIN_INDEX]!,enabled:true});return pads;
}
