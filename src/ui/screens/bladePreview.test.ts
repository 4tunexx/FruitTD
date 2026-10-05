import { installDomStub } from '../domStub.test-helper';
installDomStub();
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slicerPreview } from './itemCard';
import { allCatalogItems } from '../../game/catalog';

test('blade cards contain one animated canvas and no static sword or stacked overlays', () => {
  const item = allCatalogItems().find(item => item.category === 'slicers')!;
  const preview = slicerPreview(item);
  assert.equal(preview.querySelectorAll('canvas').length, 1);
  for (const selector of ['img', 'svg', '.ftd-blade-preview__edge', '.ftd-blade-preview__trail', '.ftd-blade-preview__glint']) assert.equal(preview.querySelector(selector), null);
});

test('preview moves the slice, draws its shine, then clears between swipes', async () => {
  const { animateBladePreview } = await import('./bladePreview');
  const oldFrame = globalThis.requestAnimationFrame;
  let nextFrame: FrameRequestCallback | undefined;
  globalThis.requestAnimationFrame = callback => { nextFrame = callback; return 1; };
  const paths: number[][] = [];
  const strokes: Array<{ color: string; glow: number; opacity: number }> = [];
  const ctx: any = { strokeStyle: '', shadowBlur: 0, globalAlpha: 1,
    setTransform() {}, clearRect() { paths.length = 0; strokes.length = 0; },
    beginPath() {}, moveTo(x: number, y: number) { paths.push([x, y]); }, lineTo(x: number, y: number) { paths.push([x, y]); },
    stroke() { strokes.push({ color: this.strokeStyle, glow: this.shadowBlur, opacity: this.globalAlpha }); },
  };
  const canvas: any = { isConnected: true, width: 0, height: 0, classList: { contains: () => false },
    getBoundingClientRect: () => ({ left: 0, top: 0, bottom: 76, width: 72, height: 76 }), getContext: () => ctx,
    addEventListener() {}, removeEventListener() {},
  };
  const began = performance.now();
  const preview = animateBladePreview(canvas, undefined);
  try {
    nextFrame!(began + 120);
    const earlyTip = paths[15];
    assert.equal(strokes.length, 3, 'one cut, its white core, and moving shine');
    assert.ok(strokes[0].glow > 0);
    assert.equal(strokes[2].color, '#fff');
    nextFrame!(began + 300);
    assert.ok(paths[15][0] > earlyTip[0], 'slice travels across the card');
    nextFrame!(began + 1200);
    assert.equal(strokes.length, 0, 'no static cut or weapon remains between animations');
  } finally { preview.dispose(); nextFrame?.(began + 1300); globalThis.requestAnimationFrame = oldFrame; }
});
