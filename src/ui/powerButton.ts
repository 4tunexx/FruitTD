import { heroAbility } from '../game/heroAbilities';
import { powerIconSource } from './powerIcons';
import { el } from './components/dom';

/** Absolute deadlines keep the sweep in sync across server snapshots and rerenders. */
export function cooldownProgress(readyAt: number, duration: number, now = Date.now()): number {
  return Math.max(0, Math.min(1, 1 - Math.max(0, readyAt - now) / Math.max(1, duration)));
}

export function updatePowerButton(button: HTMLButtonElement, id: string, readyAt: number, funds = Infinity, busy = false): void {
  const ability = heroAbility(id);
  if (!ability) return;
  const now = Date.now(), wait = Math.max(0, readyAt - now);
  const progress = cooldownProgress(readyAt, ability.cooldownMs, now);
  button.disabled = busy || wait > 0 || funds < ability.juiceCost;
  button.classList.toggle('is-recharging', wait > 0);
  button.classList.toggle('is-ready', !button.disabled);
  button.style.setProperty('--charge', `${progress * 100}%`);
  // Negative delay resumes the same animation when an online snapshot replaces DOM.
  if (button.dataset.readyAt !== String(readyAt)) {
    button.dataset.readyAt = String(readyAt);
    button.style.setProperty('--recharge-duration', `${ability.cooldownMs}ms`);
    button.style.setProperty('--recharge-delay', `${-progress * ability.cooldownMs}ms`);
  }
  const status = wait ? `${Math.ceil(wait / 1000)}s` : ability.juiceCost ? `${ability.juiceCost} F` : 'READY';
  button.querySelector('.hero-ability-slot__cooldown')!.textContent = status;
  button.title = `${ability.name} · ${status} · ${ability.description}`;
  button.setAttribute('aria-label', `${ability.name}, ${wait ? `recharging, ${Math.ceil(wait / 1000)} seconds` : funds < ability.juiceCost ? 'not enough juice' : 'ready'}`);
}

export function powerButton(id: string, onUse: () => void): HTMLButtonElement {
  const ability = heroAbility(id)!;
  const button = el('button', { type:'button', class:'hero-ability-slot', 'data-power':id }, [
    el('span', { class:'hero-ability-slot__sweep', 'aria-hidden':'true' }),
    el('img', { class:'hero-ability-slot__icon', src:powerIconSource(id, ability.iconUrl), alt:'', draggable:'false', 'data-power-icon':id, 'data-power-default':ability.iconUrl }),
    el('span', { class:'hero-ability-slot__name', text:ability.name }),
    el('span', { class:'hero-ability-slot__cooldown' }),
  ]);
  button.addEventListener('click', onUse);
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
