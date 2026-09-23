/**
 * Floating combat score popups.
 * Pooled DOM nodes prevent memory allocations and DOM thrashing during high-combo play.
 */

export type FloatingScoreType = 'normal' | 'critical' | 'special' | 'boss' | 'reslice' | 'combo';

interface FloatingNode {
  el: HTMLElement;
  active: boolean;
  life: number;
  maxLife: number;
  x: number;
  y: number;
  vy: number;
  amount: number;
}

export class FloatingScoreManager {
  private container: HTMLElement | null = null;
  private readonly pool: FloatingNode[] = [];
  private readonly POOL_SIZE = 4;

  constructor() {
    this.ensureContainer();
  }

  private ensureContainer(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    if (this.container && document.body.contains(this.container)) return this.container;

    let parent = document.getElementById('combo-layer') || document.getElementById('game-ui') || document.body;
    let el = document.getElementById('floating-score-layer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'floating-score-layer';
      el.className = 'floating-score-layer';
      el.dataset.testid = 'combat-score-layer';
      el.setAttribute('aria-hidden', 'true');
      parent.appendChild(el);
    }
    this.container = el;

    if (this.pool.length === 0) {
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const item = document.createElement('div');
        item.className = 'floating-score-item is-idle';
        item.dataset.testid = `combat-score-tick-${i}`;
        el.appendChild(item);
        this.pool.push({
          el: item,
          active: false,
          life: 0,
          maxLife: 0.85,
          x: 50,
          y: 50,
          vy: -32,
          amount: 0,
        });
      }
    }
    return this.container;
  }

  spawn(text: string, nx: number, ny: number, type: FloatingScoreType = 'normal'): void {
    this.ensureContainer();
    if (![nx, ny].every(Number.isFinite)) return;
    const amount = /^\+(\d+)$/.exec(text)?.[1];
    const nearby = amount && this.pool.find((n) => n.active && n.maxLife - n.life < 0.16 && n.amount > 0 && Math.abs(n.x - nx) < 10 && Math.abs(n.y - (ny - 3)) < 7);
    if (nearby) {
      nearby.amount += Number(amount);
      nearby.el.textContent = `+${nearby.amount}`;
      return;
    }
    const node = this.pool.find((n) => !n.active);
    if (!node) return;

    node.active = true;
    node.maxLife = type === 'boss' ? 0.7 : 0.55;
    node.life = node.maxLife;
    node.x = Math.max(10, Math.min(90, nx));
    node.y = Math.max(16, Math.min(82, ny - 3));
    node.vy = -3;
    node.amount = Number(amount) || 0;

    const el = node.el;
    el.className = `floating-score-item is-active score-type-${type}`;
    el.textContent = text;
    el.style.left = `${node.x}%`;
    el.style.top = `${node.y}%`;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, -50%)';
  }

  update(dt: number): void {
    for (const node of this.pool) {
      if (!node.active) continue;
      node.life -= dt;
      if (node.life <= 0) {
        node.active = false;
        node.el.className = 'floating-score-item is-idle';
        node.el.style.opacity = '0';
        continue;
      }
      const progress = 1 - node.life / node.maxLife;
      // Float upward
      node.y += node.vy * dt * (1 - progress * 0.4);
      node.el.style.top = `${node.y}%`;

      node.el.style.opacity = `${Math.min(1, Math.max(0, (1 - progress) / 0.55))}`;
    }
  }

  reset(): void {
    for (const node of this.pool) {
      node.active = false;
      node.life = 0;
      node.el.className = 'floating-score-item is-idle';
      node.el.style.opacity = '0';
    }
  }
}

export const floatingScore = new FloatingScoreManager();
