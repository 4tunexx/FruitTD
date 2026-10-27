/** Client-side motion between authoritative Arena snapshots. */
export class NetworkMotion2D {
  private x = 0; private y = 0;
  private vx = 0; private vy = 0;
  private at = 0; private offsetX = 0; private offsetY = 0;
  private stamp: number | string | undefined;
  private fromX = 0; private fromY = 0; private duration = .1;
  constructor(private readonly interpolateOnly = false) {}

  update(x: number, y: number, maxSpeed: number, stamp: number | string, now: number, halted = false): void {
    if (stamp === this.stamp) return;
    const previous = this.stamp === undefined ? { x, y } : this.sample(now);
    const elapsed = Math.max(.05, (now - this.at) / 1000);
    if (this.interpolateOnly) {
      this.fromX = previous.x; this.fromY = previous.y;
      const distance = Math.hypot(x - previous.x, y - previous.y);
      this.duration = Math.max(.1, Math.min(1, elapsed), distance / Math.max(.1, maxSpeed));
      this.x = x; this.y = y; this.at = now; this.stamp = stamp;
      return;
    }
    const dx = x - this.x, dy = y - this.y;
    const distance = Math.hypot(dx, dy);
    const speed = this.stamp === undefined || halted || elapsed > 1.5 ? 0 : Math.min(maxSpeed, distance / elapsed);
    this.vx = distance ? dx / distance * speed : 0;
    this.vy = distance ? dy / distance * speed : 0;
    this.x = x; this.y = y; this.at = now;
    this.offsetX = previous.x - x; this.offsetY = previous.y - y;
    this.stamp = stamp;
  }

  sample(now: number): { x: number; y: number } {
    const elapsed = Math.max(0, (now - this.at) / 1000);
    if (this.interpolateOnly) {
      const t = Math.min(1, elapsed / this.duration);
      return { x: this.fromX + (this.x - this.fromX) * t, y: this.fromY + (this.y - this.fromY) * t };
    }
    const prediction = Math.min(elapsed, 1.2);
    const correction = Math.exp(-elapsed / .25);
    return { x: this.x + this.vx * prediction + this.offsetX * correction,
      y: this.y + this.vy * prediction + this.offsetY * correction };
  }
}
