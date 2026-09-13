import type { CatalogSlicer, SlicerFxStyle, SlicerRarity } from '../game/slicers';

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

function readSlicerCard(card: HTMLElement): CatalogSlicer {
  const value = (selector: string, fallback = '') =>
    (card.querySelector(selector) as HTMLInputElement | HTMLSelectElement | null)?.value ?? fallback;
  const number = (selector: string, fallback: number) => {
    const n = Number(value(selector));
    return Number.isFinite(n) ? n : fallback;
  };
  const checked = (selector: string) => (card.querySelector(selector) as HTMLInputElement | null)?.checked ?? false;

  return {
    id: value('.sl-id', 'preview'),
    name: value('.sl-name', 'Slicer'),
    blurb: value('.sl-blurb', ''),
    enabled: checked('.sl-on'),
    cost: number('.sl-cost', 0),
    sellValue: number('.sl-sell', 0),
    rarity: value('.sl-rarity', 'common') as SlicerRarity,
    color: value('.sl-color', '#ffffff'),
    glowColor: value('.sl-glowc', '#ffffff'),
    fxStyle: value('.sl-fx', 'solid') as SlicerFxStyle,
    trailWidth: number('.sl-width', 1),
    glow: number('.sl-glow', 0.5),
    glint: number('.sl-glint', 0.5),
    damageMul: number('.sl-dmg', 1),
    juiceMul: number('.sl-juice', 1),
    brittleBonus: number('.sl-brittle', 0),
  };
}

function mountSlicerCard(card: HTMLElement): void {
  if (card.dataset.liveInspectionMounted === '1') return;
  card.dataset.liveInspectionMounted = '1';

  const host = document.createElement('div');
  host.className = 'slicer-live-inspector mt-4';
  card.appendChild(host);

  const refresh = () => renderSlicerLivePreview(host, readSlicerCard(card));
  refresh();

  card.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((input) => {
    input.addEventListener('input', refresh);
    input.addEventListener('change', refresh);
  });
}

/**
 * The admin catalog is rendered dynamically. This observer keeps the live
 * inspection attached even when the admin opens, adds, removes, or rebuilds
 * slicer cards later in the session.
 */
function observeSlicerEditor(): void {
  if (typeof document === 'undefined' || !document.body) return;

  const scan = () => {
    document.querySelectorAll<HTMLElement>('.admin-slicer-card').forEach(mountSlicerCard);
  };

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}

observeSlicerEditor();
