import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Rest } from 'ably';
import { getCollection } from '../db';
import { resolveRequestUser } from '../auth';
import { creditClaimReward } from '../claimWallet';
import { DEFAULT_PVP_CONFIG, advancePvpMatch, applyPvpCommand, calculatePvpRating, createPvpPlayer, newPvpMatch, pvpTier, resetSeasonRating, vetoPvpMap, type PvpConfig, type PvpMatch, type PvpQueue } from '../../src/game/pvp';
import { mergeAdminConfig } from '../../src/services/admin';

export const pvpRouter = Router();
type QueueEntry = { userId: string; name: string; queue: PvpQueue; createdAt: Date; expiresAt: Date };
type Challenge = { challengeId: string; fromId: string; fromName: string; toId: string; createdAt: Date; expiresAt: Date; acceptedAt?: Date; matchId?: string };
type StoredMatch = PvpMatch & { updatedAt: Date; settled?: boolean; resultsSeenBy?: string[] };
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
    await col.insertOne(row);
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
  return { id: match.id, queue: match.queue, status: match.status, remainingMs: Math.max(0, match.endsAt - Date.now()), revision: match.revision,
    map: match.map, mapPool: match.mapPool.map(({ id, name, width, height, pathCells }) => ({ id, name, width, height, pathCells })), vetoTurnId: match.vetoTurn, yourVetoTurn: match.vetoTurn === userId, vetoesRemaining: Math.max(0, match.mapPool.length - 2),
    players: match.players.map(({ userId: id, name, side, fruts, wallHealth, score, towers, attackers, connected, ratingDelta }) => ({ userId: id, name, side, fruts: Math.floor(fruts), wallHealth, score, towers, attackers, connected, ...(match.status === 'complete' && match.queue === 'ranked' ? { ratingDelta } : {}) })),
    yourSequence: match.players.find((player) => player.userId === userId)?.sequence ?? 0,
    yourCombo: match.players.find((player) => player.userId === userId)?.currentCombo ?? 0,
    yourSide: match.players.find((player) => player.userId === userId)?.side, winnerId: match.winnerId, resultReason: match.resultReason };
}
async function makeMatch(queue: PvpQueue, left: { userId: string; name: string }, right: { userId: string; name: string }, config: PvpConfig): Promise<StoredMatch> {
  const match = newPvpMatch(randomUUID(), queue, [createPvpPlayer(left.userId, left.name, 'blue', config), createPvpPlayer(right.userId, right.name, 'red', config)], Date.now(), config) as StoredMatch;
  match.updatedAt = new Date();
  await (await getCollection<StoredMatch>('pvp_matches')).insertOne(match);
  void publishMatch(match);
  return match;
}
async function settleMatch(match: StoredMatch, config: PvpConfig): Promise<void> {
  if (match.status !== 'complete' || match.settled) return;
  if (settlingMatches.has(match.id)) return;
  settlingMatches.add(match.id);
  const matches = await getCollection<StoredMatch>('pvp_matches');
  try {
    const achievements = await getCollection<any>('achievements'); const badges = await getCollection<any>('badges');
    for (const player of match.players) {
      const outcome = match.winnerId === null ? 'tie' : match.winnerId === player.userId ? 'win' : 'loss';
      const achievement = async (achievementId: string) => achievements.updateOne({ userId: player.userId, achievementId }, { $set: { unlocked: true, unlockedAt: new Date(), progress: 1, maxProgress: 1 }, $setOnInsert: { claimed: false } }, { upsert: true });
      const badge = async (badgeId: string) => badges.updateOne({ userId: player.userId, badgeId }, { $set: { unlocked: true, unlockedAt: new Date(), progress: 1, maxProgress: 1 } }, { upsert: true });
      if (outcome === 'win') { await achievement('pvp_first_win'); await badge('pvp-first-win'); }
      if (player.maxCombo >= 50) await achievement('pvp_combo_50');
      if (player.maxSingleSlashKills >= 5) await achievement('pvp_multislice_5');
      if (match.queue === 'ranked') {
        const row = await ratingFor(player.userId, config); const ratings = await getCollection<RatingDoc>('pvp_ratings');
        if (row.settledMatchIds?.includes(match.id)) player.ratingDelta = row.lastMatchId === match.id ? row.lastDelta ?? 0 : 0;
        else {
          const result = calculatePvpRating(row.points, outcome, player.comboMilestones, player.maxSingleSlashKills, config);
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
    await matches.updateOne({ id: match.id }, { $set: { settled: true, players: match.players } });
  } finally {
    settlingMatches.delete(match.id);
  }
}

pvpRouter.get('/status', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in to play PvP.');
  try {
    const config = await currentPvpConfig();
    const matches = await getCollection<StoredMatch>('pvp_matches');
    let match = await matches.findOne({ 'players.userId': user.userId, $or: [{ status: { $in: ['draft', 'active'] } }, { status: 'complete', resultsSeenBy: { $ne: user.userId } }] });
    if (match?.status === 'complete' && !match.settled) { await settleMatch(match, config); match = await matches.findOne({ id: match.id }); }
    if (match && match.status !== 'complete') {
      const player = match.players.find((item) => item.userId === user.userId)!;
      player.connected = true; player.disconnectedAt = null; player.lastSeenAt = Date.now(); match.revision++;
      await matches.replaceOne({ id: match.id, revision: match.revision - 1, status: match.status }, match);
    }
    const rating = await ratingFor(user.userId, config);
    const challenge = await (await getCollection<Challenge>('pvp_challenges')).findOne({ toId: user.userId, expiresAt: { $gt: new Date() }, acceptedAt: { $exists: false } });
    const queued = await (await getCollection<QueueEntry>('pvp_queue')).findOne({ userId: user.userId, expiresAt: { $gt: new Date() } });
    res.json({ success: true, rating: { points: rating.points, tier: pvpTier(rating.points, config), season: rating.season, matches: rating.matches, wins: rating.wins, ties: rating.ties, losses: rating.losses }, match: match ? publicMatch(match, user.userId) : null, queued: queued ? queued.queue : null, challenge: challenge ? { challengeId: challenge.challengeId, fromId: challenge.fromId, fromName: challenge.fromName } : null, config: { durationSeconds: config.durationSeconds, reconnectGraceSeconds: config.reconnectGraceSeconds, towers: config.towers, attacks: config.attacks, maps: config.maps } });
  } catch (error) { console.error(error); routerError(res, 503, 'PvP storage is unavailable.'); }
});

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
    const other = await queues.findOneAndDelete({ queue, userId: { $ne: user.userId }, expiresAt: { $gt: new Date() } }, { sort: { createdAt: 1 } });
    const otherEntry = other;
    if (otherEntry) {
      const match = await makeMatch(queue, { userId: otherEntry.userId, name: otherEntry.name }, { userId: user.userId, name: user.username || user.nickname || 'Slicer' }, config);
      return res.json({ success: true, match: publicMatch(match, user.userId) });
    }
    const now = new Date();
    await queues.updateOne({ userId: user.userId }, { $set: { userId: user.userId, name: user.username || user.nickname || 'Slicer', queue, createdAt: now, expiresAt: new Date(Date.now() + 60_000) } }, { upsert: true });
    return res.json({ success: true, queued: true, expiresInSeconds: 60 });
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

pvpRouter.post('/match/:id/command', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  const sequence = Number(req.body?.sequence); const command = req.body?.command;
  if (!Number.isSafeInteger(sequence) || !command || typeof command !== 'object') return routerError(res, 400, 'Command sequence and command are required.');
  try {
    const matches = await getCollection<StoredMatch>('pvp_matches');
    const match = await matches.findOne({ id: req.params.id, status: 'active', 'players.userId': user.userId }); if (!match) return routerError(res, 404, 'Active match not found.');
    const config = await currentPvpConfig(); const priorRevision = match.revision;
    applyPvpCommand(match, user.userId, command, sequence, Date.now(), config);
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
    const priorRevision = match.revision; vetoPvpMap(match, user.userId, mapId, sequence, Date.now(), await currentPvpConfig());
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

pvpRouter.post('/match/:id/connection', async (req: Request, res: Response) => {
  const user = await resolveRequestUser(req); if (!user) return routerError(res, 401, 'Sign in first.');
  try {
    const matches = await getCollection<StoredMatch>('pvp_matches'); const match = await matches.findOne({ id: req.params.id, status: { $in: ['draft', 'active'] }, 'players.userId': user.userId });
    if (!match) return routerError(res, 404, 'Active match not found.');
    const player = match.players.find((item) => item.userId === user.userId)!; player.connected = req.body?.connected === true; player.disconnectedAt = player.connected ? null : Date.now(); player.lastSeenAt = Date.now(); match.revision++;
    await matches.replaceOne({ id: match.id }, match); void publishMatch(match); res.json({ success: true });
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
      const matches = await col.find({ status: { $in: ['draft', 'active'] } }).limit(200).toArray(); const now = Date.now();
      for (const match of matches) {
        const priorRevision = match.revision; const dt = Math.max(0, Math.min(1, (now - match.updatedAt.getTime()) / 1000));
        advancePvpMatch(match, dt, now, config); match.updatedAt = new Date(now);
        const saved = await col.replaceOne({ id: match.id, revision: priorRevision, status: 'active' }, match);
        if (saved.modifiedCount) { void publishMatch(match); if (match.status === 'complete') await settleMatch(match, config); }
      }
    } catch (error) { console.error('PvP authority tick failed:', error); }
    finally { ticking = false; }
  }, 500);
  authorityTimer.unref?.();
}
