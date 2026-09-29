import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OrthographicCamera } from 'three';
import { BladeInput } from './blade';
import { FruitField, FRUIT_DEFS } from '../game/fruits';
import { strokeHitsFruit } from '../game/slicer';
import { calculateReward, applyRewards } from '../game/progression';
import { defaultSave } from '../game/save';

class SyntheticCanvas extends EventTarget {
  style: Record<string, string> = {};
  setPointerCapture(): void {
    // Mirrors dispatchEvent-created PointerEvents in browsers: there is no
    // native active pointer for capture, but the stroke must still proceed.
    throw new DOMException('No active pointer', 'NotFoundError');
  }
  getBoundingClientRect(): DOMRect {
    return { left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({}) };
  }
}

function pointer(type: string, pointerId: number, pointerType: 'mouse' | 'touch', clientX: number, clientY: number): Event {
  const event = new Event(type);
  Object.defineProperties(event, {
    pointerId: { value: pointerId },
    pointerType: { value: pointerType },
    clientX: { value: clientX },
    clientY: { value: clientY },
    button: { value: 0 },
    shiftKey: { value: false },
  });
  return event;
}

function installStorage(): void {
  const values = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  };
}

for (const pointerType of ['mouse', 'touch'] as const) {
  test(`synthetic ${pointerType} canvas stroke kills a fruit and grants score/XP`, () => {
    installStorage();
    const browserWindow = new EventTarget();
    (globalThis as any).window = browserWindow;
    const canvas = new SyntheticCanvas();
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 30);
    camera.position.set(0, 10, 0);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const blade = new BladeInput(canvas as unknown as HTMLCanvasElement, camera, {
      pan() {}, zoom() {},
    } as any);

    canvas.dispatchEvent(pointer('pointerdown', 7, pointerType, 50, 100));
    canvas.dispatchEvent(pointer('pointermove', 7, pointerType, 150, 100));
    browserWindow.dispatchEvent(pointer('pointerup', 7, pointerType, 150, 100));

    const slash = blade.consumeSlash();
    assert.ok(slash, 'canvas pointer events should produce a slash');
    assert.equal(slash.pointer, pointerType);
    assert.ok(blade.trail.length >= 2, 'the synthetic stroke should leave visible trail points');

    const field = new FruitField(() => {});
    const fruit = field.spawn('lemon')!;
    fruit.group.position.set(0, 0.75, 0);
    assert.equal(strokeHitsFruit(slash, fruit).hit, true, 'projected stroke should cross the fruit');
    assert.equal(field.hurt(fruit, fruit.hp), true, 'the crossed fruit should be killed');
    assert.equal(fruit.alive, false);

    const save = defaultSave();
    const xpBefore = save.xp[save.hero];
    const reward = calculateReward({ type: 'fruit_sliced', baseScore: FRUIT_DEFS.lemon.score, enemyKind: 'normal' });
    applyRewards(save, reward, { heroId: save.hero });
    assert.ok(reward.score > 0, 'kill reward should increase score');
    assert.ok(save.xp[save.hero] > xpBefore, 'kill reward should increase hero XP');
  });
}
