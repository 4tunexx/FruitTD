import { IMPACT_FREEZE, SIM_DT } from '../game/world';

export class GameLoop {
  private last = performance.now();
  private acc = 0;
  private freeze = 0;
  private frames = 0;
  private fpsClock = 0;
  fps = 60;
  running = true;
  private raf = 0;

  constructor(
    private readonly simulate: (dt: number) => void,
    private readonly draw: () => void,
    private readonly afterFrame?: (dt: number) => void,
  ) {}

  start(): void {
    this.last = performance.now();
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > 0.05) dt = 0.05;

      this.frames += 1;
      this.fpsClock += dt;
      if (this.fpsClock >= 0.4) {
        this.fps = this.frames / this.fpsClock;
        this.frames = 0;
        this.fpsClock = 0;
      }

      if (this.freeze > 0) {
        this.freeze -= dt;
        this.draw();
        this.afterFrame?.(dt);
        return;
      }

      if (this.running) {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= SIM_DT && steps < 5) {
          this.simulate(SIM_DT);
          this.acc -= SIM_DT;
          steps += 1;
        }
        if (steps >= 5) this.acc = 0;
      }

      this.draw();
      this.afterFrame?.(dt);
    };
    this.raf = requestAnimationFrame(tick);
  }

  impactFrame(): void {
    this.freeze = IMPACT_FREEZE;
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }
}
