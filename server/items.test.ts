import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';
import express from 'express';
import { defaultSave } from '../src/game/save';
import { DEFAULT_SLICERS } from '../src/game/slicers';
import { createItemsRouter } from './routes/items';
import { createProfileRouter } from './routes/profile';

const user = { userId: 'shop-journey-user', nickname: 'Slicer', avatar: '', createdAt: new Date(), updatedAt: new Date() };

test('shop purchase, equip and unequip survive a cloud profile reload', async (t) => {
  const cloud: any = {
    userId: user.userId,
    saveData: { ...defaultSave(), coins: 500 },
    revision: 3,
    updatedAt: new Date(),
  };
  const cloudCollection = {
    findOne: async ({ userId }: any) => userId === cloud.userId ? structuredClone(cloud) : null,
    insertOne: async (doc: any) => Object.assign(cloud, structuredClone(doc)),
    updateOne: async (filter: any, update: any) => {
      if (filter.userId !== cloud.userId || filter.revision !== cloud.revision) return { matchedCount: 0 };
      Object.assign(cloud, structuredClone(update.$set));
      return { matchedCount: 1 };
    },
  };
  const usersCollection = { findOne: async () => user };
  const deps: any = {
    resolveUser: async () => user,
    collection: async (name: string) => name === 'cloud_saves' ? cloudCollection : usersCollection,
    allowedSkinIds: async () => new Set(['blade-default', 'blade-gold', 'wall-brick', 'wall-stone', 'wall-night']),
    slicers: async () => DEFAULT_SLICERS,
  };
  const app = express();
  app.use(express.json());
  app.use('/api/items', createItemsRouter(deps));
  app.use('/api/profile', createProfileRouter(deps));
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind test server');
  const base = `http://127.0.0.1:${address.port}`;

  const action = async (name: string, id: string) => fetch(`${base}/api/items/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: name, id }),
  });

  const purchased = await action('buy', 'blade-gold');
  assert.equal(purchased.status, 200);
  const purchaseBody = await purchased.json() as any;
  assert.equal(purchaseBody.saveData.coins, 320);
  assert.ok(purchaseBody.saveData.ownedSkins.includes('blade-gold'));

  const equipped = await action('equip', 'blade-gold');
  assert.equal(equipped.status, 200);
  assert.equal((await equipped.json() as any).saveData.bladeSkin, 'blade-gold');

  const reloaded = await fetch(`${base}/api/profile`);
  assert.equal(reloaded.status, 200);
  const profile = await reloaded.json() as any;
  assert.ok(profile.saveData.ownedSkins.includes('blade-gold'));
  assert.equal(profile.saveData.bladeSkin, 'blade-gold');
  assert.equal(profile.revision, 5);

  const unequipped = await action('unequip', 'blade-gold');
  assert.equal(unequipped.status, 200);
  const afterUnequip = await (await fetch(`${base}/api/profile`)).json() as any;
  assert.ok(afterUnequip.saveData.ownedSkins.includes('blade-gold'));
  assert.equal(afterUnequip.saveData.bladeSkin, '');

  const sold = await action('sell', 'blade-gold');
  assert.equal(sold.status, 200);
  const afterSale = (await sold.json() as any).saveData;
  assert.equal(afterSale.coins, 380);
  assert.equal(afterSale.ownedSkins.includes('blade-gold'), false);
});


test('power upgrades spend skill points through rank five and stop at the cap', async (t) => {
  const cloud: any = {
    userId: user.userId,
    saveData: { ...defaultSave(), xp: { jiju: 50000, topfu: 0, lagen: 0, tripos: 0, ki: 0 }, skillPoints: 5 },
    revision: 1,
    updatedAt: new Date(),
  };
  const cloudCollection = {
    findOne: async ({ userId }: any) => userId === cloud.userId ? structuredClone(cloud) : null,
    insertOne: async (doc: any) => Object.assign(cloud, structuredClone(doc)),
    updateOne: async (filter: any, update: any) => {
      if (filter.userId !== cloud.userId || filter.revision !== cloud.revision) return { matchedCount: 0 };
      Object.assign(cloud, structuredClone(update.$set));
      return { matchedCount: 1 };
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/api/items', createItemsRouter({
    resolveUser: async () => user,
    collection: async () => cloudCollection,
    slicers: async () => DEFAULT_SLICERS,
  } as any));
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to bind test server');
  const base = `http://127.0.0.1:${address.port}`;

  for (let rank = 1; rank <= 5; rank += 1) {
    const response = await fetch(`${base}/api/items/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'buy-ability', id: 'jiju-1' }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.saveData.heroAbilityRanks['jiju-1'], rank);
    assert.equal(body.saveData.skillPoints, 5 - rank);
  }
  const capped = await fetch(`${base}/api/items/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'buy-ability', id: 'jiju-1' }),
  });
  assert.equal(capped.status, 409);
});
