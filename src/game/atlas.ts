import { CanvasTexture, SRGBColorSpace } from 'three';
import atlasUrl from '../assets/fruit-atlas.jpg';

const COLS = 8;
const ROWS = 5;

export class FruitAtlas {
  private img: HTMLImageElement | null = null;
  private readonly cache = new Map<string, CanvasTexture>();
  ready = false;

  async load(): Promise<void> {
    if (this.ready) return;
    const img = new Image();
    img.src = atlasUrl;
    await img.decode();
    this.img = img;
    this.ready = true;
  }

  tile(col: number, row: number): CanvasTexture | null {
    if (!this.img) return null;
    
    // Safe bounds checking - prevent invalid cell access
    if (!Number.isFinite(col) || !Number.isFinite(row)) return null;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) {
      console.warn(`Atlas: invalid cell [${col}, ${row}], expected [0-${COLS-1}, 0-${ROWS-1}]`);
      return null;
    }
    
    const key = `${col},${row}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const tw = this.img.width / COLS;
    const th = this.img.height / ROWS;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.img, col * tw, row * th, tw, th, 0, 0, 256, 256);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    this.cache.set(key, tex);
    return tex;
  }
  
  /** Admin/debug: check if a tile coordinate is valid */
  isValidTile(col: number, row: number): boolean {
    return Number.isFinite(col) && Number.isFinite(row) && 
           col >= 0 && col < COLS && row >= 0 && row < ROWS;
  }
  
  /** Admin inspector: get atlas dimensions */
  getDimensions(): { cols: number; rows: number } {
    return { cols: COLS, rows: ROWS };
  }
}

export const fruitAtlas = new FruitAtlas();
