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

const CLEAR = new Color(0xdce8d4);

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
  private lookZ = 0.4;
  private readonly composer: EffectComposer;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setClearColor(CLEAR, 1);
    this.renderer.outputColorSpace = 'srgb';
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new Scene();
    this.scene.background = CLEAR.clone();
    this.scene.fog = new Fog(0xdce8d4, 24, 52);

    const aspect = window.innerWidth / window.innerHeight;
    const viewW = this.viewH * aspect;
    this.camera = new OrthographicCamera(-viewW / 2, viewW / 2, this.viewH / 2, -this.viewH / 2, 0.1, 90);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(0, 0.2, this.lookZ);

    // Lighting — ambient + key (warm) + fill (cool rim)
    this.scene.add(new AmbientLight(0xffffff, 0.85));
    const key = new DirectionalLight(0xfff6e8, 0.72);
    key.position.set(6, 18, -8);
    this.scene.add(key);
    const fill = new DirectionalLight(0xc8e8ff, 0.28);
    fill.position.set(-8, 10, 12);
    this.scene.add(fill);

    // Post-processing: Bloom → Output
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(
      new Vector2(window.innerWidth, window.innerHeight),
      0.38,  // strength
      0.55,  // radius
      0.72,  // threshold — only very bright emissive bits glow
    );
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    const aspect = w / h;
    const viewW = this.viewH * aspect;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = this.viewH / 2;
    this.camera.bottom = -this.viewH / 2;
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
    this.shakeVel += amount * 0.5;
    this.shakeAmp = Math.max(this.shakeAmp, amount * 0.05);
  }

  update(dt: number): void {
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
