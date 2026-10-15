import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { createApp } from './app';
import { decodeSpriteImage } from './routes/media';

test('sprite media accepts image signatures and rejects disguised content', () => {
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.from('safe')]);
  assert.equal(decodeSpriteImage(`data:image/png;base64,${png.toString('base64')}`)?.contentType, 'image/png');
  assert.equal(decodeSpriteImage('data:image/png;base64,PHNjcmlwdD4='), null);
  assert.equal(decodeSpriteImage('data:image/svg+xml;base64,PHN2Zz4='), null);
});

test('sprite upload needs an authenticated admin', async (t) => {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: 'data:image/png;base64,iVBORw0KGgo=' }),
  });
  assert.equal(response.status, 403);
});
