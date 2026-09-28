import { installDomStub } from '../domStub.test-helper';
installDomStub();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { showLegacyMenuPage } from './legacyMenu';

test('Achievements opens the quests page and selects its achievements subtab', () => {
  const root = document.createElement('div');
  root.classList.add('hidden');
  let clicked = 0;
  const tab = document.createElement('button');
  tab.click = () => { clicked++; };
  root.querySelector = (selector: string) =>
    selector.includes('data-sub="achievements"') ? tab : null;
  let page = '';

  showLegacyMenuPage('ACHIEVEMENTS', root, (next) => { page = next; });

  assert.equal(root.classList.contains('hidden'), false);
  assert.equal(page, 'quests');
  assert.equal(clicked, 1);
});

test('non-legacy screens hide the shared legacy lobby host', () => {
  const root = document.createElement('div');
  showLegacyMenuPage('SHOP', root, () => assert.fail('should not render a legacy page'));
  assert.equal(root.classList.contains('hidden'), true);
});
