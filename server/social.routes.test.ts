import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test, type TestContext } from 'node:test';
import express from 'express';
import { createSocialRouter, type SocialRouteDeps } from './routes/social';

const alice = { userId: 'alice-id', username: 'alice', nickname: 'Alice', avatar: '', createdAt: new Date(), updatedAt: new Date() };
const bob = { userId: 'bob-id', username: 'bob', nickname: 'Bob', avatar: '', createdAt: new Date(), updatedAt: new Date() };
function matches(doc: any, filter: any): boolean {
  if (filter.$or) return filter.$or.some((branch: any) => matches(doc, branch));
  return Object.entries(filter).every(([key, expected]: [string, any]) => {
    const actual = doc[key];
    if (expected?.$regex) return new RegExp(expected.$regex, expected.$options).test(String(actual || ''));
    if (expected?.$exists !== undefined) return expected.$exists ? actual !== undefined : actual === undefined;
    if (expected?.$in) return expected.$in.includes(actual);
    return actual === expected;
  });
}
function memoryCollection(initial: any[] = []) {
  const rows = initial;
  return {
    rows,
    findOne: async (filter: any) => rows.find((doc) => matches(doc, filter)) ?? null,
    insertOne: async (doc: any) => { rows.push(doc); return { insertedId: doc.userId || doc.notificationId }; },
    updateOne: async (filter: any, update: any) => { const row = rows.find((doc) => matches(doc, filter)); if (!row) return { matchedCount: 0 }; Object.assign(row, update.$set); return { matchedCount: 1 }; },
    deleteOne: async (filter: any) => { const i = rows.findIndex((doc) => matches(doc, filter)); if (i < 0) return { deletedCount: 0 }; rows.splice(i, 1); return { deletedCount: 1 }; },
    updateMany: async (filter: any, update: any) => { let modifiedCount = 0; for (const row of rows.filter((doc) => matches(doc, filter))) { Object.assign(row, update.$set); modifiedCount++; } return { modifiedCount }; },
    find: (filter: any) => {
      let selected = rows.filter((doc) => matches(doc, filter));
      const cursor: any = { sort: () => cursor, limit: (n: number) => { selected = selected.slice(0, n); return cursor; }, toArray: async () => selected };
      return cursor;
    },
  };
}
function setup(authenticated = true) {
  const users = memoryCollection([alice, bob]);
  const friends = memoryCollection();
  const notifications = memoryCollection();
  const messages = memoryCollection();
  const cloud = memoryCollection([{ userId: 'bob-id', saveData: { hero: 'jiju', highScore: 900, bestWave: 7, games: 12 } }]);
  const leaders = memoryCollection(); const badges = memoryCollection();
  const cols: Record<string, any> = { users, friends, notifications, messages, cloud_saves: cloud, leaderboards: leaders, badges };
  let currentUser: any = alice;
  const deps: SocialRouteDeps = { resolveUser: async () => authenticated ? currentUser : null, collection: async (name) => cols[name] as any };
  return { router: createSocialRouter(deps), cols, setUser: (user: any) => { currentUser = user; } };
}
async function listen(router: express.Router) {
  const app = express(); app.use(express.json()); app.use('/api/social', router);
  const server = createServer(app); await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Failed to bind test server');
  return { server, base: `http://127.0.0.1:${address.port}/api/social` };
}
function closeAfter(t: TestContext, server: Server) { t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()))); }

test('social endpoints require auth for friends and return a privacy-limited public profile', async (t) => {
  const unauth = setup(false); const anon = await listen(unauth.router); closeAfter(t, anon.server);
  assert.equal((await fetch(`${anon.base}/friends`)).status, 401);
  const auth = setup(); const live = await listen(auth.router); closeAfter(t, live.server);
  const response = await fetch(`${live.base}/profiles/bob`);
  assert.equal(response.status, 200);
  const { profile } = await response.json();
  assert.equal(profile.username, 'bob'); assert.equal(profile.highScore, 900);
  assert.equal('email' in profile, false); assert.equal('userId' in profile, false);
});

test('social requests are addressed by username and messages require an accepted friendship', async (t) => {
  const { router, cols, setUser } = setup(); const live = await listen(router); closeAfter(t, live.server);
  const request = await fetch(`${live.base}/friends/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'bob' }) });
  assert.equal(request.status, 201);
  assert.equal(cols.notifications.rows.length, 1);
  setUser(bob);
  const response = await fetch(`${live.base}/friends/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friendId: 'alice-id', accept: true }) });
  assert.equal(response.status, 200);
  setUser(alice);
  const sent = await fetch(`${live.base}/messages/bob`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Hold the wall!' }) });
  assert.equal(sent.status, 201);
  assert.equal(cols.messages.rows[0].senderId, 'alice-id');
  assert.equal(cols.messages.rows[0].recipientId, 'bob-id');
  const spoofed = await fetch(`${live.base}/friends/respond`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ friendId: 'someone-else', accept: true }) });
  assert.equal(spoofed.status, 404);
});
