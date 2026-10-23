/** Visual-only prediction. Server positions remain authoritative for combat. */
export class NetworkMotion {
  private value = 0;
  private speed = 0;
  private at = 0;
  private correction = 0;
  private stamp: string | number | undefined;

  update(value: number, speed: number, stamp: string | number, now: number): void {
    if (stamp === this.stamp) return;
    const previous = this.stamp === undefined ? value : this.sample(now);
    this.value = value;
    this.speed = speed;
    this.at = now;
    this.correction = previous - value;
    this.stamp = stamp;
  }

  sample(now: number): number {
    const elapsed = Math.max(0, (now - this.at) / 1000);
    // Cover the 900 ms polling fallback plus normal jitter, then stop rather
    // than simulating an indefinitely disconnected match.
    return this.value + this.speed * Math.min(1.2, elapsed)
      + this.correction * Math.exp(-elapsed / .16);
  }
}
