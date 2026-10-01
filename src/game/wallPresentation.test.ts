import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function installStorageShim(): void {
  const store = new Map<string, string>();
  (globalThis as any).localStorage ??= {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
  };
}

test('tower range is shown only after selection and tower HP updates the ground bar', async () => {
  installStorageShim();
  const { WallBase } = await import('./wall');
  const { MAIN_INDEX } = await import('./world');
  const wall = new WallBase();
  const range = (wall as any).rangeRing as import('three').Mesh;
  const hp = (wall as any).towerHpFill as import('three').Mesh;
  const hpTrack = wall.group.children.find((child: any) => child.type === 'Mesh' && child !== hp && child.geometry?.type === 'PlaneGeometry' && child.geometry.parameters.width > 18);

  assert.equal(range.visible, false, 'initial main tower selection should not cover the arena with a range ring');
  wall.select(MAIN_INDEX);
  assert.equal(range.visible, true, 'click selection should reveal the selected tower range');
  wall.setTowerHealth(0.5);
  assert.ok(hp.scale.x > 0 && hp.scale.x < 1, 'tower health should visibly shorten the world-space health bar');
  assert.equal((hp.material as import('three').MeshBasicMaterial).color.getHex(), 0xf59e0b, 'mid health should use warning amber');
  assert.ok(hpTrack, 'a contrasting full-length health rail should sit below the tower');
  assert.ok((hp.geometry as any).parameters.width > 18, 'tower health rail should span most of the wall');
  assert.equal((hp.material as import('three').MeshBasicMaterial).depthTest, false, 'tower health must not disappear inside battlefield geometry');
  assert.ok(hp.renderOrder > (hpTrack as import('three').Mesh).renderOrder, 'health fill should render over its track');
  assert.equal(hp.geometry.type, 'PlaneGeometry', 'one flat health rail should not draw stacked 3D edges');
});

test('combat HUD retains health text without duplicating the arena health rail', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="hud-hp-value"/);
  assert.doesNotMatch(html, /id="hp-track"|id="hud-hp-fill"/);
});
