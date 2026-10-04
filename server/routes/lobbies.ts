import { randomBytes, randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Collection } from 'mongodb';
import { getCollection, type UserDoc } from '../db';
import { resolveRequestUser } from '../auth';

type RequestUser = Awaited<ReturnType<typeof resolveRequestUser>>;
type Member = { userId: string; name: string; ready: boolean };
export type CoopLobby = {
  lobbyId: string; code: string; hostId: string; visibility: 'friends' | 'public';
  status: 'waiting'; members: Member[]; createdAt: Date; expiresAt: Date;
};

export interface LobbyDeps {
  resolveUser(req: Request): Promise<RequestUser>;
  collection<T extends Record<string, any>>(name: string): Promise<Collection<T>>;
}
const defaults: LobbyDeps = { resolveUser: resolveRequestUser, collection: getCollection };
const error = (res: Response, status: number, message: string) => res.status(status).json({ success: false, error: message });
const active = () => ({ status: 'waiting' as const, expiresAt: { $gt: new Date() } });

export function createLobbyRouter(deps: LobbyDeps = defaults): Router {
  const router = Router();
  const identity = async (req: Request, res: Response) => {
    const user = await deps.resolveUser(req);
    if (!user) error(res, 401, 'Sign in to use online lobbies');
    return user;
  };

  router.get('/mine', async (req, res) => {
    try {
      const user = await identity(req, res); if (!user) return;
      const room = await (await deps.collection<CoopLobby>('coop_lobbies')).findOne({ 'members.userId': user.userId, ...active() });
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ success: true, userId: user.userId, lobby: room || null });
    } catch { error(res, 503, 'Lobbies are unavailable'); }
  });

  router.get('/public', async (req, res) => {
    try {
      const user = await identity(req, res); if (!user) return;
      const rooms = await (await deps.collection<CoopLobby>('coop_lobbies'))
        .find({ visibility: 'public', ...active(), $expr: { $lt: [{ $size: '$members' }, 2] } } as any)
        .sort({ createdAt: 1 }).limit(12).toArray();
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ success: true, lobbies: rooms });
    } catch { error(res, 503, 'Lobbies are unavailable'); }
  });

  router.post('/', async (req, res) => {
    try {
      const user = await identity(req, res); if (!user) return;
      const rooms = await deps.collection<CoopLobby>('coop_lobbies');
      const existing = await rooms.findOne({ 'members.userId': user.userId, ...active() });
      if (existing) return error(res, 409, 'Leave your current lobby first');
      const lobby: CoopLobby = {
        lobbyId: randomUUID(), code: randomBytes(4).toString('hex').toUpperCase(), hostId: user.userId,
        visibility: req.body?.visibility === 'public' ? 'public' : 'friends', status: 'waiting',
        members: [{ userId: user.userId, name: String(user.username || user.nickname || 'Slicer').slice(0, 32), ready: false }],
        createdAt: new Date(), expiresAt: new Date(Date.now() + 2 * 60 * 60_000),
      };
      await rooms.insertOne(lobby);
      res.status(201).json({ success: true, lobby });
    } catch (err: any) { error(res, err?.code === 11000 ? 409 : 503, 'Could not create lobby'); }
  });

  router.post('/join', async (req, res) => {
    try {
      const user = await identity(req, res); if (!user) return;
      const rooms = await deps.collection<CoopLobby>('coop_lobbies');
      const existing = await rooms.findOne({ 'members.userId': user.userId, ...active() });
      if (existing) return error(res, 409, 'Leave your current lobby first');
      const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
      if (code && !/^[A-F0-9]{8}$/.test(code)) return error(res, 400, 'Enter an eight character invite code');
      const where = code ? { code } : { visibility: 'public' as const };
      // Capacity and duplicate membership are checked in the same Mongo update.
      const room = await rooms.findOneAndUpdate({ ...where, ...active(),
        'members.userId': { $ne: user.userId },
        $expr: { $lt: [{ $size: '$members' }, 2] },
      } as any, { $push: { members: { userId: user.userId, name: String(user.username || user.nickname || 'Slicer').slice(0, 32), ready: false } } },
      { sort: { createdAt: 1 }, returnDocument: 'after' });
      if (!room) return error(res, 404, code ? 'Lobby unavailable or full' : 'No open public lobby yet');
      res.json({ success: true, lobby: room });
    } catch { error(res, 503, 'Could not join lobby'); }
  });

  router.post('/ready', async (req, res) => {
    try {
      const user = await identity(req, res); if (!user) return;
      if (typeof req.body?.ready !== 'boolean') return error(res, 400, 'Invalid ready state');
      const room = await (await deps.collection<CoopLobby>('coop_lobbies')).findOneAndUpdate(
        { 'members.userId': user.userId, ...active() },
        { $set: { 'members.$.ready': req.body.ready } }, { returnDocument: 'after' });
      if (!room) return error(res, 404, 'Lobby no longer available');
      res.json({ success: true, lobby: room });
    } catch { error(res, 503, 'Could not update ready state'); }
  });

  router.post('/leave', async (req, res) => {
    try {
      const user = await identity(req, res); if (!user) return;
      const rooms = await deps.collection<CoopLobby>('coop_lobbies');
      // Host departure closes the lobby so ownership can never become stale.
      const hosted = await rooms.findOneAndDelete({ hostId: user.userId, ...active() });
      if (!hosted) await rooms.updateOne({ 'members.userId': user.userId, ...active() }, { $pull: { members: { userId: user.userId } } });
      res.json({ success: true });
    } catch { error(res, 503, 'Could not leave lobby'); }
  });

  router.post('/invite', async (req, res) => {
    try {
      const user = await identity(req, res); if (!user) return;
      const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
      const friendId = typeof req.body?.friendId === 'string' ? req.body.friendId : '';
      if (!/^[a-z0-9_]{3,24}$/i.test(username) && (!friendId || friendId.length > 128)) return error(res, 400, 'Choose a friend or enter a valid username');
      const room = await (await deps.collection<CoopLobby>('coop_lobbies')).findOne({ hostId: user.userId, ...active() });
      if (!room) return error(res, 403, 'Only the lobby host can invite friends');
      const friend = await (await deps.collection<UserDoc>('users')).findOne(friendId
        ? { userId: friendId } : { username: { $regex: `^${username}$`, $options: 'i' } } as any);
      if (!friend || friend.userId === user.userId) return error(res, 404, 'Friend not found');
      const relationship = await (await deps.collection<any>('friends')).findOne({ userId: user.userId, friendId: friend.userId, state: 'accepted' });
      if (!relationship) return error(res, 403, 'Invite accepted friends only');
      await (await deps.collection<any>('notifications')).insertOne({
        notificationId: randomUUID(), userId: friend.userId, actorId: user.userId,
        actorName: String(user.username || user.nickname || 'Slicer').slice(0, 32), type: 'coop_invite',
        title: 'Co-op lobby invitation', body: `Join with code ${room.code}`, createdAt: new Date(),
      });
      res.json({ success: true });
    } catch { error(res, 503, 'Could not send invite'); }
  });

  return router;
}

export const lobbyRouter = createLobbyRouter();
