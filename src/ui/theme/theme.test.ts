import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_THEME } from './defaultTheme';
import { themeToCssVars, themeToCssText } from './cssVars';
import { BUILTIN_PRESETS, findPreset } from './presets';
import {
  cloneTheme,
  exportThemeJson,
  importThemeJson,
  mergeTheme,
  sanitizeAssetUrl,
  sanitizeCssValue,
  validateTheme,
} from './validate';
import {
  DEFAULT_LAYOUT,
  LAYOUT_PRESETS,
  breakpointForWidth,
  findLayoutPreset,
  presentationFor,
} from './layout';

/* ── theme loading / defaults ─────────────────────────────────────── */

test('default theme is valid and complete', () => {
  const res = validateTheme(DEFAULT_THEME);
  assert.equal(res.ok, true, res.errors.join(', '));
  assert.deepEqual(res.theme, DEFAULT_THEME);
});

test('every builtin preset validates and has a unique id', () => {
  const ids = new Set<string>();
  for (const preset of BUILTIN_PRESETS) {
    const res = validateTheme(preset);
    assert.equal(res.ok, true, `${preset.id}: ${res.errors.join(', ')}`);
    assert.equal(ids.has(preset.id), false, `duplicate preset id ${preset.id}`);
    ids.add(preset.id);
  }
  assert.ok(findPreset('neon'));
  assert.equal(findPreset('does-not-exist'), null);
});

test('presets contain only visual configuration', () => {
  const forbidden = ['coins', 'xp', 'rank', 'heroes', 'progression', 'rules', 'save'];
  for (const preset of BUILTIN_PRESETS) {
    const topLevel = Object.keys(preset);
    for (const key of forbidden) assert.equal(topLevel.includes(key), false, `${preset.id} leaks ${key}`);
  }
});

/* ── fallback on invalid input ────────────────────────────────────── */

test('invalid theme falls back to defaults without throwing', () => {
  const res = validateTheme({ colors: { primary: 'javascript:alert(1)' }, spacing: { md: 'drop table' } });
  assert.equal(res.ok, false);
  assert.equal(res.theme.colors.primary, DEFAULT_THEME.colors.primary);
  assert.equal(res.theme.spacing.md, DEFAULT_THEME.spacing.md);
  assert.ok(res.errors.length >= 2);
});

test('non-object payloads fall back to the default theme', () => {
  for (const bad of [null, undefined, 42, 'theme', [1, 2, 3]]) {
    const res = validateTheme(bad);
    assert.equal(res.ok, false);
    assert.equal(res.theme.id, DEFAULT_THEME.id);
  }
});

test('numbers are range clamped and type checked', () => {
  const res = validateTheme({ animation: { transitionSpeed: 99999, popupSpeed: 'fast' }, typography: { scale: -4 } });
  assert.equal(res.theme.animation.transitionSpeed, 2000);
  assert.equal(res.theme.animation.popupSpeed, DEFAULT_THEME.animation.popupSpeed);
  assert.equal(res.theme.typography.scale, 0.6);
});

test('theme data never carries executable content', () => {
  const res = validateTheme({
    colors: { primary: '#fff' },
    onLoad: 'alert(1)',
    typography: { headingFont: "url(javascript:alert(1))" },
  });
  assert.equal('onLoad' in res.theme, false);
  assert.equal(res.theme.typography.headingFont, DEFAULT_THEME.typography.headingFont);
});

test('sanitizeCssValue strips CSS escapes', () => {
  assert.equal(sanitizeCssValue('#fff; background: url(x)'), '#fff background: x)');
  assert.equal(sanitizeCssValue(' red '), 'red');
});

/* ── export / import ──────────────────────────────────────────────── */

test('export produces JSON that round-trips', () => {
  const json = exportThemeJson(DEFAULT_THEME);
  const parsed = JSON.parse(json);
  assert.equal(parsed.id, DEFAULT_THEME.id);
  const back = importThemeJson(json);
  assert.equal(back.ok, true);
  assert.deepEqual(back.theme, DEFAULT_THEME);
});

test('import rejects malformed JSON safely', () => {
  const res = importThemeJson('{ not json');
  assert.equal(res.ok, false);
  assert.deepEqual(res.theme, DEFAULT_THEME);
});

test('import of a partial theme fills missing sections', () => {
  const res = importThemeJson(JSON.stringify({ id: 'partial', name: 'Partial', colors: { primary: '#ff0000' } }));
  assert.equal(res.ok, true);
  assert.equal(res.theme.colors.primary, '#ff0000');
  assert.equal(res.theme.colors.background, DEFAULT_THEME.colors.background);
  assert.equal(res.theme.spacing.md, DEFAULT_THEME.spacing.md);
});

test('mergeTheme deep-merges patches and revalidates', () => {
  const merged = mergeTheme(DEFAULT_THEME, { colors: { accent: '#123456' }, shapes: { panelRadius: '1rem' } });
  assert.equal(merged.colors.accent, '#123456');
  assert.equal(merged.shapes.panelRadius, '1rem');
  assert.equal(merged.colors.primary, DEFAULT_THEME.colors.primary);
  const rejected = mergeTheme(DEFAULT_THEME, { colors: { accent: 'not-a-color' } });
  assert.equal(rejected.colors.accent, DEFAULT_THEME.colors.accent);
});

test('cloneTheme returns an independent copy', () => {
  const copy = cloneTheme(DEFAULT_THEME);
  copy.colors.primary = '#000000';
  assert.notEqual(DEFAULT_THEME.colors.primary, '#000000');
});

/* ── assets ───────────────────────────────────────────────────────── */

test('asset urls are restricted to safe forms', () => {
  assert.equal(sanitizeAssetUrl('https://cdn.example.com/logo.png'), 'https://cdn.example.com/logo.png');
  assert.equal(sanitizeAssetUrl('/assets/logo.png'), '/assets/logo.png');
  assert.equal(sanitizeAssetUrl('data:image/png;base64,iVBORw0KGgo='), 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(sanitizeAssetUrl(''), '');
  assert.equal(sanitizeAssetUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeAssetUrl('../../etc/passwd'), null);
  assert.equal(sanitizeAssetUrl('url("x") ; color:red'), null);
  assert.equal(sanitizeAssetUrl(42), null);
});

test('unsafe asset urls are dropped during validation', () => {
  const res = validateTheme({ assets: { logo: 'javascript:alert(1)', background: 'https://cdn.example.com/bg.jpg' } });
  assert.equal(res.ok, false);
  assert.equal(res.theme.assets.logo, '');
  assert.equal(res.theme.assets.background, 'https://cdn.example.com/bg.jpg');
});

/* ── css variables ────────────────────────────────────────────────── */

test('theme flattens to --ftd-* css variables', () => {
  const vars = themeToCssVars(DEFAULT_THEME);
  assert.equal(vars['--ftd-color-primary'], DEFAULT_THEME.colors.primary);
  assert.equal(vars['--ftd-color-text-muted'], DEFAULT_THEME.colors.textMuted);
  assert.equal(vars['--ftd-radius-panel'], DEFAULT_THEME.shapes.panelRadius);
  assert.equal(vars['--ftd-speed-popup'], `${DEFAULT_THEME.animation.popupSpeed}ms`);
  assert.equal(vars['--ftd-asset-logo'], 'none');
  assert.ok(Object.keys(vars).every((k) => k.startsWith('--ftd-')));
});

test('typography scale multiplies exposed font sizes', () => {
  const scaled = themeToCssVars(mergeTheme(DEFAULT_THEME, { typography: { scale: 2 } }));
  assert.equal(scaled['--ftd-text-md'], '1.9rem');
});

test('reduced motion zeroes animation durations', () => {
  const vars = themeToCssVars(mergeTheme(DEFAULT_THEME, { animation: { reducedMotion: true } }));
  assert.equal(vars['--ftd-speed-popup'], '0ms');
  assert.equal(vars['--ftd-speed-screen'], '0ms');
});

test('css text output is a valid rule block', () => {
  const css = themeToCssText(DEFAULT_THEME);
  assert.ok(css.startsWith(':root {'));
  assert.ok(css.includes('--ftd-color-panel:'));
  assert.ok(css.trim().endsWith('}'));
});

/* ── layout / responsive ──────────────────────────────────────────── */

test('breakpoints map widths to device classes', () => {
  assert.equal(breakpointForWidth(1600), 'desktop');
  assert.equal(breakpointForWidth(900), 'tablet');
  assert.equal(breakpointForWidth(420), 'mobile');
});

test('screens resolve to responsive presentations', () => {
  assert.equal(presentationFor('settings', 'desktop').kind, 'modal');
  assert.equal(presentationFor('inventory', 'desktop').kind, 'overlay');
  assert.equal(presentationFor('inventory', 'mobile').kind, 'fullscreen');
  assert.equal(presentationFor('main-menu', 'mobile').kind, 'fullscreen');
  assert.equal(presentationFor('hud', 'desktop').kind, 'panel');
});

test('layout presets are addressable and cover every screen', () => {
  assert.equal(findLayoutPreset(DEFAULT_LAYOUT.id)?.name, DEFAULT_LAYOUT.name);
  assert.equal(findLayoutPreset('nope'), null);
  for (const preset of LAYOUT_PRESETS) {
    assert.equal(Object.keys(preset.screens).length, Object.keys(DEFAULT_LAYOUT.screens).length);
    assert.ok(preset.dashboard.columns >= 1);
  }
});
