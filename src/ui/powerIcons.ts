const ADMIN_POWER_KEY = 'admin-sprite-power-';
export function powerIconSource(id: string, fallback: string): string {
  try { return localStorage.getItem(ADMIN_POWER_KEY + id) || fallback; } catch { return fallback; }
}
export function refreshPowerIcon(id: string, source: string | null): void {
  document.querySelectorAll<HTMLImageElement>('img[data-power-icon]').forEach((image) => {
    if (image.dataset.powerIcon === id) image.src = source || image.dataset.powerDefault || '';
  });
}
