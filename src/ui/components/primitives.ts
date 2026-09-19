/**
 * FruitTD UI primitives.
 *
 * Plain DOM factories (the project is vanilla TypeScript + Vite — no React).
 * Every primitive renders `ftd-*` classes which consume `--ftd-*` CSS
 * variables. No colours, radii or spacing are hardcoded here.
 */
import { classNames, el, type Child } from './dom';

export type Tone = 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'xp' | 'coins' | 'tower' | 'combo';
export type Size = 'sm' | 'md' | 'lg';

export interface ButtonOptions {
  label?: string;
  tone?: Tone;
  size?: Size;
  variant?: 'solid' | 'outline' | 'ghost' | 'glass';
  icon?: string;
  block?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  id?: string;
  onClick?: (ev: MouseEvent) => void;
  children?: Child[];
}

export function GameButton(opts: ButtonOptions = {}): HTMLButtonElement {
  const btn = el('button', {
    type: opts.type ?? 'button',
    id: opts.id,
    class: classNames(
      'ftd-btn',
      `ftd-btn--${opts.variant ?? 'solid'}`,
      `ftd-btn--${opts.size ?? 'md'}`,
      `ftd-tone-${opts.tone ?? 'default'}`,
      opts.block && 'ftd-btn--block',
    ),
    disabled: opts.disabled,
  });
  if (opts.icon) btn.appendChild(el('span', { class: 'ftd-btn__icon', 'aria-hidden': 'true', text: opts.icon }));
  if (opts.label) btn.appendChild(el('span', { class: 'ftd-btn__label', text: opts.label }));
  if (opts.children) opts.children.forEach((c) => c && btn.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  if (opts.onClick) btn.addEventListener('click', opts.onClick);
  return btn;
}

export interface PanelOptions {
  title?: string;
  subtitle?: string;
  variant?: 'glass' | 'solid' | 'outline' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  tone?: Tone;
  id?: string;
  class?: string;
  children?: Child[];
}

export function GamePanel(opts: PanelOptions = {}): HTMLElement {
  const panel = el('section', {
    id: opts.id,
    class: classNames(
      'ftd-panel',
      `ftd-panel--${opts.variant ?? 'glass'}`,
      `ftd-panel--pad-${opts.padding ?? 'md'}`,
      opts.tone && `ftd-tone-${opts.tone}`,
      opts.class,
    ),
  });
  if (opts.title || opts.subtitle) {
    const head = el('header', { class: 'ftd-panel__head' });
    if (opts.title) head.appendChild(el('h3', { class: 'ftd-panel__title', text: opts.title }));
    if (opts.subtitle) head.appendChild(el('p', { class: 'ftd-panel__sub', text: opts.subtitle }));
    panel.appendChild(head);
  }
  const body = el('div', { class: 'ftd-panel__body' }, opts.children ?? []);
  panel.appendChild(body);
  return panel;
}

export interface CardOptions {
  title?: string;
  meta?: string;
  media?: string;
  tone?: Tone;
  interactive?: boolean;
  children?: Child[];
  onClick?: () => void;
}

export function GameCard(opts: CardOptions = {}): HTMLElement {
  const card = el('article', {
    class: classNames('ftd-card', opts.interactive && 'ftd-card--interactive', opts.tone && `ftd-tone-${opts.tone}`),
    tabindex: opts.interactive ? 0 : undefined,
  });
  if (opts.media) {
    const media = el('div', { class: 'ftd-card__media' });
    media.style.backgroundImage = `url("${opts.media.replace(/"/g, '')}")`;
    card.appendChild(media);
  }
  if (opts.title) card.appendChild(el('h4', { class: 'ftd-card__title', text: opts.title }));
  if (opts.meta) card.appendChild(el('p', { class: 'ftd-card__meta', text: opts.meta }));
  if (opts.children?.length) card.appendChild(el('div', { class: 'ftd-card__body' }, opts.children));
  if (opts.onClick) card.addEventListener('click', () => opts.onClick?.());
  return card;
}

export function GameBadge(label: string, tone: Tone = 'default'): HTMLElement {
  return el('span', { class: classNames('ftd-badge', `ftd-tone-${tone}`), text: label });
}

export function GameRankBadge(rank: string, tone: Tone = 'accent'): HTMLElement {
  return el('span', { class: classNames('ftd-rank-badge', `ftd-tone-${tone}`) }, [
    el('span', { class: 'ftd-rank-badge__dot', 'aria-hidden': 'true' }),
    el('span', { text: rank }),
  ]);
}

export interface ProgressOptions {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
  showValue?: boolean;
  size?: Size;
}

export function GameProgressBar(opts: ProgressOptions): HTMLElement {
  const max = opts.max && opts.max > 0 ? opts.max : 100;
  const pct = Math.max(0, Math.min(100, (opts.value / max) * 100));
  const wrap = el('div', { class: classNames('ftd-progress', `ftd-progress--${opts.size ?? 'md'}`, `ftd-tone-${opts.tone ?? 'primary'}`) });
  if (opts.label || opts.showValue) {
    wrap.appendChild(
      el('div', { class: 'ftd-progress__head' }, [
        opts.label ? el('span', { text: opts.label }) : null,
        opts.showValue ? el('span', { class: 'ftd-num', text: `${Math.round(opts.value)} / ${max}` }) : null,
      ]),
    );
  }
  const track = el('div', { class: 'ftd-progress__track', role: 'progressbar', 'aria-valuenow': String(Math.round(pct)) });
  const fill = el('i', { class: 'ftd-progress__fill' });
  fill.style.width = `${pct}%`;
  track.appendChild(fill);
  wrap.appendChild(track);
  return wrap;
}

export function GameXPBar(xp: number, xpToNext: number, level: number): HTMLElement {
  return el('div', { class: 'ftd-xpbar' }, [
    el('span', { class: 'ftd-xpbar__level ftd-num', text: `LV ${level}` }),
    GameProgressBar({ value: xp, max: xpToNext, tone: 'xp', size: 'sm' }),
  ]);
}

export function GameCurrency(amount: number, kind: 'coins' | 'xp' | 'gems' = 'coins', icon?: string): HTMLElement {
  const tone: Tone = kind === 'xp' ? 'xp' : kind === 'gems' ? 'tower' : 'coins';
  return el('span', { class: classNames('ftd-currency', `ftd-tone-${tone}`) }, [
    el('span', { class: 'ftd-currency__icon', 'aria-hidden': 'true', text: icon ?? (kind === 'coins' ? '🪙' : kind === 'gems' ? '💎' : '✦') }),
    el('span', { class: 'ftd-currency__value ftd-num', text: amount.toLocaleString() }),
  ]);
}

export function GameAvatar(src: string, name = '', size: Size = 'md'): HTMLElement {
  const wrap = el('span', { class: classNames('ftd-avatar', `ftd-avatar--${size}`) });
  if (src) wrap.appendChild(el('img', { src, alt: name }));
  else wrap.appendChild(el('span', { class: 'ftd-avatar__fallback', text: (name || '?').slice(0, 1).toUpperCase() }));
  return wrap;
}

export interface TabItem {
  id: string;
  label: string;
  badge?: string;
}

export function GameTabs(items: TabItem[], active: string, onChange: (id: string) => void): HTMLElement {
  const bar = el('div', { class: 'ftd-tabs', role: 'tablist' });
  items.forEach((item) => {
    const btn = el('button', {
      type: 'button',
      class: classNames('ftd-tab', item.id === active && 'is-active'),
      role: 'tab',
      'data-tab': item.id,
      'aria-selected': item.id === active ? 'true' : 'false',
    }, [el('span', { text: item.label }), item.badge ? GameBadge(item.badge, 'danger') : null]);
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.ftd-tab').forEach((t) => t.classList.remove('is-active'));
      btn.classList.add('is-active');
      onChange(item.id);
    });
    bar.appendChild(btn);
  });
  return bar;
}

export function GameSection(title: string, children: Child[] = [], action?: HTMLElement): HTMLElement {
  return el('section', { class: 'ftd-section' }, [
    el('div', { class: 'ftd-section__head' }, [el('h3', { class: 'ftd-section__title', text: title }), action ?? null]),
    el('div', { class: 'ftd-section__body' }, children),
  ]);
}

export function GameHeader(title: string, subtitle?: string, actions: Child[] = []): HTMLElement {
  return el('header', { class: 'ftd-header' }, [
    el('div', { class: 'ftd-header__copy' }, [
      el('h2', { class: 'ftd-header__title', text: title }),
      subtitle ? el('p', { class: 'ftd-header__sub', text: subtitle }) : null,
    ]),
    el('div', { class: 'ftd-header__actions' }, actions),
  ]);
}

export function GameFooter(children: Child[] = []): HTMLElement {
  return el('footer', { class: 'ftd-footer' }, children);
}

export function GameTooltip(target: HTMLElement, text: string): HTMLElement {
  target.classList.add('ftd-has-tooltip');
  target.setAttribute('data-ftd-tooltip', text);
  return target;
}

export interface HeroCardOptions {
  name: string;
  role?: string;
  level?: number;
  artwork?: string;
  locked?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export function GameHeroCard(opts: HeroCardOptions): HTMLElement {
  const card = el('article', {
    class: classNames('ftd-hero-card', opts.locked && 'is-locked', opts.selected && 'is-selected'),
    tabindex: '0',
  });
  const art = el('div', { class: 'ftd-hero-card__art' });
  if (opts.artwork) art.style.backgroundImage = `url("${opts.artwork.replace(/"/g, '')}")`;
  card.appendChild(art);
  card.appendChild(
    el('div', { class: 'ftd-hero-card__meta' }, [
      el('h4', { class: 'ftd-hero-card__name', text: opts.name }),
      opts.role ? el('p', { class: 'ftd-hero-card__role', text: opts.role }) : null,
      typeof opts.level === 'number' ? GameBadge(`LV ${opts.level}`, 'xp') : null,
      opts.locked ? GameBadge('LOCKED', 'danger') : null,
    ]),
  );
  if (opts.onSelect) card.addEventListener('click', () => opts.onSelect?.());
  return card;
}

export interface ItemCardOptions {
  name: string;
  rarity?: string;
  price?: number;
  icon?: string;
  owned?: boolean;
  onClick?: () => void;
}

export function GameItemCard(opts: ItemCardOptions): HTMLElement {
  const card = el('article', { class: classNames('ftd-item-card', opts.owned && 'is-owned'), tabindex: '0' }, [
    el('div', { class: 'ftd-item-card__icon', 'aria-hidden': 'true', text: opts.icon ?? '🍉' }),
    el('h4', { class: 'ftd-item-card__name', text: opts.name }),
    opts.rarity ? el('p', { class: 'ftd-item-card__rarity', text: opts.rarity }) : null,
    typeof opts.price === 'number' ? GameCurrency(opts.price, 'coins') : null,
    opts.owned ? GameBadge('OWNED', 'success') : null,
  ]);
  if (opts.onClick) card.addEventListener('click', () => opts.onClick?.());
  return card;
}

export function GameEmpty(message: string): HTMLElement {
  return el('p', { class: 'ftd-empty', text: message });
}
