import { refreshAdminTexture } from '../game/adminTextureLoader';
import { refreshPowerIcon } from './powerIcons';
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
  'power-jiju-1': 'admin-sprite-power-jiju-1',
  'power-jiju-2': 'admin-sprite-power-jiju-2',
  'power-jiju-3': 'admin-sprite-power-jiju-3',
  'power-jiju-4': 'admin-sprite-power-jiju-4',
  'power-jiju-5': 'admin-sprite-power-jiju-5',
  'power-jiju-6': 'admin-sprite-power-jiju-6',
  'power-topfu-1': 'admin-sprite-power-topfu-1',
  'power-topfu-2': 'admin-sprite-power-topfu-2',
  'power-topfu-3': 'admin-sprite-power-topfu-3',
  'power-topfu-4': 'admin-sprite-power-topfu-4',
  'power-topfu-5': 'admin-sprite-power-topfu-5',
  'power-topfu-6': 'admin-sprite-power-topfu-6',
  'power-lagen-1': 'admin-sprite-power-lagen-1',
  'power-lagen-2': 'admin-sprite-power-lagen-2',
  'power-lagen-3': 'admin-sprite-power-lagen-3',
  'power-lagen-4': 'admin-sprite-power-lagen-4',
  'power-lagen-5': 'admin-sprite-power-lagen-5',
  'power-lagen-6': 'admin-sprite-power-lagen-6',
  'power-tripos-1': 'admin-sprite-power-tripos-1',
  'power-tripos-2': 'admin-sprite-power-tripos-2',
  'power-tripos-3': 'admin-sprite-power-tripos-3',
  'power-tripos-4': 'admin-sprite-power-tripos-4',
  'power-tripos-5': 'admin-sprite-power-tripos-5',
  'power-tripos-6': 'admin-sprite-power-tripos-6',
  'power-ki-1': 'admin-sprite-power-ki-1',
  'power-ki-2': 'admin-sprite-power-ki-2',
  'power-ki-3': 'admin-sprite-power-ki-3',
  'power-ki-4': 'admin-sprite-power-ki-4',
  'power-ki-5': 'admin-sprite-power-ki-5',
  'power-ki-6': 'admin-sprite-power-ki-6',
} as const;

export function installSpriteUploads(): void {
  Object.entries(SPRITE_KEYS).forEach(([id, storageKey]) => {
    const input = document.getElementById(`sprite-${id}`) as HTMLInputElement | null;
    const preview = document.getElementById(`preview-${id}`);
    const clearBtn = document.getElementById(`clear-${id}`);
    
    if (!input || !preview || !clearBtn) return;
    
    const loadStored = () => {
      const stored = localStorage.getItem(storageKey);
      preview.replaceChildren();
      if (stored) {
        const image = document.createElement('img');
        image.src = stored;
        image.alt = id;
        preview.appendChild(image);
        clearBtn.style.display = 'block';
      } else {
        const empty = document.createElement('span');
        empty.textContent = 'No sprite';
        preview.appendChild(empty);
        clearBtn.style.display = 'none';
      }
    };

    if (input.dataset.spriteUploadWired === '1') {
      loadStored();
      return;
    }
    input.dataset.spriteUploadWired = '1';
    
    input.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          localStorage.setItem(storageKey, dataUrl);
          loadStored();
          
          id.startsWith('power-') ? refreshPowerIcon(id.slice('power-'.length), dataUrl) : refreshAdminTexture(id as any);
        }
      };
      reader.readAsDataURL(file);
    });
    
    clearBtn.addEventListener('click', () => {
      localStorage.removeItem(storageKey);
      input.value = '';
      loadStored();
      
      id.startsWith('power-') ? refreshPowerIcon(id.slice('power-'.length), null) : refreshAdminTexture(id as any);
    });
    
    loadStored();
  });
}

export type AdminSpriteType = keyof typeof SPRITE_KEYS;

export function getAdminSprite(type: AdminSpriteType): string | null {
  return localStorage.getItem(SPRITE_KEYS[type]);
}
