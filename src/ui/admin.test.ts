import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installDomStub, resetDom } from './domStub.test-helper';
installDomStub();
import { AdminController } from './admin';
import { DEFAULT_ADMIN_CONFIG } from '../services/admin';

function workspace() {
  resetDom();
  const root = document.createElement('div');
  root.id = 'modal-admin';
  for (const tab of ['branding', 'economy']) {
    const button = document.createElement('button'); button.className = 'admin-tab-btn'; button.setAttribute('data-tab', tab); root.appendChild(button);
    const panel = document.createElement('div'); panel.id = `admin-tab-${tab}`; panel.className = 'admin-panel-tab'; root.appendChild(panel);
  }
  for (const id of ['eyebrow', 'title', 'subtitle', 'announcement', 'theme', 'money', 'lives', 'scoremul', 'supermul']) {
    const input = document.createElement(id === 'title' ? 'textarea' : 'input'); input.id = `admin-in-${id}`; root.appendChild(input);
  }
  const table = document.createElement('div'); table.id = 'admin-lb-table'; root.appendChild(table);
  document.body.appendChild(root);
  const controller = new AdminController();
  // Seed a local draft to exercise the UI without credentials or database writes.
  const local = controller as any;
  local.config = structuredClone(DEFAULT_ADMIN_CONFIG);
  local.renderBrandingEditor(); local.renderEconomyEditor();
  return { root, local };
}

test('admin title and economy drafts survive switching tabs before publishing', () => {
  const { root, local } = workspace();
  const title = root.querySelector<HTMLTextAreaElement>('#admin-in-title')!;
  const money = root.querySelector<HTMLInputElement>('#admin-in-money')!;
  title.value = 'OUTPOST\nLAST STAND'; title.dispatchEvent({ type: 'input' } as Event);
  root.querySelector<HTMLButtonElement>('[data-tab="economy"]')!.click();
  money.value = '350'; money.dispatchEvent({ type: 'input' } as Event);
  root.querySelector<HTMLButtonElement>('[data-tab="branding"]')!.click();
  assert.equal(title.value, 'OUTPOST\nLAST STAND');
  root.querySelector<HTMLButtonElement>('[data-tab="economy"]')!.click();
  assert.equal(money.value, '350');
  assert.equal(local.config.menuConfig.title, title.value);
  assert.equal(local.config.gameplayConfig.startMoney, 350);
});

test('admin leaderboard renders untrusted player names as text', async () => {
  const { root, local } = workspace();
  const priorFetch = globalThis.fetch;
  const nickname = '<img src=x onerror="alert(1)">';
  globalThis.fetch = async () => new Response(JSON.stringify({ entries: [{ _id: 'score-1', nickname, mode: 'casual', score: 42, wave: 2 }] }));
  try {
    await local.renderLeaderboardManager();
    assert.equal(root.querySelector('.admin-lb-row')!.querySelector('span')!.textContent, nickname);
    assert.equal(root.querySelector('#admin-lb-table')!.querySelector('img'), null);
    assert.equal(root.querySelectorAll('.admin-lb-row').length, 1);
  } finally { globalThis.fetch = priorFetch; resetDom(); }
});

test('an older admin leaderboard response cannot overwrite a newer refresh', async () => {
  const { root, local } = workspace();
  const priorFetch = globalThis.fetch;
  const responses: Array<(response: Response) => void> = [];
  globalThis.fetch = () => new Promise<Response>(resolve => responses.push(resolve));
  const data = (nickname: string) => new Response(JSON.stringify({ entries: [{ _id: nickname, nickname, mode: 'casual', score: 1, wave: 1 }] }));
  try {
    const older = local.renderLeaderboardManager(); const newer = local.renderLeaderboardManager();
    responses[1]!(data('Current')); await newer;
    responses[0]!(data('Stale')); await older;
    assert.match(root.querySelector('#admin-lb-table')!.textContent!, /Current/);
    assert.doesNotMatch(root.querySelector('#admin-lb-table')!.textContent!, /Stale/);
  } finally { globalThis.fetch = priorFetch; resetDom(); }
});
