import { OrthographicCamera, Vector3 } from 'three';
import { ARENA_W, SOLO_ARENA_D } from '../game/world';
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
 const portrait=w<860&&w/Math.max(1,h)<1.15;
 let zoom=portrait?1.11:1;
 for(let attempt=0;attempt<3;attempt++){
  camera.left=-frame.viewWidth/(2*zoom);camera.right=frame.viewWidth/(2*zoom);
  camera.top=frame.viewHeight/(2*zoom);camera.bottom=-frame.viewHeight/(2*zoom);
  // Measure the neutral view. Reuse its lens shift during panning so looking
  // up the lane still moves the world instead of pinning the wall in place.
  camera.position.set(0,baseY,baseZ+initial.centerZ);camera.lookAt(0,.2,initial.centerZ);
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  if(!portrait)break;
  const targetY=1-2*.972;
  const wall=new Vector3(0,.15,-10.6).project(camera);
  const shift=(wall.y-targetY)*(camera.top-camera.bottom)/2;
  camera.top+=shift;camera.bottom+=shift;camera.updateProjectionMatrix();
  const spawnY=new Vector3(0,.7,SOLO_ARENA_D*.475).project(camera).y;
  if(spawnY<=.96)break;
  zoom*=Math.max(.7,(.96-targetY)/(spawnY-targetY))*.995;
 }
 camera.position.set(0,baseY,baseZ+frame.centerZ);camera.lookAt(0,.2,frame.centerZ);
 camera.updateMatrixWorld(true);
 return {baseY,baseZ,lookZ};
}
