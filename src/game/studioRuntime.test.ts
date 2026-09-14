import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  advanceFrameCursor,
  directionFromVelocity,
  enemyKindToStudioKey,
  STUDIO_DEFAULT_FPS,
} from './studioRuntime';

test('enemyKindToStudioKey maps all enemy kinds', () => {
  assert.equal(enemyKindToStudioKey('normal'), 'enemy-normal');
  assert.equal(enemyKindToStudioKey('explosive'), 'enemy-explosive');
  assert.equal(enemyKindToStudioKey('armored'), 'enemy-armored');
  assert.equal(enemyKindToStudioKey('splitter'), 'enemy-splitter');
  assert.equal(enemyKindToStudioKey('swift'), 'enemy-swift');
});

test('directionFromVelocity picks dominant axis', () => {
  assert.equal(directionFromVelocity(-2, 0.1), 'left');
  assert.equal(directionFromVelocity(2, 0.1), 'right');
  assert.equal(directionFromVelocity(0.1, -2), 'down');
  assert.equal(directionFromVelocity(0.1, 2), 'up');
  assert.equal(directionFromVelocity(0, 0), 'down');
});

test('advanceFrameCursor steps by fps and wraps', () => {
  const a = advanceFrameCursor(0, 0.1, 10, 4);
  assert.equal(a.frameIndex, 1);
  assert.ok(Math.abs(a.cursor - 1) < 1e-9);

  const b = advanceFrameCursor(3.9, 0.05, 10, 4);
  assert.equal(b.frameIndex, 0); // floor(4.4) % 4 === 0
  assert.ok(b.cursor > 3.9);

  const c = advanceFrameCursor(0, 1 / STUDIO_DEFAULT_FPS, STUDIO_DEFAULT_FPS, 1);
  assert.equal(c.frameIndex, 0);

  const d = advanceFrameCursor(0, 0, 8, 6);
  assert.equal(d.frameIndex, 0);
  assert.equal(d.cursor, 0);
});
