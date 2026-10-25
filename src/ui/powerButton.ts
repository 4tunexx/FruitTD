import { powerStats } from '../game/powerCombat';
import { heroAbility } from '../game/heroAbilities';
import { powerIconSource } from './powerIcons';
import { el } from './components/dom';

/** Absolute deadlines keep the sweep in sync across server snapshots and rerenders. */
export function cooldownProgress(readyAt: number, duration: number, now = Date.now()): number {
  return Math.max(0, Math.min(1, 1 - Math.max(0, readyAt - now) / Math.max(1, duration)));
}

export function updatePowerButton(button: HTMLButtonElement, id: string, readyAt: number, funds = Infinity, busy = false, resource:'juice'|'fruts'='juice',rank=1): void {
  const ability = heroAbility(id);
  if (!ability) return;
  const stats=powerStats(ability,rank);
  const now = Date.now(), wait = Math.max(0, readyAt - now);
  const progress = cooldownProgress(readyAt, stats.cooldownMs, now);
  button.disabled = busy || wait > 0 || funds < ability.juiceCost;
  button.classList.toggle('is-recharging', wait > 0);
  button.classList.toggle('is-ready', !button.disabled);
  button.style.setProperty('--charge', `${progress * 100}%`);
  // Negative delay resumes the same animation when an online snapshot replaces DOM.
  if (button.dataset.readyAt !== String(readyAt)) {
    button.dataset.readyAt = String(readyAt);
    button.style.setProperty('--recharge-duration', `${stats.cooldownMs}ms`);
    button.style.setProperty('--recharge-delay', `${-progress * stats.cooldownMs}ms`);
  }
  const status = wait ? `${Math.ceil(wait / 1000)}s` : ability.juiceCost ? `${ability.juiceCost} ${resource==='juice'?'J':'F'}` : 'READY';
  const label = button.querySelector('.hero-ability-slot__cooldown')!;
  if (label.textContent !== status) label.textContent = status;
  button.title = `${ability.name} · ${status} · ${Math.round(stats.damage)} close-range damage · ${ability.description}`;
  button.setAttribute('aria-label', `${ability.name}, ${wait ? `recharging, ${Math.ceil(wait / 1000)} seconds` : funds < ability.juiceCost ? `not enough ${resource}` : 'ready'}`);
}

export function powerButton(id: string, onUse: () => void): HTMLButtonElement {
  const ability = heroAbility(id)!;
  const button = el('button', { type:'button', class:'hero-ability-slot', 'data-power':id, 'data-no-count':'' }, [
    el('span', { class:'hero-ability-slot__portrait', 'aria-hidden':'true' }, [
      el('img', { class:'hero-ability-slot__icon', src:powerIconSource(id, ability.iconUrl), alt:'', draggable:'false', 'data-power-icon':id, 'data-power-default':ability.iconUrl }),
      el('span', { class:'hero-ability-slot__sweep' }),
    ]),
    el('span', { class:'hero-ability-slot__name', text:ability.name }),
    el('span', { class:'hero-ability-slot__cooldown' }),
  ]);
  const palette:Record<string,[string,string]>={shock:['#ffd05e','#ffd05e66'],frost:['#8ce9ff','#8ce9ff66'],burst:['#ff8a68','#ff8a6866'],pierce:['#cda5ff','#cda5ff66'],bloom:['#ec8bca','#ec8bca66'],guard:['#94e8a5','#94e8a566']};
  button.style.setProperty('--power-color',palette[ability.effect][0]);button.style.setProperty('--power-glow',palette[ability.effect][1]);
  button.addEventListener('click', () => {
    if (button.disabled) return;
    button.classList.add('is-casting');
    window.setTimeout(() => button.classList.remove('is-casting'), 360);
    onUse();
  });
  return button;
}

export function installPowerHotkeys(): void {
  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || !(event.key === '1' || event.key === '2' || event.key === '3')) return;
    if ((event.target as HTMLElement | null)?.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]')) return;
    const powers = [...document.querySelectorAll<HTMLButtonElement>('.hero-ability-slot[data-power]')].filter(button => button.getClientRects().length > 0);
    const button = powers[Number(event.key)-1];
    if (button && !button.disabled) { event.preventDefault(); button.click(); }
  });
}
