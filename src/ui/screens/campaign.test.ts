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

test('Campaign labels the cleared final stage as replayable', () => {
  const root = document.createElement('main');
  const save = defaultSave();
  save.campaignProgress = { unlocked: 100, cleared: Array.from({ length: 100 }, (_, i) => i + 1) };
  renderCampaign(root, save, () => undefined);
  assert.match(root.querySelector('[data-testid="campaign-start-stage"]')?.textContent || '', /REPLAY STAGE/);
});

test('Campaign can browse back to and replay every older cleared stage', () => {
  const root = document.createElement('main');
  const save = defaultSave();
  save.campaignProgress = { unlocked: 30, cleared: Array.from({ length: 29 }, (_, i) => i + 1) };
  const started: number[] = [];
  renderCampaign(root, save, (stage) => started.push(stage));

  const previous = root.querySelector<HTMLButtonElement>('[data-testid="campaign-prev"]')!;
  for (let i = 0; i < 6; i++) previous.click();
  const first = [...root.querySelectorAll<HTMLButtonElement>('.ftd-stage')]
    .find((stage) => stage.getAttribute('aria-label') === 'Stage 1, cleared');
  assert.ok(first, 'stage 1 must remain reachable after later stages unlock');
  first.click();
  root.querySelector<HTMLButtonElement>('[data-testid="campaign-start-stage"]')!.click();
  assert.deepEqual(started, [1]);
  assert.equal(previous.disabled, true);
  root.querySelector<HTMLButtonElement>('[data-testid="campaign-next"]')!.click();
  assert.equal(root.querySelector<HTMLButtonElement>('[data-testid="campaign-prev"]')!.disabled, false);
});

test('selecting Campaign shows its briefing and opens the stage launcher from Panel 2', async () => {
  const { navigation } = await import('../../game/navigation');
  const { renderHub, registerHubTab, resetHub } = await import('./hub');
  const { homeHubTab } = await import('./hubTabs');
  const { resetRegistry, registerScreen, installScreenRouter } = await import('./registry');
  resetHub();
  resetRegistry();
  navigation.reset('MAIN_MENU');
  const hub = document.createElement('div');
  const campaign = document.createElement('div');
  hub.id = 'screen-hub';
  campaign.id = 'screen-campaign';
  document.body.appendChild(hub);
  document.body.appendChild(campaign);
  const started: number[] = [];
  const save = defaultSave();
  registerScreen({ id: 'MAIN_MENU', elementId: 'screen-hub' });
  registerScreen({ id: 'CAMPAIGN', elementId: 'screen-campaign', overlay: true, onEnter: () => renderCampaign(campaign, save, (stage) => started.push(stage)) });
  installScreenRouter();
  registerHubTab(homeHubTab(() => undefined, undefined, () => navigation.open('CAMPAIGN')));
  renderHub(hub, save, 'MAIN_MENU', { onPlay: () => undefined });
  hub.querySelector<HTMLButtonElement>('[data-testid="campaign-open"]')!.click();
  assert.equal(navigation.state, 'MAIN_MENU', 'choosing Campaign should show its briefing before opening the map');
  assert.match(hub.querySelector('.ftd-hub__sub')?.textContent ?? '', /Campaign/);
  hub.querySelector<HTMLButtonElement>('[data-testid="nav-play"]')!.click();
  assert.equal(navigation.state, 'CAMPAIGN');
  assert.equal(campaign.classList.contains('hidden'), false);
  campaign.querySelector<HTMLButtonElement>('[data-testid="campaign-start-stage"]')!.click();
  assert.deepEqual(started, [1]);
  navigation.reset('MAIN_MENU');
  resetRegistry();
  resetHub();
  hub.remove(); campaign.remove();
});

test('hub keeps launch beside the map after moving boss intel to its side panel', async () => {
  const { menuHubTabs } = await import('./menuHubTabs');
  const { renderHub, registerHubTab, resetHub } = await import('./hub');
  resetHub();
  const starts: number[] = [];
  for (const tab of menuHubTabs({ onOpenDaily() {}, onToggleSound() {}, onLogout() {}, onStartCampaign: stage => starts.push(stage), showLobbyPage() {} })) registerHubTab(tab);
  const root = document.createElement('div');
  const save = defaultSave(); save.campaignProgress = { unlocked: 3, cleared: [1, 2] };
  renderHub(root, save, 'CAMPAIGN', { onPlay() {} });
  const main = root.querySelector('.ftd-hub__main')!;
  const sub = root.querySelector('.ftd-hub__sub')!;
  assert.ok(main.querySelector('[data-testid="campaign-start-stage"]'));
  assert.ok(sub.querySelector('.ftd-boss-reveal'));
  assert.equal(sub.querySelector('[data-testid="campaign-start-stage"]'), null);
  Array.from(main.querySelectorAll<HTMLButtonElement>('.ftd-stage')).find(stage => stage.getAttribute('aria-label') === 'Stage 1, cleared')!.click();
  const launch = main.querySelector<HTMLButtonElement>('[data-testid="campaign-start-stage"]')!;
  assert.match(launch.textContent || '', /REPLAY STAGE/);
  main.querySelector<HTMLButtonElement>('[data-testid="campaign-start-stage"]')!.click();
  assert.deepEqual(starts, [1], 'pinned launch starts the selected stage without scrolling boss intel');
  resetHub();
});
