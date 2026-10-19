import { LinearFilter, SRGBColorSpace, Texture, TextureLoader } from 'three';

export const CHARACTER_ATLAS_URL = '/assets/battle/portraits-v1.webp';
import { BATTLEFIELD_ART_URL } from './battleMaps';
export { BATTLEFIELD_ART_URL } from './battleMaps';

// Atlas rows have individually measured centers, avoiding neighbouring portraits
// and the illustration's bottom margin. UVs are inset inside the gold medallion.
const rows = [.12, .355, .588, .834];
export const PORTRAIT_CELLS: Record<string, [number,number]> = {
  orange:[0,0], lemon:[1,0], strawberry:[2,0], watermelon:[3,0],
  banana:[0,1], apple:[1,1], kiwi:[2,1], bomb:[3,1], pineapple:[1,0],
  jiju:[0,2], topfu:[1,2], lagen:[2,2], tripos:[3,2],
  ki:[0,3], 'boss-melon':[1,3], 'boss-orange':[2,3], tower:[3,3],
};

const cache = new Map<string,Texture>();
let source:Texture|null=null;
let terrain:Texture|null=null;

export function battlefieldTexture():Texture|null {
  if(typeof document==='undefined' || typeof document.createElementNS!=='function')return null;
  if(!terrain) {
    terrain=new TextureLoader().load(BATTLEFIELD_ART_URL);
    terrain.colorSpace=SRGBColorSpace;
  }
  return terrain;
}

/** One shared atlas upload; UV views are cached rather than allocating per enemy. */
export function characterPortrait(key:string):Texture|null {
  const cell=PORTRAIT_CELLS[key];
  if(!cell || typeof document==='undefined' || typeof document.createElementNS!=='function')return null;
  const cached=cache.get(key);if(cached)return cached;
  if(key==='pineapple') {
    const texture=new TextureLoader().load('/assets/battle/pineapple-v1.webp');
    texture.colorSpace=SRGBColorSpace;cache.set(key,texture);return texture;
  }
  if(!source) {
    source=new TextureLoader().load(CHARACTER_ATLAS_URL,()=>{
      for(const texture of cache.values())texture.needsUpdate=true;
    });
    source.colorSpace=SRGBColorSpace;
  }
  const texture=source.clone();
  texture.colorSpace=SRGBColorSpace;
  texture.minFilter=LinearFilter;texture.magFilter=LinearFilter;
  texture.generateMipmaps=false;
  const size=.228;
  texture.repeat.set(size,size);
  texture.offset.set((cell[0]+.5)/4-size/2,1-rows[cell[1]]!-size/2);
  texture.needsUpdate=true;
  cache.set(key,texture);return texture;
}

export function enemyPortrait(kind:string,boss=false):Texture|null {
  return characterPortrait(boss?(kind==='watermelon'?'boss-melon':'boss-orange'):kind);
}

/** Retired sample maps are upgraded; custom uploaded maps keep their artwork. */
export function battlefieldArtSource(source:string):string {
  return source.startsWith('/assets/maps/samples/')?BATTLEFIELD_ART_URL:source;
}
