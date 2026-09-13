import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getCollection, type UserDoc, type AchievementDoc } from '../db';
import {
  createSession,
  destroySession,
  deliverVerifyCode,
  hashPassword,
  hashToken,
  isValidEmail,
  makeVerifyCode,
  publicUser,
  resolveSession,
  verifyPassword,
} from '../auth';
import { sanitizeSteamUsername, validateUsername } from '../username';

export const authRouter = Router();

function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  const q = req.query.token;
  if (typeof q === 'string' && q) return q;
  const body = req.body?.token;
  if (typeof body === 'string' && body) return body;
  return null;
}

async function unlockSteamAchievement(userId: string): Promise<void> {
  try {
    const achCol = await getCollection<AchievementDoc>('achievements');
    await achCol.updateOne(
      { userId, achievementId: 'steam_connect' },
      {
        $set: {
          progress: 1,
          maxProgress: 1,
          unlocked: true,
          unlockedAt: new Date(),
          claimed: false,
        },
      },
      { upsert: true }
    );
  } catch {
    // non-fatal
  }
}

authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const user = await resolveSession(bearer(req));
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in' });
    res.json({ success: true, user: publicUser(user) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    await destroySession(bearer(req));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
    }

    const users = await getCollection<UserDoc>('users');
    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, error: 'An account with that email already exists. Log in instead.' });
    }

    const userId = 'user_' + crypto.randomBytes(8).toString('hex');
    const code = makeVerifyCode();
    const now = new Date();
    const doc: UserDoc = {
      userId,
      email,
      emailVerified: false,
      emailVerifyCodeHash: hashToken(code),
      emailVerifyExpires: new Date(Date.now() + 30 * 60 * 1000),
      passwordHash: hashPassword(password),
      authProvider: 'email',
      nickname: 'Slicer',
      avatar: '',
      profileComplete: false,
      createdAt: now,
      updatedAt: now,
    };
    await users.insertOne(doc);
    const delivery = await deliverVerifyCode(email, code);
    const token = await createSession(userId);

    res.json({
      success: true,
      token,
      user: publicUser(doc),
      needsEmailConfirm: true,
      needsProfileSetup: true,
      ...delivery,
    });
  } catch (err: any) {
    console.error('register error', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || '');
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }

    const users = await getCollection<UserDoc>('users');
    const user = await users.findOne({ email });
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ success: false, error: 'Wrong email or password.' });
    }

    const token = await createSession(user.userId);
    res.json({
      success: true,
      token,
      user: publicUser(user),
      needsEmailConfirm: !user.emailVerified,
      needsProfileSetup: !user.profileComplete,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const user = await resolveSession(bearer(req));
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in' });

    const code = String(req.body?.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: 'Enter the 6-digit code from your email.' });
    }
    if (!user.emailVerifyCodeHash || !user.emailVerifyExpires) {
      return res.status(400).json({ success: false, error: 'No verification pending. Request a new code.' });
    }
    if (user.emailVerifyExpires.getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'Code expired. Request a new one.' });
    }
    if (hashToken(code) !== user.emailVerifyCodeHash) {
      return res.status(400).json({ success: false, error: 'Incorrect code.' });
    }

    const users = await getCollection<UserDoc>('users');
    await users.updateOne(
      { userId: user.userId },
      {
        $set: { emailVerified: true, updatedAt: new Date() },
        $unset: { emailVerifyCodeHash: '', emailVerifyExpires: '' },
      }
    );
    const updated = await users.findOne({ userId: user.userId });
    res.json({
      success: true,
      user: updated ? publicUser(updated) : null,
      needsProfileSetup: updated ? !updated.profileComplete : true,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/resend-verify', async (req: Request, res: Response) => {
  try {
    const user = await resolveSession(bearer(req));
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in' });
    if (user.emailVerified) return res.json({ success: true, alreadyVerified: true });

    let email = user.email;
    const bodyEmail = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    if (bodyEmail) {
      if (!isValidEmail(bodyEmail)) {
        return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
      }
      const users = await getCollection<UserDoc>('users');
      const taken = await users.findOne({ email: bodyEmail, userId: { $ne: user.userId } });
      if (taken) return res.status(409).json({ success: false, error: 'That email is already used.' });
      email = bodyEmail;
    }
    if (!email) return res.status(400).json({ success: false, error: 'Email is required.' });

    const code = makeVerifyCode();
    const users = await getCollection<UserDoc>('users');
    await users.updateOne(
      { userId: user.userId },
      {
        $set: {
          email,
          emailVerified: false,
          emailVerifyCodeHash: hashToken(code),
          emailVerifyExpires: new Date(Date.now() + 30 * 60 * 1000),
          updatedAt: new Date(),
        },
      }
    );
    const delivery = await deliverVerifyCode(email, code);
    res.json({ success: true, email, ...delivery });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Steam users set/confirm email after OpenID login. */
authRouter.post('/set-email', async (req: Request, res: Response) => {
  try {
    const user = await resolveSession(bearer(req));
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in' });

    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address.' });
    }

    const users = await getCollection<UserDoc>('users');
    const taken = await users.findOne({ email, userId: { $ne: user.userId } });
    if (taken) return res.status(409).json({ success: false, error: 'That email is already used.' });

    const code = makeVerifyCode();
    await users.updateOne(
      { userId: user.userId },
      {
        $set: {
          email,
          emailVerified: false,
          emailVerifyCodeHash: hashToken(code),
          emailVerifyExpires: new Date(Date.now() + 30 * 60 * 1000),
          updatedAt: new Date(),
        },
      }
    );
    const delivery = await deliverVerifyCode(email, code);
    res.json({ success: true, email, ...delivery });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

authRouter.post('/complete-profile', async (req: Request, res: Response) => {
  try {
    const user = await resolveSession(bearer(req));
    if (!user) return res.status(401).json({ success: false, error: 'Not signed in' });
    if (!user.emailVerified) {
      return res.status(403).json({ success: false, error: 'Confirm your email first.' });
    }

    const check = validateUsername(String(req.body?.username || ''));
    if (!check.ok) return res.status(400).json({ success: false, error: check.error });

    const avatar = String(req.body?.avatar || '').trim();
    if (!avatar || avatar.length < 32) {
      return res.status(400).json({ success: false, error: 'Upload an avatar image.' });
    }
    if (avatar.length > 900_000) {
      return res.status(400).json({ success: false, error: 'Avatar is too large. Use a smaller image.' });
    }

    const users = await getCollection<UserDoc>('users');
    const taken = await users.findOne({
      username: { $regex: new RegExp(`^${check.username}$`, 'i') },
      userId: { $ne: user.userId },
    });
    if (taken) return res.status(409).json({ success: false, error: 'That username is already taken.' });

    // Steam identity always wins if linked
    const nickname = user.steamId ? user.steamPersona || check.username : check.username;
    const finalAvatar = user.steamId ? user.steamAvatar || avatar : avatar;
    const username = user.steamId ? sanitizeSteamUsername(user.steamPersona || check.username) : check.username;

    await users.updateOne(
      { userId: user.userId },
      {
        $set: {
          username,
          nickname,
          avatar: finalAvatar,
          profileComplete: true,
          updatedAt: new Date(),
        },
      }
    );
    const updated = await users.findOne({ userId: user.userId });
    res.json({ success: true, user: updated ? publicUser(updated) : null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export { unlockSteamAchievement, bearer };
