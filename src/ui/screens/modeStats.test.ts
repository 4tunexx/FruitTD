import { installDomStub, resetDom } from '../domStub.test-helper';
installDomStub();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderModeStats } from './modeStats';

const key = 'fruit-td-run-history-v1';
function run(id: string, score: number) {
  return { id, mode: 'casual', score, wave: 1, combo: 2, kills: 4, strokes: 10, hits: 6, completed: true, date: Date.now() };
}

test('one run shows a narrow chart mark and explains that no trend exists yet', () => {
  resetDom();
  localStorage.setItem(key, JSON.stringify([run('first', 99)]));
  const root = document.createElement('div');
  renderModeStats(root);
  const chart = root.querySelector<HTMLElement>('.ftd-score-chart');
  assert.equal(chart?.children.length, 1);
  assert.match(chart?.getAttribute('style') ?? '', /--points:1/);
  assert.match(root.querySelector('.ftd-run-trend__caption')?.textContent ?? '', /First run recorded/);
  assert.equal(root.querySelector('.ftd-run-trend__heading')?.querySelector('strong')?.textContent, '99');
});

test('several runs show separate score marks and a comparison', () => {
  resetDom();
  localStorage.setItem(key, JSON.stringify([run('first', 99), run('second', 120), run('third', 145)]));
  const root = document.createElement('div');
  renderModeStats(root);
  const chart = root.querySelector<HTMLElement>('.ftd-score-chart');
  assert.equal(chart?.children.length, 3);
  assert.match(chart?.getAttribute('style') ?? '', /--points:3/);
  assert.match(root.querySelector('.ftd-run-trend__caption')?.textContent ?? '', /25 points up/);
  assert.equal(root.querySelector('.ftd-run-kpis')?.querySelectorAll('.ftd-stat').length, 6);
});
