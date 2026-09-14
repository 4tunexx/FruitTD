import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { getAdminSprite } from '../ui/adminSprites';

const textureCache = new Map<string, CanvasTexture | null>();

export function getAdminTexture(type: 'enemy-normal' | 'enemy-explosive' | 'enemy-armored' | 'tower-main'): CanvasTexture | null {
  if (textureCache.has(type)) {
    return textureCache.get(type) || null;
  }
  
  const dataUrl = getAdminSprite(type);
  if (!dataUrl) {
    textureCache.set(type, null);
    return null;
  }
  
  try {
    const img = new Image();
    img.src = dataUrl;
    
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      textureCache.set(type, null);
      return null;
    }
    
    img.onload = () => {
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0, 256, 256);
      const tex = textureCache.get(type);
      if (tex) {
        tex.needsUpdate = true;
      }
    };
    
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    
    textureCache.set(type, texture);
    return texture;
  } catch (err) {
    console.warn(`Failed to load admin sprite ${type}:`, err);
    textureCache.set(type, null);
    return null;
  }
}

export function clearAdminTextureCache(): void {
  textureCache.forEach((tex) => {
    if (tex) {
      tex.dispose();
    }
  });
  textureCache.clear();
}

export function refreshAdminTexture(type: 'enemy-normal' | 'enemy-explosive' | 'enemy-armored' | 'tower-main'): void {
  const old = textureCache.get(type);
  if (old) {
    old.dispose();
  }
  textureCache.delete(type);
}
