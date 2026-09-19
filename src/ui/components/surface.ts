/**
 * One reusable surface system for FruitTD.
 *
 * Handles modals, overlays, drawers and fullscreen panels with a single
 * implementation: open / close / back / ESC / click-outside / mobile back.
 * Shop, Heroes, Inventory etc. must use this instead of bespoke modals.
 */
import { currentBreakpoint, presentationFor, type ScreenId, type SurfaceKind } from '../theme/layout';
import { classNames, el, type Child } from './dom';

export type SurfaceAnimation = 'fade' | 'scale' | 'slide' | 'none';
export type SurfaceSize = 'sm' | 'md' | 'lg' | 'full';

export interface SurfaceOptions {
  id?: string;
  title?: string;
  subtitle?: string;
  kind?: SurfaceKind;
  size?: SurfaceSize;
  animation?: SurfaceAnimation;
  /** Show the ✕ button (default true). */
  closable?: boolean;
  /** Clicking the backdrop closes (default true). */
  dismissOnBackdrop?: boolean;
  /** Show a back arrow instead of / next to close. */
  onBack?: () => void;
  onClose?: () => void;
  content?: Child[] | HTMLElement;
  footer?: Child[];
  /** Mount point, defaults to #ftd-surface-root. */
  container?: HTMLElement;
}

export interface SurfaceHandle {
  readonly root: HTMLElement;
  readonly body: HTMLElement;
  close(): void;
  setContent(content: Child[] | HTMLElement): void;
  setTitle(title: string, subtitle?: string): void;
  isOpen(): boolean;
}

const stack: SurfaceHandle[] = [];
let wired = false;

function root(): HTMLElement {
  let node = document.getElementById('ftd-surface-root');
  if (!node) {
    node = el('div', { id: 'ftd-surface-root', class: 'ftd-surface-root' });
    document.body.appendChild(node);
  }
  return node;
}

function wireGlobal(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape' || stack.length === 0) return;
    ev.stopPropagation();
    closeTop();
  });
  // Mobile / browser back button closes the top surface instead of leaving the game.
  window.addEventListener('popstate', () => {
    if (stack.length > 0) closeTop({ fromHistory: true });
  });
}

/** Opens a surface (modal / overlay / drawer / fullscreen). */
export function openSurface(opts: SurfaceOptions = {}): SurfaceHandle {
  wireGlobal();
  const kind: SurfaceKind = opts.kind ?? 'modal';
  const animation = opts.animation ?? (kind === 'drawer' ? 'slide' : 'scale');
  const size = opts.size ?? 'md';

  const backdrop = el('div', {
    id: opts.id,
    class: classNames('ftd-surface', `ftd-surface--${kind}`, `ftd-surface--${size}`, `ftd-anim-${animation}`),
    role: kind === 'modal' ? 'dialog' : 'group',
    'aria-modal': kind === 'modal' ? 'true' : 'false',
  });

  const card = el('div', { class: 'ftd-surface__card' });
  const head = el('header', { class: 'ftd-surface__head' });

  if (opts.onBack) {
    const back = el('button', { type: 'button', class: 'ftd-surface__back', 'aria-label': 'Back', text: '←' });
    back.addEventListener('click', () => opts.onBack?.());
    head.appendChild(back);
  }
  const copy = el('div', { class: 'ftd-surface__copy' }, [
    opts.title ? el('h2', { class: 'ftd-surface__title', text: opts.title }) : null,
    opts.subtitle ? el('p', { class: 'ftd-surface__sub', text: opts.subtitle }) : null,
  ]);
  head.appendChild(copy);

  const handle: SurfaceHandle = {
    root: backdrop,
    body: el('div', { class: 'ftd-surface__body' }),
    close: () => closeHandle(handle),
    setContent(content) {
      handle.body.replaceChildren();
      if (content instanceof HTMLElement) handle.body.appendChild(content);
      else content.forEach((c) => c && handle.body.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    },
    setTitle(title, subtitle) {
      copy.replaceChildren(
        el('h2', { class: 'ftd-surface__title', text: title }),
        ...(subtitle ? [el('p', { class: 'ftd-surface__sub', text: subtitle })] : []),
      );
    },
    isOpen: () => stack.includes(handle),
  };

  if (opts.closable !== false) {
    const close = el('button', { type: 'button', class: 'ftd-surface__close', 'aria-label': 'Close', text: '×' });
    close.addEventListener('click', () => handle.close());
    head.appendChild(close);
  }

  card.appendChild(head);
  if (opts.content) handle.setContent(opts.content);
  card.appendChild(handle.body);
  if (opts.footer?.length) card.appendChild(el('footer', { class: 'ftd-surface__footer' }, opts.footer));
  backdrop.appendChild(card);

  if (opts.dismissOnBackdrop !== false) {
    backdrop.addEventListener('mousedown', (ev) => {
      if (ev.target === backdrop) handle.close();
    });
  }

  (opts.container ?? root()).appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('is-open'));
  stack.push(handle);
  document.documentElement.dataset.ftdSurfaceOpen = String(stack.length);
  if (kind !== 'panel') {
    try {
      history.pushState({ ftdSurface: stack.length }, '');
    } catch {
      /* history unavailable (e.g. sandboxed iframe) */
    }
  }
  (backdrop as HTMLElement & { _ftdOnClose?: () => void })._ftdOnClose = opts.onClose;
  return handle;
}

/** Opens a surface using the layout config's presentation rules for a screen. */
export function openScreenSurface(screen: ScreenId, opts: SurfaceOptions = {}): SurfaceHandle {
  const pres = presentationFor(screen, currentBreakpoint());
  return openSurface({
    kind: pres.kind,
    size: pres.size as SurfaceSize | undefined,
    animation: pres.animation,
    ...opts,
    id: opts.id ?? `ftd-screen-${screen}`,
  });
}

function closeHandle(handle: SurfaceHandle, opts: { fromHistory?: boolean } = {}): void {
  const idx = stack.indexOf(handle);
  if (idx === -1) return;
  stack.splice(idx, 1);
  handle.root.classList.remove('is-open');
  const onClose = (handle.root as HTMLElement & { _ftdOnClose?: () => void })._ftdOnClose;
  const remove = () => handle.root.remove();
  const delay = readSpeed('--ftd-speed-popup', 220);
  if (delay <= 0) remove();
  else window.setTimeout(remove, delay);
  document.documentElement.dataset.ftdSurfaceOpen = String(stack.length);
  onClose?.();
  if (!opts.fromHistory) {
    try {
      if (history.state && (history.state as { ftdSurface?: number }).ftdSurface) history.back();
    } catch {
      /* ignore */
    }
  }
}

export function closeTop(opts: { fromHistory?: boolean } = {}): void {
  const top = stack[stack.length - 1];
  if (top) closeHandle(top, opts);
}

export function closeAllSurfaces(): void {
  while (stack.length) closeTop();
}

export function openSurfaceCount(): number {
  return stack.length;
}

function readSpeed(varName: string, fallback: number): number {
  if (typeof getComputedStyle === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/* ───────────────────────────── Toasts ───────────────────────────── */

export type ToastTone = 'default' | 'success' | 'warning' | 'danger' | 'accent';

export function GameToast(message: string, tone: ToastTone = 'default', ms = 2600): HTMLElement {
  let host = document.getElementById('ftd-toast-host');
  if (!host) {
    host = el('div', { id: 'ftd-toast-host', class: 'ftd-toast-host', 'aria-live': 'polite' });
    document.body.appendChild(host);
  }
  const toast = el('div', { class: classNames('ftd-toast', `ftd-tone-${tone}`), text: message });
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-on'));
  window.setTimeout(() => {
    toast.classList.remove('is-on');
    window.setTimeout(() => toast.remove(), 260);
  }, ms);
  return toast;
}

/** Confirmation modal built on the shared surface system. */
export function confirmModal(opts: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const confirm = el('button', { type: 'button', class: `ftd-btn ftd-btn--solid ftd-tone-${opts.tone ?? 'primary'}`, text: opts.confirmLabel ?? 'Confirm' });
    const cancel = el('button', { type: 'button', class: 'ftd-btn ftd-btn--ghost', text: opts.cancelLabel ?? 'Cancel' });
    const handle = openSurface({
      kind: 'modal',
      size: 'sm',
      title: opts.title,
      content: [el('p', { class: 'ftd-surface__text', text: opts.message })],
      footer: [cancel, confirm],
      onClose: () => finish(false),
    });
    confirm.addEventListener('click', () => {
      finish(true);
      handle.close();
    });
    cancel.addEventListener('click', () => {
      finish(false);
      handle.close();
    });
  });
}
