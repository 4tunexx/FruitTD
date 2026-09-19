/**
 * Design Preview Mode — internal dev/admin tool.
 *
 * Open with `?design=1`, Ctrl+Shift+D, or `openDesignMode()` from the Admin
 * Control Center (DESIGN section). Lets a designer preview every screen and
 * edit the live theme without playing a match or rebuilding the app.
 */
import { el } from '../components/dom';
import { GameButton, GameTabs } from '../components/primitives';
import { openSurface, type SurfaceHandle } from '../components/surface';
import { themeStore } from '../theme/themeStore';
import { PREVIEW_SCREENS, renderPreviewScreen, type PreviewScreenId } from './screenPreviews';
import { renderThemeEditor } from './themeEditor';

type Viewport = 'desktop' | 'tablet' | 'mobile';

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  desktop: '100%',
  tablet: '900px',
  mobile: '390px',
};

let handle: SurfaceHandle | null = null;

export function isDesignModeOpen(): boolean {
  return !!handle?.isOpen();
}

export function openDesignMode(initial: PreviewScreenId = 'components'): SurfaceHandle {
  if (handle?.isOpen()) return handle;
  themeStore.boot();

  let screen: PreviewScreenId = initial;
  let viewport: Viewport = 'desktop';

  const stage = el('div', { class: 'ftd-design__stage' });
  const frame = el('div', { class: 'ftd-design__frame' });
  stage.appendChild(frame);

  const paint = () => {
    frame.replaceChildren(renderPreviewScreen(screen));
    frame.style.width = VIEWPORT_WIDTH[viewport];
  };

  const tabs = GameTabs(
    PREVIEW_SCREENS.map((s) => ({ id: s.id, label: s.label })),
    screen,
    (id) => {
      screen = id as PreviewScreenId;
      paint();
    },
  );

  const viewportRow = el('div', { class: 'ftd-row' },
    (['desktop', 'tablet', 'mobile'] as Viewport[]).map((v) =>
      GameButton({
        label: v,
        size: 'sm',
        variant: v === viewport ? 'solid' : 'outline',
        onClick: () => {
          viewport = v;
          frame.style.width = VIEWPORT_WIDTH[v];
          viewportRow.querySelectorAll('.ftd-btn').forEach((b) => {
            b.classList.toggle('ftd-btn--solid', b.textContent?.trim() === v);
            b.classList.toggle('ftd-btn--outline', b.textContent?.trim() !== v);
          });
        },
      }),
    ),
  );

  const editorPanel = el('aside', { class: 'ftd-design__editor' }, [renderThemeEditor()]);

  const layout = el('div', { class: 'ftd-design' }, [
    el('div', { class: 'ftd-design__main' }, [
      el('div', { class: 'ftd-design__bar' }, [tabs, viewportRow]),
      stage,
    ]),
    editorPanel,
  ]);

  layout.addEventListener('ftd:layout-changed', () => paint());
  themeStore.subscribe(() => {
    /* CSS vars update automatically; nothing to repaint for theme-only edits */
  });

  paint();

  handle = openSurface({
    kind: 'fullscreen',
    size: 'full',
    animation: 'fade',
    title: 'FruitTD Design Mode',
    subtitle: 'Theme editor · screen previews · presets · import/export',
    content: [layout],
    dismissOnBackdrop: false,
    onClose: () => {
      handle = null;
    },
  });
  return handle;
}

export function closeDesignMode(): void {
  handle?.close();
  handle = null;
}

/** Wires the `?design=1` query flag and the Ctrl+Shift+D hotkey. */
export function installDesignMode(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey && ev.shiftKey && (ev.key === 'D' || ev.key === 'd')) {
      ev.preventDefault();
      if (isDesignModeOpen()) closeDesignMode();
      else openDesignMode();
    }
  });
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('design') === '1') openDesignMode();
  } catch {
    /* ignore */
  }
}
