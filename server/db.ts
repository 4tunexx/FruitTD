import dotenv from 'dotenv';
import { MongoClient, Db, Collection } from 'mongodb';

dotenv.config();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.warn('⚠️ MONGODB_URI not found in environment variables. Falling back to local/mock mode.');
}

let client: MongoClient | null = null;
let db: Db | null = null;

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
  updatedAt: Date;
}

export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!uri) throw new Error('MongoDB URI not defined');

  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas (FruitTD)');
  }
  db = client.db('FruitTD');

  // Ensure useful indexes
  try {
    await db.collection('leaderboards').createIndex({ mode: 1, score: -1 });
    await db.collection('leaderboards').createIndex({ userId: 1, mode: 1 });
    await db.collection('users').createIndex({ userId: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ username: 1 }, { unique: true, sparse: true });
    await db.collection('users').createIndex({ steamId: 1 }, { unique: true, sparse: true });
    await db.collection('sessions').createIndex({ tokenHash: 1 }, { unique: true });
    await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection('achievements').createIndex({ userId: 1, achievementId: 1 }, { unique: true });
    await db.collection('missions').createIndex({ userId: 1, missionId: 1, dayKey: 1 }, { unique: true });
    await db.collection('daily_bonus').createIndex({ userId: 1 }, { unique: true });
    await db.collection('cloud_saves').createIndex({ userId: 1 }, { unique: true });
    await db.collection('admin_config').createIndex({ configKey: 1 }, { unique: true });
    await db.collection('badges').createIndex({ userId: 1, badgeId: 1 }, { unique: true });
  } catch (err) {
    console.warn('Index creation notice:', err);
  }

  return db;
}

export async function getCollection<T extends Record<string, any>>(name: string): Promise<Collection<T>> {
  const database = await getDb();
  return database.collection<T>(name);
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
