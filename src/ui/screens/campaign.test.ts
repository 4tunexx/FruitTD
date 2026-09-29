import { installDomStub } from '../domStub.test-helper';
installDomStub();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultSave } from '../../game/save';
import { renderCampaign } from './campaign';

test('Campaign renders unlocked stages, boss intel, and starts the selected stage', () => {
  const root = document.createElement('div');
  const save = defaultSave();
  save.campaignProgress = { unlocked: 6, cleared: [1, 2, 3, 4, 5] };
  const started: number[] = [];

  renderCampaign(root, save, (stage) => started.push(stage));

  assert.equal(root.querySelectorAll('.ftd-stage').length, 5);
  const stages = Array.from(root.querySelectorAll('.ftd-stage')) as HTMLElement[];
  assert.ok(stages.some((stage) => stage.getAttribute('aria-label') === 'Stage 6, available'));
  assert.match(root.textContent || '', /Campaign Overlord · Stage 6/);
  assert.match(root.textContent || '', /5 WAVES/);

  stages.find((stage) => stage.getAttribute('aria-label') === 'Stage 5, cleared')!.click();
  assert.match(root.textContent || '', /REPLAY STAGE/);
  (root.querySelector('[data-testid="campaign-start-stage"]') as HTMLElement).click();
  assert.deepEqual(started, [5]);
});

test('Campaign clamps corrupt progress and disables locked stages', () => {
  const root = document.createElement('div');
  const save = defaultSave();
  save.campaignProgress = { unlocked: 1, cleared: [] };
  renderCampaign(root, save, () => undefined);

  const stages = Array.from(root.querySelectorAll('.ftd-stage')) as HTMLButtonElement[];
  const first = stages.find((stage) => stage.getAttribute('aria-label') === 'Stage 1, available');
  const second = stages.find((stage) => stage.getAttribute('aria-label') === 'Stage 2, locked');
  assert.ok(first);
  assert.ok(second);
  assert.ok(second.hasAttribute('disabled'));
});
