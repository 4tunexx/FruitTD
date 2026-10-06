import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pvpAccountIdentity } from './pvpIdentity';

test('PvP identity uses the linked Steam persona and current Steam avatar', () => {
  assert.deepEqual(pvpAccountIdentity({ steamId: '7656119', steamPersona: 'Fresh Steam Name', steamAvatar: 'https://steam/avatar.jpg', username: 'old_handle', nickname: 'Old Name', avatar: 'old.jpg' }), {
    name: 'Fresh Steam Name', avatar: 'https://steam/avatar.jpg',
  });
});

test('non-Steam profiles use the account name and avatar with safe fallbacks', () => {
  assert.deepEqual(pvpAccountIdentity({ username: 'fruitfan', nickname: 'Fruit Fan', avatar: 'https://cdn/avatar.jpg' }), {
    name: 'fruitfan', avatar: 'https://cdn/avatar.jpg',
  });
  assert.deepEqual(pvpAccountIdentity(undefined, ''), { name: 'Player', avatar: '' });
});
