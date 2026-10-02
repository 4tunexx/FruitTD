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
  it('enemies use one flat, legible health rail that shrinks after damage', async () => {
    installStorageShim();
    const { FruitField } = await import('./fruits');
    const field = new FruitField(() => undefined);
    const fruit = field.spawn('lemon')!;
    assert.equal(fruit.hpBack.geometry.type, 'PlaneGeometry');
    assert.equal(fruit.hpBar.geometry.type, 'PlaneGeometry');
    assert.ok(fruit.hpBar.renderOrder > fruit.hpBack.renderOrder);
    assert.equal(fruit.hpBack.scale.x * fruit.radius, 1.05);
    assert.equal(fruit.hpBack.visible, false);
    const initialWidth = fruit.hpBar.scale.x;
    field.hurt(fruit, fruit.hp / 2);
    assert.equal(fruit.hpBack.visible, true);
    assert.ok(fruit.hpBar.scale.x < initialWidth);
    const boss = field.spawn('watermelon', true)!;
    assert.equal(boss.hpBack.visible, true);
  });

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

  it('boss completion is consumed once and cannot leak into later pooled-enemy waves', async () => {
    installStorageShim();
    const { createState, consumeBossWaveCompletion } = await import('./state');
    const state = createState();
    state.waveIsBoss = true;
    assert.equal(consumeBossWaveCompletion(state), true, 'the active boss wave advances the level');
    assert.equal(consumeBossWaveCompletion(state), false, 'old pooled boss objects cannot advance later waves');
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

  it('a full fruit pool resumes queued wave spawns as soon as one slot is released', async () => {
    installStorageShim();
    const [{ FruitField }, { createState }] = await Promise.all([import('./fruits'), import('./state')]);
    const field = new FruitField(() => undefined);
    const state = createState();
    for (let i = 0; i < 64; i++) assert.ok(field.spawn('lemon'));

    field.beginWave([{ kind: 'orange', boss: false }], 0.3, 1);
    field.update(0.2, state, () => undefined);
    assert.equal(field.queueLength, 1, 'spawn must wait rather than overwrite a live pooled enemy');

    const freed = field.fruits.find((fruit) => fruit.alive)!;
    field.kill(freed, false);
    field.update(0.31, state, () => undefined);
    assert.equal(field.queueLength, 0, 'queued wave should continue once the pool has a free slot');
    assert.equal(field.waveBusy, true, 'the spawned enemy keeps the wave active');
  });

  it('explosive fruit hits damage the tower more in later waves', async () => {
    installStorageShim();
    const [{ FruitField }, { createState }] = await Promise.all([import('./fruits'), import('./state')]);
    const field = new FruitField(() => undefined);
    const state = createState();
    const early = field.spawn('bomb', false, 'explosive')!;
    field.update(0.016, state, () => undefined);
    const earlyLives = state.lives;
    const initialHp = early.hp;
    assert.equal(field.hurt(early, 1000, 'super'), false);
    assert.equal(early.hp, initialHp, 'super cannot bypass the turret-only rule');
    field.hurt(early, 1, 'blade');
    assert.equal(earlyLives - state.lives, 2, 'early Chem-Burst damage starts fair');
    assert.equal(early.hp, initialHp, 'blade contact does not damage the exploder');
    field.hurt(early, 1, 'blade');
    assert.equal(earlyLives - state.lives, 4, 'another blade contact damages the wall again');

    state.wave = 11;
    const later = field.spawn('bomb', false, 'explosive')!;
    field.update(0.016, state, () => undefined);
    const laterLives = state.lives;
    field.hurt(later, 1, 'blade');
    assert.equal(laterLives - state.lives, 3, 'later Chem-Burst damage rises with wave pressure');
    const safeLives = state.lives;
    assert.equal(field.hurt(later, later.hp, 'turret'), true);
    assert.equal(state.lives, safeLives, 'turret kills are safe');
  });

  it('brood bosses trigger a single halfway phase and release runners', async () => {
    installStorageShim();
    const { FruitField } = await import('./fruits');
    const field = new FruitField(() => undefined);
    let phases = 0;
    field.onBossPhase = () => { phases++; };
    const boss = field.spawn('apple', true, 'splitter', 4)!;
    const halfway = Math.ceil(boss.hp / 2);
    field.hurt(boss, halfway, 'turret');
    assert.equal(phases, 1);
    assert.equal(boss.bossEnraged, true);
    assert.equal(field.aliveCount, 3, 'two smaller runners join the boss');
    field.hurt(boss, 1, 'turret');
    assert.equal(phases, 1);
  });
});
