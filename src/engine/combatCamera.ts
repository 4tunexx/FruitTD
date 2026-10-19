import { OrthographicCamera, Vector3 } from 'three';
import { ARENA_W } from '../game/world';
export function arenaFrustum(width:number,height:number,zoomHeight=20){
 const aspect=Math.max(1,width)/Math.max(1,height),minimumWidth=aspect<.82?18:ARENA_W+2;
 const viewHeight=Math.max(20,minimumWidth/aspect)*(zoomHeight/20),viewWidth=viewHeight*aspect;
 return {left:-viewWidth/2,right:viewWidth/2,top:viewHeight/2,bottom:-viewHeight/2};
}
/** Shared by live combat and Creator. The lens keeps the wall at the safe bottom edge. */
export function frameCombatCamera(camera:OrthographicCamera,w:number,h:number,viewH=28,desktop=true,panX=0,panZ=0){
 const portrait=w/Math.max(1,h)<.82,baseY=portrait?32:26,baseZ=portrait?-24:-32,lookZ=1.5;
 Object.assign(camera,arenaFrustum(w,h,viewH*(portrait?20/28:desktop?24/28:1)));
 camera.position.set(panX,baseY,baseZ+lookZ+panZ);camera.lookAt(panX,.2,lookZ+panZ);
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const wall=new Vector3(0,.15,-10.6).project(camera),target=1-24/Math.max(1,h);
 const shift=(wall.y-(1-2*target))*(camera.top-camera.bottom)/2;
 camera.top+=shift;camera.bottom+=shift;camera.updateProjectionMatrix();
 return {baseY,baseZ,lookZ};
}
