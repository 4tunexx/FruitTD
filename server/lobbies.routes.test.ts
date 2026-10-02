import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { createLobbyRouter } from './routes/lobbies';

const players = Array.from({ length: 6 }, (_, i) => ({ userId: `player-${i}`, username: `player_${i}`, nickname: `Player ${i}` }));

test('rooms cap at four, enforce private codes, and send invites to accepted friends', async (t) => {
  const rooms: any[] = [], notices: any[] = [];
  const matches = (room: any, q: any): boolean => Object.entries(q).every(([key, value]: [string, any]) => {
    if (key === '$expr') return room.members.length < 4;
    if (key === 'members.userId') return value?.$ne ? !room.members.some((m: any) => m.userId === value.$ne) : room.members.some((m: any) => m.userId === value);
    if (key === 'expiresAt') return room.expiresAt > value.$gt;
    return room[key] === value;
  });
  const col = {
    findOne: async (q: any) => rooms.find((room) => matches(room, q)) ?? null,
    insertOne: async (room: any) => { rooms.push(room); },
    findOneAndUpdate: async (q: any, update: any) => {
      const room = rooms.find((row) => matches(row, q)); if (!room) return null;
      if (update.$push) room.members.push(update.$push.members);
      if (update.$set) room.members.find((m: any) => m.userId === q['members.userId']).ready = update.$set['members.$.ready'];
      return room;
    },
    findOneAndDelete: async (q: any) => { const i = rooms.findIndex((row) => matches(row, q)); return i < 0 ? null : rooms.splice(i, 1)[0]; },
    updateOne: async (q: any, update: any) => { const room = rooms.find((row) => matches(row, q)); if (room) room.members = room.members.filter((m: any) => m.userId !== update.$pull.members.userId); },
  };
  const deps: any = {
    resolveUser: async (req: express.Request) => players.find((p) => p.userId === req.headers.authorization) ?? null,
    collection: async (name: string) => name === 'coop_lobbies' ? col : name === 'users' ? {
      findOne: async (query: any) => players.find((p) => query.userId ? p.userId === query.userId : new RegExp(query.username.$regex, 'i').test(p.username)) ?? null,
    } : name === 'friends' ? {
      findOne: async (q: any) => q.userId === 'player-0' && q.friendId === 'player-1' ? { state: 'accepted' } : null,
    } : { insertOne: async (notification: any) => { notices.push(notification); } },
  };
  const app = express(); app.use(express.json()); app.use('/api/lobbies', createLobbyRouter(deps));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  const base = `http://127.0.0.1:${address.port}/api/lobbies`;
  const post = (path: string, user: number, body: object = {}) => fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: players[user].userId }, body: JSON.stringify(body) });
  assert.equal((await fetch(`${base}/mine`)).status, 401);
  const created = await post('/', 0, { visibility: 'friends' });
  assert.equal(created.status, 201);
  const { lobby } = await created.json();
  assert.equal((await post('/join', 1)).status, 404, 'private rooms cannot enter random matching');
  assert.equal((await post('/invite', 0, { username: 'player_2' })).status, 403);
  assert.equal((await post('/invite', 0, { friendId: 'player-1' })).status, 200);
  assert.match(notices[0].body, new RegExp(lobby.code));
  const joined = await Promise.all([1, 2, 3, 4].map((id) => post('/join', id, { code: lobby.code })));
  assert.equal(joined.filter((r) => r.status === 200).length, 3);
  assert.equal(rooms[0].members.length, 4);
  assert.equal((await post('/ready', 1, { ready: true })).status, 200);
  assert.equal(rooms[0].members.find((m: any) => m.userId === 'player-1').ready, true);
  assert.equal((await post('/leave', 0)).status, 200);
  assert.equal(rooms.length, 0);
});
