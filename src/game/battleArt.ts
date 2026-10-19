import { CanvasTexture, DoubleSide, Mesh, MeshBasicMaterial, PlaneGeometry, Group, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

const textures = new Map<string, Texture>();
/** Small original ink textures: generated once, shared by both battle renderers. */
export function battleTexture(kind: 'ground' | 'stone'): Texture | null {
  const cached = textures.get(kind); if (cached) return cached;
  const canvas = document.createElement('canvas'); canvas.width=canvas.height=256;
  const ctx = canvas.getContext?.('2d'); if (!ctx) return null;
  let seed=kind==='ground'?42:83;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  ctx.fillStyle=kind==='ground'?'#d0d6b6':'#b7ad93';ctx.fillRect(0,0,256,256);
  for(let i=0;i<450;i++){
    const x=random()*256,y=random()*256;
    ctx.fillStyle=random()>.5?'#ffffff12':'#101b1920';
    ctx.beginPath();ctx.ellipse(x,y,1+random()*8,1+random()*3,random()*3,0,Math.PI*2);ctx.fill();
  }
  if(kind==='stone'){
    ctx.strokeStyle='#19201970';ctx.lineWidth=3;
    for(let row=0;row<4;row++){
      const y=row*64;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(256,y);ctx.stroke();
      for(let x=(row%2)*64;x<256;x+=128){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+3,y+64);ctx.stroke();}
    }
  } else {
    ctx.strokeStyle='#26342435';ctx.lineWidth=1;
    for(let i=0;i<70;i++){const x=random()*256,y=random()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-2,y-5);ctx.moveTo(x,y);ctx.lineTo(x+3,y-4);ctx.stroke();}
  }
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;texture.wrapS=texture.wrapT=RepeatWrapping;texture.repeat.set(kind==='ground'?5:3,kind==='ground'?8:2);textures.set(kind,texture);return texture;
}

/** Flat inked perimeter: no props in lanes, build pads or authored collision areas. */
export function battleScenery(width: number, length: number, centerZ=0): Group {
  const group=new Group();group.name='orchard-perimeter';
  const plate=(w:number,h:number,x:number,z:number,color:number)=>{
    const mesh=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({color,side:DoubleSide}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.045,z);group.add(mesh);return mesh;
  };
  for(const side of [-1,1]) {
    const x=side*(width/2+.42);
    plate(.7,length,x,centerZ,0x202125);
    plate(.055,length,x-side*.31,centerZ,0xf48120);
    const count=Math.min(20,Math.max(3,Math.floor(length/4)));
    for(let i=0;i<count;i++) {
      const z=centerZ-length/2+(i+.5)*length/count;
      const mark=plate(.32,.75,x,z,0xffb344);mark.rotation.z=.45*side;
      // Charcoal debris beyond the perimeter, never covering the play surface.
      const rubble=plate(.45+(i%3)*.15,.55,side*(width/2+1.2+(i%2)*.3),z+.6,0x343a34);
      rubble.rotation.z=i*1.7;
    }
  }
  return group;
}
