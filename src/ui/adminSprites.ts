const SPRITE_KEYS = {
  'enemy-normal': 'admin-sprite-enemy-normal',
  'enemy-explosive': 'admin-sprite-enemy-explosive',
  'enemy-armored': 'admin-sprite-enemy-armored',
  'tower-main': 'admin-sprite-tower-main',
  // P1-3: Hero avatars for main tower
  'hero-jiju': 'admin-sprite-hero-jiju',
  'hero-topfu': 'admin-sprite-hero-topfu',
  'hero-lagen': 'admin-sprite-hero-lagen',
  'hero-tripos': 'admin-sprite-hero-tripos',
  'hero-ki': 'admin-sprite-hero-ki',
} as const;

export function installSpriteUploads(): void {
  Object.entries(SPRITE_KEYS).forEach(([id, storageKey]) => {
    const input = document.getElementById(`sprite-${id}`) as HTMLInputElement | null;
    const preview = document.getElementById(`preview-${id}`);
    const clearBtn = document.getElementById(`clear-${id}`);
    
    if (!input || !preview || !clearBtn) return;
    
    const loadStored = () => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        preview.innerHTML = `<img src="${stored}" alt="${id}" />`;
        clearBtn.style.display = 'block';
      } else {
        preview.innerHTML = '<span style="font-size: 0.7rem; color: #64748b;">No sprite</span>';
        clearBtn.style.display = 'none';
      }
    };
    
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          localStorage.setItem(storageKey, dataUrl);
          loadStored();
          
          const { refreshAdminTexture } = require('../game/adminTextureLoader');
          refreshAdminTexture(id as any);
        }
      };
      reader.readAsDataURL(file);
    });
    
    clearBtn.addEventListener('click', () => {
      localStorage.removeItem(storageKey);
      input.value = '';
      loadStored();
      
      const { refreshAdminTexture } = require('../game/adminTextureLoader');
      refreshAdminTexture(id as any);
    });
    
    loadStored();
  });
}

export function getAdminSprite(type: 'enemy-normal' | 'enemy-explosive' | 'enemy-armored' | 'tower-main' | 'hero-jiju' | 'hero-topfu' | 'hero-lagen' | 'hero-tripos' | 'hero-ki'): string | null {
  return localStorage.getItem(SPRITE_KEYS[type]);
}
