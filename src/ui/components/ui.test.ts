import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDomStub, resetDom } from '../domStub.test-helper';

// One shim for the whole file: the UI modules capture document/window on first
// import, so swapping the global per test would leave stale listeners behind.
installDomStub();

async function withDom<T>(fn: () => Promise<T> | T): Promise<T> {
  const { closeAllSurfaces } = await import('./surface');
  closeAllSurfaces();
  resetDom();
  try {
    return await fn();
  } finally {
    closeAllSurfaces();
  }
}

test('primitives render theme-driven classes, never inline colours', async () => {
  await withDom(async () => {
    const { GameButton, GamePanel, GameProgressBar, GameBadge, GameCurrency } = await import('./primitives');
    const btn = GameButton({ label: 'Play', tone: 'primary', size: 'lg' }) as any;
    assert.ok(btn.className.includes('ftd-btn'));
    assert.ok(btn.className.includes('ftd-btn--lg'));
    assert.ok(btn.className.includes('ftd-tone-primary'));
    assert.equal(btn.getAttribute('style'), null);

    const panel = GamePanel({ title: 'Wave 12', variant: 'solid' }) as any;
    assert.ok(panel.className.includes('ftd-panel--solid'));
    assert.equal(panel.querySelector('.ftd-panel__title')?.textContent, 'Wave 12');

    const bar = GameProgressBar({ value: 50, max: 200, tone: 'xp' }) as any;
    assert.equal(bar.querySelector('.ftd-progress__fill')?.style.width, '25%');

    assert.ok((GameBadge('NEW', 'danger') as any).className.includes('ftd-tone-danger'));
    assert.ok((GameCurrency(1500, 'coins') as any).textContent.includes('1,500'));
  });
});

test('button click handlers fire', async () => {
  await withDom(async () => {
    const { GameButton } = await import('./primitives');
    let clicks = 0;
    const btn = GameButton({ label: 'Buy', onClick: () => clicks++ }) as any;
    btn.click();
    assert.equal(clicks, 1);
  });
});

test('tabs switch active state and report changes', async () => {
  await withDom(async () => {
    const { GameTabs } = await import('./primitives');
    const seen: string[] = [];
    const bar = GameTabs([{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], 'a', (id) => seen.push(id)) as any;
    const tabs = bar.querySelectorAll('.ftd-tab');
    assert.equal(tabs.length, 2);
    assert.equal(tabs[0].classList.contains('is-active'), true);
    tabs[1].click();
    assert.deepEqual(seen, ['b']);
    assert.equal(tabs[1].classList.contains('is-active'), true);
    assert.equal(tabs[0].classList.contains('is-active'), false);
  });
});

test('modal system opens, stacks and closes', async () => {
  await withDom(async () => {
    const surface = await import('./surface');
    assert.equal(surface.openSurfaceCount(), 0);
    const a = surface.openSurface({ title: 'Shop', kind: 'modal', size: 'lg' });
    assert.equal(surface.openSurfaceCount(), 1);
    assert.ok((a.root as any).className.includes('ftd-surface--modal'));
    assert.ok((a.root as any).className.includes('ftd-surface--lg'));

    const b = surface.openSurface({ title: 'Confirm', kind: 'modal', size: 'sm' });
    assert.equal(surface.openSurfaceCount(), 2);
    surface.closeTop();
    assert.equal(surface.openSurfaceCount(), 1);
    assert.equal(b.isOpen(), false);
    assert.equal(a.isOpen(), true);
    surface.closeAllSurfaces();
    assert.equal(surface.openSurfaceCount(), 0);
  });
});

test('ESC closes only the top surface', async () => {
  await withDom(async () => {
    const surface = await import('./surface');
    surface.openSurface({ title: 'One' });
    surface.openSurface({ title: 'Two' });
    document.dispatchEvent({ type: 'keydown', key: 'Escape', stopPropagation() {} } as any);
    assert.equal(surface.openSurfaceCount(), 1);
    document.dispatchEvent({ type: 'keydown', key: 'Escape', stopPropagation() {} } as any);
    assert.equal(surface.openSurfaceCount(), 0);
  });
});

test('mobile/browser back closes the top surface', async () => {
  await withDom(async () => {
    const surface = await import('./surface');
    surface.openSurface({ title: 'Inventory' });
    window.dispatchEvent({ type: 'popstate' } as any);
    assert.equal(surface.openSurfaceCount(), 0);
  });
});

test('clicking the backdrop dismisses, clicking the card does not', async () => {
  await withDom(async () => {
    const surface = await import('./surface');
    const handle = surface.openSurface({ title: 'Heroes' });
    const card = (handle.root as any).querySelector('.ftd-surface__card');
    (handle.root as any).dispatchEvent({ type: 'mousedown', target: card });
    assert.equal(surface.openSurfaceCount(), 1);
    (handle.root as any).dispatchEvent({ type: 'mousedown', target: handle.root });
    assert.equal(surface.openSurfaceCount(), 0);
  });
});

test('dismissOnBackdrop:false keeps the surface open', async () => {
  await withDom(async () => {
    const surface = await import('./surface');
    const handle = surface.openSurface({ title: 'Design', dismissOnBackdrop: false });
    (handle.root as any).dispatchEvent({ type: 'mousedown', target: handle.root });
    assert.equal(surface.openSurfaceCount(), 1);
    surface.closeAllSurfaces();
  });
});

test('screen surfaces follow the layout presentation rules', async () => {
  await withDom(async () => {
    const surface = await import('./surface');
    const settings = surface.openScreenSurface('settings', { title: 'Settings' });
    assert.ok((settings.root as any).className.includes('ftd-surface--modal'));
    const inventory = surface.openScreenSurface('inventory', { title: 'Inventory' });
    assert.ok((inventory.root as any).className.includes('ftd-surface--overlay'));
    surface.closeAllSurfaces();
  });
});

test('confirm modal resolves true on confirm and false on cancel', async () => {
  await withDom(async () => {
    const { confirmModal, closeAllSurfaces } = await import('./surface');
    const pending = confirmModal({ title: 'Buy', message: 'Spend 100 coins?' });
    const footer = (document as any).getElementById('ftd-surface-root').querySelector('.ftd-surface__footer');
    footer.children[1].click();
    assert.equal(await pending, true);

    const second = confirmModal({ title: 'Buy', message: 'Spend 100 coins?' });
    const footer2 = (document as any).getElementById('ftd-surface-root').querySelector('.ftd-surface__footer');
    footer2.children[0].click();
    assert.equal(await second, false);
    closeAllSurfaces();
  });
});

test('toasts mount into a shared host', async () => {
  await withDom(async () => {
    const { GameToast } = await import('./surface');
    GameToast('Saved', 'success');
    // The shim runs timers synchronously, so the toast has already expired —
    // what matters is that it mounted into the single shared host.
    const host = (document as any).getElementById('ftd-toast-host');
    assert.ok(host, 'toast host was not created');
    assert.equal(host.className, 'ftd-toast-host');
  });
});

test('theme store applies css variables to the document and persists', async () => {
  await withDom(async () => {
    const { themeStore } = await import('../theme/themeStore');
    themeStore.boot();
    const root = (document as any).documentElement;
    assert.equal(root.style['--ftd-color-primary'], '#a3e635');
    themeStore.patch({ colors: { primary: '#ff0000' } });
    assert.equal(root.style['--ftd-color-primary'], '#ff0000');
    assert.equal(root.dataset.ftdTheme, 'fruittd-default');

    themeStore.usePreset('neon');
    assert.equal(root.dataset.ftdTheme, 'neon');
    assert.equal(root.dataset.ftdPanelStyle, 'glass');

    themeStore.reset();
    assert.equal(themeStore.get().id, 'fruittd-default');
    assert.equal(root.style['--ftd-color-primary'], '#a3e635');
  });
});

test('theme store notifies subscribers and rejects invalid patches', async () => {
  await withDom(async () => {
    const { themeStore } = await import('../theme/themeStore');
    themeStore.boot();
    let calls = 0;
    const off = themeStore.subscribe(() => calls++);
    themeStore.patch({ colors: { accent: '#00ff00' } });
    assert.equal(calls, 1);
    themeStore.patch({ colors: { accent: 'nope;' } });
    assert.equal(themeStore.get().colors.accent, '#00ff00');
    off();
    themeStore.patch({ colors: { accent: '#0000ff' } });
    assert.equal(calls, 2);
    themeStore.reset();
  });
});

test('theme import/export round-trips through the store', async () => {
  await withDom(async () => {
    const { themeStore } = await import('../theme/themeStore');
    themeStore.boot();
    themeStore.patch({ colors: { primary: '#abcdef' }, name: 'Exported' });
    const json = themeStore.export();
    themeStore.reset();
    const res = themeStore.import(json);
    assert.equal(res.ok, true);
    assert.equal(themeStore.get().colors.primary, '#abcdef');
    themeStore.reset();
  });
});

test('asset slots accept safe urls and reject unsafe ones', async () => {
  await withDom(async () => {
    const assets = await import('../theme/themeAssets');
    const { themeStore } = await import('../theme/themeStore');
    themeStore.boot();
    assert.equal(assets.setThemeAsset('logo', 'https://cdn.example.com/logo.png').ok, true);
    assert.equal(assets.getThemeAsset('logo'), 'https://cdn.example.com/logo.png');
    const bad = assets.setThemeAsset('background', 'javascript:alert(1)');
    assert.equal(bad.ok, false);
    assert.equal(assets.getThemeAsset('background'), '');
    assets.clearThemeAsset('logo');
    assert.equal(assets.getThemeAsset('logo'), '');
    assert.equal(assets.isThemeAssetSlot('heroArtwork'), true);
    assert.equal(assets.isThemeAssetSlot('evil'), false);
    themeStore.reset();
  });
});

test('asset urls reach the dom as url() css variables', async () => {
  await withDom(async () => {
    const { themeStore } = await import('../theme/themeStore');
    themeStore.boot();
    themeStore.patch({ assets: { background: 'https://cdn.example.com/bg.jpg' } });
    assert.equal((document as any).documentElement.style['--ftd-asset-background'], 'url("https://cdn.example.com/bg.jpg")');
    themeStore.reset();
    assert.equal((document as any).documentElement.style['--ftd-asset-background'], 'none');
  });
});

test('layout application writes responsive data attributes', async () => {
  await withDom(async () => {
    const layout = await import('../theme/layout');
    layout.setLayout(layout.DEFAULT_LAYOUT);
    const root = (document as any).documentElement;
    assert.equal(root.dataset.ftdMenuLayout, 'hero-focus');
    assert.equal(root.style['--ftd-dash-columns'], '3');
    const mobile = layout.findLayoutPreset('mobile-first-layout')!;
    layout.setLayout(mobile);
    assert.equal(root.dataset.ftdDashNav, 'drawer');
    assert.equal(root.style['--ftd-dash-columns'], '1');
    layout.setLayout(layout.DEFAULT_LAYOUT);
  });
});

test('design mode renders every preview screen without game state', async () => {
  await withDom(async () => {
    const { PREVIEW_SCREENS, renderPreviewScreen } = await import('../design/screenPreviews');
    for (const screen of PREVIEW_SCREENS) {
      const node = renderPreviewScreen(screen.id) as any;
      assert.ok(node, `${screen.id} rendered nothing`);
      assert.ok(node.all().length > 3, `${screen.id} looks empty`);
    }
  });
});

test('theme editor renders controls bound to the store', async () => {
  await withDom(async () => {
    const { themeStore } = await import('../theme/themeStore');
    themeStore.boot();
    const { renderThemeEditor } = await import('../design/themeEditor');
    const editor = renderThemeEditor() as any;
    const colorInputs = editor.querySelectorAll('.ftd-input--color');
    assert.ok(colorInputs.length >= 16, 'expected a control per theme colour');
    colorInputs[0].value = '#112233';
    colorInputs[0].dispatchEvent({ type: 'input', target: colorInputs[0] });
    assert.equal(themeStore.get().colors.primary, '#112233');
    themeStore.reset();
  });
});

test('design mode opens as a fullscreen surface and closes', async () => {
  await withDom(async () => {
    const design = await import('../design/designMode');
    const surface = await import('./surface');
    design.openDesignMode();
    assert.equal(design.isDesignModeOpen(), true);
    assert.equal(surface.openSurfaceCount(), 1);
    design.closeDesignMode();
    assert.equal(design.isDesignModeOpen(), false);
    assert.equal(surface.openSurfaceCount(), 0);
  });
});
