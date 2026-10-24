import { OrthographicCamera } from 'three';
import { ARENA_W } from '../game/world';
import { laneFrame } from './laneCamera';
export function arenaFrustum(width:number,height:number,zoomHeight=20){
 const aspect=Math.max(1,width)/Math.max(1,height),minimumWidth=aspect<.82?18:ARENA_W+2;
 const viewHeight=Math.max(20,minimumWidth/aspect)*(zoomHeight/20),viewWidth=viewHeight*aspect;
 return {left:-viewWidth/2,right:viewWidth/2,top:viewHeight/2,bottom:-viewHeight/2};
}
/** Shared by live combat and Creator. The lens keeps the wall at the safe bottom edge. */
export function frameCombatCamera(camera:OrthographicCamera,w:number,h:number,_viewH=28,_desktop=true,_panX=0,panZ=0){
 const initial=laneFrame(w,h,ARENA_W+.8,-12,23,-12,true);
 const frame=laneFrame(w,h,ARENA_W+.8,-12,23,initial.low+panZ,true);
 const baseY=60,baseZ=-35.6,lookZ=frame.centerZ-panZ;
 camera.left=-frame.viewWidth/2;camera.right=frame.viewWidth/2;
 camera.top=frame.viewHeight/2;camera.bottom=-frame.viewHeight/2;
 camera.position.set(0,baseY,baseZ+frame.centerZ);camera.lookAt(0,.2,frame.centerZ);
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 return {baseY,baseZ,lookZ};
}
