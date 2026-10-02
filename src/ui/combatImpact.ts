export type CombatImpactKind = 'leak' | 'blast' | 'stomp' | 'boss';

/** Screen-space combat accents stay outside the input layer and expire independently. */
export class CombatImpact {
  private readonly timers = new Map<CombatImpactKind, ReturnType<typeof setTimeout>>();

  constructor(private readonly element: HTMLElement | null) {}

  trigger(kind: CombatImpactKind): void {
    if (!this.element) return;
    const name = `impact-${kind}`;
    this.element.classList.remove(name);
    // Restart the animation on successive hits, including hits in one frame.
    void this.element.offsetWidth;
    this.element.classList.add(name);
    const pending = this.timers.get(kind);
    if (pending) clearTimeout(pending);
    this.timers.set(kind, setTimeout(() => {
      this.element?.classList.remove(name);
      this.timers.delete(kind);
    }, kind === 'blast' ? 370 : 460));
  }

  clear(): void {
    for (const timeout of this.timers.values()) clearTimeout(timeout);
    this.timers.clear();
    this.element?.classList.remove('impact-leak', 'impact-blast', 'impact-stomp', 'impact-boss');
  }
}
