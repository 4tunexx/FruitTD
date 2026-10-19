import { getStudioEntityData } from '../game/studioRuntime';
const ADMIN_POWER_KEY = 'admin-sprite-power-';
export function powerIconSource(id: string, fallback: string): string {
  const entity=getStudioEntityData(`power-${id}`);if(entity?.ignoreLegacy&&!entity.sheetDataUrl)return fallback;
  const published=entity?.sheetDataUrl;if(published)return published;
  try { return localStorage.getItem(ADMIN_POWER_KEY + id) || fallback; } catch { return fallback; }
}
export function refreshPowerIcon(id: string, source: string | null): void {
  document.querySelectorAll<HTMLImageElement>('img[data-power-icon]').forEach((image) => {
    if (image.dataset.powerIcon === id) image.src = source || powerIconSource(id,image.dataset.powerDefault || '');
  });
}

if(typeof window!=='undefined')window.addEventListener('fruit-td-creator-update',()=>{document.querySelectorAll<HTMLImageElement>('img[data-power-icon]').forEach(image=>{image.src=powerIconSource(image.dataset.powerIcon!,image.dataset.powerDefault||'');});});
