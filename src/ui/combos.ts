import './gameFeel.css';
import './slicerPreview';

type Slot = 'hit' | 'streak' | 'reslice';

const STREAKS = [
  { n: 2, title: 'DOUBLE SLICE!' },
  { n: 3, title: 'TRIPLE SLICE!' },
  { n: 5, title: 'MULTISLICER!' },
  { n: 8, title: 'ULTRASLICE!' },
  { n: 15, title: 'UNSTOPPABLE!' },
  { n: 20, title: 'MEGASLICER!' },
  { n: 30, title: 'MONSTERSLICER!' },
  { n: 50, title: 'GODLIKE CUT!' },
];

const LIVE_WINDOW = 2.85;
const STACK_MAX = 3;

type Floater = {
  el: HTMLElement;
  age: number;
};

export type ComboFocusDetail = { intensity: number; combo: number };

/** Optional hook used by main.ts for camera shake / vignette. */
export let onComboFocus: ((detail: ComboFocusDetail) => void) | null = null;

export function setComboFocusHandler(handler: ((detail: ComboFocusDetail) => void) | null): void {
  onComboFocus = handler;
}

export class ComboFx {
  private readonly layer: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly avEl: HTMLImageElement;
  private readonly comboMeter: HTMLElement;
  private readonly stacks: Record<Slot, Floater[]> = { hit: [], streak: [], reslice: [] };
  private window = 0;
  private kills = 0;
  private lastTier = 0;
  private lastFocusAt = 0;

  constructor() {
    this.layer = document.getElementById('combo-layer')!;
    this.nameEl = document.getElementById('player-name')!;
    this.avEl = document.getElementById('player-avatar') as HTMLImageElement;
    this.comboMeter = document.createElement('div');
    this.comboMeter.className = 'combo-meter is-idle';
    this.comboMeter.innerHTML =
      '<span class="combo-meter__label">COMBO</span><strong class="combo-meter__value">x0</strong>';
    this.comboMeter.setAttribute('aria-hidden', 'true');
    this.layer.appendChild(this.comboMeter);

    if (!document.getElementById('combo-focus-vignette')) {
      const vig = document.createElement('div');
      vig.id = 'combo-focus-vignette';
      vig.setAttribute('aria-hidden', 'true');
      this.layer.appendChild(vig);
    }
  }

  setPlayer(name: string, avatar: string) {
    this.nameEl.textContent = name;
    this.avEl.src = avatar;
  }

  reset() {
    this.window = 0;
    this.kills = 0;
    this.lastTier = 0;
    this.setMeter(0);
    this.clearStacks();
    this.setFocus(0, 0);
  }

  update(dt: number) {
    if (this.window > 0) {
      this.window -= dt;
      if (this.window <= 0) {
        this.kills = 0;
        this.lastTier = 0;
        this.setMeter(0);
      }
    }
    for (const slot of Object.keys(this.stacks) as Slot[]) {
      const list = this.stacks[slot];
      for (const f of list) f.age += dt;
      // Cull fully faded floaters (animation ~2.6s + stack hold)
      while (list.length && list[list.length - 1]!.age > 3.2) {
        const old = list.pop()!;
        old.el.remove();
      }
    }
  }

  onHits(n: number, combo: number) {
    if (n <= 0) return;
    this.window = LIVE_WINDOW;
    this.setMeter(combo);
    this.push('hit', `${n > 1 ? `+${n} HITS` : 'SLICE!'} · x${combo}`, comboColor(combo), 'hit-pop');
    if (n >= 3) {
      this.push('streak', `${n}X MULTISLICE!`, comboColor(combo), 'streak-pop');
    }
    this.maybeFocus(combo);
  }

  onReslice(n: number, nx?: number, ny?: number) {
    if (n <= 0) return;
    this.push('reslice', `RESLICE x${n}`, n >= 2 ? '#4ade80' : '#86efac', 'reslice-pop', nx, ny);
  }

  onKills(n: number) {
    if (n <= 0) return;
    this.window = LIVE_WINDOW;
    this.kills += n;
    let title = '';
    let tier = 0;
    for (const s of STREAKS) {
      if (this.kills >= s.n) {
        title = s.title;
        tier = s.n;
      }
    }
    if (title && tier > this.lastTier) {
      this.lastTier = tier;
      this.push('streak', title, comboColor(this.kills), 'streak-pop');
      this.maybeFocus(Math.max(tier, this.kills));
    }
  }

  private setMeter(combo: number) {
    const value = this.comboMeter.querySelector('.combo-meter__value');
    if (value) value.textContent = `x${Math.max(0, combo)}`;
    const idle = combo <= 0;
    this.comboMeter.classList.toggle('is-idle', idle);
    this.comboMeter.classList.toggle('is-hidden', idle);
    this.comboMeter.classList.toggle('is-hot', combo >= 5);
    this.comboMeter.classList.toggle('is-super-hot', combo >= 12);
    this.comboMeter.setAttribute('aria-hidden', idle ? 'true' : 'false');
  }

  private maybeFocus(combo: number) {
    if (combo < 8) return;
    const now = performance.now();
    if (now - this.lastFocusAt < 280) return;
    this.lastFocusAt = now;
    const intensity = combo >= 12 ? 1 : 0.55;
    this.setFocus(intensity, combo);
    const detail: ComboFocusDetail = { intensity, combo };
    onComboFocus?.(detail);
    window.dispatchEvent(new CustomEvent('fruittd-combo-focus', { detail }));
  }

  private setFocus(intensity: number, combo: number) {
    const vig = document.getElementById('combo-focus-vignette');
    if (!vig) return;
    if (intensity <= 0) {
      vig.classList.remove('is-on', 'is-hot', 'is-super');
      return;
    }
    vig.classList.add('is-on');
    vig.classList.toggle('is-hot', combo >= 8 && combo < 12);
    vig.classList.toggle('is-super', combo >= 12);
    // Auto clear after a beat so it pulses with combos
    window.setTimeout(() => {
      if (!this.comboMeter.classList.contains('is-super-hot') && !this.comboMeter.classList.contains('is-hot')) {
        vig.classList.remove('is-on', 'is-hot', 'is-super');
      } else if (combo < 8) {
        vig.classList.remove('is-on', 'is-hot', 'is-super');
      }
    }, 900);
  }

  private push(slot: Slot, text: string, color: string, cls: string, nx?: number, ny?: number) {
    const list = this.stacks[slot];
    // Shift existing floaters up the stack
    for (let i = 0; i < list.length; i++) {
      const f = list[i]!;
      const depth = i + 1;
      f.el.classList.remove('is-stack-0', 'is-stack-1', 'is-stack-2');
      f.el.classList.add(`is-stack-${Math.min(depth, 2)}`, 'is-stacked');
      f.el.classList.remove('is-live', 'is-swap');
    }

    const el = document.createElement('div');
    el.className = `${cls} is-live is-stack-0`;
    el.textContent = text;
    el.style.color = color;
    if (nx != null && ny != null) {
      el.style.left = `${nx}%`;
      el.style.top = `${ny}%`;
    }
    this.layer.appendChild(el);
    list.unshift({ el, age: 0 });

    while (list.length > STACK_MAX) {
      const old = list.pop()!;
      old.el.remove();
    }
  }

  private clearStacks() {
    for (const slot of Object.keys(this.stacks) as Slot[]) {
      for (const f of this.stacks[slot]) f.el.remove();
      this.stacks[slot] = [];
    }
  }
}

function comboColor(n: number) {
  if (n >= 50) return '#f8fafc';
  if (n >= 30) return '#ef4444';
  if (n >= 20) return '#f97316';
  if (n >= 12) return '#ef4444';
  if (n >= 8) return '#f97316';
  if (n >= 5) return '#fbbf24';
  if (n >= 3) return '#34d399';
  return '#93c5fd';
}
