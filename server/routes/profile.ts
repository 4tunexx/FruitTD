import { Router, Request, Response } from 'express';
import type { Collection } from 'mongodb';
import { getCollection, CloudSaveDoc, UserDoc } from '../db';
import { resolveRequestUser } from '../auth';
import { loadQuestCatalog } from '../catalog';
import { defaultSave, WALL_SKINS } from '../../src/game/save';
import { saveValidationError, serverOwnedSaveError } from '../validation';

type RequestUser = Awaited<ReturnType<typeof resolveRequestUser>>;

export interface ProfileRouteDeps {
  resolveUser(req: Request): Promise<RequestUser>;
  collection<T extends Record<string, any>>(name: string): Promise<Collection<T>>;
  allowedSkinIds(): Promise<ReadonlySet<string>>;
}

const defaultDeps: ProfileRouteDeps = {
  resolveUser: resolveRequestUser,
  collection: getCollection,
  allowedSkinIds: async () => {
    const catalog = await loadQuestCatalog();
    return new Set([...catalog.slicers.map((item) => item.id), ...WALL_SKINS.map((item) => item.id)]);
  },
};

function etag(revision: number): string {
  return `"${revision}"`;
}

function serverRevision(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : 0;
}

export function createProfileRouter(deps: ProfileRouteDeps = defaultDeps): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = await deps.resolveUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Sign in to view a cloud save' });
      const userId = user.userId;

      const col = await deps.collection<CloudSaveDoc>('cloud_saves');
      const doc = await col.findOne({ userId });
      const revision = serverRevision(doc?.revision);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('ETag', etag(revision));

      const usersCol = await deps.collection<UserDoc>('users');
      const userDoc = await usersCol.findOne({ userId });

      res.json({
        success: true,
        saveData: doc?.saveData || null,
        revision,
        updatedAt: doc?.updatedAt || null,
        user: userDoc
          ? {
              nickname: userDoc.nickname,
              avatar: userDoc.avatar,
              steamId: userDoc.steamId,
              steamPersona: userDoc.steamPersona,
              steamAvatar: userDoc.steamAvatar,
            }
          : null,
      });
    } catch (err: any) {
      console.error('Error fetching profile cloud save:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const { saveData: incoming, revision } = req.body ?? {};
      const allowedSkinIds = await deps.allowedSkinIds();
      const invalid = saveValidationError(incoming, allowedSkinIds);
      if (invalid) return res.status(400).json({ success: false, error: invalid });

      const user = await deps.resolveUser(req);
      if (!user) return res.status(401).json({ success: false, error: 'Sign in to sync a profile' });
      if (!Number.isSafeInteger(revision) || revision < 0) {
        return res.status(428).json({ success: false, error: 'A current server revision is required' });
      }
      const userId = user.userId;
      const col = await deps.collection<CloudSaveDoc>('cloud_saves');
      const current = await col.findOne({ userId });
      const currentRevision = serverRevision(current?.revision);
      if (revision !== currentRevision) {
        res.setHeader('ETag', etag(currentRevision));
        return res.status(409).json({ success: false, error: 'Save conflict: reload the current server revision', revision: currentRevision });
      }

      const authoritative = current?.saveData ?? defaultSave();
      const authorityError = serverOwnedSaveError(incoming as Record<string, unknown>, authoritative as unknown as Record<string, unknown>);
      if (authorityError) return res.status(422).json({ success: false, error: authorityError, revision: currentRevision });

      const saveData = { ...authoritative, ...incoming };
      const nextRevision = currentRevision + 1;
      const updatedAt = new Date();
      let written = false;

      if (current) {
        const result = await col.updateOne(
          current.revision === undefined
            ? { userId, revision: { $exists: false } }
            : { userId, revision: currentRevision },
          { $set: { saveData, revision: nextRevision, updatedAt } }
        );
        written = result.matchedCount === 1;
      } else {
        try {
          await col.insertOne({ userId, saveData, revision: nextRevision, updatedAt });
          written = true;
        } catch (err: any) {
          if (err?.code !== 11000) throw err;
        }
      }

      if (!written) {
        const latest = await col.findOne({ userId });
        const latestRevision = latest ? serverRevision(latest.revision) : currentRevision;
        res.setHeader('ETag', etag(latestRevision));
        return res.status(409).json({ success: false, error: 'Save conflict: reload the current server revision', revision: latestRevision });
      }

      const usersCol = await deps.collection<UserDoc>('users');
      await usersCol.updateOne(
        { userId },
        {
          $set: {
            nickname: saveData.nickname || user.nickname || 'Slicer',
            avatar: saveData.avatar || user.avatar || '',
            updatedAt,
          },
          $setOnInsert: { createdAt: updatedAt },
        },
        { upsert: true }
      );

      res.setHeader('ETag', etag(nextRevision));
      res.json({ success: true, revision: nextRevision, saveData, timestamp: updatedAt });
    } catch (err: any) {
      if (err?.code === 11000) return res.status(409).json({ success: false, error: 'Save conflict: reload the current server revision' });
      console.error('Error syncing cloud save:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
}

export const profileRouter = createProfileRouter();
