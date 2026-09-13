import type { CatalogSlicer } from '../game/slicers';

/**
 * Lightweight live preview used by the admin slicer editor.
 * It deliberately uses DOM/CSS rather than the combat renderer so admins can
 * inspect a blade without starting a match or changing player inventory.
 */
export function renderSlicerLivePreview(container: HTMLElement, slicer: CatalogSlicer): void {
  container.innerHTML = `
    <div class="slicer-live-preview" aria-label="Live slicer inspection">
      <div class="slicer-live-sparks"></div>
      <div class="slicer-live-blade"></div>
      <div class="absolute inset-x-0 bottom-3 text-center text-[10px] font-black uppercase tracking-[.2em] text-white/55">LIVE CUT INSPECTION · ${escapeHtml(slicer.fxStyle)}</div>
    </div>
    <div class="mt-2 grid grid-cols-3 gap-2 text-[10px] text-white/55">
      <span>WIDTH <b class="text-white">${slicer.trailWidth.toFixed(2)}</b></span>
      <span>GLOW <b class="text-white">${Math.round(slicer.glow * 100)}%</b></span>
      <span>GLINT <b class="text-white">${Math.round(slicer.glint * 100)}%</b></span>
    </div>
  `;
  const preview = container.querySelector('.slicer-live-preview') as HTMLElement | null;
  if (!preview) return;
  preview.style.setProperty('--slicer-width', `${Math.max(3, slicer.trailWidth * 7)}px`);
  preview.style.setProperty('--slicer-color', slicer.color);
  preview.style.setProperty('--slicer-glow', slicer.glowColor);
  preview.style.setProperty('--slicer-glow-strength', String(slicer.glow));
}

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch] || ch));
}
