/** Per-gesture contact ownership, retained across animation-frame slash chunks. */
export class StrokeContacts {
  private id: number | null = null;
  private readonly targets = new Map<object, number>();
  connected = false;
  attempted = false;
  private debrisSerial = 0;

  begin(id: number, halves: readonly { spawnSerial?: number }[] = []): void {
    if (this.id === id) return;
    this.reset();
    this.id = id;
    this.attempted = true;
    this.debrisSerial = 0;
    for (const half of halves) this.debrisSerial = Math.max(this.debrisSerial, half.spawnSerial ?? 0);
  }

  has(target: { spawnSerial?: number }): boolean {
    return this.targets.get(target) === (target.spawnSerial ?? 0);
  }

  add(target: { spawnSerial?: number }): void {
    this.targets.set(target, target.spawnSerial ?? 0);
    this.connected = true;
  }

  canReslice(target: { spawnSerial?: number }): boolean {
    return (target.spawnSerial ?? 0) <= this.debrisSerial;
  }

  missed(id: number): boolean {
    return this.id === id && this.attempted && !this.connected;
  }

  reset(): void {
    this.id = null;
    this.targets.clear();
    this.connected = false;
    this.attempted = false;
  }
}