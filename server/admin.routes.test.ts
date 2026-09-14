import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import { createApp } from './app';
import { closeDb } from './db';
import { ADMIN_STEAM_ID } from './routes/admin';

async function listen(app: ReturnType<typeof createApp>): Promise<{ server: Server; base: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind admin test server');
  }
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test('admin API routes are registered and authorized', async (t) => {
  const { server, base } = await listen(createApp());
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await closeDb();
  });

  // PIN auth removed - only Steam ID accepted
  const verifyNoPin = await fetch(`${base}/api/admin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '1337' }),
  });
  assert.equal(verifyNoPin.status, 200);
  const noPinBody = await verifyNoPin.json();
  assert.equal(noPinBody.isAdmin, false, 'PIN should not grant admin access');

  const verifySteam = await fetch(`${base}/api/admin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steamId: ADMIN_STEAM_ID }),
  });
  assert.equal((await verifySteam.json()).isAdmin, true, 'Valid Steam ID should grant admin access');

  const denySave = await fetch(`${base}/api/admin/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(denySave.status, 403, 'Config save without auth should be denied');

  const config = await fetch(`${base}/api/admin/config`);
  assert.notEqual(config.status, 404);
  assert.ok(config.status === 200 || config.status === 500);
  if (config.status === 200) {
    const body = await config.json();
    assert.equal(body.success, true);
    assert.equal(body.config.dailyRewards.length, 7);
    assert.ok(Array.isArray(body.config.vipTiers) && body.config.vipTiers.length === 3, 'VIP tiers should be present');
    assert.ok(Array.isArray(body.config.missions) && body.config.missions.length > 0);
    assert.ok(Array.isArray(body.config.ranks) && body.config.ranks.some((r: { id: string }) => r.id === 'diamond'));
    assert.ok(Array.isArray(body.config.badges) && body.config.badges.length > 0);
  }
});
