import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clipKey, frameRect, indexFromCell } from './adminMediaStudio';

test('frameRect maps row-major indices to cells', () => {
  const a = frameRect(0, 4, 3, 128, 96);
  assert.equal(a.col, 0);
  assert.equal(a.row, 0);
  assert.equal(a.sx, 0);
  assert.equal(a.sy, 0);
  assert.equal(a.sw, 32);
  assert.equal(a.sh, 32);

  const b = frameRect(5, 4, 3, 128, 96);
  assert.equal(b.col, 1);
  assert.equal(b.row, 1);
  assert.equal(b.sx, 32);
  assert.equal(b.sy, 32);

  const c = frameRect(11, 4, 3, 128, 96);
  assert.equal(c.col, 3);
  assert.equal(c.row, 2);
});

test('frameRect wraps and honors explicit frame size', () => {
  const wrapped = frameRect(12, 4, 3, 128, 96);
  assert.equal(wrapped.col, 0);
  assert.equal(wrapped.row, 0);

  const custom = frameRect(1, 8, 8, 256, 256, 16, 24);
  assert.equal(custom.sw, 16);
  assert.equal(custom.sh, 24);
  assert.equal(custom.sx, 16);
  assert.equal(custom.sy, 0);
});

test('indexFromCell and clipKey helpers', () => {
  assert.equal(indexFromCell(2, 1, 4), 6);
  assert.equal(clipKey('idle', 'left'), 'idle');
  assert.equal(clipKey('hit', 'up'), 'hit');
  assert.equal(clipKey('death', 'down'), 'death');
  assert.equal(clipKey('walk', 'left'), 'walk_left');
  assert.equal(clipKey('run', 'up'), 'run_up');
});
