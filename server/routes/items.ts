import { Router, type Request, type Response } from 'express';
import type { Collection } from 'mongodb';
import { getCollection, type CloudSaveDoc } from '../db';
import { resolveRequestUser } from '../auth';
import { loadQuestCatalog } from '../catalog';
import { defaultSave, WALL_SKINS, type SaveData } from '../../src/game/save';
import { HEROES, type HeroId } from '../../src/game/heroes';
import { canEquipHero, purchaseHeroAtomic } from '../../src/game/progression/heroStatus';
import type { CatalogSlicer } from '../../src/game/slicers';
import { SKILLS } from '../../src/game/skills';

type RequestUser = Awaited<ReturnType<typeof resolveRequestUser>>;
type ItemAction = 'buy' | 'equip' | 'unequip' | 'sell' | 'buy-vip' | 'buy-skill';
const VIP_FALLBACK: Record<'bronze' | 'silver' | 'gold', { price: number; coins: number }> = {
  bronze: { price: 500, coins: 1000 }, silver: { price: 1500, coins: 2500 }, gold: { price: 5000, coins: 5000 },
};

export interface ItemsRouteDeps {
  resolveUser(req: Request): Promise<RequestUser>;
  collection<T extends Record<string, any>>(name: string): Promise<Collection<T>>;
  slicers(): Promise<CatalogSlicer[]>;
}

const defaultDeps: ItemsRouteDeps = {
  resolveUser: resolveRequestUser,
  collection: getCollection,
  slicers: async () => (await loadQuestCatalog()).slicers,
};

function serverRevision(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : 0;
}

function isSlicer(id: string, slicers: CatalogSlicer[]): CatalogSlicer | undefined {
  return slicers.find((item) => item.id === id && item.enabled !== false);
}

export function createItemsRouter(deps: ItemsRouteDeps = defaultDeps): Router {
  const router = Router();

  router.post('/action', async (req: Request, res: Response) => {
    try {
      const user = await deps.resolveUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Sign in to manage gear' });

      const action = req.body?.action as ItemAction;
      const id = req.body?.id;
      if (!['buy', 'equip', 'unequip', 'sell', 'buy-vip', 'buy-skill'].includes(action) || typeof id !== 'string' || id.length > 120) {
        return res.status(400).json({ success: false, error: 'Invalid gear action' });
      }

      const slicers = await deps.slicers();
      const slicer = isSlicer(id, slicers);
      const wall = WALL_SKINS.find((item) => item.id === id);
      const heroId = id.startsWith('hero:') ? id.slice(5) as HeroId : null;
      const hero = heroId && HEROES.find((item) => item.id === heroId);
      if (!['buy-vip', 'buy-skill'].includes(action) && !slicer && !wall && !hero) return res.status(404).json({ success: false, error: 'Gear not found' });

      const col = await deps.collection<CloudSaveDoc>('cloud_saves');
      const current = await col.findOne({ userId: user.userId });
      const currentRevision = serverRevision(current?.revision);
      const saveData = structuredClone(current?.saveData ?? defaultSave());
      const ownedSkins: string[] = Array.isArray(saveData.ownedSkins) ? saveData.ownedSkins : [];
      const ownedHeroes: string[] = Array.isArray(saveData.ownedHeroes) ? saveData.ownedHeroes : [];
      const owned = hero ? ownedHeroes.includes(hero.id) : ownedSkins.includes(id);

      if (action === 'buy-vip') {
        if (!['bronze', 'silver', 'gold'].includes(id)) return res.status(400).json({ success: false, error: 'Invalid VIP tier' });
        const tier = id as keyof typeof VIP_FALLBACK;
        const configCol = await deps.collection<Record<string, any>>('admin_config');
        const config = await configCol.findOne({ configKey: 'game_config' });
        const configuredPrice = Number(config?.vipTiers?.find((entry: any) => entry?.tier === tier)?.price);
        const price = Number.isSafeInteger(configuredPrice) && configuredPrice >= 0 && configuredPrice <= 1_000_000
          ? configuredPrice : VIP_FALLBACK[tier].price;
        const tiers = ['none', 'bronze', 'silver', 'gold'];
        const currentTier = tiers.indexOf(saveData.vipStatus || 'none');
        if (currentTier >= tiers.indexOf(tier)) return res.status(409).json({ success: false, error: 'Already own this VIP tier or higher' });
        if (!Number.isSafeInteger(saveData.gems) || saveData.gems < price) return res.status(422).json({ success: false, error: 'Not enough gems' });
        saveData.gems -= price;
        saveData.vipStatus = tier;
        saveData.coins = Math.min(1_000_000, (Number.isSafeInteger(saveData.coins) ? saveData.coins : 0) + VIP_FALLBACK[tier].coins);
      } else if (action === 'buy-skill') {
        const skill = SKILLS.find((entry) => entry.id === id);
        if (!skill) return res.status(404).json({ success: false, error: 'Skill not found' });
        if (!Number.isSafeInteger(saveData.skillPoints) || saveData.skillPoints < 1) return res.status(422).json({ success: false, error: 'Not enough skill points' });
        if (!saveData.skills || !Number.isSafeInteger(saveData.skills[id]) || saveData.skills[id] >= skill.max) return res.status(409).json({ success: false, error: 'Skill is already at maximum rank' });
        saveData.skillPoints -= 1;
        saveData.skills[id] += 1;
      }

      if (action === 'buy') {
        if (hero) {
          const result = purchaseHeroAtomic(saveData as SaveData, hero.id);
          if (!result.ok) return res.status(result.error === 'already-owned' ? 409 : 422).json({ success: false, error: result.message });
        } else {
          const price = slicer?.cost ?? wall?.cost ?? 0;
          if (owned) return res.status(409).json({ success: false, error: 'Gear is already owned' });
          if (price <= 0) return res.status(400).json({ success: false, error: 'This gear cannot be purchased' });
          if (!Number.isSafeInteger(saveData.coins) || saveData.coins < price) {
            return res.status(422).json({ success: false, error: 'Not enough coins' });
          }
          saveData.coins -= price;
          saveData.ownedSkins = [...ownedSkins, id];
        }
      } else if (action === 'equip') {
        if (!owned) return res.status(403).json({ success: false, error: 'Gear is not owned' });
        if (hero) {
          if (!canEquipHero(saveData as SaveData, hero.id)) return res.status(403).json({ success: false, error: 'Hero is not unlocked' });
          saveData.hero = hero.id;
        } else if (slicer) saveData.bladeSkin = id;
        else saveData.wallSkin = id;
      } else if (action === 'unequip') {
        if (hero) return res.status(422).json({ success: false, error: 'A hero must remain selected' });
        if (slicer && saveData.bladeSkin === id) saveData.bladeSkin = '';
        else if (wall && saveData.wallSkin === id) saveData.wallSkin = '';
        else return res.status(409).json({ success: false, error: 'Gear is not equipped' });
      } else if (action === 'sell') {
        if (hero) return res.status(422).json({ success: false, error: 'Heroes cannot be sold' });
        const sellValue = slicer?.sellValue ?? wall?.sellValue ?? 0;
        if (!owned) return res.status(403).json({ success: false, error: 'Gear is not owned' });
        if (id === 'blade-default' || id === 'wall-brick' || sellValue <= 0) {
          return res.status(422).json({ success: false, error: 'Starter gear cannot be sold' });
        }
        saveData.ownedSkins = ownedSkins.filter((ownedId) => ownedId !== id);
        saveData.coins = Math.min(1_000_000, (Number.isSafeInteger(saveData.coins) ? saveData.coins : 0) + sellValue);
        if (saveData.bladeSkin === id) saveData.bladeSkin = '';
        if (saveData.wallSkin === id) saveData.wallSkin = '';
      }

      const nextRevision = currentRevision + 1;
      const updatedAt = new Date();
      let written = false;
      if (current) {
        const result = await col.updateOne(
          current.revision === undefined
            ? { userId: user.userId, revision: { $exists: false } }
            : { userId: user.userId, revision: currentRevision },
          { $set: { saveData, revision: nextRevision, updatedAt } },
        );
        written = result.matchedCount === 1;
      } else {
        try {
          await col.insertOne({ userId: user.userId, saveData, revision: nextRevision, updatedAt });
          written = true;
        } catch (err: any) {
          if (err?.code !== 11000) throw err;
        }
      }

      if (!written) return res.status(409).json({ success: false, error: 'Save changed; reload and try again' });
      res.setHeader('ETag', `"${nextRevision}"`);
      return res.json({ success: true, saveData, revision: nextRevision });
    } catch (err: any) {
      console.error('Error applying catalogue action:', err);
      return res.status(500).json({ success: false, error: 'Could not update gear' });
    }
  });

  return router;
}

export const itemsRouter = createItemsRouter();
