/**
 * Live Theme Editor — dev/admin only.
 * Every control patches themeStore, which re-applies CSS variables instantly.
 * No rebuild is required to preview a change.
 */
import { el } from '../components/dom';
import { GameButton, GamePanel, GameSection } from '../components/primitives';
import { GameToast } from '../components/surface';
import { THEME_ASSET_SLOTS, clearThemeAsset, setThemeAsset, uploadThemeAsset } from '../theme/themeAssets';
import { themeStore } from '../theme/themeStore';
import { LAYOUT_PRESETS, findLayoutPreset, getLayout, setLayout } from '../theme/layout';
import type { Theme } from '../theme/types';

type ColorKey = keyof Theme['colors'];

const COLOR_FIELDS: { key: ColorKey; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'panel', label: 'Panel' },
  { key: 'panelSecondary', label: 'Panel 2' },
  { key: 'border', label: 'Border' },
  { key: 'text', label: 'Text' },
  { key: 'textMuted', label: 'Muted text' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'danger', label: 'Danger' },
  { key: 'xp', label: 'XP' },
  { key: 'coins', label: 'Coins' },
  { key: 'tower', label: 'Tower' },
  { key: 'combo', label: 'Combo' },
];

function field(label: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'ftd-field' }, [el('span', { class: 'ftd-field__label', text: label }), control]);
}

function toHexInput(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
}

export function renderThemeEditor(): HTMLElement {
  const root = el('div', { class: 'ftd-stack ftd-theme-editor' });

  /* Presets ------------------------------------------------------------- */
  const presetSelect = el('select', { class: 'ftd-input' });
  themeStore.presets().forEach((p) => presetSelect.appendChild(el('option', { value: p.id, text: p.name })));
  presetSelect.value = themeStore.get().id;
  presetSelect.addEventListener('change', () => {
    themeStore.usePreset(presetSelect.value);
    GameToast(`Preset applied: ${presetSelect.value}`, 'success');
  });

  const nameInput = el('input', { class: 'ftd-input', type: 'text', value: themeStore.get().name, maxlength: '60' });
  nameInput.addEventListener('input', () => themeStore.patch({ name: nameInput.value || 'Custom' }));

  const saveAs = GameButton({
    label: 'Save as custom preset',
    variant: 'outline',
    size: 'sm',
    onClick: () => {
      const id = (nameInput.value || 'custom').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'custom';
      themeStore.patch({ id, name: nameInput.value || 'Custom' });
      GameToast(`Saved as "${id}" (visual config only)`, 'success');
    },
  });

  root.appendChild(
    GamePanel({
      title: 'Presets',
      subtitle: 'Visual configuration only — never progression or game rules.',
      children: [field('Preset', presetSelect), field('Theme name', nameInput), saveAs],
    }),
  );

  /* Colors -------------------------------------------------------------- */
  const colorRows = COLOR_FIELDS.map(({ key, label }) => {
    const current = themeStore.get().colors[key];
    const picker = el('input', { class: 'ftd-input ftd-input--color', type: 'color', value: toHexInput(current) });
    const text = el('input', { class: 'ftd-input', type: 'text', value: current });
    picker.addEventListener('input', () => {
      text.value = picker.value;
      themeStore.patch({ colors: { [key]: picker.value } });
    });
    text.addEventListener('change', () => {
      themeStore.patch({ colors: { [key]: text.value } });
      const applied = themeStore.get().colors[key];
      text.value = applied;
      picker.value = toHexInput(applied);
    });
    return field(label, el('div', { class: 'ftd-field__row' }, [picker, text]));
  });
  root.appendChild(GamePanel({ title: 'Colors', children: [el('div', { class: 'ftd-editor-grid' }, colorRows)] }));

  /* Shape / effects / typography / spacing / animation ------------------ */
  const range = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void,
  ): HTMLElement => {
    const input = el('input', { class: 'ftd-input', type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
    const out = el('span', { class: 'ftd-field__value ftd-num', text: String(value) });
    input.addEventListener('input', () => {
      const v = Number(input.value);
      out.textContent = String(v);
      onChange(v);
    });
    return field(label, el('div', { class: 'ftd-field__row' }, [input, out]));
  };

  const lengthField = (label: string, value: string, onChange: (v: string) => void): HTMLElement => {
    const input = el('input', { class: 'ftd-input', type: 'text', value });
    input.addEventListener('change', () => onChange(input.value));
    return field(label, input);
  };

  const t = themeStore.get();
  root.appendChild(
    GamePanel({
      title: 'Shape & effects',
      children: [
        el('div', { class: 'ftd-editor-grid' }, [
          lengthField('Panel radius', t.shapes.panelRadius, (v) => themeStore.patch({ shapes: { panelRadius: v } })),
          lengthField('Button radius', t.shapes.buttonRadius, (v) => themeStore.patch({ shapes: { buttonRadius: v } })),
          lengthField('Card radius', t.shapes.cardRadius, (v) => themeStore.patch({ shapes: { cardRadius: v } })),
          lengthField('Border width', t.shapes.borderWidth, (v) => themeStore.patch({ shapes: { borderWidth: v } })),
          lengthField('Shadow', t.effects.shadow, (v) => themeStore.patch({ effects: { shadow: v } })),
          lengthField('Glow', t.effects.glow, (v) => themeStore.patch({ effects: { glow: v } })),
          lengthField('Blur', t.effects.blur, (v) => themeStore.patch({ effects: { blur: v } })),
          range('Panel opacity', t.effects.panelOpacity, 0.2, 1, 0.02, (v) => themeStore.patch({ effects: { panelOpacity: v } })),
          range('Backdrop opacity', t.effects.backdropOpacity, 0, 1, 0.02, (v) => themeStore.patch({ effects: { backdropOpacity: v } })),
        ]),
      ],
    }),
  );

  const styleSelect = (label: string, options: string[], value: string, onChange: (v: string) => void): HTMLElement => {
    const sel = el('select', { class: 'ftd-input' });
    options.forEach((o) => sel.appendChild(el('option', { value: o, text: o })));
    sel.value = value;
    sel.addEventListener('change', () => onChange(sel.value));
    return field(label, sel);
  };

  root.appendChild(
    GamePanel({
      title: 'Surfaces & typography',
      children: [
        el('div', { class: 'ftd-editor-grid' }, [
          styleSelect('Button style', ['solid', 'outline', 'ghost', 'glass'], t.surfaces.buttonStyle, (v) => themeStore.patch({ surfaces: { buttonStyle: v } })),
          styleSelect('Panel style', ['glass', 'solid', 'outline', 'flat'], t.surfaces.panelStyle, (v) => themeStore.patch({ surfaces: { panelStyle: v } })),
          lengthField('Heading font', t.typography.headingFont, (v) => themeStore.patch({ typography: { headingFont: v } })),
          lengthField('Body font', t.typography.bodyFont, (v) => themeStore.patch({ typography: { bodyFont: v } })),
          lengthField('Number font', t.typography.numberFont, (v) => themeStore.patch({ typography: { numberFont: v } })),
          range('Typography scale', t.typography.scale, 0.75, 1.5, 0.05, (v) => themeStore.patch({ typography: { scale: v } })),
        ]),
      ],
    }),
  );

  root.appendChild(
    GamePanel({
      title: 'Spacing & animation',
      children: [
        el('div', { class: 'ftd-editor-grid' }, [
          lengthField('Spacing sm', t.spacing.sm, (v) => themeStore.patch({ spacing: { sm: v } })),
          lengthField('Spacing md', t.spacing.md, (v) => themeStore.patch({ spacing: { md: v } })),
          lengthField('Spacing lg', t.spacing.lg, (v) => themeStore.patch({ spacing: { lg: v } })),
          lengthField('Screen padding', t.spacing.screenPadding, (v) => themeStore.patch({ spacing: { screenPadding: v } })),
          lengthField('Panel padding', t.spacing.panelPadding, (v) => themeStore.patch({ spacing: { panelPadding: v } })),
          lengthField('Grid gap', t.spacing.gridGap, (v) => themeStore.patch({ spacing: { gridGap: v } })),
          range('Transition (ms)', t.animation.transitionSpeed, 0, 800, 10, (v) => themeStore.patch({ animation: { transitionSpeed: v } })),
          range('Popup (ms)', t.animation.popupSpeed, 0, 800, 10, (v) => themeStore.patch({ animation: { popupSpeed: v } })),
          range('Hover (ms)', t.animation.hoverSpeed, 0, 600, 10, (v) => themeStore.patch({ animation: { hoverSpeed: v } })),
          range('Screen (ms)', t.animation.screenTransition, 0, 1200, 10, (v) => themeStore.patch({ animation: { screenTransition: v } })),
        ]),
        (() => {
          const cb = el('input', { type: 'checkbox' }) as HTMLInputElement;
          cb.checked = t.animation.reducedMotion;
          cb.addEventListener('change', () => themeStore.patch({ animation: { reducedMotion: cb.checked } }));
          return field('Reduced motion', cb);
        })(),
      ],
    }),
  );

  /* Layout -------------------------------------------------------------- */
  const layoutSelect = el('select', { class: 'ftd-input' });
  LAYOUT_PRESETS.forEach((l) => layoutSelect.appendChild(el('option', { value: l.id, text: l.name })));
  layoutSelect.value = getLayout().id;
  layoutSelect.addEventListener('change', () => {
    const preset = findLayoutPreset(layoutSelect.value);
    if (preset) {
      setLayout(preset);
      GameToast(`Layout: ${preset.name}`, 'accent');
      root.dispatchEvent(new CustomEvent('ftd:layout-changed', { bubbles: true }));
    }
  });
  root.appendChild(GamePanel({ title: 'Layout', subtitle: 'Menu/dashboard arrangement — no gameplay impact.', children: [field('Layout preset', layoutSelect)] }));

  /* Assets -------------------------------------------------------------- */
  const assetRows = THEME_ASSET_SLOTS.map(({ slot, label }) => {
    const urlInput = el('input', { class: 'ftd-input', type: 'url', value: themeStore.get().assets[slot], placeholder: 'https://… or leave blank' });
    urlInput.addEventListener('change', () => {
      const res = setThemeAsset(slot, urlInput.value);
      if (!res.ok) GameToast(res.error ?? 'Rejected', 'danger');
    });
    const file = el('input', { class: 'ftd-input', type: 'file', accept: 'image/*' }) as HTMLInputElement;
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      const res = await uploadThemeAsset(slot, f);
      if (res.ok && res.url) {
        urlInput.value = res.url;
        GameToast(`${label} updated`, 'success');
      } else GameToast(res.error ?? 'Upload failed', 'danger');
    });
    const clear = GameButton({
      label: 'Clear',
      size: 'sm',
      variant: 'ghost',
      onClick: () => {
        clearThemeAsset(slot);
        urlInput.value = '';
        file.value = '';
      },
    });
    return field(label, el('div', { class: 'ftd-field__row' }, [urlInput, file, clear]));
  });
  root.appendChild(GamePanel({ title: 'Assets', subtitle: 'Fixed slots only. URLs are validated; uploads become data URLs.', children: assetRows }));

  /* Import / export ------------------------------------------------------ */
  const jsonArea = el('textarea', { class: 'ftd-input ftd-input--code', rows: '8', spellcheck: 'false' }) as HTMLTextAreaElement;
  jsonArea.value = themeStore.export();
  const exportBtn = GameButton({
    label: 'Export JSON',
    variant: 'outline',
    size: 'sm',
    onClick: () => {
      jsonArea.value = themeStore.export();
      try {
        const blob = new Blob([jsonArea.value], { type: 'application/json' });
        const a = el('a', { href: URL.createObjectURL(blob), download: 'fruitTdTheme.json' });
        a.click();
        URL.revokeObjectURL(a.href);
      } catch {
        /* download unavailable — textarea still holds the JSON */
      }
      GameToast('Theme exported', 'success');
    },
  });
  const importBtn = GameButton({
    label: 'Import JSON',
    tone: 'primary',
    size: 'sm',
    onClick: () => {
      const res = themeStore.import(jsonArea.value);
      if (res.ok) GameToast('Theme imported', 'success');
      else GameToast(`Imported with ${res.errors.length} issue(s) — invalid values were reset`, 'warning');
      rerender(root);
    },
  });
  const resetBtn = GameButton({
    label: 'Reset to default',
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      themeStore.reset();
      GameToast('Theme reset', 'default');
      rerender(root);
    },
  });
  root.appendChild(
    GameSection('Import / Export', [
      jsonArea,
      el('div', { class: 'ftd-row' }, [exportBtn, importBtn, resetBtn]),
      el('p', { class: 'ftd-empty', text: 'Theme files are data only — no JavaScript is ever executed from them.' }),
    ]),
  );

  return root;
}

function rerender(root: HTMLElement): void {
  const parent = root.parentElement;
  if (!parent) return;
  const fresh = renderThemeEditor();
  parent.replaceChild(fresh, root);
}
