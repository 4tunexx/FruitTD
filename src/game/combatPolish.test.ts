import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Vector3 } from 'three';

function installStorageShim(): void {
  const g = globalThis as any;
  if (g.localStorage) return;
  const store = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('combat polish regressions', () => {
  it('trail geometry updates GPU-backed positions and resets cleanly', async () => {
    installStorageShim();
    const { BladeTrail } = await import('./trail');
    const trail = new BladeTrail();

    trail.sync([
      new Vector3(-1, 0.7, 0),
      new Vector3(0.5, 0.7, 0),
      new Vector3(1.2, 0.7, 0.3),
    ]);

    const attr = trail.line.geometry.getAttribute('position');
    const verts = Array.from((attr.array as Float32Array).slice(0, 18));
    const nonZero = verts.some((v) => Math.abs(v) > 0.0001);
    assert.equal(nonZero, true, 'expected dynamic trail vertices to change from origin');
    assert.ok(trail.line.geometry.drawRange.count > 0, 'expected trail draw range to be active');

    trail.reset();
    assert.equal(trail.line.geometry.drawRange.count, 0, 'reset must clear trail draw range');
    assert.equal(trail.sparks.visible, false, 'reset must hide sparks');
  });

  it('slash flashes are directional (not radial) and expire quickly', async () => {
    const { SlashFx } = await import('./slashfx');
    const fx = new SlashFx();

    fx.spawn(1, 2, 0xffffff, 0, 1, 1.4);
    const live = fx.group.children.find((m): m is Mesh => m instanceof Mesh && m.visible);
    assert.ok(live, 'expected one active slash flash');

    const posAttr = (live!.geometry as any).getAttribute('position');
    assert.equal(posAttr.count, 4, 'flash geometry should be a tapered quad, not a ring mesh');
    assert.ok(Math.abs(live!.rotation.y + Math.PI / 2) < 0.01, 'flash should align with slash direction');

    fx.update(0.2);
    const stillVisible = fx.group.children.some((m) => m.visible);
    assert.equal(stillVisible, false, 'flash lifetime should end around 140ms');
  });

  it('stroke contacts enforce one-hit-per-gesture and spawn-serial identity', async () => {
    const { StrokeContacts } = await import('./strokeContacts');
    const contacts = new StrokeContacts();

    const target = { spawnSerial: 3 };
    contacts.begin(100, [{ spawnSerial: 5 }]);
    contacts.add(target);
    assert.equal(contacts.has(target), true);

    target.spawnSerial = 6;
    assert.equal(contacts.has(target), false, 'same object with new spawnSerial must be treated as new target');
    assert.equal(contacts.canReslice({ spawnSerial: 4 }), true, 'old debris can be resliced');
    assert.equal(contacts.canReslice({ spawnSerial: 9 }), false, 'new debris from this swipe cannot be re-hit');
  });

  it('wave accounting excludes split children and requires strict perfect-wave equality', async () => {
    installStorageShim();
    const { createState, isPerfectWave, recordWaveKill } = await import('./state');
    const s = createState();
    s.waveTotal = 3;
    s.waveKilled = 0;
    s.waveLeaks = 0;

    recordWaveKill(s, false);
    recordWaveKill(s, true);
    recordWaveKill(s, false);
    assert.equal(s.waveKilled, 2, 'splitChild kill must not count toward waveKilled');
    assert.equal(isPerfectWave(s), false, 'not perfect until strict killed===total');

    recordWaveKill(s, false);
    assert.equal(isPerfectWave(s), true, 'perfect only when all originals are killed and no leaks');
    s.waveLeaks = 1;
    assert.equal(isPerfectWave(s), false, 'any leak invalidates perfect wave');
  });

  it('splitter parent is quarantined for this tick and pending children eventually spawn under pool pressure', async () => {
    installStorageShim();
    const [{ FruitField }, { createState }] = await Promise.all([import('./fruits'), import('./state')]);
    const field = new FruitField(() => undefined);
    const state = createState();

    const parent = field.spawn('watermelon', false, 'splitter');
    assert.ok(parent);
    for (let i = 0; i < 63; i++) field.spawn('lemon', false, 'normal');

    field.kill(parent!, true);
    field.update(0.016, state, () => undefined);
    let splitChildren = field.fruits.filter((f) => f.alive && f.splitChild);
    assert.equal(splitChildren.length, 1, 'one child should spawn immediately when only one slot is free');

    const release = field.fruits.find((f) => f.alive && !f.splitChild);
    assert.ok(release);
    field.kill(release!, false);
    field.update(0.016, state, () => undefined);
    splitChildren = field.fruits.filter((f) => f.alive && f.splitChild);
    assert.equal(splitChildren.length, 2, 'queued child should spawn later instead of being dropped');
  });
});
