import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Db, IndexSpecification } from 'mongodb';
import { ensureDatabaseIndexes } from './db';

test('a failed index does not prevent later database indexes from being created', async () => {
  const attempts: Array<{ collection: string; keys: IndexSpecification }> = [];
  const db = {
    collection: (collection: string) => ({
      createIndex: async (keys: IndexSpecification) => {
        attempts.push({ collection, keys });
        if (attempts.length === 1) throw new Error('legacy duplicate data');
        return 'created';
      },
    }),
  } as unknown as Db;
  const previousWarn = console.warn;
  console.warn = () => {};

  try {
    await ensureDatabaseIndexes(db);
  } finally {
    console.warn = previousWarn;
  }

  assert.equal(attempts.length, 46);
  assert.deepEqual(attempts[1], { collection: 'leaderboards', keys: { userId: 1, mode: 1 } });
  assert.deepEqual(attempts.at(-1), { collection: 'pvp_challenges', keys: { toId: 1, expiresAt: 1 } });
});
