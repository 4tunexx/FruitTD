import { el } from './dom';

/** Indeterminate activity only; never invents a progress percentage. */
export function LoadingIndicator(message = 'Loading…'): HTMLElement {
  return el('div', { class: 'ftd-loading', role: 'status', 'aria-live': 'polite' }, [
    el('span', { class: 'ftd-loading__spinner', 'aria-hidden': 'true' }),
    el('span', { text: message }),
  ]);
}

export function beginLoading(host: HTMLElement, message: string): () => void {
  const indicator = LoadingIndicator(message);
  host.setAttribute('aria-busy', 'true');
  host.appendChild(indicator);
  return () => { indicator.remove(); host.removeAttribute('aria-busy'); };
}
