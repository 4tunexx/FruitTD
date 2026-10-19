import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDomStub, resetDom } from './domStub.test-helper';
import { normalizeIconAssignments, ICON_ROLE_IDS, EXTRACTED_ICON_IDS } from './extractedIcons';
import { mergeAdminConfig } from '../services/admin';
import { MODE_ICONS } from './modeIcons';

installDomStub();
(document as any).createElementNS = (_namespace: string, tag: string) => document.createElement(tag);
const { lucideIcon, ADMIN_ICON_NAMES } = await import('./lucideIcon');
const { setLiveConfig } = await import('../services/liveConfig');
const { renderIconLibrary } = await import('./admin/iconLibrary');

test('mode and SVG roles survive publishing validation and config reload', () => {
  const input = { ModeHorde: 'stat-01-09', ModeCoop: 'rune-05-04', Bell: 'misc-01-01', Users: 'hero-01-02',
    UnknownRole: 'stat-01-01', ModeCasual: 'missing-file' };
  const normalized = normalizeIconAssignments(input);
  assert.deepEqual(normalized, { ModeHorde: input.ModeHorde, ModeCoop: input.ModeCoop, Bell: input.Bell, Users: input.Users });
  assert.deepEqual(mergeAdminConfig(JSON.parse(JSON.stringify({ iconOverrides: normalized }))).iconOverrides, normalized);
  for (const role of ADMIN_ICON_NAMES) assert.ok(ICON_ROLE_IDS.includes(role), `${role} must be editable`);
  assert.equal(MODE_ICONS.horde, 'ModeHorde');
  assert.notEqual(MODE_ICONS.arena, MODE_ICONS.ranked);
});

test('live publishing replaces SVGs with assets and restores them without renderer classes leaking', () => {
  resetDom();
  setLiveConfig(mergeAdminConfig({ iconOverrides: {} }));
  const original = lucideIcon('ModeCoop', 'ftd-mode-card__icon', 44);
  document.body.appendChild(original);
  assert.equal(original.tagName.toLowerCase(), 'svg');
  setLiveConfig(mergeAdminConfig({ iconOverrides: { ModeCoop: 'rune-05-04' } }));
  const assigned = document.body.querySelector('[data-icon-role="ModeCoop"]')!;
  assert.equal(assigned.tagName.toLowerCase(), 'span');
  assert.ok(assigned.classList.contains('ftd-extracted-icon'));
  setLiveConfig(mergeAdminConfig({ iconOverrides: {} }));
  const restored = document.body.querySelector('[data-icon-role="ModeCoop"]')!;
  assert.equal(restored.tagName.toLowerCase(), 'svg');
  assert.equal(restored.classList.contains('ftd-extracted-icon'), false);
  assert.equal(restored.getAttribute('width'), '44');
});

test('Admin exposes mode roles, searches by their name, and keeps the saved selection stable', async () => {
  resetDom();
  const host = document.createElement('section');
  document.body.appendChild(host);
  let complete!: (result: { ok: boolean; message: string }) => void;
  let saved: [string, string | null] | undefined;
  renderIconLibrary(host, {}, async (role, asset) => {
    saved = [role, asset];
    return new Promise(resolve => { complete = resolve; });
  });
  const more = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.startsWith('Load more icons'))!;
  const firstBatch = host.querySelectorAll('.admin-icon-library__item').length;
  assert.ok(firstBatch < EXTRACTED_ICON_IDS.length);
  more.click();
  assert.ok(host.querySelectorAll('.admin-icon-library__item').length > firstBatch);
  for (let i = 0; i < 5; i++) more.click();
  assert.equal(host.querySelectorAll('.admin-icon-library__item').length, EXTRACTED_ICON_IDS.length);
  const role = host.querySelector('[aria-label="Icon role to update"]') as HTMLSelectElement;
  assert.match(role.textContent || '', /Mode: Horde/);
  assert.match(role.textContent || '', /Mode: Co-op/);
  role.value = 'ModeHorde'; role.dispatchEvent({ type: 'change' } as Event);
  const search = host.querySelector('[aria-label="Search icons"]') as HTMLInputElement;
  search.value = 'Horde'; search.dispatchEvent({ type: 'input' } as Event);
  const item = host.querySelector('.admin-icon-library__item') as HTMLButtonElement;
  assert.ok(item, 'mode names should find the default artwork');
  item.click();
  const assign = Array.from(host.querySelectorAll('button')).find(button => button.textContent === 'Apply selected icon')!;
  assign.click();
  assert.equal(role.disabled, true);
  assert.deepEqual(saved, ['ModeHorde', 'stat-01-09']);
  complete({ ok: true, message: 'Saved' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(role.disabled, false);
  assert.match(host.querySelector('.admin-icon-library__preview')!.textContent || '', /Current Mode: Horde: stat-01-09/);
});
