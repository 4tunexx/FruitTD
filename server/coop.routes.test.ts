import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { createCoopService } from './routes/coop';

test('two authenticated Co-op clients share rooms, commands and equal idempotent rewards', async (t) => {
  const tables = new Map<string, any[]>();
  const credits = new Map<string, any>();
  const rows = (name: string) => { if (!tables.has(name)) tables.set(name, []); return tables.get(name)!; };
  const values = (row: any, path: string): any[] => {
    const parts = path.split('.'); let nodes = [row];
    for (const part of parts) nodes = nodes.flatMap(node => Array.isArray(node) && !/^\d+$/.test(part) ? node.map(item => item?.[part]) : [node?.[part]]);
    return nodes;
  };
  const matches = (row: any, query: any): boolean => Object.entries(query).every(([key, value]: [string, any]) => {
    if (key === '$or') return value.some((alternative: any) => matches(row, alternative));
    const candidates = values(row, key).flat();
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('$ne' in value) return candidates.every(v => v !== value.$ne);
      if ('$gt' in value) return candidates.some(v => v > value.$gt);
      if ('$lt' in value) return candidates.some(v => v < value.$lt);
      if ('$lte' in value) return candidates.some(v => v <= value.$lte);
      if ('$in' in value) return candidates.some(v => value.$in.includes(v));
      if ('$regex' in value) return candidates.some(v => new RegExp(value.$regex, value.$options).test(String(v ?? '')));
    }
    return candidates.some(v => v === value);
  });
  const collection = async (name: string) => ({
    findOne: async (q: any) => structuredClone(rows(name).find(r => matches(r, q)) ?? null),
    insertOne: async (row: any) => { rows(name).push(structuredClone(row)); return {}; },
    replaceOne: async (q: any, row: any) => { const index = rows(name).findIndex(r => matches(r, q)); if (index < 0) return { modifiedCount: 0 }; rows(name)[index] = structuredClone(row); return { modifiedCount: 1 }; },
    updateOne: async (q: any, update: any, options?: any) => {
      let row = rows(name).find(r => matches(r, q));
      if (!row && options?.upsert) { row = { ...q, ...update.$setOnInsert }; rows(name).push(row); }
      if (!row) return { modifiedCount: 0 };
      for (const key of Object.keys(update.$unset ?? {})) delete row[key];
      for (const [key, value] of Object.entries(update.$set ?? {})) {
        if (key === 'players.$[self].lastSeenAt') row.players.find((p: any) => p.userId === options.arrayFilters[0]['self.userId']).lastSeenAt = value;
        else row[key] = value;
      }
      for (const [key, value] of Object.entries(update.$inc ?? {})) row[key] = (row[key] ?? 0) + Number(value);
      for (const [key, value] of Object.entries(update.$addToSet ?? {})) row[key] = [...new Set([...(row[key] ?? []), value])];
      return { modifiedCount: 1 };
    },
  });
  const service = createCoopService({
    publish: async () => {},
    token: async (params) => params,
    collection: collection as any,
    resolveUser: async (req) => ['one', 'two', 'three'].includes(String(req.headers.authorization)) ? { userId: String(req.headers.authorization), nickname: String(req.headers.authorization) } as any : null,
    creditReward: (async (user: string, receipt: string, reward: any) => { credits.set(`${user}:${receipt}`, reward); return { saveData: {} }; }) as any,
  });
  const app = express(); app.use(express.json()); app.use('/api/coop', service.router);
  const server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port');
  const base = `http://127.0.0.1:${address.port}/api/coop`;
  const post = (path: string, user: string, body: object = {}) => fetch(base + path, { method: 'POST', headers: { Authorization: user, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const status = async (user: string) => (await fetch(base + '/status', { headers: { Authorization: user } })).json();
  rows('users').push({ userId: 'two', username: 'two', nickname: 'two' });
  rows('friends').push({ userId: 'one', friendId: 'two', state: 'accepted' });
  assert.equal((await fetch(base + '/status')).status, 401);
  const created = await (await post('/create', 'one', { public: false })).json();
  const id = created.room.id;
  assert.equal((await post(`/${id}/invite`, 'one', { username: 'two' })).status, 200);
  assert.equal(rows('notifications').length, 1);
  assert.equal(rows('notifications')[0].type, 'coop_invite');
  assert.match(rows('notifications')[0].body, new RegExp(id, 'i'));
  assert.equal((await post('/create', 'one')).status, 409);
  assert.equal((await post('/join', 'two', { code: 'invalid' })).status, 400);
  assert.equal((await post('/join', 'two', { code: id })).status, 200);
  assert.equal((await post('/join', 'three', { code: id })).status, 404);
  assert.equal((await post(`/${id}/token`, 'three')).status, 404);
  const permissions = await (await post(`/${id}/token`, 'one')).json();
  assert.equal(permissions.clientId, 'one');
  assert.equal(permissions.ttl, 60000);
  assert.deepEqual(JSON.parse(permissions.capability), { [`fruittd-coop-${id}`]: ['subscribe'] });
  const stored = rows('coop_matches')[0]; stored.status = 'playing'; stored.remainingSpawns = 1; stored.spawnAt = Date.now() + 100000;
  stored.fruits = [{ id: 'fruit', type: 'normal', x: 5, y: 5, hp: 60, boss: false }];
  const cut = { type: 'slash', from: { x: 4, y: 5 }, to: { x: 6, y: 5 } };
  assert.equal((await post(`/${id}/command`, 'three', { sequence: 1, command: cut })).status, 404);
  assert.equal((await post(`/${id}/command`, 'one', { sequence: 1, command: cut })).status, 200);
  assert.equal((await post(`/${id}/command`, 'two', { sequence: 1, command: cut })).status, 200);
  assert.equal((await post(`/${id}/command`, 'one', { sequence: 1, command: cut })).status, 400);
  assert.equal((await status('one')).room.kills, 1);
  assert.equal((await status('two')).room.kills, 1);
  rows('coop_matches')[0].completedWaves = 6;
  assert.equal((await post(`/${id}/command`, 'one', { sequence: 2, command: { type: 'leave' } })).status, 200);
  await status('one'); await status('two');
  assert.equal(credits.size, 2);
  assert.deepEqual(credits.get(`one:coop:${id}`), credits.get(`two:coop:${id}`));
  assert.equal(rows('achievements').length, 2);
  assert.equal(rows('leaderboards').length, 2, 'both teammates receive a server verified Co-op record');
  assert.ok(rows('leaderboards').every(row => row.mode === 'coop' && row.wave === 6 && row.score === rows('coop_matches')[0].score));
  assert.equal((await post(`/${id}/command`, 'two', { sequence: 2, command: cut })).status, 409);
  assert.equal((await post(`/${id}/token`, 'one')).status, 404);
  assert.equal((await post(`/${id}/ack`, 'one')).status, 200);
  assert.equal((await status('one')).room, null);
  assert.equal((await post(`/${id}/ack`, 'two')).status, 200);
  const publicRoom = await (await post('/create', 'one', { public: true })).json();
  const paired = await (await post('/create', 'two', { public: true })).json();
  assert.equal(paired.room.id, publicRoom.room.id);
  assert.equal(paired.room.players.length, 2);
});
