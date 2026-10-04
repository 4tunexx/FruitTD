import { installDomStub } from '../domStub.test-helper';
installDomStub();

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderCoopLobby } from './coopLobby';

test('local Co-op shows both player controls and starts a real match callback', () => {
  const root = document.createElement('div');
  let starts = 0;
  renderCoopLobby(root, () => { starts += 1; });
  assert.match(root.textContent || '', /PLAYER 1/);
  assert.match(root.textContent || '', /PLAYER 2/);
  assert.match(root.textContent || '', /arrow keys/i);
  const play = root.querySelector<HTMLButtonElement>('.ftd-coop-lobby__button');
  assert.ok(play);
  play.click();
  assert.equal(starts, 1);
});
