import { Router } from 'express';
import { DEFAULT_BATTLE_MAPS, normalizeBattleMap, type BattleMap, type BattleMapMode } from '../../src/game/battleMaps';
import { getCollection } from '../db';
import { resolveRequestUser } from '../auth';

type StoredBattleMap = BattleMap & { updatedAt: Date };
const MODES = new Set<BattleMapMode>(['casual', 'horde', 'campaign', 'coop', 'pvp']);
export const mapsRouter = Router();
export const adminMapsRouter = Router();

function validAdmin(user: Awaited<ReturnType<typeof resolveRequestUser>>): boolean {
  return Boolean(process.env.ADMIN_STEAM_ID && user?.steamId === process.env.ADMIN_STEAM_ID);
}

function mapError(map: BattleMap): string | null {
  if (!map.routes.length) return 'Add at least one enemy route.';
  const routeIds = new Set(map.routes.map((route) => route.id));
  if (!map.spawns.some((spawn) => spawn.enabled)) return 'Enable at least one spawn point.';
  if (map.spawns.some((spawn) => !routeIds.has(spawn.routeId))) return 'Every spawn must connect to a saved route.';
  if (map.routes.some((route) => route.points.length < 2)) return 'Each route needs at least two points.';
  if (map.mode !== 'pvp' && map.spawns.some((spawn) => spawn.y > .2)) return 'Standard-mode spawns must be at the top of the map.';
  if (map.mode === 'pvp' && !map.opponentTower) return 'PvP needs both tower anchors.';
  return null;
}

mapsRouter.get('/:mode', async (req, res) => {
  const mode = req.params.mode as BattleMapMode;
  if (!MODES.has(mode)) return res.status(404).json({ success: false, error: 'Map mode not found.' });
  try {
    const col = await getCollection<StoredBattleMap>('battle_maps');
    const map = await col.findOne({ mode, published: true }, { projection: { _id: 0 } });
    return res.json({ success: true, map: map || DEFAULT_BATTLE_MAPS[mode] });
  } catch (error) {
    console.error('Battle map read failed:', error);
    return res.status(503).json({ success: false, error: 'Battle map service is unavailable.' });
  }
});

adminMapsRouter.get('/', async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!validAdmin(user)) return res.status(403).json({ success: false, error: 'Admin access required.' });
  try {
    const col = await getCollection<StoredBattleMap>('battle_maps');
    await col.bulkWrite(Object.values(DEFAULT_BATTLE_MAPS).map((map) => ({
      updateOne: { filter: { id: map.id }, update: { $setOnInsert: { ...map, updatedAt: new Date() } }, upsert: true },
    })));
    const maps = await col.find({}, { projection: { _id: 0 } }).sort({ mode: 1, id: 1 }).toArray();
    return res.json({ success: true, maps });
  } catch (error) {
    console.error('Admin battle map read failed:', error);
    return res.status(503).json({ success: false, error: 'Could not load maps from MongoDB.' });
  }
});

adminMapsRouter.post('/', async (req, res) => {
  const user = await resolveRequestUser(req);
  if (!validAdmin(user)) return res.status(403).json({ success: false, error: 'Admin access required.' });
  try {
    const raw = req.body?.map;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return res.status(400).json({ success: false, error: 'Map data is required.' });
    if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > 3_500_000) return res.status(413).json({ success: false, error: 'Map is too large. Optimize uploaded images before saving.' });
    const mode = MODES.has(raw.mode) ? raw.mode as BattleMapMode : 'casual';
    const map = normalizeBattleMap(raw, mode);
    const error = mapError(map);
    if (error) return res.status(400).json({ success: false, error });
    const col = await getCollection<StoredBattleMap>('battle_maps');
    const existing = await col.findOne({ id: map.id });
    const expected = Number(req.body?.expectedRevision);
    if (existing && (!Number.isSafeInteger(expected) || expected !== existing.revision)) {
      return res.status(409).json({ success: false, error: 'This map changed in another admin session. Reload it before saving.', currentRevision: existing.revision });
    }
    map.revision = existing ? existing.revision + 1 : 1;
    const document: StoredBattleMap = { ...map, updatedAt: new Date() };
    if (existing) {
      const result = await col.replaceOne({ id: map.id, revision: existing.revision }, document);
      if (!result.matchedCount) return res.status(409).json({ success: false, error: 'This map changed while you were saving. Reload and try again.' });
    } else {
      await col.insertOne(document);
    }
    return res.json({ success: true, map: document });
  } catch (error) {
    console.error('Admin battle map save failed:', error);
    return res.status(500).json({ success: false, error: 'Could not save the map to MongoDB.' });
  }
});
