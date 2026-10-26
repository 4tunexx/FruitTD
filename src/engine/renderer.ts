import { faceCombatPortraits } from '../game/portraitFacing';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';

const CLEAR = new Color(0x202529);

export { arenaFrustum } from './combatCamera';
import { frameCombatCamera } from './combatCamera';

export function combatViewport(width:number,height:number) {
 const desktop=width>=1100&&height>=600;
 const top=desktop?78:112,bottom=desktop?100:0;
 const available=desktop?width-320:width;
 const h=Math.max(160,height-top-bottom),w=Math.min(available,h*1.05);
 return {left:Math.round((desktop?304:0)+(available-w)/2),top,width:Math.round(w),height:h};
}

export class GameRenderer {
  readonly renderer: WebGLRenderer;
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  readonly cameraBase = new Vector3(0, 26, -32);
  panX = 0;
  panZ = 0;
  viewH = 28;

  private readonly shake = new Vector3();
  private shakeVel = 0;
  private shakeAmp = 0;
  private blastKick = 0;
  private hitZoom = 0;
  private hitRoll = 0;
  private hitFocusX = 0;
  private hitFocusZ = 0;
  private hitSide = 1;
  private hitTarget: number | null = null;
  private hitStreak = 0;
  private hitHold = 0;
  private hitZoomGoal = 0;
  private hitRollGoal = 0;
  private readonly canvas: HTMLCanvasElement | null = null;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private lookZ = 0;
  private readonly ambientLight = new AmbientLight(0xe8f4dc, 0.92);
  private readonly keyLight = new DirectionalLight(0xfff4d8, 0.85);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.installCameraControls(canvas);
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const isMobile = window.matchMedia('(max-width: 860px), (pointer: coarse)').matches;
    const isLowMemory = typeof deviceMemory === 'number' && deviceMemory <= 4;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: !isMobile && !isLowMemory,
      powerPreference: isMobile || isLowMemory ? 'low-power' : 'high-performance',
      alpha: true,
    });
    this.renderer.setClearColor(CLEAR, 0);
    this.renderer.outputColorSpace = 'srgb';
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile || isLowMemory ? 1 : 1.5));

    this.scene = new Scene();
    this.scene.background = null;
    this.scene.fog = new Fog(0x3a4d32, 55, 110);

    const aspect = window.innerWidth / window.innerHeight;
    const viewW = this.viewH * aspect;
    this.camera = new OrthographicCamera(-viewW / 2, viewW / 2, this.viewH / 2, -this.viewH / 2, 0.1, 220);
    this.camera.up.set(0, 1, 0);
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
        (this.scene.fog as Fog).color.set(config.skyColor === '#4a5f3e' ? '#202529' : config.skyColor);
      }
      if (Number.isFinite(config.ambientLight)) this.ambientLight.intensity = Math.max(.1, Math.min(1.5, Number(config.ambientLight)));
      if (Number.isFinite(config.sunLight)) this.keyLight.intensity = Math.max(.1, Math.min(1.5, Number(config.sunLight)));
    });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private installCameraControls(canvas: HTMLCanvasElement): void {
    type TouchPoint = { x: number; y: number };
    const activeTouches = new Map<number, TouchPoint>();
    let pinchCenter: TouchPoint | null = null;
    let panPointer: { id: number; x: number; y: number } | null = null;
    canvas.style.touchAction = 'none';

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
      this.pan(0, -event.deltaY * 0.025);
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
      const nextCenter = center(points[0], points[1]);
      panByScreen(nextCenter.x - pinchCenter.x, nextCenter.y - pinchCenter.y);
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
      pinchCenter = null;
    });
  }

  resize(): void {
    const viewport=combatViewport(window.innerWidth,window.innerHeight);
    const w=viewport.width,h=viewport.height;
    const canvas=this.renderer.domElement;
    if(canvas){Object.assign(canvas.style,{position:'absolute',left:`${viewport.left}px`,top:`${viewport.top}px`,width:`${w}px`,height:`${h}px`});}
    if(typeof document!=='undefined'){
      const style=document.documentElement.style;
      for(const [key,value] of Object.entries(viewport))style.setProperty(`--combat-${key}`,`${value}px`);
    }
    // Portrait phones need the wall lower in the playable viewport, with room
    // for the compact top HUD. Keep landscape/desktop composition unchanged.
    this.renderer.setSize(w, h, false);
    const frame=frameCombatCamera(this.camera,w,h,this.viewH,window.innerWidth>=1100,this.panX,this.panZ);
    this.cameraBase.set(0,frame.baseY,frame.baseZ);this.lookZ=frame.lookZ;
  }

  pan(_dx: number, dz: number): void {
    this.panX = 0;
    this.panZ = Math.max(0, Math.min(12, this.panZ + dz));
    this.resize();
  }

  resetView(): void {
    this.panX = 0;
    this.panZ = 0;
    this.viewH = 28;
    this.blastKick = 0;
    this.resetHitFeedback();
    this.camera.zoom = 1;
    this.resize();
  }

  zoom(_delta: number): void {
    this.viewH = 28;
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

  /** A small, alternating lens lean toward the struck enemy. One impulse per stroke. */
  impulseHit(x: number, z: number, combo: number, target?: number): void {
    if (this.reducedMotion.matches) return;
    // Keep the chain's momentum when the blade moves to another fruit.
    // A new target shifts focus without snapping the lens back to normal.
    if (target !== undefined && target !== this.hitTarget) this.hitStreak = Math.min(this.hitStreak,Math.max(0,combo-2));
    this.hitTarget = target ?? null;
    this.hitStreak = Math.min(9, this.hitStreak + 1);
    this.hitHold = .85;
    const strength = Math.min(9, this.hitStreak);
    this.hitSide *= -1;
    this.hitZoomGoal = Math.min(.17, .023 + strength * .016 + Math.min(combo,12)*.001);
    this.hitRollGoal = this.hitSide * Math.min(.024,.004 + strength * .002);
    this.hitFocusX = Math.max(-0.5, Math.min(0.5, x * 0.09));
    this.hitFocusZ = Math.max(-0.5, Math.min(0.5, (z - this.lookZ) * 0.03));
    this.canvas?.classList.add('is-combo-focused');
  }

  releaseHitFocus(): void {
    this.hitHold = 0;
    this.hitTarget = null;
    this.hitStreak = 0;
  }

  resetHitFeedback(): void {
    this.hitZoom = 0;
    this.hitRoll = 0;
    this.hitFocusX = 0;
    this.hitFocusZ = 0;
    this.hitZoomGoal = 0; this.hitRollGoal = 0;
    this.releaseHitFocus();
    this.canvas?.classList.remove('is-combo-focused');
    this.camera.zoom = 1 / (1 + this.blastKick);
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.blastKick *= Math.exp(-dt * 8);
    if (this.blastKick < 0.0001) this.blastKick = 0;
    this.hitHold = Math.max(0,this.hitHold-dt);
    if (!this.hitHold) {this.hitZoomGoal=0;this.hitRollGoal=0;this.canvas?.classList.remove('is-combo-focused');}
    this.hitZoom += (this.hitZoomGoal-this.hitZoom)*(1-Math.exp(-dt*(this.hitHold?7:3.5)));
    this.hitRoll += (this.hitRollGoal-this.hitRoll)*(1-Math.exp(-dt*9));
    if (!this.hitHold) {this.hitFocusX *= Math.exp(-dt*3.5);this.hitFocusZ *= Math.exp(-dt*3.5);}
    if (this.hitZoom < 0.0001) this.hitZoom = 0;
    const nextZoom = (1 + this.hitZoom) / (1 + this.blastKick);
    if (Math.abs(this.camera.zoom - nextZoom) > 0.00001) {
      this.camera.zoom = nextZoom;
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
      this.cameraBase.z + this.lookZ + this.panZ + this.shake.z,
    );
    this.camera.lookAt(this.panX + this.shake.x * 0.1 + this.hitFocusX, 0.2, this.lookZ + this.panZ + this.hitFocusZ);
    if (Math.abs(this.hitRoll) > 0.00001) this.camera.rotateZ(this.hitRoll);
  }

  render(): void {
    faceCombatPortraits(this.scene,this.camera);
    this.renderer.render(this.scene, this.camera);
  }
}
