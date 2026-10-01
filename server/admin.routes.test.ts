import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import { createApp } from './app';
import { closeDb } from './db';
import { campaignBossRosterError, normalizeMenuConfig } from './routes/admin';
import { defaultCampaignBoss } from '../src/game/campaign';

test('admin branding keeps safe logo, background and favicon assets', () => {
  const background = 'https://cdn.example.com/menu.webp';
  const logo = 'data:image/webp;base64,AAAA';
  const config = normalizeMenuConfig({
    eyebrow: 'Briefing', title: 'Fruit TD', subtitle: 'Hold the wall', announcement: 'Live',
    themeColor: '#a3e635', backgroundImage: background, logoImage: logo, faviconImage: 'javascript:alert(1)',
  });
  assert.equal(config.backgroundImage, background);
  assert.equal(config.logoImage, logo);
  assert.equal(config.faviconImage, '');
  assert.equal(config.themeColor, '#a3e635');

  const partial = normalizeMenuConfig({ title: 'New title' }, config);
  assert.equal(partial.title, 'New title');
  assert.equal(partial.backgroundImage, background);
  assert.equal(partial.logoImage, logo);
});

test('admin accepts all generated campaign bosses and optimized reveal images', () => {
  const roster = Array.from({ length: 100 }, (_, index) => defaultCampaignBoss(index + 1));
  roster[99].revealImage = `data:image/webp;base64,${'A'.repeat(29_900)}`;
  assert.equal(campaignBossRosterError(roster), null);

  roster[99].revealImage = `data:image/webp;base64,${'A'.repeat(30_001)}`;
  assert.match(campaignBossRosterError(roster) || '', /under 30 KB/);
  roster[99].revealImage = undefined;
  roster[99].rewardCoins += 1_000_000;
  assert.match(campaignBossRosterError(roster) || '', /Invalid campaign boss roster/);
});

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
    body: JSON.stringify({ pin: 'invalid-development-pin' }),
  });
  assert.equal(verifyNoPin.status, 200);
  const noPinBody = await verifyNoPin.json();
  assert.equal(noPinBody.isAdmin, false, 'PIN should not grant admin access');

  const verifySpoofedHeader = await fetch(`${base}/api/admin/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-steamid': 'spoofed-steam-id',
    },
    body: JSON.stringify({ steamId: 'spoofed-steam-id' }),
  });
  assert.equal((await verifySpoofedHeader.json()).isAdmin, false, 'Spoofed Steam ID should not grant admin access');

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
