import { OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { BladeTrail } from '../../game/trail';
import type { CatalogSlicer } from '../../game/slicers';

type Preview = { canvas: HTMLCanvasElement; trail: BladeTrail; born: number; points: Vector3[]; pointer: boolean };
const previews = new Set<Preview>();
let renderer: WebGLRenderer | null = null;
let frame = 0;
let previous = 0;
const scene = new Scene();
const camera = new OrthographicCamera(-4.5, 4.5, 2, -2, .1, 20);
camera.position.set(0, 10, 0); camera.up.set(0, 0, 1); camera.lookAt(0, 0, 0);

/** One shared WebGL context renders the exact in-game BladeTrail into all visible cards. */
export function animateBladePreview(canvas: HTMLCanvasElement, slicer: CatalogSlicer | undefined): void {
  const trail = new BladeTrail(); trail.applySlicer(slicer);
  const preview: Preview = { canvas, trail, born: performance.now(), points: [], pointer: false };
  previews.add(preview);
  canvas.width = 450; canvas.height = 200;
  const point = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return new Vector3((event.clientX - rect.left) / rect.width * 9 - 4.5, .2, 2 - (event.clientY - rect.top) / rect.height * 4);
  };
  canvas.addEventListener('pointerdown', (event) => { preview.pointer = true; preview.points = [point(event)]; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => { if (preview.pointer) { preview.points.push(point(event)); if (preview.points.length > 16) preview.points.shift(); } });
  const stop = () => { preview.pointer = false; preview.born = performance.now(); preview.points = []; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  if (!frame) frame = requestAnimationFrame(draw);
}

function release(preview: Preview): void {
  previews.delete(preview);
  for (const mesh of [preview.trail.line, preview.trail.glowLine, preview.trail.sparks]) {
    mesh.geometry.dispose(); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]; materials.forEach((material) => material.dispose());
  }
}
function draw(now: number): void {
  frame = 0;
  const dt = previous ? Math.min(.05, (now - previous) / 1000) : .016; previous = now;
  for (const preview of previews) {
    if (!preview.canvas.isConnected) { release(preview); continue; }
    const rect = preview.canvas.getBoundingClientRect();
    if (!rect.width || rect.bottom < 0 || rect.top > window.innerHeight) continue;
    try {
      if (!renderer) { renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); renderer.setSize(450, 200, false); renderer.setClearColor(0, 0); }
      if (!preview.pointer) {
        const phase = ((now - preview.born) % 2200) / 2200;
        const t = Math.min(1, phase / .65);
        preview.points = Array.from({ length: 16 }, (_, i) => {
          const p = Math.max(0, t - (15 - i) * .035);
          return new Vector3(-3.4 + p * 6.8, .2, Math.sin(p * Math.PI) * 1.25 - .55);
        });
        if (phase > .82) preview.points = [];
      }
      preview.trail.sync(preview.points); preview.trail.update(dt);
      scene.clear(); scene.add(preview.trail.line, preview.trail.glowLine, preview.trail.sparks);
      renderer.render(scene, camera);
      const ctx = preview.canvas.getContext('2d');
      if (ctx) { ctx.clearRect(0, 0, 450, 200); ctx.drawImage(renderer.domElement, 0, 0); }
    } catch { release(preview); preview.canvas.remove(); }
  }
  if (previews.size) frame = requestAnimationFrame(draw);
  else { renderer?.dispose(); renderer?.forceContextLoss(); renderer = null; previous = 0; }
}
