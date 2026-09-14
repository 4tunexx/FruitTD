import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';
import { getAdminSprite, type AdminSpriteType } from '../ui/adminSprites';

const textureCache = new Map<string, CanvasTexture | null>();
const pendingLoads = new Map<string, ((tex: CanvasTexture | null) => void)[]>();

export function getAdminTexture(type: AdminSpriteType): CanvasTexture | null {
  if (textureCache.has(type)) {
    return textureCache.get(type) || null;
  }
  
  const dataUrl = getAdminSprite(type);
  if (!dataUrl) {
    textureCache.set(type, null);
    return null;
  }
  
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      textureCache.set(type, null);
      return null;
    }
    
    // Draw a placeholder so texture isn't completely blank
    ctx.fillStyle = '#888888';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#666666';
    ctx.fillText('Loading...', 110, 128);
    
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    
    textureCache.set(type, texture);
    
    // Load actual image asynchronously
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0, 256, 256);
      texture.needsUpdate = true;
      
      // Notify any pending callbacks
      const callbacks = pendingLoads.get(type);
      if (callbacks) {
        callbacks.forEach(cb => cb(texture));
        pendingLoads.delete(type);
      }
    };
    img.onerror = () => {
      console.warn(`Failed to load admin sprite ${type}`);
      const callbacks = pendingLoads.get(type);
      if (callbacks) {
        callbacks.forEach(cb => cb(null));
        pendingLoads.delete(type);
      }
    };
    img.src = dataUrl;
    
    return texture;
  } catch (err) {
    console.warn(`Failed to create admin sprite ${type}:`, err);
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
  pendingLoads.clear();
}

export function refreshAdminTexture(type: AdminSpriteType): void {
  const old = textureCache.get(type);
  if (old) {
    old.dispose();
  }
  textureCache.delete(type);
}
