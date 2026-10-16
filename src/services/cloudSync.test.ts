import assert from 'node:assert/strict';
import { test } from 'node:test';

test('cloud sync reloads a conflicting revision and keeps campaign clears from both saves', async () => {
  const values = new Map<string, string>([
    ['fruit_td_token', 'session-token'],
    ['fruit_td_user_id', 'user-1'],
  ]);
  const previousStorage = globalThis.localStorage;
  const previousFetch = globalThis.fetch;
  (globalThis as any).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const posts: Array<{ revision: number; saveData: any }> = [];
  let reads = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/profile') {
      reads++;
      return Response.json({ success: true, revision: reads === 1 ? 2 : 3,
        saveData: { campaignProgress: reads === 1
          ? { unlocked: 2, cleared: [1] }
          : { unlocked: 4, cleared: [1, 3] } } });
    }
    assert.equal(String(input), '/api/profile/sync');
    posts.push(JSON.parse(String(init?.body)));
    return posts.length === 1
      ? Response.json({ success: false, revision: 3 }, { status: 409 })
      : Response.json({ success: true, revision: 4 });
  }) as typeof fetch;
  try {
    const { syncCloudSave } = await import('./api');
    const saved = await syncCloudSave({ nickname: 'Slicer', avatar: '', mode: 'campaign',
      campaignProgress: { unlocked: 3, cleared: [1, 2] } });
    assert.equal(saved, true);
    assert.deepEqual(posts.map((post) => post.revision), [2, 3]);
    assert.deepEqual(posts[1].saveData.campaignProgress, { unlocked: 4, cleared: [1, 2, 3] });
  } finally {
    globalThis.fetch = previousFetch;
    (globalThis as any).localStorage = previousStorage;
  }
});
