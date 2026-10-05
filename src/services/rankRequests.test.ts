import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchMonthlyRank } from './api';
import { setAuthToken } from './auth';
const storage = new Map<string, string>();
(globalThis as any).localStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) };

test('signed-out startup skips personal monthly-rank requests', async () => {
  setAuthToken(null);
  const previous = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('No service expected'); };
  try { assert.equal(await fetchMonthlyRank(), null); assert.equal(calls, 0); }
  finally { globalThis.fetch = previous; }
});

test('monthly rank uses the authenticated session without a client-supplied identity', async () => {
  setAuthToken('test-only'); storage.set('fruit_td_user_id', 'local-id');
  const previous = globalThis.fetch; let endpoint = ''; let authorization: string | null = null;
  globalThis.fetch = async (url, options) => {
    endpoint = String(url); authorization = new Headers(options?.headers).get('Authorization');
    return new Response(JSON.stringify({ success: true, season: '2026-10', score: 0 }));
  };
  try { await fetchMonthlyRank(); assert.equal(endpoint, '/api/leaderboard/monthly-rank'); assert.equal(authorization, 'Bearer test-only'); }
  finally { globalThis.fetch = previous; setAuthToken(null); }
});
