import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import { createApp } from './app';
import { closeDb } from './db';

async function listen(app: ReturnType<typeof createApp>): Promise<{ server: Server; base: string }> {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server');
  }
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test('leaderboard rejects absurd score values', async (t) => {
  const { server, base } = await listen(createApp());
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await closeDb();
  });

  // Test absurdly high score
  const absurdScore = await fetch(`${base}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user-1',
      nickname: 'TestUser',
      score: 99_999_999_999, // Way over 10M limit
      mode: 'casual',
      wave: 10,
    }),
  });
  assert.equal(absurdScore.status, 400, 'Should reject score > 10M');
  const absurdBody = await absurdScore.json();
  assert.ok(absurdBody.error?.includes('reasonable'), 'Error should mention reasonable limits');

  // Test absurd wave
  const absurdWave = await fetch(`${base}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user-2',
      nickname: 'TestUser',
      score: 5000,
      mode: 'casual',
      wave: 9999,
    }),
  });
  assert.equal(absurdWave.status, 400, 'Should reject wave > 1000');

  // Test absurd combo
  const absurdCombo = await fetch(`${base}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user-3',
      nickname: 'TestUser',
      score: 5000,
      mode: 'casual',
      wave: 10,
      maxCombo: 99999,
    }),
  });
  assert.equal(absurdCombo.status, 400, 'Should reject combo > 5000');

  const unauthenticatedScore = await fetch(`${base}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ score: 5000, mode: 'casual', wave: 10 }),
  });
  assert.equal(unauthenticatedScore.status, 401, 'Scores require an authenticated session');

  // Test valid score
  const validScore = await fetch(`${base}/api/leaderboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user-4',
      nickname: 'TestUser',
      score: 5000,
      mode: 'casual',
      wave: 10,
      maxCombo: 50,
      fruitsSliced: 200,
    }),
  });
  assert.equal(validScore.status, 401, 'Client-supplied user IDs must not bypass authentication');
});

test('cloud save sync rejects absurd economy values', async (t) => {
  const { server, base } = await listen(createApp());
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await closeDb();
  });

  // Test absurd coins
  const absurdCoins = await fetch(`${base}/api/profile/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user-5',
      saveData: {
        coins: 999_999_999,
        skillPoints: 10,
        xp: { jiju: 1000 },
      },
    }),
  });
  assert.equal(absurdCoins.status, 400, 'Should reject coins > 1M');

  // Test absurd skill points
  const absurdSp = await fetch(`${base}/api/profile/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user-6',
      saveData: {
        coins: 1000,
        skillPoints: 999999,
        xp: { jiju: 1000 },
      },
    }),
  });
  assert.equal(absurdSp.status, 400, 'Should reject skillPoints > 10000');

  // Test absurd hero XP
  const absurdXp = await fetch(`${base}/api/profile/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user-7',
      saveData: {
        coins: 1000,
        skillPoints: 10,
        xp: { jiju: 999_999_999 },
      },
    }),
  });
  assert.equal(absurdXp.status, 400, 'Should reject hero XP > 1M');

  // Test valid save
  const validSave = await fetch(`${base}/api/profile/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'test-user-8',
      saveData: {
        coins: 5000,
        skillPoints: 15,
        xp: { jiju: 50000, topfu: 10000 },
        nickname: 'ValidUser',
        avatar: 'avatar.jpg',
      },
    }),
  });
  assert.equal(validSave.status, 401, 'Cloud saves require an authenticated session');
});

test('progression and reward routes require an authenticated session', async (t) => {
  const { server, base } = await listen(createApp());
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    await closeDb();
  });

  const protectedReads = ['/api/achievements', '/api/missions', '/api/badges', '/api/daily'];
  for (const endpoint of protectedReads) {
    const response = await fetch(`${base}${endpoint}?userId=another-user`);
    assert.equal(response.status, 401, `${endpoint} must not trust a client user ID`);
  }

  const protectedWrites = [
    ['/api/achievements/progress', { userId: 'another-user', updates: [] }],
    ['/api/missions/progress', { userId: 'another-user', updates: [] }],
    ['/api/badges/progress', { userId: 'another-user', updates: [] }],
    ['/api/daily/claim', { userId: 'another-user' }],
  ] as const;
  for (const [endpoint, body] of protectedWrites) {
    const response = await fetch(`${base}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 401, `${endpoint} must require a session`);
  }
});
