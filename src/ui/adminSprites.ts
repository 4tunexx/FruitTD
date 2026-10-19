import { refreshAdminTexture } from '../game/adminTextureLoader';
import { refreshPowerIcon } from './powerIcons';
import { fetchAdminConfig, saveAdminConfig } from '../services/admin';
import { getAuthToken } from '../services/auth';
import { getLiveConfig, setLiveConfig } from '../services/liveConfig';
import { getPublishedCreatorMedia } from '../game/creatorMedia';
import { resolveEntityArtwork } from '../game/entityArtwork';
import { artworkPreview } from './entityArtworkPreview';
import type { MediaStudioStore } from './adminMediaStudio';
let spriteSaveQueue:Promise<unknown>=Promise.resolve();

export function withSpriteImage(media:MediaStudioStore|null|undefined,key:string,source:string|null):MediaStudioStore {
  const old=media?.entities[key];
  return {version:2,selectedEntity:key,sounds:media?.sounds,entities:{...media?.entities,[key]:{...old,ignoreLegacy:!source,sheetDataUrl:source,cols:1,rows:1,frameW:0,frameH:0,clips:source?{idle:{startFrame:0,frameCount:1}}:{}}}};
}
async function publishSprite(key:string,source:string|null):Promise<MediaStudioStore> {
  const latest=await fetchAdminConfig();if(!latest)throw new Error('Could not load the live asset configuration.');
  const creatorMedia=withSpriteImage(latest.creatorMedia,key,source);
  const result=await saveAdminConfig({creatorMedia});if(!result.success)throw new Error(result.error||'Could not publish this image.');
  return creatorMedia;
}
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
      const published=getPublishedCreatorMedia();
      const stored=localStorage.getItem(storageKey);
      const artwork=resolveEntityArtwork(id,published?.entities||{},stored);
      preview.replaceChildren(artworkPreview(artwork,id));
      const source=document.createElement('small');source.textContent=artwork?.origin==='published'?'Published · shared with players':artwork?.origin==='legacy'?'Local upload · upload again to publish':'Built-in game artwork';preview.appendChild(source);
      clearBtn.style.display = published?.entities[id]?.sheetDataUrl||stored?'block':'none';
      clearBtn.textContent='Restore built-in artwork';
    };
    let status=preview.parentElement?.querySelector<HTMLElement>('.sprite-save-status');
    if(!status){status=document.createElement('p');status.className='sprite-save-status';status.setAttribute('role','status');preview.parentElement?.appendChild(status);}
    if (input.dataset.spriteUploadWired === '1') {
      loadStored();
      return;
    }
    input.dataset.spriteUploadWired = '1';
    
    input.accept='image/png,image/jpeg,image/webp';
    input.addEventListener('change', () => {
      const file=input.files?.[0];if(!file)return;
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>1_000_000){status!.textContent='Use PNG, JPEG or WebP under 1 MB.';return;}
      input.disabled=true;clearBtn.setAttribute('disabled','');status!.textContent='Uploading and publishing…';
      const operation=async()=>{
        const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read this image.'));reader.readAsDataURL(file);});
        const response=await fetch('/api/admin/media',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${getAuthToken()}`},body:JSON.stringify({image:dataUrl})});
        const result=await response.json();if(!response.ok||!result.url)throw new Error(result.error||'Image upload failed.');
        const creatorMedia=await publishSprite(id,result.url);
        try{localStorage.setItem(storageKey,result.url);}catch{/* Shared image is already saved. */}
        refreshAdminTexture(id as any);setLiveConfig({...getLiveConfig(),creatorMedia});window.dispatchEvent(new CustomEvent('fruit-td-sprite-published',{detail:{key:id}}));
        if(id.startsWith('power-'))refreshPowerIcon(id.slice(6),result.url);
        loadStored();status!.textContent='Published. This image is shared with every player.';
      };
      spriteSaveQueue=spriteSaveQueue.catch(()=>{}).then(operation).catch(error=>{status!.textContent=error instanceof Error?error.message:'Could not publish this image.';}).finally(()=>{input.disabled=false;clearBtn.removeAttribute('disabled');});
    });
    clearBtn.addEventListener('click',()=>{
      input.disabled=true;clearBtn.setAttribute('disabled','');status!.textContent='Restoring game artwork…';
      spriteSaveQueue=spriteSaveQueue.catch(()=>{}).then(async()=>{
        const creatorMedia=await publishSprite(id,null);localStorage.removeItem(storageKey);input.value='';
        refreshAdminTexture(id as any);setLiveConfig({...getLiveConfig(),creatorMedia});window.dispatchEvent(new CustomEvent('fruit-td-sprite-published',{detail:{key:id}}));
        if(id.startsWith('power-'))refreshPowerIcon(id.slice(6),null);
        loadStored();status!.textContent='Built-in artwork restored for every player.';
      }).catch(error=>{status!.textContent=error instanceof Error?error.message:'Could not restore this image.';}).finally(()=>{input.disabled=false;clearBtn.removeAttribute('disabled');});
    });

    loadStored();
  });
}

export type AdminSpriteType = keyof typeof SPRITE_KEYS;

export function getAdminSprite(type: AdminSpriteType): string | null {
  const published=getPublishedCreatorMedia()?.entities[type];
  if(published?.ignoreLegacy)return null;
  if(published?.sheetDataUrl&&published.cols===1&&published.rows===1)return published.sheetDataUrl;
  return localStorage.getItem(SPRITE_KEYS[type]);
}

if(typeof window!=='undefined')window.addEventListener('fruit-td-creator-update',()=>installSpriteUploads());
