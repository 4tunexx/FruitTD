import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  OrthographicCamera,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ARENA_W } from '../game/world';

const CLEAR = new Color(0x4a5f3e);

/** Preserve all spawn lanes at default zoom, including narrow portrait screens. */
export function arenaFrustum(width: number, height: number, zoomHeight = 20) {
  const aspect = Math.max(1, width) / Math.max(1, height);
  const viewHeight = Math.max(20, (ARENA_W + 2) / aspect) * (zoomHeight / 20);
  const viewWidth = viewHeight * aspect;
  return { left: -viewWidth / 2, right: viewWidth / 2, top: viewHeight / 2, bottom: -viewHeight / 2 };
}

export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  readonly cameraBase = new Vector3(0, 26, -14);
  panX = 0;
  panZ = 0;
  viewH = 20;

  private readonly shake = new Vector3();
  private shakeVel = 0;
  private shakeAmp = 0;
  private blastKick = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private lookZ = 0.4;
  private readonly composer: EffectComposer;
  private readonly ambientLight = new AmbientLight(0xe8f4dc, 0.92);
  private readonly keyLight = new DirectionalLight(0xfff4d8, 0.85);

  constructor(canvas: HTMLCanvasElement) {
    this.installCameraControls(canvas);
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const isMobile = window.matchMedia('(max-width: 860px), (pointer: coarse)').matches;
    const isLowMemory = typeof deviceMemory === 'number' && deviceMemory <= 4;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: !isMobile && !isLowMemory,
      powerPreference: isMobile || isLowMemory ? 'low-power' : 'high-performance',
      alpha: false,
    });
    this.renderer.setClearColor(CLEAR, 1);
    this.renderer.outputColorSpace = 'srgb';
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile || isLowMemory ? 1 : 1.5));

    this.scene = new Scene();
    this.scene.background = CLEAR.clone();
    this.scene.fog = new Fog(0x3a4d32, 28, 58);

    const aspect = window.innerWidth / window.innerHeight;
    const viewW = this.viewH * aspect;
    this.camera = new OrthographicCamera(-viewW / 2, viewW / 2, this.viewH / 2, -this.viewH / 2, 0.1, 90);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(0, 0.2, this.lookZ);

    // Lighting — ambient + key (warm sun) + fill (cool sky)
    this.scene.add(this.ambientLight);
    this.keyLight.position.set(8, 22, -10);
    this.scene.add(this.keyLight);
    const fill = new DirectionalLight(0xa8d8f0, 0.35);
    fill.position.set(-9, 14, 14);
    this.scene.add(fill);
    window.addEventListener('fruit-td-landscape-update', (event) => {
      const config = (event as CustomEvent<Partial<{ skyColor: string; ambientLight: number; sunLight: number }>>).detail;
      if (!config) return;
      if (typeof config.skyColor === 'string' && /^#[0-9a-f]{6}$/i.test(config.skyColor)) {
        this.scene.background = new Color(config.skyColor);
        (this.scene.fog as Fog).color.set(config.skyColor);
        this.renderer.setClearColor(config.skyColor, 1);
      }
      if (Number.isFinite(config.ambientLight)) this.ambientLight.intensity = Math.max(.1, Math.min(1.5, Number(config.ambientLight)));
      if (Number.isFinite(config.sunLight)) this.keyLight.intensity = Math.max(.1, Math.min(1.5, Number(config.sunLight)));
    });

    // Post-processing: Bloom → Output
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      0.38,  // strength
      0.55,  // radius
      0.72,  // threshold — only very bright emissive bits glow
    );
    bloom.enabled = !isMobile && !isLowMemory;
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private installCameraControls(canvas: HTMLCanvasElement): void {
    type TouchPoint = { x: number; y: number };
    const activeTouches = new Map<number, TouchPoint>();
    let pinchDistance = 0;
    let pinchCenter: TouchPoint | null = null;
    let panPointer: { id: number; x: number; y: number } | null = null;
    canvas.style.touchAction = 'none';

    const distance = (a: TouchPoint, b: TouchPoint): number => Math.hypot(a.x - b.x, a.y - b.y);
    const center = (a: TouchPoint, b: TouchPoint): TouchPoint => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    const panByScreen = (dx: number, dy: number): void => {
      const height = Math.max(1, canvas.clientHeight);
      this.pan(-(dx / height) * this.viewH, (dy / height) * this.viewH);
    };
    const cancelBladePointer = (pointerId: number): void => {
      window.dispatchEvent(new PointerEvent('pointercancel', {
        bubbles: true,
        pointerId,
        pointerType: 'touch',
        isPrimary: true,
      }));
    };

    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.zoom(event.deltaY * 0.012);
    }, { passive: false });

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    // Desktop camera movement uses middle/right drag or Shift + left drag,
    // leaving an ordinary left drag available for slicing.
    canvas.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && (event.button === 1 || event.button === 2 || event.shiftKey)) {
        panPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
        canvas.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (event.pointerType !== 'touch') return;
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activeTouches.size < 2) return;
      const points = [...activeTouches.values()];
      pinchDistance = distance(points[0], points[1]);
      pinchCenter = center(points[0], points[1]);
      for (const id of activeTouches.keys()) cancelBladePointer(id);
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    canvas.addEventListener('pointermove', (event) => {
      if (panPointer?.id === event.pointerId) {
        panByScreen(event.clientX - panPointer.x, event.clientY - panPointer.y);
        panPointer.x = event.clientX;
        panPointer.y = event.clientY;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      if (event.pointerType !== 'touch' || !activeTouches.has(event.pointerId)) return;
      activeTouches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activeTouches.size < 2 || !pinchCenter) return;
      const points = [...activeTouches.values()];
      const nextDistance = distance(points[0], points[1]);
      const nextCenter = center(points[0], points[1]);
      const height = Math.max(1, canvas.clientHeight);
      this.zoom(((pinchDistance - nextDistance) / height) * this.viewH * 1.25);
      panByScreen(nextCenter.x - pinchCenter.x, nextCenter.y - pinchCenter.y);
      pinchDistance = nextDistance;
      pinchCenter = nextCenter;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    const endPointer = (event: PointerEvent): void => {
      if (panPointer?.id === event.pointerId) {
        panPointer = null;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      if (!activeTouches.has(event.pointerId)) return;
      const wasPinching = activeTouches.size > 1;
      activeTouches.delete(event.pointerId);
      if (activeTouches.size < 2) {
        pinchDistance = 0;
        pinchCenter = null;
      }
      if (wasPinching) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    canvas.addEventListener('pointerup', endPointer, true);
    canvas.addEventListener('pointercancel', endPointer, true);
    window.addEventListener('blur', () => {
      activeTouches.clear();
      panPointer = null;
      pinchDistance = 0;
      pinchCenter = null;
    });
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Portrait phones need the wall lower in the playable viewport, with room
    // for the compact top HUD. Keep landscape/desktop composition unchanged.
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    Object.assign(this.camera, arenaFrustum(w, h, this.viewH));
    // Frame the wall foot at the lower safe edge regardless of aspect ratio.
    // Solve against the actual projection because a fixed look target drifts
    // substantially between short landscape and tall portrait viewports.
    let bestZ = this.lookZ;
    let bestError = Infinity;
    for (let z = -8; z <= 18; z += 0.25) {
      this.camera.lookAt(this.panX, 0.2, z + this.panZ);
      this.camera.updateMatrixWorld();
      const screenY = (1 - new Vector3(0, 0.2, -9.2).project(this.camera).y) / 2;
      const error = Math.abs(screenY - 0.93);
      if (error < bestError) { bestError = error; bestZ = z; }
    }
    this.lookZ = bestZ;
    this.camera.lookAt(this.panX, 0.2, this.lookZ + this.panZ);
    this.camera.updateProjectionMatrix();
  }

  pan(dx: number, dz: number): void {
    this.panX = Math.max(-11, Math.min(11, this.panX + dx));
    this.panZ = Math.max(-5, Math.min(16, this.panZ + dz));
  }

  zoom(delta: number): void {
    this.viewH = Math.max(13, Math.min(28, this.viewH + delta));
    this.resize();
  }

  pulseLight(_x: number, _y: number, _z: number): void {}

  impulseShake(amount: number): void {
    if (this.reducedMotion.matches) return;
    this.shakeVel += amount * 0.5;
    this.shakeAmp = Math.max(this.shakeAmp, amount * 0.05);
  }

  /** A brief camera pullback without changing the user's persistent zoom. */
  impulseBlast(amount = 1): void {
    if (this.reducedMotion.matches) return;
    this.blastKick = Math.min(0.14, Math.max(this.blastKick, amount * 0.07));
    this.impulseShake(amount);
  }

  update(dt: number): void {
    const previousKick = this.blastKick;
    this.blastKick *= Math.exp(-dt * 8);
    if (this.blastKick < 0.0001) this.blastKick = 0;
    if (this.blastKick !== previousKick) {
      this.camera.zoom = 1 / (1 + this.blastKick);
      this.camera.updateProjectionMatrix();
    }
    this.shakeVel += -this.shakeAmp * 70 * dt;
    this.shakeVel *= Math.pow(0.86, dt * 60);
    this.shakeAmp += this.shakeVel * dt;
    if (this.shakeAmp < 0) this.shakeAmp = 0;
    this.shake.set((Math.random() - 0.5) * this.shakeAmp, 0, (Math.random() - 0.5) * this.shakeAmp);
    this.camera.position.set(
      this.cameraBase.x + this.panX + this.shake.x,
      this.cameraBase.y,
      this.cameraBase.z + this.panZ + this.shake.z,
    );
    this.camera.lookAt(this.panX + this.shake.x * 0.1, 0.2, this.lookZ + this.panZ);
  }

  render(): void {
    this.composer.render();
  }
}
