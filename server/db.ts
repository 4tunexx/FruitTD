import dotenv from 'dotenv';
import { MongoClient, type Db, type Collection, type CreateIndexesOptions, type IndexSpecification } from 'mongodb';
import { SharedMongoConnection, mongoClientOptions } from './mongoConnection';

dotenv.config({ quiet: true });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.warn('MONGODB_URI is missing; cloud account and progression requests will fail until it is configured.');
}

export interface UserDoc {
  userId: string;
  nickname: string;
  username?: string;
  avatar: string;
  email?: string;
  emailVerified?: boolean;
  emailVerifyCodeHash?: string;
  emailVerifyExpires?: Date;
  passwordHash?: string;
  authProvider?: 'steam' | 'email' | 'steam+email';
  profileComplete?: boolean;
  steamId?: string;
  steamPersona?: string;
  steamAvatar?: string;
  steamBonusGranted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaderboardDoc {
  userId: string;
  nickname: string;
  avatar: string;
  hero: string;
  mode: string;
  score: number;
  wave: number;
  fruitsSliced: number;
  maxCombo: number;
  steamId?: string;
  steamPersona?: string;
  steamAvatar?: string;
  createdAt: Date;
}

export interface AchievementDoc {
  userId: string;
  achievementId: string;
  unlocked: boolean;
  unlockedAt?: Date;
  claimed: boolean;
  progress: number;
  maxProgress: number;
}

export interface MissionDoc {
  userId: string;
  missionId: string;
  dayKey: string; // YYYY-MM-DD
  progress: number;
  goal: number;
  completed: boolean;
  claimed: boolean;
  updatedAt: Date;
}

export interface BadgeDoc {
  userId: string;
  badgeId: string;
  unlocked: boolean;
  unlockedAt?: Date;
  progress: number;
  maxProgress: number;
}

export interface DailyBonusDoc {
  userId: string;
  streak: number;
  lastClaimDate: string; // YYYY-MM-DD
  totalClaimed: number;
  updatedAt: Date;
}

export interface CloudSaveDoc {
  userId: string;
  saveData: Record<string, any>;
  /** Monotonic server-owned compare-and-swap revision. */
  revision?: number;
  /** Canonical single-use reward claim receipts, updated atomically with wallet. */
  claimReceipts?: string[];
  updatedAt: Date;
}

export interface RunTokenDoc {
  tokenHash: string;
  userId: string;
  mode: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt?: Date;
}

type DatabaseIndex = {
  collection: string;
  keys: IndexSpecification;
  options?: CreateIndexesOptions;
};

const DATABASE_INDEXES: DatabaseIndex[] = [
  { collection: 'leaderboards', keys: { mode: 1, score: -1 } },
  { collection: 'leaderboards', keys: { userId: 1, mode: 1 } },
  { collection: 'users', keys: { userId: 1 }, options: { unique: true } },
  { collection: 'users', keys: { email: 1 }, options: { unique: true, sparse: true } },
  { collection: 'users', keys: { username: 1 }, options: { unique: true, sparse: true } },
  { collection: 'users', keys: { steamId: 1 }, options: { unique: true, sparse: true } },
  { collection: 'sessions', keys: { tokenHash: 1 }, options: { unique: true } },
  { collection: 'sessions', keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
  { collection: 'achievements', keys: { userId: 1, achievementId: 1 }, options: { unique: true } },
  { collection: 'missions', keys: { userId: 1, missionId: 1, dayKey: 1 }, options: { unique: true } },
  { collection: 'daily_bonus', keys: { userId: 1 }, options: { unique: true } },
  { collection: 'cloud_saves', keys: { userId: 1 }, options: { unique: true } },
  { collection: 'run_tokens', keys: { tokenHash: 1 }, options: { unique: true } },
  { collection: 'run_tokens', keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
  { collection: 'admin_config', keys: { configKey: 1 }, options: { unique: true } },
  { collection: 'battle_maps', keys: { id: 1 }, options: { unique: true } },
  { collection: 'battle_maps', keys: { mode: 1, published: 1 } },
  { collection: 'coop_matches', keys: { activePlayers: 1 }, options: { unique: true, sparse: true } },
  { collection: 'coop_matches', keys: { id: 1 }, options: { unique: true } },
  { collection: 'badges', keys: { userId: 1, badgeId: 1 }, options: { unique: true } },
  { collection: 'friends', keys: { userId: 1, friendId: 1 }, options: { unique: true } },
  { collection: 'friends', keys: { userId: 1, state: 1, updatedAt: -1 } },
  { collection: 'friends', keys: { friendId: 1, state: 1, updatedAt: -1 } },
  { collection: 'notifications', keys: { userId: 1, createdAt: -1 } },
  { collection: 'notifications', keys: { createdAt: 1 }, options: { expireAfterSeconds: 30 * 24 * 60 * 60 } },
  { collection: 'notifications', keys: { notificationId: 1 }, options: { unique: true } },
  { collection: 'notifications', keys: { userId: 1, eventKey: 1 }, options: { unique: true, partialFilterExpression: { eventKey: { $exists: true } } } },
  { collection: 'messages', keys: { conversationId: 1, createdAt: 1 } },
  { collection: 'messages', keys: { createdAt: 1 }, options: { expireAfterSeconds: 30 * 24 * 60 * 60 } },
  { collection: 'messages', keys: { messageId: 1 }, options: { unique: true } },
  { collection: 'forum_posts', keys: { postId: 1 }, options: { unique: true } },
  { collection: 'forum_posts', keys: { createdAt: -1 } },
  { collection: 'coop_lobbies', keys: { lobbyId: 1 }, options: { unique: true } },
  { collection: 'coop_lobbies', keys: { code: 1 }, options: { unique: true } },
  { collection: 'coop_lobbies', keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
  { collection: 'coop_lobbies', keys: { visibility: 1, status: 1, createdAt: 1 } },
  { collection: 'coop_lobbies', keys: { 'members.userId': 1, status: 1 } },
  { collection: 'pvp_arena_records', keys: { userId: 1 }, options: { unique: true } },
  { collection: 'pvp_ratings', keys: { userId: 1 }, options: { unique: true } },
  { collection: 'pvp_matches', keys: { id: 1 }, options: { unique: true } },
  { collection: 'pvp_matches', keys: { activePlayers: 1 }, options: { unique: true, sparse: true } },
  { collection: 'pvp_matches', keys: { status: 1, updatedAt: 1 } },
  { collection: 'pvp_queue', keys: { userId: 1 }, options: { unique: true } },
  { collection: 'pvp_queue', keys: { queue: 1, expiresAt: 1 } },
  { collection: 'pvp_challenges', keys: { challengeId: 1 }, options: { unique: true } },
  { collection: 'pvp_challenges', keys: { toId: 1, expiresAt: 1 } },
];

/** Keep attempting independent indexes if a legacy data conflict blocks one. */
export async function ensureDatabaseIndexes(db: Db): Promise<void> {
  for (const index of DATABASE_INDEXES) {
    try {
      await db.collection(index.collection).createIndex(index.keys, index.options);
    } catch (error) {
      console.warn(`Index creation notice (${index.collection}):`, error);
    }
  }
}

const connection = new SharedMongoConnection<Db>(
  () => {
    if (!uri) throw new Error('MongoDB URI not defined');
    return new MongoClient(uri, mongoClientOptions(process.env.VERCEL === '1'));
  },
  'FruitTD',
  ensureDatabaseIndexes,
);

export function getDb(): Promise<Db> {
  return connection.get();
}

export async function getCollection<T extends Record<string, any>>(name: string): Promise<Collection<T>> {
  const database = await getDb();
  return database.collection<T>(name);
}

export function closeDb(): Promise<void> {
  return connection.close();
}
