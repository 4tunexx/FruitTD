import { Vector3, type Camera } from 'three';
import type { Fruit } from '../game/fruits';

const point = new Vector3();

/** A single readable screen-space rail for enemies that have actually taken damage. */
export class EnemyHealthOverlay {
  private readonly layer = document.createElement('div');
  private readonly bars = new Map<Fruit, HTMLElement>();

  constructor() {
    this.layer.id = 'enemy-health-layer';
    this.layer.setAttribute('aria-hidden', 'true');
    document.getElementById('app')?.appendChild(this.layer);
  }

  update(fruits: readonly Fruit[], camera: Camera, canvas: HTMLCanvasElement, active: boolean): void {
    const rect = canvas.getBoundingClientRect();
    const visible = new Set<Fruit>();
    if (active && rect.width && rect.height) for (const fruit of fruits) {
      if (!fruit.alive || fruit.hp <= 0 || fruit.hp >= fruit.maxHp) continue;
      point.copy(fruit.group.position);
      point.y += fruit.boss ? 2.2 : 1.45;
      point.project(camera);
      if (point.x < -1 || point.x > 1 || point.y < -1 || point.y > 1) continue;
      visible.add(fruit);
      let bar = this.bars.get(fruit);
      if (!bar) {
        bar = document.createElement('div');
        bar.className = 'enemy-health-rail';
        bar.innerHTML = '<i></i>';
        this.layer.appendChild(bar);
        this.bars.set(fruit, bar);
      }
      bar.classList.toggle('is-boss', fruit.boss);
      bar.style.left = `${rect.left + (point.x + 1) * rect.width / 2}px`;
      bar.style.top = `${rect.top + (1 - point.y) * rect.height / 2}px`;
      bar.firstElementChild!.setAttribute('style', `width:${Math.max(0, Math.min(100, fruit.hp / fruit.maxHp * 100))}%`);
    }
    for (const [fruit, bar] of this.bars) if (!visible.has(fruit)) { bar.remove(); this.bars.delete(fruit); }
  }
}
