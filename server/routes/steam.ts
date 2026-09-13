import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { getCollection, type UserDoc } from '../db';
import { fetchSteamPlayerSummary } from '../steam';
import { createSession, resolveSession } from '../auth';
import { sanitizeSteamUsername } from '../username';
import { unlockSteamAchievement, bearer } from './auth';

export const steamRouter = Router();

function frontendOrigin(): string {
  return (process.env.APP_URL || process.env.PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function apiCallbackOrigin(req: Request): string {
  // Prefer public site URL so Steam return_to matches fruit-td.vercel.app
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.API_URL) return process.env.API_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  if (host && !host.includes('localhost:3001') && !host.startsWith('127.0.0.1:3001')) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    return `${proto}://${host}`;
  }
  const port = process.env.PORT || '3001';
  return `http://localhost:${port}`;
}

/** GET /api/steam/login?mode=login|register|link&token=optional */
steamRouter.get('/login', async (req: Request, res: Response) => {
  try {
    const mode = String(req.query.mode || 'login');
    const existingToken = typeof req.query.token === 'string' ? req.query.token : '';
    const returnBase = apiCallbackOrigin(req);
    const returnTo = `${returnBase}/api/steam/callback?mode=${encodeURIComponent(mode)}${
      existingToken ? `&linkToken=${encodeURIComponent(existingToken)}` : ''
    }`;
    const realm = frontendOrigin();

    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo,
      'openid.realm': realm,
      'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
      'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select',
    });

    res.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function verifySteamOpenId(query: Record<string, unknown>): Promise<string | null> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (typeof v === 'string') params.set(k, v);
  }
  params.set('openid.mode', 'check_authentication');

  const verifyRes = await fetch('https://steamcommunity.com/openid/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const text = await verifyRes.text();
  if (!text.includes('is_valid:true')) return null;

  const claimed = String(query['openid.claimed_id'] || '');
  const match = claimed.match(/\/openid\/id\/(\d{17})$/);
  return match?.[1] || null;
}

/** GET /api/steam/callback — Steam OpenID return */
steamRouter.get('/callback', async (req: Request, res: Response) => {
  const front = frontendOrigin();
  const fail = (msg: string) => res.redirect(`${front}/?auth_error=${encodeURIComponent(msg)}`);

  try {
    const steamId = await verifySteamOpenId(req.query as Record<string, unknown>);
    if (!steamId) return fail('Steam login could not be verified.');

    const summary = await fetchSteamPlayerSummary(steamId);
    if (!summary) return fail('Could not load your Steam profile.');

    const users = await getCollection<UserDoc>('users');
    const mode = String(req.query.mode || 'login');
    const linkToken = typeof req.query.linkToken === 'string' ? req.query.linkToken : '';

    let user: UserDoc | null = null;
    let bonus = false;

    if (linkToken) {
      const sessionUser = await resolveSession(linkToken);
      if (sessionUser) {
        const other = await users.findOne({ steamId, userId: { $ne: sessionUser.userId } });
        if (other) return fail('That Steam account is already linked to another player.');

        const username = sanitizeSteamUsername(summary.personaName);
        await users.updateOne(
          { userId: sessionUser.userId },
          {
            $set: {
              steamId: summary.steamId,
              steamPersona: summary.personaName,
              steamAvatar: summary.avatarFull,
              nickname: summary.personaName,
              username,
              avatar: summary.avatarFull,
              profileComplete: true,
              authProvider: sessionUser.passwordHash ? 'steam+email' : 'steam',
              updatedAt: new Date(),
              ...(sessionUser.steamBonusGranted
                ? {}
                : { steamBonusGranted: true }),
            },
          }
        );
        if (!sessionUser.steamBonusGranted) bonus = true;
        await unlockSteamAchievement(sessionUser.userId);
        user = await users.findOne({ userId: sessionUser.userId });
      }
    }

    if (!user) {
      user = await users.findOne({ steamId });
    }

    if (!user) {
      const userId = 'user_' + crypto.randomBytes(8).toString('hex');
      const username = sanitizeSteamUsername(summary.personaName);
      const now = new Date();
      const doc: UserDoc = {
        userId,
        steamId: summary.steamId,
        steamPersona: summary.personaName,
        steamAvatar: summary.avatarFull,
        nickname: summary.personaName,
        username,
        avatar: summary.avatarFull,
        authProvider: 'steam',
        emailVerified: false,
        profileComplete: true,
        steamBonusGranted: true,
        createdAt: now,
        updatedAt: now,
      };
      await users.insertOne(doc);
      await unlockSteamAchievement(userId);
      user = doc;
      bonus = true;
    } else {
      // Returning Steam login: always refresh persona + avatar (replaces custom)
      const username = sanitizeSteamUsername(summary.personaName);
      await users.updateOne(
        { userId: user.userId },
        {
          $set: {
            steamId: summary.steamId,
            steamPersona: summary.personaName,
            steamAvatar: summary.avatarFull,
            nickname: summary.personaName,
            username,
            avatar: summary.avatarFull,
            profileComplete: true,
            updatedAt: new Date(),
          },
        }
      );
      user = (await users.findOne({ userId: user.userId }))!;
    }

    const token = await createSession(user.userId);
    const needsEmail = !user.emailVerified;
    const qs = new URLSearchParams({
      auth_token: token,
      steam: '1',
      needs_email: needsEmail ? '1' : '0',
      bonus: bonus ? '1' : '0',
      mode,
    });
    res.redirect(`${front}/?${qs.toString()}`);
  } catch (err: any) {
    console.error('Steam callback error', err);
    return fail(err.message || 'Steam login failed.');
  }
});

// Legacy manual link kept for tools / older clients
steamRouter.post('/link', async (req: Request, res: Response) => {
  try {
    const user = await resolveSession(bearer(req));
    if (!user) return res.status(401).json({ success: false, error: 'Sign in first to link Steam.' });

    return res.status(400).json({
      success: false,
      error: 'Use Sign in through Steam. Manual Steam ID entry is disabled.',
      useOpenId: true,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

steamRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const user = await resolveSession(bearer(req));
    if (!user || !user.steamId) {
      return res.json({ success: true, linked: false });
    }
    res.json({
      success: true,
      linked: true,
      steamId: user.steamId,
      personaName: user.steamPersona,
      avatar: user.steamAvatar,
      emailVerified: !!user.emailVerified,
      email: user.email || null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
