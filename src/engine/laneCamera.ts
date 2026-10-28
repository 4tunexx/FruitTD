/** Keep the battlefield inside an adaptive lens while constraining lane travel. */
export function laneFrame(width:number,height:number,fieldWidth:number,minZ:number,maxZ:number,requestedZ:number,shared=false,fitFullDepth=false) {
  const aspect=Math.max(1,width)/Math.max(1,height);
  const tilt=.86;
  const fieldDepth=maxZ-minZ;
  // In a wide window show one territory at a useful scale, never both lanes as a sliver.
  const targetDepth=shared?fieldDepth:fieldDepth/2;
  const viewWidth=Math.max(fieldWidth,fitFullDepth?targetDepth*tilt*aspect:shared ? Math.min(fieldDepth*tilt*aspect,fieldWidth*1.12) : Math.min(fieldDepth*.48*tilt*aspect,fieldWidth*1.06));
  const viewHeight=viewWidth/aspect;
  const visibleDepth=viewHeight/tilt;
  const low=minZ+Math.min(fieldDepth/2,visibleDepth/2);
  const high=maxZ-Math.min(fieldDepth/2,visibleDepth/2);
  return {viewWidth,viewHeight,centerZ:Math.max(low,Math.min(high,requestedZ)),low,high,tilt};
}
