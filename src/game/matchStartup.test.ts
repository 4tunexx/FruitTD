import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startMatchWithOptionalMedia } from './matchStartup';

test('a match starts without waiting for slow sound or atlas downloads', () => {
  let started = false;
  const pending = () => new Promise<void>(() => undefined);
  startMatchWithOptionalMedia(pending, pending, () => { started = true; }, () => undefined);
  assert.equal(started, true);
});

test('a failed optional asset does not prevent entering PLAY', async () => {
  const failures: string[] = [];
  let started = false;
  startMatchWithOptionalMedia(
    () => Promise.reject(new Error('audio unavailable')),
    () => { throw new Error('atlas unavailable'); },
    () => { started = true; },
    (asset) => failures.push(asset),
  );
  await Promise.resolve();
  assert.equal(started, true);
  assert.deepEqual(failures.sort(), ['atlas', 'audio']);
});
