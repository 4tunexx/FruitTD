import { BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

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

/** Ruined orchard masonry and amber beacons leave the playable lane clear. */
export function battleScenery(width: number, length: number, centerZ=0): Group {
  const group=new Group();
  const stone=new MeshLambertMaterial({color:0x6b7768,flatShading:true,map:battleTexture('stone')});
  const dark=new MeshLambertMaterial({color:0x263b35,flatShading:true});
  const amber=new MeshBasicMaterial({color:0xffca57});
  const shadowMaterial=new MeshBasicMaterial({color:0x071511,transparent:true,opacity:.3,depthWrite:false});
  for(const side of [-1,1]) for(let i=0;i<4;i++){
    const x=side*(width/2+.4),z=centerZ-length*.36+i*length*.24;
    const ruin=new Group();ruin.position.set(x,0,z);
    const foot=new Mesh(new CylinderGeometry(.62,.86,.32,6),dark);foot.position.y=.16;ruin.add(foot);
    const column=new Mesh(new BoxGeometry(.65,1.35,.65),stone);column.position.y=.9;column.rotation.y=.15*side;ruin.add(column);
    const cap=new Mesh(new ConeGeometry(.55,.35,4),dark);cap.position.y=1.75;cap.rotation.y=Math.PI/4;ruin.add(cap);
    const lamp=new Mesh(new BoxGeometry(.36,.22,.7),amber);lamp.position.y=1.35;ruin.add(lamp);
    const shadow=new Mesh(new CircleGeometry(1.05,12),shadowMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.set(.2,.03,.3);ruin.add(shadow);
    for(let j=0;j<2;j++){const rock=new Mesh(new ConeGeometry(.4+j*.12,.5+j*.25,5),stone);rock.position.set(side*(.7+j*.45),.25,j*.45);rock.rotation.z=side*.3;ruin.add(rock);}
    group.add(ruin);
  }
  return group;
}
