import type { CatalogSlicer } from '../../game/slicers';

type Point = { x: number; y: number };
type Preview = { canvas: HTMLCanvasElement; slicer?: CatalogSlicer; born: number; points: Point[]; pointer: boolean; cleanup: () => void };
const previews = new Set<Preview>();
let frame = 0;

/** A single travelling slash with its own shine, without a static weapon.
 * Canvas2D also works on phones that cannot allocate another WebGL context. */
export function animateBladePreview(canvas: HTMLCanvasElement, slicer: CatalogSlicer | undefined): { update: (slicer: CatalogSlicer) => void; dispose: () => void } {
  const preview: Preview = { canvas, slicer, born: performance.now(), points: [], pointer: false, cleanup: () => undefined };
  const point = (event: PointerEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  };
  const down = (event: PointerEvent) => {
    // Small card previews must let touch swipes scroll the inventory. The
    // larger admin inspector is explicitly interactive on touch screens.
    if (event.pointerType === 'touch' && !canvas.classList.contains('admin-slicer-live')) return;
    preview.pointer = true; preview.points = [point(event)]; canvas.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!preview.pointer) return;
    preview.points.push(point(event)); if (preview.points.length > 16) preview.points.shift();
  };
  const stop = () => { preview.pointer = false; preview.born = performance.now(); preview.points = []; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  preview.cleanup = () => {
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', stop); canvas.removeEventListener('pointercancel', stop);
  };
  previews.add(preview);
  if (!frame) frame = requestAnimationFrame(draw);
  return { update: (next) => { preview.slicer = next; }, dispose: () => release(preview) };
}

function release(preview: Preview): void { previews.delete(preview); preview.cleanup(); }

function draw(now: number): void {
  frame = 0;
  for (const preview of previews) {
    if (!preview.canvas.isConnected) { release(preview); continue; }
    const { canvas, slicer } = preview;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > window.innerHeight) continue;
    const ctx = canvas.getContext('2d'); if (!ctx) continue;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(rect.width * scale), height = Math.round(rect.height * scale);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const phase = ((now - preview.born) % 1800) / 1800;
    const progress = Math.min(1, phase / .32);
    let opacity = 1;
    if (!preview.pointer) {
      opacity = phase < .32 ? 1 : Math.max(0, 1 - (phase - .32) / .15);
      preview.points = Array.from({ length: 16 }, (_, i) => {
        const t = Math.max(0, progress - (15 - i) * .027);
        return { x: .12 + t * .76, y: .66 - Math.sin(t * Math.PI) * .27 - t * .25 };
      });
    }
    if (!opacity || preview.points.length < 2) continue;
    const points = preview.points;
    const bladeWidth = Math.max(1.3, Math.min(4, (slicer?.trailWidth ?? 1) * 2));
    ctx.globalAlpha = opacity; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x * rect.width, p.y * rect.height) : ctx.moveTo(p.x * rect.width, p.y * rect.height));
    ctx.strokeStyle = slicer?.color ?? '#a3e635'; ctx.lineWidth = bladeWidth;
    ctx.shadowColor = slicer?.glowColor ?? '#a3e635'; ctx.shadowBlur = 2 + (slicer?.glow ?? .35) * 10; ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = bladeWidth * .35; ctx.stroke();
    // Shine belongs to the moving cut, rather than a separate panel overlay.
    const glint = Math.max(0, Math.min(1, slicer?.glint ?? .25));
    const tip = points[points.length - 1];
    if (glint > 0) {
      ctx.globalAlpha = opacity * glint;
      const x = tip.x * rect.width, y = tip.y * rect.height;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.shadowColor = slicer?.glowColor ?? '#fff'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }
  if (previews.size) frame = requestAnimationFrame(draw);
}
