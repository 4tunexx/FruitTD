import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Rest } from 'ably';
import { getCollection } from '../db';
import { resolveRequestUser } from '../auth';
import { creditClaimReward } from '../claimWallet';
import { DEFAULT_PVP_CONFIG, advancePvpMatch, applyPvpCommand, calculateArenaRating, createPvpPlayer, newPvpMatch, pvpTier, resetSeasonRating, vetoPvpMap, type PvpConfig, type PvpMatch, type PvpQueue } from '../../src/game/pvp';
import { mergeAdminConfig } from '../../src/services/admin';
import { pvpCanMatch } from '../../src/game/pvpMatchmaking';
import { HEROES } from '../../src/game/heroes';
import { WALL_SKINS } from '../../src/game/save';
import { playPvpBotTurn } from '../../src/game/pvpBot';

export const pvpRouter = Router();
type QueueEntry = { userId: string; name: string; queue: PvpQueue; points: number; season: string; createdAt: Date; expiresAt: Date };
type Challenge = { challengeId: string; fromId: string; fromName: string; toId: string; createdAt: Date; expiresAt: Date; acceptedAt?: Date; matchId?: string };
type StoredMatch = PvpMatch & { updatedAt: Date; balance?: PvpConfig; startRatings?: Record<string, number>; activePlayers?: string[]; settled?: boolean; resultsSeenBy?: string[]; testMatch?: boolean; botUserId?: string; botNextActionAt?: number };
type ArenaRecordDoc = { userId: string; matches: number; wins: number; ties: number; losses: number; settledMatchIds?: string[] };
type RatingDoc = { userId: string; points: number; season: string; matches: number; wins: number; ties: number; losses: number; updatedAt: Date; settledMatchIds?: string[]; lastMatchId?: string; lastDelta?: number };
const seasonKey = () => new Date().toISOString().slice(0, 7);
const routerError = (res: Response, status: number, message: string) => res.status(status).json({ success: false, error: message });
let authorityTimer: ReturnType<typeof setInterval> | null = null;
let ticking = false;
const settlingMatches = new Set<string>();
let ablyPublisher: Rest | null = null;
let ablySubscriber: Rest | null = null;

async function currentPvpConfig(): Promise<PvpConfig> {
  const doc = await (await getCollection<any>('admin_config')).findOne({ configKey: 'game_config' });
  return doc?.pvpConfig ? mergeAdminConfig({ pvpConfig: doc.pvpConfig } as any).pvpConfig : DEFAULT_PVP_CONFIG;
}
async function ratingFor(userId: string, config: PvpConfig): Promise<RatingDoc> {
  const col = await getCollection<RatingDoc>('pvp_ratings');
  const season = seasonKey();
  let row: RatingDoc | null = await col.findOne({ userId });
  if (!row) {
    row = { userId, points: config.rating.start, season, matches: 0, wins: 0, ties: 0, losses: 0, updatedAt: new Date() };
    await col.updateOne({ userId }, { $setOnInsert: row }, { upsert: true });
    row = (await col.findOne({ userId }))!;
  } else if (row.season !== season) {
    if (row.matches > 0) {
      const finalTier = pvpTier(row.points, config);
      const reward = config.seasonRewards.find((item) => item.tier === finalTier);
      if (reward) {
        await creditClaimReward(userId, `pvp-season:${row.season}`, { coins: reward.coins, gems: reward.gems });
        await (await getCollection<any>('badges')).updateOne({ userId, badgeId: reward.badgeId }, { $set: { unlocked: true, unlockedAt: new Date(), progress: 1, maxProgress: 1 } }, { upsert: true });
      }
    }
    const points = resetSeasonRating(row.points, config);
    await col.updateOne({ userId, season: row.season }, { $set: { points, season, matches: 0, wins: 0, ties: 0, losses: 0, updatedAt: new Date() } });
    row = { ...row, points, season, matches: 0, wins: 0, ties: 0, losses: 0 };
  }
  return row;
}
async function arenaRecordFor(userId: string) {
  const row = await (await getCollection<ArenaRecordDoc>('pvp_arena_records')).findOne({ userId });
  return { matches: row?.matches || 0, wins: row?.wins || 0, ties: row?.ties || 0, losses: row?.losses || 0 };
}
function publicRating(row: RatingDoc, config: PvpConfig) {
  const tier = pvpTier(row.points, config);
  const tiers = [...config.rating.tiers].sort((a, b) => a.min - b.min);
  return { points: row.points, tier, season: row.season, matches: row.matches, wins: row.wins, ties: row.ties, losses: row.losses, tierMin: tiers.find(item => item.name === tier)?.min ?? 0, nextTier: tiers.find(item => item.min > row.points) ?? null };
}

pvpRouter.get('/rating', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in for Ranked Arena.');
  try { const config = await currentPvpConfig(); res.json({ success: true, rating: { ...publicRating(await ratingFor(user.userId, config), config), arena: await arenaRecordFor(user.userId) } }); }
  catch { routerError(res, 503, 'Ranked rating is unavailable.'); }
});

function ablyKey(): { app: string; keyName: string; secret: string } | null {
  const value = process.env.ABLY_API_KEY || '';
  const match = /^([^.\s]+)\.([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(value);
  return match ? { app: match[1]!, keyName: match[2]!, secret: match[3]! } : null;
}
function subscriberKey(): { app: string; keyName: string; secret: string } | null {
  const value = process.env.ABLY_SUBSCRIBE_KEY || '';
  const match = /^([^.\s]+)\.([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(value);
  return match ? { app: match[1]!, keyName: match[2]!, secret: match[3]! } : null;
}
async function publishMatch(match: StoredMatch): Promise<void> {
  const key = process.env.ABLY_API_KEY;
  if (!key) return;
  try {
    ablyPublisher ??= new Rest({ key });
    await ablyPublisher.channels.get(`fruittd-pvp-${match.id}`).publish('match.snapshot', { id: match.id, revision: match.revision, status: match.status, endsAt: match.endsAt, map: match.map, mapPool: match.mapPool, vetoTurn: match.vetoTurn, players: match.players, winnerId: match.winnerId, resultReason: match.resultReason });
  } catch (error) { console.error('Ably match event publish failed:', error); }
}
function publicMatch(match: StoredMatch, userId: string) {
  if (!match.players.some((player) => player.userId === userId)) return null;
  return { id: match.id, queue: match.queue, status: match.status, testMatch: Boolean(match.testMatch), remainingMs: Math.max(0, match.endsAt - Date.now()), revision: match.revision,
    map: match.map, mapPool: match.mapPool.map(({ id, name, width, height, pathCells }) => ({ id, name, width, height, pathCells })), vetoTurnId: match.vetoTurn, yourVetoTurn: match.vetoTurn === userId, vetoesRemaining: Math.max(0, match.mapPool.length - 2),
    players: match.players.map(({ userId: id, name, side, fruts, wallHealth, score, towers, attackers, connected, ratingDelta, lastStroke, hero, wallSkin, rallyUntil, rallyReadyAt, mainLevel, wallMaxHealth, captured }) => ({ userId: id, name, side, fruts: Math.floor(fruts), wallHealth, score, towers, attackers, connected, lastStroke, hero, wallSkin, rallyUntil, rallyReadyAt, mainLevel, wallMaxHealth, captured, ...(match.status === 'complete' && match.queue === 'ranked' && !match.testMatch ? { ratingDelta } : {}) })),
    yourSequence: match.players.find((player) => player.userId === userId)?.sequence ?? 0,
    yourCombo: match.players.find((player) => player.userId === userId)?.currentCombo ?? 0,
    yourSide: match.players.find((player) => player.userId === userId)?.side, winnerId: match.winnerId, resultReason: match.resultReason };
}
async function equippedAppearance(userId: string) {
  const cloud = await (await getCollection<any>('cloud_saves')).findOne({ userId });
  const save = cloud?.saveData;
  const hero = HEROES.some(item => item.id === save?.hero) && (save?.hero === 'jiju' || save?.ownedHeroes?.includes(save.hero)) ? save.hero : 'jiju';
  const wallSkin = WALL_SKINS.some(item => item.id === save?.wallSkin) && (save?.wallSkin === 'wall-brick' || save?.ownedSkins?.includes(save.wallSkin)) ? save.wallSkin : 'wall-brick';
  return { hero, wallSkin };
}
async function makeMatch(queue: PvpQueue, left: { userId: string; name: string }, right: { userId: string; name: string }, config: PvpConfig): Promise<StoredMatch> {
  const match = newPvpMatch(randomUUID(), queue, [createPvpPlayer(left.userId, left.name, 'blue', config), createPvpPlayer(right.userId, right.name, 'red', config)], Date.now(), config) as StoredMatch;
  match.updatedAt = new Date(); match.balance = structuredClone(config); match.activePlayers = [left.userId, right.userId];
  const ratings = await Promise.all(match.players.map(async player => { Object.assign(player, await equippedAppearance(player.userId)); return (await ratingFor(player.userId, config)).points; }));
  match.startRatings = Object.fromEntries(match.players.map((player, index) => [player.userId, ratings[index]!]));
  await (await getCollection<StoredMatch>('pvp_matches')).insertOne(match);
  void publishMatch(match);
  return match;
}
async function settleMatch(match: StoredMatch, config: PvpConfig): Promise<void> {
  config = match.balance ?? config;
  if (match.status !== 'complete' || match.settled) return;
  if (settlingMatches.has(match.id)) return;
  settlingMatches.add(match.id);
  const matches = await getCollection<StoredMatch>('pvp_matches');
  try {
    if (match.testMatch) {
      match.settled = true;
      await matches.updateOne({ id: match.id, testMatch: true }, { $set: { settled: true } });
      return;
    }
    const achievements = await getCollection<any>('achievements'); const badges = await getCollection<any>('badges');
    for (const player of match.players) {
      const outcome = match.winnerId === null ? 'tie' : match.winnerId === player.userId ? 'win' : 'loss';
      const achievement = async (achievementId: string) => achievements.updateOne({ userId: player.userId, achievementId }, { $set: { unlocked: true, unlockedAt: new Date(), progress: 1, maxProgress: 1 }, $setOnInsert: { claimed: false } }, { upsert: true });
      const badge = async (badgeId: string) => badges.updateOne({ userId: player.userId, badgeId }, { $set: { unlocked: true, unlockedAt: new Date(), progress: 1, maxProgress: 1 } }, { upsert: true });
      if (outcome === 'win') { await achievement('pvp_first_win'); await badge('pvp-first-win'); }
      if (match.queue === 'arena') {
        const records = await getCollection<ArenaRecordDoc>('pvp_arena_records');
        await records.updateOne({ userId: player.userId }, { $setOnInsert: { userId: player.userId, matches: 0, wins: 0, ties: 0, losses: 0, settledMatchIds: [] } }, { upsert: true });
        await records.updateOne({ userId: player.userId, settledMatchIds: { $ne: match.id } }, { $inc: { matches: 1, [outcome === 'win' ? 'wins' : outcome === 'tie' ? 'ties' : 'losses']: 1 }, $addToSet: { settledMatchIds: match.id } });
      }
      if (match.queue === 'ranked') {
        const row = await ratingFor(player.userId, config); const ratings = await getCollection<RatingDoc>('pvp_ratings');
        if (row.settledMatchIds?.includes(match.id)) player.ratingDelta = row.lastMatchId === match.id ? row.lastDelta ?? 0 : 0;
        else {
          const result = calculateArenaRating(row.points, match.startRatings?.[match.players.find(item => item !== player)!.userId] ?? row.points, outcome, config);
          const updated = await ratings.updateOne({ userId: player.userId, season: row.season, settledMatchIds: { $ne: match.id } }, {
            $set: { points: result.rating, updatedAt: new Date(), lastMatchId: match.id, lastDelta: result.delta },
            $inc: { matches: 1, [outcome === 'win' ? 'wins' : outcome === 'tie' ? 'ties' : 'losses']: 1 }, $addToSet: { settledMatchIds: match.id },
          });
          player.ratingDelta = updated.modifiedCount ? result.delta : (await ratings.findOne({ userId: player.userId }))?.lastDelta ?? 0;
        }
        const current = await ratings.findOne({ userId: player.userId });
        if (current && current.wins >= 10) await achievement('pvp_ten_wins');
        if (current) {
          const topTier = pvpTier(current.points, config);
          const badgeByTier: Partial<Record<typeof topTier, string>> = { Silver: 'fr-silver', Gold: 'fr-gold', Diamond: 'fr-diamond', Emerald: 'fr-emerald', Sapphire: 'fr-sapphire' };
          const reached = badgeByTier[topTier]; if (reached) await badge(reached);
        }
      }
    }
    match.settled = true;
    await matches.updateOne({ id: match.id }, { $set: { settled: true, players: match.players }, $unset: { activePlayers: '' } });
  } finally {
    settlingMatches.delete(match.id);
  }
}

async function tickMatch(match: StoredMatch, config: PvpConfig, now: number): Promise<StoredMatch | null> {
  config = match.balance ?? config;
  if (match.status !== 'active') return match;
  const col = await getCollection<StoredMatch>('pvp_matches');
  const priorRevision = match.revision;
  const elapsed = Math.max(0, Math.min(1, (now - match.updatedAt.getTime()) / 1000));
  if (match.testMatch && match.botUserId) {
    const bot = match.players.find((player) => player.userId === match.botUserId);
    if (bot) { bot.connected = true; bot.disconnectedAt = null; bot.lastSeenAt = now; }
  }
  advancePvpMatch(match, elapsed, now, config);
  if ((match as StoredMatch).status === 'active' && match.testMatch && match.botUserId && now >= (match.botNextActionAt ?? 0)) {
    try { playPvpBotTurn(match, match.botUserId, now, config); }
    catch (error) { console.error('PvP bot action failed:', error); }
    match.botNextActionAt = now + 1_300;
  }
  if ((match as StoredMatch).status === 'complete') delete match.activePlayers;
  match.updatedAt = new Date(now);
  const saved = await col.replaceOne({ id: match.id, revision: priorRevision, status: 'active' }, match);
  if (!saved.modifiedCount) return null;
  void publishMatch(match);
  if ((match as StoredMatch).status === 'complete') await settleMatch(match, config);
  return match;
}

pvpRouter.get('/status', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in to play PvP.');
  try {
    const config = await currentPvpConfig();
    const matches = await getCollection<StoredMatch>('pvp_matches');
    let match: StoredMatch | null = await matches.findOne({ 'players.userId': user.userId, $or: [{ status: { $in: ['draft', 'active'] } }, { status: 'complete', resultsSeenBy: { $ne: user.userId } }] });
    if (match?.status === 'draft' && Date.now() - match.createdAt >= 120_000) {
      const revision = match.revision; match.status = 'complete'; match.resultReason = 'draft-cancelled'; match.settled = true; delete match.activePlayers; match.revision++;
      await matches.replaceOne({ id: match.id, revision, status: 'draft' }, match); match = await matches.findOne({ id: match.id });
    }
    if (match?.status === 'complete' && !match.settled) { await settleMatch(match, config); match = await matches.findOne({ id: match.id }); }
    if (match && match.status !== 'complete') {
      const player = match.players.find((item) => item.userId === user.userId)!;
      player.connected = true; player.disconnectedAt = null; player.lastSeenAt = Date.now(); match.revision++;
      await matches.replaceOne({ id: match.id, revision: match.revision - 1, status: match.status }, match);
      match = await matches.findOne({ id: match.id });
      if (match?.status === 'active') { await tickMatch(match, config, Date.now()); match = await matches.findOne({ id: match.id }); }
    }
    if (!match) { const waiting = await (await getCollection<QueueEntry>('pvp_queue')).findOne({ userId: user.userId, expiresAt: { $gt: new Date() } }); if (waiting) match = await pairQueued(waiting, config); }
    const rating = await ratingFor(user.userId, config);
    const challenge = await (await getCollection<Challenge>('pvp_challenges')).findOne({ toId: user.userId, expiresAt: { $gt: new Date() }, acceptedAt: { $exists: false } });
    const queued = await (await getCollection<QueueEntry>('pvp_queue')).findOne({ userId: user.userId, expiresAt: { $gt: new Date() } });
    res.json({ success: true, canStartBotMatch: Boolean(process.env.ADMIN_STEAM_ID && user.steamId === process.env.ADMIN_STEAM_ID), rating: { ...publicRating(rating, config), arena: await arenaRecordFor(user.userId) }, match: match ? publicMatch(match, user.userId) : null, queued: queued ? queued.queue : null, challenge: challenge ? { challengeId: challenge.challengeId, fromId: challenge.fromId, fromName: challenge.fromName } : null, config: { incomePerSecond: (match?.balance ?? config).incomePerSecond, wallHealth: (match?.balance ?? config).wallHealth, durationSeconds: (match?.balance ?? config).durationSeconds, reconnectGraceSeconds: (match?.balance ?? config).reconnectGraceSeconds, towers: (match?.balance ?? config).towers, attacks: (match?.balance ?? config).attacks, maps: (match?.balance ?? config).maps } });
  } catch (error) { console.error(error); routerError(res, 503, 'PvP storage is unavailable.'); }
});

pvpRouter.post('/admin/bot', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  if (!process.env.ADMIN_STEAM_ID || user.steamId !== process.env.ADMIN_STEAM_ID) return routerError(res, 403, 'Admin access required.');
  const queue = req.body?.queue as PvpQueue;
  if (queue !== 'arena' && queue !== 'ranked') return routerError(res, 400, 'Choose Arena or Ranked.');
  try {
    const config = await currentPvpConfig();
    const selectedMap = config.maps.find((map) => map.id === req.body?.mapId);
    if (!selectedMap) return routerError(res, 400, 'Choose a valid Arena path.');
    const matches = await getCollection<StoredMatch>('pvp_matches');
    const active = await matches.findOne({ status: { $in: ['draft', 'active'] }, 'players.userId': user.userId });
    if (active) return routerError(res, 409, 'Finish your current match before starting a test.');
    const now = Date.now(); const id = randomUUID(); const botUserId = `bot:${id}`;
    const match = newPvpMatch(id, queue, [createPvpPlayer(user.userId, user.username || user.nickname || 'Slicer', 'blue', config, now), createPvpPlayer(botUserId, 'Orchard Siege Bot', 'red', config, now)], now, config) as StoredMatch;
    match.status = 'active'; match.map = structuredClone(selectedMap); match.endsAt = now + config.durationSeconds * 1000;
    match.balance = structuredClone(config); match.activePlayers = [user.userId]; match.nextWaveAt = now + 15_000; match.neutralWave = 0;
    Object.assign(match.players[0], await equippedAppearance(user.userId)); match.players.forEach(player => { player.rallyReadyAt = now + 15_000; });
    match.testMatch = true; match.botUserId = botUserId; match.botNextActionAt = now + 1_200; match.updatedAt = new Date(now);
    await (await getCollection<QueueEntry>('pvp_queue')).deleteOne({ userId: user.userId });
    await matches.insertOne(match); void publishMatch(match);
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error) { console.error(error); routerError(res, 503, 'Could not create the bot test match.'); }
});

async function pairQueued(entry: QueueEntry, config: PvpConfig): Promise<StoredMatch | null> {
  const queues = await getCollection<QueueEntry>('pvp_queue'); const matches = await getCollection<StoredMatch>('pvp_matches');
  const now = Date.now();
  const candidates = await queues.find({ queue: entry.queue, userId: { $ne: entry.userId }, season: seasonKey(), expiresAt: { $gt: new Date(now) } }).sort({ createdAt: 1 }).limit(100).toArray();
  for (const candidate of candidates) {
    if (!pvpCanMatch({ ...entry, createdAt: entry.createdAt.getTime() }, { ...candidate, createdAt: candidate.createdAt.getTime() }, now, config)) continue;
    if (await matches.findOne({ status: { $in: ['draft', 'active'] }, 'players.userId': { $in: [entry.userId, candidate.userId] } })) continue;
    const other = await queues.findOneAndDelete({ userId: candidate.userId, queue: candidate.queue, createdAt: candidate.createdAt, expiresAt: { $gt: new Date(now) } });
    if (!other) continue;
    const own = await queues.findOneAndDelete({ userId: entry.userId, queue: entry.queue, createdAt: entry.createdAt, expiresAt: { $gt: new Date(now) } });
    if (!own) { await queues.updateOne({ userId: other.userId }, { $setOnInsert: other }, { upsert: true }); return null; }
    try { return await makeMatch(entry.queue, other, own, config); }
    catch (error) { for (const waiting of [other, own]) if (!await matches.findOne({ status: { $in: ['draft', 'active'] }, 'players.userId': waiting.userId })) await queues.updateOne({ userId: waiting.userId }, { $setOnInsert: waiting }, { upsert: true }); throw error; }
  }
  return null;
}

pvpRouter.post('/queue', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in to play PvP.');
  const queue = req.body?.queue as PvpQueue;
  if (!['arena', 'ranked'].includes(queue)) return routerError(res, 400, 'Choose Arena or Ranked.');
  try {
    const matches = await getCollection<StoredMatch>('pvp_matches');
    const active = await matches.findOne({ status: { $in: ['draft', 'active'] }, 'players.userId': user.userId });
    if (active) return res.json({ success: true, match: publicMatch(active, user.userId) });
    const queues = await getCollection<QueueEntry>('pvp_queue');
    const config = await currentPvpConfig();
    const now = new Date(); const rating = await ratingFor(user.userId, config);
    const existing = await queues.findOne({ userId: user.userId, queue, expiresAt: { $gt: now } });
    const entry: QueueEntry = { userId: user.userId, name: user.username || user.nickname || 'Slicer', queue, points: rating.points, season: seasonKey(), createdAt: existing?.createdAt ?? now, expiresAt: new Date(Date.now() + 120_000) };
    await queues.updateOne({ userId: user.userId }, { $set: entry }, { upsert: true });
    const match = await pairQueued(entry, config);
    if (match) return res.json({ success: true, match: publicMatch(match, user.userId) });
    return res.json({ success: true, queued: true, expiresInSeconds: 120 });
  } catch (error) { console.error(error); routerError(res, 503, 'Matchmaking is unavailable.'); }
});
pvpRouter.delete('/queue', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  await (await getCollection<QueueEntry>('pvp_queue')).deleteOne({ userId: user.userId }); res.json({ success: true });
});

pvpRouter.post('/challenge', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in to challenge a friend.');
  const friendId = String(req.body?.friendId || ''); if (!friendId || friendId === user.userId) return routerError(res, 400, 'Choose a friend to challenge.');
  try {
    const active = await (await getCollection<StoredMatch>('pvp_matches')).findOne({ status: { $in: ['draft', 'active'] }, 'players.userId': { $in: [user.userId, friendId] } });
    if (active) return routerError(res, 409, 'One of you is already in a PvP match.');
    const friends = await getCollection<any>('friends');
    const relation = await friends.findOne({ userId: user.userId, friendId, state: 'accepted' }) || await friends.findOne({ userId: friendId, friendId: user.userId, state: 'accepted' });
    if (!relation) return routerError(res, 403, 'Private challenges are only available to accepted friends.');
    const users = await getCollection<any>('users'); const friend = await users.findOne({ userId: friendId }); if (!friend) return routerError(res, 404, 'Friend not found.');
    const challenge: Challenge = { challengeId: randomUUID(), fromId: user.userId, fromName: user.username || user.nickname || 'Slicer', toId: friendId, createdAt: new Date(), expiresAt: new Date(Date.now() + 120_000) };
    await (await getCollection<Challenge>('pvp_challenges')).insertOne(challenge);
    try { await (await getCollection<any>('notifications')).insertOne({ notificationId: randomUUID(), userId: friendId, actorId: user.userId, actorName: challenge.fromName, type: 'pvp_challenge', title: 'Arena challenge', body: `${challenge.fromName} challenged you to an Arena siege. Open Arena to accept within two minutes.`, createdAt: new Date() }); } catch (error) { console.error('Could not create the Arena challenge notification:', error); }
    res.json({ success: true, challengeId: challenge.challengeId });
  } catch (error) { console.error(error); routerError(res, 503, 'Friend challenges are unavailable.'); }
});
pvpRouter.post('/challenge/:id/accept', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  try {
    const challenges = await getCollection<Challenge>('pvp_challenges');
    const pending = await challenges.findOne({ challengeId: req.params.id, toId: user.userId, expiresAt: { $gt: new Date() }, acceptedAt: { $exists: false } });
    if (!pending) return routerError(res, 404, 'Challenge expired or already accepted.');
    const active = await (await getCollection<StoredMatch>('pvp_matches')).findOne({ status: { $in: ['draft', 'active'] }, 'players.userId': { $in: [pending.fromId, user.userId] } });
    if (active) return routerError(res, 409, 'One of you is already in a PvP match.');
    const invite = await challenges.findOneAndUpdate({ challengeId: req.params.id, toId: user.userId, expiresAt: { $gt: new Date() }, acceptedAt: { $exists: false } }, { $set: { acceptedAt: new Date() } }, { returnDocument: 'before' });
    if (!invite) return routerError(res, 404, 'Challenge expired or already accepted.');
    const config = await currentPvpConfig(); const match = await makeMatch('arena', { userId: invite.fromId, name: invite.fromName }, { userId: user.userId, name: user.username || user.nickname || 'Slicer' }, config);
    await challenges.updateOne({ challengeId: req.params.id }, { $set: { matchId: match.id } }); res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error) { console.error(error); routerError(res, 503, 'Could not start the friend match.'); }
});

pvpRouter.post('/match/:id/cancel-draft', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  try {
    const matches = await getCollection<StoredMatch>('pvp_matches');
    const match = await matches.findOne({ id: req.params.id, status: 'draft', 'players.userId': user.userId });
    if (!match) return routerError(res, 409, 'Draft already ended. Refresh the match.');
    const revision = match.revision; match.status = 'complete'; match.resultReason = 'draft-cancelled'; match.settled = true; delete match.activePlayers; match.revision++;
    const saved = await matches.replaceOne({ id: match.id, revision, status: 'draft' }, match);
    if (!saved.modifiedCount) return routerError(res, 409, 'Draft changed. Refresh the match.');
    void publishMatch(match); res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch { routerError(res, 503, 'Could not cancel the draft.'); }
});

pvpRouter.post('/match/:id/command', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  const sequence = Number(req.body?.sequence); const command = req.body?.command;
  if (!Number.isSafeInteger(sequence) || !command || typeof command !== 'object') return routerError(res, 400, 'Command sequence and command are required.');
  try {
    const matches = await getCollection<StoredMatch>('pvp_matches');
    const match = await matches.findOne({ id: req.params.id, status: 'active', 'players.userId': user.userId }); if (!match) return routerError(res, 404, 'Active match not found.');
    const config = match.balance ?? await currentPvpConfig(); const priorRevision = match.revision;
    applyPvpCommand(match, user.userId, command, sequence, Date.now(), config);
    if (match.status === 'complete') delete match.activePlayers;
    const result = await matches.replaceOne({ id: match.id, revision: priorRevision, status: 'active' }, match);
    if (!result.modifiedCount) return routerError(res, 409, 'Match changed. Refresh the board and retry.');
    if (match.status === 'complete') await settleMatch(match, config); void publishMatch(match);
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error) { routerError(res, 400, error instanceof Error ? error.message : 'Invalid command.'); }
});

pvpRouter.post('/match/:id/veto', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  const sequence = Number(req.body?.sequence); const mapId = String(req.body?.mapId || '');
  if (!Number.isSafeInteger(sequence) || !mapId) return routerError(res, 400, 'Choose a path to veto.');
  try {
    const matches = await getCollection<StoredMatch>('pvp_matches'); const match = await matches.findOne({ id: req.params.id, status: 'draft', 'players.userId': user.userId });
    if (!match) return routerError(res, 404, 'Path draft not found.');
    const priorRevision = match.revision; vetoPvpMap(match, user.userId, mapId, sequence, Date.now(), match.balance ?? await currentPvpConfig());
    const saved = await matches.replaceOne({ id: match.id, revision: priorRevision, status: 'draft' }, match);
    if (!saved.modifiedCount) return routerError(res, 409, 'The other player vetoed first. Refresh the path list.');
    void publishMatch(match); res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error) { routerError(res, 400, error instanceof Error ? error.message : 'Path veto failed.'); }
});

pvpRouter.get('/match/:id', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  try {
    const match = await (await getCollection<StoredMatch>('pvp_matches')).findOne({ id: req.params.id, 'players.userId': user.userId });
    if (!match) return routerError(res, 404, 'Match not found.');
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch { routerError(res, 503, 'Match storage is unavailable.'); }
});

pvpRouter.post('/match/:id/ack', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  try {
    await (await getCollection<StoredMatch>('pvp_matches')).updateOne({ id: req.params.id, status: 'complete', 'players.userId': user.userId }, { $addToSet: { resultsSeenBy: user.userId } });
    res.json({ success: true });
  } catch { routerError(res, 503, 'Could not close the match result.'); }
});

pvpRouter.post('/match/:id/end-test', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  if (!process.env.ADMIN_STEAM_ID || user.steamId !== process.env.ADMIN_STEAM_ID) return routerError(res, 403, 'Admin access required.');
  try {
    const matches = await getCollection<StoredMatch>('pvp_matches');
    const match = await matches.findOne({ id: req.params.id, status: 'active', testMatch: true, 'players.userId': user.userId });
    if (!match) return routerError(res, 404, 'Active bot test match not found.');
    const priorRevision = match.revision;
    match.status = 'complete'; delete match.activePlayers; match.resultReason = 'test-ended'; match.winnerId = null; match.revision++; match.updatedAt = new Date();
    const saved = await matches.replaceOne({ id: match.id, revision: priorRevision, status: 'active', testMatch: true }, match);
    if (!saved.modifiedCount) return routerError(res, 409, 'Match changed. Refresh the board.');
    await settleMatch(match, await currentPvpConfig()); void publishMatch(match);
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error) { console.error(error); routerError(res, 503, 'Could not end the bot test match.'); }
});

pvpRouter.post('/match/:id/connection', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  try {
    const matches = await getCollection<StoredMatch>('pvp_matches'); const match = await matches.findOne({ id: req.params.id, status: { $in: ['draft', 'active'] }, 'players.userId': user.userId });
    if (!match) return routerError(res, 404, 'Active match not found.');
    const player = match.players.find((item) => item.userId === user.userId)!; player.connected = req.body?.connected === true; player.disconnectedAt = player.connected ? null : Date.now(); player.lastSeenAt = Date.now(); match.revision++;
    const saved = await matches.replaceOne({ id: match.id, revision: match.revision - 1, status: match.status }, match);
    if (!saved.modifiedCount) return routerError(res, 409, 'Match changed. Retry connection update.');
    void publishMatch(match); res.json({ success: true });
  } catch { routerError(res, 503, 'Could not update connection state.'); }
});

pvpRouter.post('/match/:id/token', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  try {
    const match = await (await getCollection<StoredMatch>('pvp_matches')).findOne({ id: req.params.id, 'players.userId': user.userId });
    if (!match) return routerError(res, 404, 'Match not found.');
    const key = ablyKey(); const scopedKey = subscriberKey();
    if (!key || !scopedKey || key.app !== scopedKey.app) return routerError(res, 503, 'Ably server and subscribe-only keys are not configured for the same app.');
    const capability = JSON.stringify({ [`fruittd-pvp-${match.id}`]: ['subscribe'] });
    ablySubscriber ??= new Rest({ key: process.env.ABLY_SUBSCRIBE_KEY! });
    const token = await ablySubscriber.auth.requestToken({ clientId: `player-${user.userId}`, capability, ttl: 10 * 60 * 1000 });
    res.json({ success: true, token, channel: `fruittd-pvp-${match.id}` });
  } catch { routerError(res, 502, 'Could not issue the scoped match token.'); }
});

export function startPvpAuthority(): void {
  if (authorityTimer) return;
  authorityTimer = setInterval(async () => {
    if (ticking) return; ticking = true;
    try {
      const col = await getCollection<StoredMatch>('pvp_matches'); const config = await currentPvpConfig();
      const matches = await col.find({ status: 'active' }).limit(200).toArray(); const now = Date.now();
      for (const match of matches) {
        await tickMatch(match, config, now);
      }
    } catch (error) { console.error('PvP authority tick failed:', error); }
    finally { ticking = false; }
  }, 500);
  authorityTimer.unref?.();
}
