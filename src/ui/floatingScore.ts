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
}

export class FloatingScoreManager {
  private container: HTMLElement | null = null;
  private readonly pool: FloatingNode[] = [];
  private readonly POOL_SIZE = 24;

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
      el.setAttribute('aria-hidden', 'true');
      parent.appendChild(el);
    }
    this.container = el;

    if (this.pool.length === 0) {
      for (let i = 0; i < this.POOL_SIZE; i++) {
        const item = document.createElement('div');
        item.className = 'floating-score-item is-idle';
        el.appendChild(item);
        this.pool.push({
          el: item,
          active: false,
          life: 0,
          maxLife: 0.85,
          x: 50,
          y: 50,
          vy: -32,
        });
      }
    }
    return this.container;
  }

  spawn(text: string, nx: number, ny: number, type: FloatingScoreType = 'normal'): void {
    this.ensureContainer();
    const node = this.pool.find((n) => !n.active) || this.pool[0];
    if (!node) return;

    node.active = true;
    node.maxLife = type === 'boss' || type === 'critical' ? 1.15 : 0.85;
    node.life = node.maxLife;
    node.x = Math.max(8, Math.min(92, nx + (Math.random() - 0.5) * 4));
    node.y = Math.max(12, Math.min(88, ny + (Math.random() - 0.5) * 3));
    node.vy = type === 'boss' ? -22 : -36;

    const el = node.el;
    el.className = `floating-score-item is-active score-type-${type}`;
    el.textContent = text;
    el.style.left = `${node.x}%`;
    el.style.top = `${node.y}%`;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, -50%) scale(1.15)';
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

      if (progress < 0.2) {
        const t = progress / 0.2;
        node.el.style.transform = `translate(-50%, -50%) scale(${1 + t * 0.25})`;
        node.el.style.opacity = '1';
      } else if (progress > 0.6) {
        const fade = (1 - progress) / 0.4;
        node.el.style.opacity = `${Math.max(0, fade)}`;
        node.el.style.transform = `translate(-50%, -50%) scale(${1.25 - (progress - 0.6) * 0.35})`;
      } else {
        node.el.style.opacity = '1';
        node.el.style.transform = 'translate(-50%, -50%) scale(1.25)';
      }
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
