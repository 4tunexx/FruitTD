import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notifyStudioRuntimeChanged, subscribeStudioRuntimeInvalidation } from './studioRuntimeSignals';

test('Creator Hub changes notify registered runtime cache listeners', () => {
  let invalidations = 0;
  const unsubscribe = subscribeStudioRuntimeInvalidation(() => invalidations++);
  notifyStudioRuntimeChanged();
  unsubscribe();
  notifyStudioRuntimeChanged();
  assert.equal(invalidations, 1);
});
