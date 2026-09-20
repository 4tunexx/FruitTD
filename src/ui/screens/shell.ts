/**
 * Shared screen chrome.
 *
 * Every full screen gets the same header (back + title + currency) so BACK is
 * always in the same place and never missing (§10), and so screens don't each
 * invent their own layout.
 */

import { el, clear } from '../components/dom';
import { GameButton, GameCurrency } from '../components/primitives';
import { back, home } from './registry';
import type { SaveData } from '../../game/save';

export interface ScreenShellOptions {
  title: string;
  subtitle?: string;
  /** Shown top-right; usually coins/gems. */
  save?: SaveData;
  /** Extra actions rendered next to the title. */
  actions?: HTMLElement[];
  /** Hide the back button (main menu is the root). */
  hideBack?: boolean;
}

/** Builds a screen container with a consistent header. Returns the body to fill. */
export function screenShell(root: HTMLElement, opts: ScreenShellOptions): HTMLElement {
  clear(root);
  root.classList.add('ftd-screen');

  const left = el('div', { class: 'ftd-screen__titles' }, [
    el('h1', { class: 'ftd-screen__title', text: opts.title }),
    ...(opts.subtitle ? [el('p', { class: 'ftd-screen__subtitle', text: opts.subtitle })] : []),
  ]);

  const headerChildren: HTMLElement[] = [];
  if (!opts.hideBack) {
    headerChildren.push(
      GameButton({
        label: '‹ Back',
        variant: 'ghost',
        class: 'ftd-screen__back',
        onClick: () => back(),
      }),
    );
  }
  headerChildren.push(left);

  const right = el('div', { class: 'ftd-screen__header-right' });
  if (opts.save) {
    right.appendChild(GameCurrency(opts.save.coins, 'coins'));
    if (opts.save.gems) right.appendChild(GameCurrency(opts.save.gems, 'gems'));
  }
  for (const action of opts.actions ?? []) right.appendChild(action);
  right.appendChild(
    GameButton({
      label: 'Menu',
      variant: 'ghost',
      class: 'ftd-screen__home',
      onClick: () => home(),
    }),
  );
  headerChildren.push(right);

  root.appendChild(el('header', { class: 'ftd-screen__header' }, headerChildren));

  const body = el('div', { class: 'ftd-screen__body' });
  root.appendChild(body);
  return body;
}

/** Horizontal category filter used by shop and inventory. */
export function categoryTabs(
  categories: string[],
  active: string,
  labels: Record<string, string>,
  onChange: (id: string) => void,
): HTMLElement {
  const bar = el('div', { class: 'ftd-catbar', role: 'tablist' });
  for (const id of categories) {
    const tab = el('button', {
      class: `ftd-catbar__tab${id === active ? ' is-active' : ''}`,
      text: labels[id] ?? id,
      type: 'button',
      role: 'tab',
      'aria-selected': String(id === active),
    });
    tab.addEventListener('click', () => onChange(id));
    bar.appendChild(tab);
  }
  return bar;
}

/** Consistent empty state so screens never render a blank void. */
export function emptyState(title: string, hint?: string, action?: HTMLElement): HTMLElement {
  return el('div', { class: 'ftd-empty' }, [
    el('p', { class: 'ftd-empty__title', text: title }),
    ...(hint ? [el('p', { class: 'ftd-empty__hint', text: hint })] : []),
    ...(action ? [action] : []),
  ]);
}
