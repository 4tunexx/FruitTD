import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { createProfileRouter, sanitizeRun } from './routes/profile';

const now = Date.now();
const validRun = { id: 'r1', mode: 'horde', score: 500, wave: 4, combo: 9, kills: 30, strokes: 40, hits: 30, completed: true, date: now - 1000 };

test('run records are bounded and cannot claim impossible accuracy or unknown modes', () => {
  assert.ok(sanitizeRun(validRun));
  assert.equal(sanitizeRun({ ...validRun, mode: 'arena' }), null);
  assert.equal(sanitizeRun({ ...validRun, hits: 41 }), null);
  assert.equal(sanitizeRun({ ...validRun, score: -1 }), null);
  assert.equal(sanitizeRun({ ...validRun, date: now + 10 * 86_400_000 }), null);
  assert.equal(sanitizeRun({ ...validRun, id: 'x'.repeat(81) }), null);
});

test('history returns the signed-in player\'s own PvP matches and stored runs; duplicate uploads are ignored', async () => {
  const runs: any[] = [];
  const matches = [{
    id: 'm1', queue: 'ranked', status: 'complete', updatedAt: new Date(now), winnerId: 'u1', resultReason: 'wall', map: { id: 'old-grove', name: 'Old Grove' },
    players: [{ userId: 'u1', name: 'Me', wallHealth: 80, wallMaxHealth: 100, ratingDelta: 12 }, { userId: 'u2', name: 'Rival', wallHealth: 0, wallMaxHealth: 100 }],
  }];
  const collection = async (name: string): Promise<any> => name === 'pvp_matches'
    ? { find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => matches }) }) }) }
    : {
      find: (query: any) => ({ sort: () => ({ limit: () => ({ toArray: async () => runs.filter(row => row.userId === query.userId) }) }) }),
      updateOne: async (filter: any, update: any) => {
        if (runs.some(row => row.userId === filter.userId && row.id === filter.id)) return { upsertedCount: 0 };
        runs.push(update.$setOnInsert); return { upsertedCount: 1 };
      },
    };
  const app = express(); app.use(express.json());
  app.use('/p', createProfileRouter({ resolveUser: async () => ({ userId: 'u1' } as any), collection, allowedSkinIds: async () => new Set() }));
  const server = createServer(app); await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${(server.address() as any).port}/p`;
    const post = () => fetch(`${base}/runs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ runs: [validRun, { ...validRun, id: 'bad', mode: 'nope' }] }) }).then(r => r.json());
    assert.equal((await post() as any).stored, 1);
    assert.equal((await post() as any).stored, 0);
    const history = await fetch(`${base}/history`).then(r => r.json()) as any;
    assert.equal(history.runs.length, 1);
    assert.deepEqual(history.pvp[0], { id: 'm1', queue: 'ranked', date: now, map: 'Old Grove', rival: 'Rival', result: 'win', reason: 'wall', ownWall: 80, rivalWall: 0, ratingDelta: 12 });
  } finally { server.close(); }
});
