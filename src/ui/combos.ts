import './gameFeel.css';
import './slicerPreview';
import { COMBAT_COMBO_STREAKS } from '../game/progression/combo';

type Slot = 'hit' | 'streak' | 'reslice';

export const STREAKS = COMBAT_COMBO_STREAKS;

const LIVE_WINDOW = 1.1;

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
  private readonly rail: HTMLElement;
  private readonly stacks: Record<Slot, Floater[]> = { hit: [], streak: [], reslice: [] };
  private window = 0;
  private kills = 0;
  private lastFocusAt = 0;
  private bonusScore = 0;

  constructor() {
    this.layer = document.getElementById('combo-layer')!;
    this.nameEl = document.getElementById('player-name')!;
    this.avEl = document.getElementById('player-avatar') as HTMLImageElement;
    this.nameEl.dataset.testid = 'combat-player-name';
    this.avEl.dataset.testid = 'combat-player-avatar';
    this.rail = document.createElement('div');
    this.rail.className = 'combat-feedback';
    this.rail.dataset.testid = 'combat-feedback';
    this.layer.appendChild(this.rail);
    this.comboMeter = document.createElement('div');
    this.comboMeter.className = 'combo-meter is-idle';
    this.comboMeter.dataset.testid = 'combat-combo-meter';
    this.comboMeter.innerHTML =
      '<span class="combo-meter__label" data-testid="combat-combo-label">CHAIN</span><strong class="combo-meter__value" data-testid="combat-combo-count">×0</strong><i class="combo-meter__timer" data-testid="combat-combo-timer" aria-hidden="true"></i>';
    this.comboMeter.setAttribute('aria-hidden', 'true');
    this.rail.appendChild(this.comboMeter);
  }

  setPlayer(name: string, avatar: string) {
    this.nameEl.textContent = name;
    this.avEl.src = avatar;
  }

  reset() {
    this.window = 0;
    this.kills = 0;
    this.bonusScore = 0;
    this.lastFocusAt = 0;
    this.setMeter(0);
    this.clearStacks();
    this.setFocus(0, 0);
  }

  update(dt: number, combo = 0, remaining = 0) {
    this.setMeter(combo);
    this.comboMeter.style.setProperty('--combo-time', String(Math.max(0, Math.min(1, remaining / 1.65))));
    if (this.window > 0) {
      this.window -= dt;
      if (this.window <= 0) {
        this.kills = 0;
        this.bonusScore = 0;
      }
    }
    for (const slot of Object.keys(this.stacks) as Slot[]) {
      const list = this.stacks[slot];
      for (const f of list) f.age += dt;
      while (list.length && list[list.length - 1]!.age > 0.85) {
        const old = list.pop()!;
        old.el.remove();
      }
    }
  }

  onHits(n: number, combo: number) {
    if (n <= 0) return;
    this.setMeter(combo);
    // Hits advance the one chain meter. They are not kills and need no banner.
    this.maybeFocus(combo);
  }

  onReslice(n: number, _nx?: number, _ny?: number) {
    if (n <= 0) return;
    if (this.kills < 2 && this.bonusScore === 0) {
      this.push('reslice', n >= 2 ? 'RESLICE II' : 'RESLICE', 'var(--ftd-color-success)', 'combat-feedback__notice');
    }
  }

  onKills(n: number) {
    if (n <= 0) return;
    this.window = LIVE_WINDOW;
    this.kills += n;
    if (this.kills >= 2) this.showSummary();
  }

  onMilestone(score: number): void {
    this.window = LIVE_WINDOW;
    this.bonusScore += Math.max(0, Math.round(score));
    this.showSummary();
  }

  private showSummary(): void {
    const killText = this.kills >= 2 ? `${this.kills} KILLS` : '';
    const bonusText = this.bonusScore ? `CHAIN +${this.bonusScore}` : '';
    this.push('streak', [killText, bonusText].filter(Boolean).join(' · '), 'var(--ftd-color-primary)', 'combat-feedback__notice');
  }

  private setMeter(combo: number) {
    const value = this.comboMeter.querySelector('.combo-meter__value');
    if (value) value.textContent = `×${Math.max(0, combo)}`;
    this.comboMeter.dataset.combo = String(Math.max(0, combo));
    const idle = combo <= 0;
    this.comboMeter.classList.toggle('is-idle', idle);
    this.comboMeter.classList.toggle('is-hidden', idle);
    this.comboMeter.classList.toggle('is-hot', combo >= 5);
    this.comboMeter.classList.toggle('is-super-hot', combo >= 12);
    this.comboMeter.setAttribute('aria-hidden', idle ? 'true' : 'false');
  }

  private maybeFocus(combo: number) {
    if (combo < 12 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const now = performance.now();
    if (now - this.lastFocusAt < 1000) return;
    this.lastFocusAt = now;
    const intensity = combo >= 25 ? 0.16 : 0.08;
    this.setFocus(intensity, combo);
    const detail: ComboFocusDetail = { intensity, combo };
    onComboFocus?.(detail);
    window.dispatchEvent(new CustomEvent('fruittd-combo-focus', { detail }));
  }

  private setFocus(_intensity: number, _combo: number) {
    const vig = document.getElementById('combo-focus-vignette');
    if (!vig) return;
    // Never blur/darken enemies because the player is doing well.
    vig.classList.remove('is-on', 'is-hot', 'is-super');
  }

  private push(_slot: Slot, text: string, color: string, _cls: string) {
    // One shared, reusable notification: no hit/streak/reslice stacks.
    const list = this.stacks.streak;
    let current = list[0];
    if (!current) {
      const el = document.createElement('div');
      el.dataset.testid = 'combat-feedback-notice';
      el.className = 'combat-feedback__notice';
      this.rail.appendChild(el);
      current = { el, age: 0 };
      list.push(current);
    }
    current.age = 0;
    current.el.textContent = text;
    current.el.style.color = color;
  }

  private clearStacks() {
    for (const slot of Object.keys(this.stacks) as Slot[]) {
      for (const f of this.stacks[slot]) f.el.remove();
      this.stacks[slot] = [];
    }
  }
}

