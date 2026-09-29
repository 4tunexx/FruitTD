import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { Collection } from 'mongodb';
import { getCollection, type UserDoc } from '../db';
import { resolveRequestUser } from '../auth';
import { rankFromScore } from '../../src/game/requirements';

type RequestUser = Awaited<ReturnType<typeof resolveRequestUser>>;
type FriendDoc = { userId: string; friendId: string; state: 'pending' | 'accepted' | 'blocked'; createdAt: Date; updatedAt: Date };
type NotificationDoc = { notificationId: string; userId: string; actorId: string; actorName: string; type: string; title: string; body: string; readAt?: Date; createdAt: Date };
type MessageDoc = { messageId: string; conversationId: string; senderId: string; recipientId: string; body: string; readAt?: Date; createdAt: Date };

export interface SocialRouteDeps {
  resolveUser(req: Request): Promise<RequestUser>;
  collection<T extends Record<string, any>>(name: string): Promise<Collection<T>>;
}

const defaults: SocialRouteDeps = { resolveUser: resolveRequestUser, collection: getCollection };
const fail = (res: Response, status: number, error: string) => res.status(status).json({ success: false, error });
const safeName = (user: Partial<UserDoc>) => String(user.username || user.nickname || 'Slicer').slice(0, 32);
const usernamePattern = /^[a-z0-9_]{3,24}$/i;
const pairKey = (a: string, b: string) => [a, b].sort().join(':');

async function byUsername(col: Collection<UserDoc>, username: string): Promise<UserDoc | null> {
  if (!usernamePattern.test(username)) return null;
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return col.findOne({ username: { $regex: `^${escaped}$`, $options: 'i' } } as any);
}

async function notify(
  col: Collection<NotificationDoc>,
  userId: string,
  actorId: string,
  actorName: string,
  type: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    await col.insertOne({ notificationId: randomUUID(), userId, actorId, actorName, type, title, body: body.slice(0, 240), createdAt: new Date() });
  } catch (err) {
    // A notification is a secondary signal; it must not turn an already saved
    // friend request or message into a reported failure the player may repeat.
    console.error('Could not save social notification:', err);
  }
}

export function createSocialRouter(deps: SocialRouteDeps = defaults): Router {
  const router = Router();

  router.get('/profiles/:username', async (req, res) => {
    try {
      const users = await deps.collection<UserDoc>('users');
      const profile = await byUsername(users, String(req.params.username || ''));
      if (!profile) return fail(res, 404, 'Player not found');
      const [save, best, badges] = await Promise.all([
        (await deps.collection<any>('cloud_saves')).findOne({ userId: profile.userId }),
        (await deps.collection<any>('leaderboards')).findOne({ userId: profile.userId }, { sort: { score: -1 } }),
        (await deps.collection<any>('badges')).find({ userId: profile.userId, unlocked: true }).limit(30).toArray(),
      ]);
      const score = Math.max(Number(best?.score) || 0, Number(save?.saveData?.rankedScore) || 0);
      res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
      res.json({ success: true, profile: {
        username: safeName(profile), nickname: String(profile.nickname || safeName(profile)).slice(0, 32),
        avatar: typeof profile.avatar === 'string' ? profile.avatar.slice(0, 900_000) : '',
        hero: String(save?.saveData?.hero || 'jiju'), highScore: Number(save?.saveData?.highScore) || 0,
        rankedScore: score, rank: rankFromScore(score).title, bestWave: Number(save?.saveData?.bestWave) || 1,
        games: Number(save?.saveData?.games) || 0, badges: badges.map((badge) => String(badge.badgeId)).slice(0, 30),
      } });
    } catch (err: any) {
      console.error('Error loading public player profile:', err);
      fail(res, 500, 'Could not load player profile');
    }
  });

  router.get('/friends', async (req, res) => {
    try {
      const user = await deps.resolveUser(req);
      if (!user) return fail(res, 401, 'Sign in to view friends');
      const relations = await (await deps.collection<FriendDoc>('friends'))
        .find({ $or: [{ userId: user.userId }, { friendId: user.userId }] } as any)
        .sort({ updatedAt: -1 }).limit(200).toArray();
      const users = await deps.collection<UserDoc>('users');
      const uniqueRelations = [...new Map(relations.map((row) => {
        const friendId = row.userId === user.userId ? row.friendId : row.userId;
        return [friendId, row] as const;
      })).values()];
      const friends = await Promise.all(uniqueRelations.map(async (row) => {
        const friendId = row.userId === user.userId ? row.friendId : row.userId;
        const friend = await users.findOne({ userId: friendId });
        return friend ? { userId: friend.userId, username: safeName(friend), nickname: friend.nickname, avatar: friend.avatar, state: row.state, direction: row.userId === user.userId ? 'incoming' : 'outgoing' } : null;
      }));
      res.json({ success: true, friends: friends.filter(Boolean) });
    } catch (err: any) {
      console.error('Error loading friends:', err);
      fail(res, 500, 'Could not load friends');
    }
  });

  router.post('/friends/request', async (req, res) => {
    try {
      const user = await deps.resolveUser(req);
      if (!user) return fail(res, 401, 'Sign in to add friends');
      const target = await byUsername(await deps.collection<UserDoc>('users'), String(req.body?.username || '').trim());
      if (!target) return fail(res, 404, 'Player not found. Check the username and try again.');
      if (target.userId === user.userId) return fail(res, 400, 'You cannot add yourself as a friend');
      const friends = await deps.collection<FriendDoc>('friends');
      const existing = await friends.findOne({ $or: [
        { userId: user.userId, friendId: target.userId }, { userId: target.userId, friendId: user.userId },
      ] } as any);
      if (existing) return fail(res, 409, existing.state === 'accepted' ? 'You are already friends' : 'A friend request is already waiting');
      const now = new Date();
      await friends.insertOne({ userId: target.userId, friendId: user.userId, state: 'pending', createdAt: now, updatedAt: now });
      await notify(await deps.collection<NotificationDoc>('notifications'), target.userId, user.userId, safeName(user), 'friend_request', 'Friend request', `${safeName(user)} wants to join your friends list.`);
      res.status(201).json({ success: true, username: safeName(target) });
    } catch (err: any) {
      if (err?.code === 11000) return fail(res, 409, 'A friend request is already waiting');
      console.error('Error sending friend request:', err);
      fail(res, 500, 'Could not send friend request');
    }
  });

  router.post('/friends/respond', async (req, res) => {
    try {
      const user = await deps.resolveUser(req);
      if (!user) return fail(res, 401, 'Sign in to respond to friend requests');
      const friendId = typeof req.body?.friendId === 'string' ? req.body.friendId : '';
      const accept = req.body?.accept === true;
      if (!friendId || friendId === user.userId) return fail(res, 400, 'Invalid friend request');
      const friends = await deps.collection<FriendDoc>('friends');
      const update = accept
        ? await friends.updateOne({ userId: user.userId, friendId, state: 'pending' }, { $set: { state: 'accepted', updatedAt: new Date() } })
        : await friends.deleteOne({ userId: user.userId, friendId, state: 'pending' });
      if (!('matchedCount' in update ? update.matchedCount : update.deletedCount)) return fail(res, 404, 'Friend request is no longer available');
      if (accept) {
        try { await friends.insertOne({ userId: friendId, friendId: user.userId, state: 'accepted', createdAt: new Date(), updatedAt: new Date() }); }
        catch (err: any) { if (err?.code !== 11000) throw err; }
        const actor = await (await deps.collection<UserDoc>('users')).findOne({ userId: user.userId });
        await notify(await deps.collection<NotificationDoc>('notifications'), friendId, user.userId, safeName(user), 'friend_accepted', 'Friend request accepted', `${safeName(actor || user)} accepted your request.`);
      }
      res.json({ success: true, state: accept ? 'accepted' : 'declined' });
    } catch (err: any) {
      console.error('Error responding to friend request:', err);
      fail(res, 500, 'Could not update friend request');
    }
  });

  router.get('/notifications', async (req, res) => {
    try {
      const user = await deps.resolveUser(req);
      if (!user) return fail(res, 401, 'Sign in to view notifications');
      const notifications = await (await deps.collection<NotificationDoc>('notifications'))
        .find({ userId: user.userId }).sort({ createdAt: -1 }).limit(50).toArray();
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ success: true, unread: notifications.filter((item) => !item.readAt).length, notifications });
    } catch (err: any) {
      console.error('Error loading notifications:', err);
      fail(res, 500, 'Could not load notifications');
    }
  });

  router.post('/notifications/read', async (req, res) => {
    try {
      const user = await deps.resolveUser(req);
      if (!user) return fail(res, 401, 'Sign in to update notifications');
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((id: unknown) => typeof id === 'string').slice(0, 50) : [];
      const filter: any = { userId: user.userId, readAt: { $exists: false } };
      if (ids.length) filter.notificationId = { $in: ids };
      const result = await (await deps.collection<NotificationDoc>('notifications')).updateMany(filter, { $set: { readAt: new Date() } });
      res.json({ success: true, markedRead: result.modifiedCount });
    } catch (err: any) {
      console.error('Error updating notifications:', err);
      fail(res, 500, 'Could not update notifications');
    }
  });

  router.get('/messages/:username', async (req, res) => {
    try {
      const user = await deps.resolveUser(req);
      if (!user) return fail(res, 401, 'Sign in to open messages');
      const peer = await byUsername(await deps.collection<UserDoc>('users'), String(req.params.username || ''));
      if (!peer) return fail(res, 404, 'Player not found');
      const relation = await (await deps.collection<FriendDoc>('friends')).findOne({ userId: user.userId, friendId: peer.userId, state: 'accepted' });
      if (!relation) return fail(res, 403, 'You can message friends only');
      const conversationId = pairKey(user.userId, peer.userId);
      const messages = await (await deps.collection<MessageDoc>('messages')).find({ conversationId }).sort({ createdAt: 1 }).limit(100).toArray();
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ success: true, friend: { username: safeName(peer), nickname: peer.nickname, avatar: peer.avatar }, messages });
    } catch (err: any) {
      console.error('Error loading messages:', err);
      fail(res, 500, 'Could not load messages');
    }
  });

  router.post('/messages/:username', async (req, res) => {
    try {
      const user = await deps.resolveUser(req);
      if (!user) return fail(res, 401, 'Sign in to send messages');
      const peer = await byUsername(await deps.collection<UserDoc>('users'), String(req.params.username || ''));
      if (!peer) return fail(res, 404, 'Player not found');
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
      if (!body || body.length > 1000) return fail(res, 400, 'Messages must contain 1 to 1,000 characters');
      const relation = await (await deps.collection<FriendDoc>('friends')).findOne({ userId: user.userId, friendId: peer.userId, state: 'accepted' });
      if (!relation) return fail(res, 403, 'You can message friends only');
      const message: MessageDoc = { messageId: randomUUID(), conversationId: pairKey(user.userId, peer.userId), senderId: user.userId, recipientId: peer.userId, body, createdAt: new Date() };
      await (await deps.collection<MessageDoc>('messages')).insertOne(message);
      await notify(await deps.collection<NotificationDoc>('notifications'), peer.userId, user.userId, safeName(user), 'message', 'New message', body.slice(0, 100));
      res.status(201).json({ success: true, message });
    } catch (err: any) {
      console.error('Error sending message:', err);
      fail(res, 500, 'Could not send message');
    }
  });

  return router;
}

export const socialRouter = createSocialRouter();
