import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { createApp } from './app';

test('Steam OpenID callback reaches signature verification with dotted query fields', async (t) => {
  const originalFetch = globalThis.fetch;
  let verified = false;
  globalThis.fetch = (async (input, init) => {
    assert.equal(input, 'https://steamcommunity.com/openid/login');
    const body = new URLSearchParams(String(init?.body));
    assert.equal(body.get('openid.mode'), 'check_authentication');
    assert.equal(body.get('openid.sig'), 'sample-signature');
    verified = true;
    return new Response('is_valid:false', { status: 200 });
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');

  const callback = new URL(`http://127.0.0.1:${address.port}/api/steam/callback`);
  callback.searchParams.set('mode', 'login');
  callback.searchParams.set('openid.mode', 'id_res');
  callback.searchParams.set('openid.claimed_id', 'https://steamcommunity.com/openid/id/76561198000000000');
  callback.searchParams.set('openid.sig', 'sample-signature');
  const response = await originalFetch(callback, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(verified, true);
  assert.equal(new URL(response.headers.get('location') || '').searchParams.get('auth_error'), 'Steam login could not be verified.');

  const unsafe = await originalFetch(`http://127.0.0.1:${address.port}/api/steam/callback?openid.%24where=1`, { redirect: 'manual' });
  assert.equal(unsafe.status, 400);
  const otherRoute = await originalFetch(`http://127.0.0.1:${address.port}/api/steam/status?openid.sig=1`, { redirect: 'manual' });
  assert.equal(otherRoute.status, 400);
});
