// Bundled Fruit TD API for Vercel


// server/routes/coop.ts
import { Router } from "express";
import { randomUUID as randomUUID2 } from "node:crypto";
import { Rest } from "ably";

// server/db.ts
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
dotenv.config({ quiet: true });
var uri = process.env.MONGODB_URI;
if (!uri) {
  console.warn("MONGODB_URI is missing; cloud account and progression requests will fail until it is configured.");
}
var client = null;
var db = null;
async function getDb() {
  if (db) return db;
  if (!uri) throw new Error("MongoDB URI not defined");
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    console.log("\u2705 Connected to MongoDB Atlas (FruitTD)");
  }
  db = client.db("FruitTD");
  try {
    await db.collection("leaderboards").createIndex({ mode: 1, score: -1 });
    await db.collection("leaderboards").createIndex({ userId: 1, mode: 1 });
    await db.collection("users").createIndex({ userId: 1 }, { unique: true });
    await db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection("users").createIndex({ username: 1 }, { unique: true, sparse: true });
    await db.collection("users").createIndex({ steamId: 1 }, { unique: true, sparse: true });
    await db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true });
    await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection("achievements").createIndex({ userId: 1, achievementId: 1 }, { unique: true });
    await db.collection("missions").createIndex({ userId: 1, missionId: 1, dayKey: 1 }, { unique: true });
    await db.collection("daily_bonus").createIndex({ userId: 1 }, { unique: true });
    await db.collection("cloud_saves").createIndex({ userId: 1 }, { unique: true });
    await db.collection("run_tokens").createIndex({ tokenHash: 1 }, { unique: true });
    await db.collection("run_tokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection("admin_config").createIndex({ configKey: 1 }, { unique: true });
    await db.collection("battle_maps").createIndex({ id: 1 }, { unique: true });
    await db.collection("battle_maps").createIndex({ mode: 1, published: 1 });
    await db.collection("coop_matches").createIndex({ activePlayers: 1 }, { unique: true, sparse: true });
    await db.collection("coop_matches").createIndex({ id: 1 }, { unique: true });
    await db.collection("badges").createIndex({ userId: 1, badgeId: 1 }, { unique: true });
    await db.collection("friends").createIndex({ userId: 1, friendId: 1 }, { unique: true });
    await db.collection("friends").createIndex({ userId: 1, state: 1, updatedAt: -1 });
    await db.collection("friends").createIndex({ friendId: 1, state: 1, updatedAt: -1 });
    await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });
    await db.collection("notifications").createIndex({ notificationId: 1 }, { unique: true });
    await db.collection("notifications").createIndex({ userId: 1, eventKey: 1 }, { unique: true, partialFilterExpression: { eventKey: { $exists: true } } });
    await db.collection("messages").createIndex({ conversationId: 1, createdAt: 1 });
    await db.collection("messages").createIndex({ messageId: 1 }, { unique: true });
    await db.collection("forum_posts").createIndex({ postId: 1 }, { unique: true });
    await db.collection("forum_posts").createIndex({ createdAt: -1 });
    await db.collection("coop_lobbies").createIndex({ lobbyId: 1 }, { unique: true });
    await db.collection("coop_lobbies").createIndex({ code: 1 }, { unique: true });
    await db.collection("coop_lobbies").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection("coop_lobbies").createIndex({ visibility: 1, status: 1, createdAt: 1 });
    await db.collection("coop_lobbies").createIndex({ "members.userId": 1, status: 1 });
    await db.collection("pvp_arena_records").createIndex({ userId: 1 }, { unique: true });
    await db.collection("pvp_ratings").createIndex({ userId: 1 }, { unique: true });
    await db.collection("pvp_matches").createIndex({ id: 1 }, { unique: true });
    await db.collection("pvp_matches").createIndex({ activePlayers: 1 }, { unique: true, sparse: true });
    await db.collection("pvp_matches").createIndex({ status: 1, updatedAt: 1 });
    await db.collection("pvp_queue").createIndex({ userId: 1 }, { unique: true });
    await db.collection("pvp_queue").createIndex({ queue: 1, expiresAt: 1 });
    await db.collection("pvp_challenges").createIndex({ challengeId: 1 }, { unique: true });
    await db.collection("pvp_challenges").createIndex({ toId: 1, expiresAt: 1 });
  } catch (err) {
    console.warn("Index creation notice:", err);
  }
  return db;
}
async function getCollection(name) {
  const database = await getDb();
  return database.collection(name);
}

// server/auth.ts
import crypto from "crypto";

// server/emailTemplates.ts
function verifyEmailHtml(code) {
  const digits = code.split("").map(
    (d) => `<td style="width:42px;height:52px;text-align:center;font-size:26px;font-weight:800;color:#ecfccb;background:#122018;border:1px solid rgba(163,230,53,.35);border-radius:10px;letter-spacing:0">${d}</td>`
  );
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#050a0f;font-family:'Segoe UI',system-ui,-apple-system,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050a0f;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:linear-gradient(180deg,#12261a 0%,#0a1210 40%,#080e14 100%);border:1px solid rgba(163,230,53,.22);border-radius:20px;overflow:hidden">
        <tr>
          <td style="padding:28px 28px 8px;text-align:center">
            <div style="display:inline-block;width:56px;height:56px;border-radius:16px;background:radial-gradient(circle at 35% 30%,#3dff7a,#146628);border:2px solid #a3e635;line-height:56px;font-size:28px">\u{1F349}</div>
            <p style="margin:14px 0 0;color:#a3e635;font-weight:800;letter-spacing:.28em;text-transform:uppercase;font-size:11px">Fruit TD</p>
            <h1 style="margin:8px 0 0;color:#f1f5f9;font-size:24px;font-weight:900;line-height:1.2">Confirm your email</h1>
            <p style="margin:10px 0 0;color:#94a3b8;font-size:14px;line-height:1.5;font-weight:600">
              Enter this code in the game to finish signing in. It expires in <strong style="color:#cbd5e1">30 minutes</strong>.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 28px 8px" align="center">
            <table role="presentation" cellpadding="0" cellspacing="8" style="margin:0 auto">
              <tr>${digits.join("")}</tr>
            </table>
            <p style="margin:18px 0 0;color:#64748b;font-size:12px;letter-spacing:.2em;font-weight:700">${code}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px 28px;text-align:center">
            <p style="margin:0;padding:12px 14px;background:rgba(163,230,53,.08);border:1px solid rgba(163,230,53,.2);border-radius:12px;color:#a3e635;font-size:12px;font-weight:700;line-height:1.45">
              Slice. Hold the Wall. \u2014 See you in the slicer dashboard.
            </p>
            <p style="margin:16px 0 0;color:#475569;font-size:11px;line-height:1.4">
              If you did not create a Fruit TD account, you can ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
function verifyEmailText(code) {
  return `Fruit TD \u2014 confirm your email

Your code is ${code}.
It expires in 30 minutes.

If you did not create an account, ignore this email.`;
}

// server/auth.ts
var SESSION_DAYS = 30;
function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(next, "hex"));
  } catch {
    return false;
  }
}
function makeVerifyCode() {
  return String(crypto.randomInt(1e5, 999999));
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function makeSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}
function requestSessionToken(req2) {
  const authorization = req2.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  const cookie = req2.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("fruit_td_session="));
  return cookie ? decodeURIComponent(cookie.slice("fruit_td_session=".length)) : null;
}
async function createSession(userId) {
  const token = makeSessionToken();
  const col = await getCollection("sessions");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1e3);
  await col.insertOne({
    tokenHash: hashToken(token),
    userId,
    createdAt: /* @__PURE__ */ new Date(),
    expiresAt
  });
  return token;
}
async function resolveSession(token) {
  if (!token) return null;
  const col = await getCollection("sessions");
  const doc = await col.findOne({ tokenHash: hashToken(token) });
  if (!doc || doc.expiresAt.getTime() < Date.now()) return null;
  const users = await getCollection("users");
  return users.findOne({ userId: doc.userId });
}
async function resolveRequestUser(req2) {
  return resolveSession(requestSessionToken(req2));
}
async function destroySession(token) {
  if (!token) return;
  const col = await getCollection("sessions");
  await col.deleteOne({ tokenHash: hashToken(token) });
}
function publicUser(user) {
  return {
    userId: user.userId,
    nickname: user.nickname,
    username: user.username || user.nickname,
    avatar: user.avatar,
    email: user.email || null,
    emailVerified: !!user.emailVerified,
    profileComplete: !!user.profileComplete,
    authProvider: user.authProvider || (user.steamId ? "steam" : "email"),
    steamId: user.steamId || null,
    steamPersona: user.steamPersona || null,
    steamAvatar: user.steamAvatar || null,
    isAdmin: Boolean(process.env.ADMIN_STEAM_ID && user.steamId === process.env.ADMIN_STEAM_ID)
  };
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
async function deliverVerifyCode(email, code) {
  const exposePreview = process.env.NODE_ENV !== "production";
  const fallback = (error2) => exposePreview ? { previewCode: code, emailed: false, ...error2 ? { error: error2 } : {} } : { emailed: false, error: error2 || "Email delivery is unavailable." };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return exposePreview ? { previewCode: code, emailed: false } : fallback("Email delivery is not configured.");
  }
  const from = process.env.EMAIL_FROM || "Fruit TD <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Fruit TD \u2014 your confirmation code",
        html: verifyEmailHtml(code),
        text: verifyEmailText(code)
      })
    });
    if (!res.ok) {
      const body = await res.text();
      if (exposePreview) console.error("[auth] Resend failed:", res.status, body);
      else console.error("[auth] Resend failed with status:", res.status);
      return fallback(exposePreview ? "Email send failed" : "Email delivery failed.");
    }
    return { emailed: true };
  } catch (err) {
    if (exposePreview) console.error("[auth] Resend error:", err);
    else console.error("[auth] Resend request failed.");
    return fallback(exposePreview ? "Email send failed" : "Email delivery failed.");
  }
}

// src/game/progression/heroEconomy.ts
var HERO_PRICES = {
  tripos: { cost: 1800 },
  ki: { cost: 3e3 }
};
function heroPrice(id) {
  return HERO_PRICES[id]?.cost ?? null;
}

// src/game/progression/heroMilestones.ts
var HERO_MILESTONES = [
  { level: 5, kind: "cosmetic", name: "First Edge", reward: "Blade effect slot" },
  { level: 10, kind: "perk", name: "Combo Engine", reward: "Hero perk I + Topfu unlock", unlocksHero: "topfu", bonusPerkPoints: 1 },
  { level: 20, kind: "cosmetic", name: "Bladebearer", reward: "Hero cosmetic slot" },
  { level: 25, kind: "unlock", name: "Long Reach", reward: "Lagen unlock", unlocksHero: "lagen" },
  { level: 30, kind: "perk", name: "Tower Guardian", reward: "Hero perk II", bonusPerkPoints: 1 },
  { level: 40, kind: "cosmetic", name: "Orchard Veteran", reward: "Hero cosmetic slot" },
  { level: 50, kind: "perk", name: "Perfect Cut", reward: "Hero perk III", bonusPerkPoints: 1 },
  { level: 60, kind: "cosmetic", name: "Grove Warden", reward: "Hero cosmetic slot" },
  { level: 75, kind: "perk", name: "Last Stand", reward: "Major hero perk IV", bonusPerkPoints: 2 },
  { level: 90, kind: "cosmetic", name: "Mastery Aura", reward: "Mastery cosmetic" },
  { level: 100, kind: "mastery", name: "Max Mastery", reward: "MAX MASTERY \u2014 permanent Hero 100 title", bonusPerkPoints: 3 }
];
function heroMilestonesUnlocked(level) {
  const lv = Math.max(1, Math.floor(level));
  return HERO_MILESTONES.filter((m) => m.level <= lv);
}
function heroesUnlockedByJijuLevel(level) {
  return heroMilestonesUnlocked(level).map((m) => m.unlocksHero).filter((id) => !!id);
}

// src/game/heroes.ts
var HEROES = [
  { id: "jiju", name: "Master Jiju", title: "Clean blade", color: 3108845, trail: 1920728, blurb: "Classic wide cuts. Combos stack if you keep slicing.", mouse: "Precise flicks. Combo builds fast.", touch: "Wider finger slash. Easier to clip packs.", damage: 18, radius: 0.16, shake: 0.55, unlockLevel: 1 },
  { id: "topfu", name: "Topfu", title: "Soft pressure", color: 16040810, trail: 15251530, blurb: "Shorter reach, but fruit go brittle and slow.", mouse: "Short snap cuts. Stacks brittle.", touch: "Fat squash pad. Bigger slow zone.", damage: 13, radius: 0.1, shake: 0.35, unlockLevel: 10 },
  { id: "lagen", name: "Lagen", title: "Long reach", color: 3842906, trail: 2278750, blurb: "Lance slash. The swipe keeps going past your cursor.", mouse: "Fast flick = extra spear length.", touch: "Stable long line, a bit less extra reach.", damage: 16, radius: 0.12, shake: 0.45, unlockLevel: 25 },
  { id: "tripos", name: "Tripos", title: "Triple path", color: 12860298, trail: 15235520, blurb: "One swipe becomes three parallel cuts.", mouse: "Tight triple lines.", touch: "Wider triple spread.", damage: 11, radius: 0.1, shake: 0.4, unlockLevel: 50, purchaseOnly: true, purchaseCost: heroPrice("tripos") ?? 1800 },
  { id: "ki", name: "Master Ki", title: "Charged spirit", color: 8141549, trail: 10980346, blurb: "Hold to charge. Tap empty grass for a Ki pulse.", mouse: "Hold, then flick for a heavy cut.", touch: "Tap to pulse. Swipe to slash.", damage: 15, radius: 0.14, shake: 0.7, unlockLevel: 75, purchaseOnly: true, purchaseCost: heroPrice("ki") ?? 3e3 }
];
var MAX_HERO_LEVEL = 100;
function heroDef(id) {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}
function heroXpForLevel(level) {
  const lv = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.floor(level)));
  return lv === 1 ? 0 : Math.floor(35 * Math.pow(lv - 1, 1.58) + 20 * (lv - 1));
}
function heroXpToLevel(xp) {
  const safe = Math.max(0, Math.floor(xp));
  let low = 1;
  let high = MAX_HERO_LEVEL;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (heroXpForLevel(mid) <= safe) low = mid;
    else high = mid - 1;
  }
  return low;
}

// src/game/skills.ts
var SKILLS = [
  { id: "edge", name: "Edge", blurb: "Your slash hits harder.", max: 3 },
  { id: "reach", name: "Reach", blurb: "Wider cut. Easier multi-hits.", max: 3 },
  { id: "flow", name: "Flow", blurb: "Super juice fills faster.", max: 3 },
  { id: "steel", name: "Steel", blurb: "Turrets deal more damage.", max: 3 },
  { id: "storm", name: "Storm", blurb: "Super blow wrecks a bigger pack.", max: 3 }
];
function emptySkills() {
  return { edge: 0, reach: 0, flow: 0, steel: 0, storm: 0 };
}

// src/game/world.ts
var ARENA_W = 22;
var ARENA_D = 132;
var SIM_DT = 1 / 60;
var IMPACT_FREEZE = 1 / 60;
var WALL_Z = -9.2;
var EXTRA_Z = -7.85;
var LEAK_Z = -7.5;
function buildPads() {
  return [
    { x: -6.2, z: WALL_Z, main: false, floor: false },
    { x: -3.8, z: WALL_Z, main: false, floor: false },
    { x: 0, z: WALL_Z, main: true, floor: false },
    { x: 3.8, z: WALL_Z, main: false, floor: false },
    { x: 6.2, z: WALL_Z, main: false, floor: false },
    { x: -4.8, z: EXTRA_Z, main: false, floor: true },
    { x: -2.2, z: EXTRA_Z, main: false, floor: true },
    { x: 2.2, z: EXTRA_Z, main: false, floor: true },
    { x: 4.8, z: EXTRA_Z, main: false, floor: true }
  ];
}
var PADS = buildPads();
var MAIN_INDEX = PADS.findIndex((p) => p.main);

// src/game/heroAbilities.ts
var names = {
  jiju: [["Blue Arc", "Shock the whole field for heavy damage.", "\u26A1", "shock"], ["Clean Sweep", "A balanced burst around the lead fruit.", "\u2726", "burst"], ["Quick Draw", "Pierce the nearest fruit.", "\u27A4", "pierce"], ["Still Frame", "Freeze the field, then strike.", "\u2744", "frost"], ["Orchard Guard", "A steady burst that protects the wall.", "\u2B21", "guard"], ["Grand Finale", "A full-field finishing strike.", "\u2739", "shock"]],
  topfu: [["Cold Press", "Slow and crack every fruit.", "\u2744", "frost"], ["Soft Crush", "Burst damage around the front fruit.", "\u25CF", "burst"], ["Brittle Wave", "A freezing full-field wave.", "\u2727", "frost"], ["Heavy Drop", "High damage to the front pack.", "\u2B07", "pierce"], ["Chill Guard", "Slow the full field and steady the wall.", "\u2B21", "guard"], ["Deep Freeze", "Topfu\u2019s strongest field freeze.", "\u2739", "frost"]],
  lagen: [["Long Lance", "Pierce a line through the field.", "\u27A4", "pierce"], ["Far Reach", "Strike fruit across the whole field.", "\u2301", "shock"], ["Spearhead", "High damage to the lead fruit.", "\u2197", "pierce"], ["Raking Line", "A broad slash through the front pack.", "\u2571", "burst"], ["Vine Snare", "Slow every fruit in its path.", "\u2667", "frost"], ["Horizon Break", "A full field lance strike.", "\u2739", "shock"]],
  tripos: [["Triple Cut", "Three fast cuts across the field.", "\u224B", "burst"], ["Rose Burst", "A powerful clustered blast.", "\u273F", "burst"], ["Crosswind", "Strike the field from both sides.", "\u2723", "shock"], ["Pink Haze", "Slow and damage every fruit.", "\u274B", "frost"], ["Encore", "Repeat damage on the strongest fruit.", "\u266B", "pierce"], ["Grand Waltz", "Tripos\u2019 full field finale.", "\u2739", "shock"]],
  ki: [["Golden Pulse", "A fast full-field pulse.", "\u263C", "shock"], ["Lucky Drop", "A heavy burst near the lead fruit.", "\u2726", "burst"], ["Sunbeam", "Pierce through the leading line.", "\u2600", "pierce"], ["Golden Guard", "Slow fruit and protect the wall.", "\u2B21", "guard"], ["Solar Bloom", "Blast the front pack with solar energy.", "\u273A", "burst"], ["Daybreak", "Ki\u2019s strongest full-field strike.", "\u2739", "shock"]]
};
var HERO_ABILITIES = Object.keys(names).flatMap((hero) => names[hero].map(([name, description, icon, effect], i) => ({ id: hero + "-" + (i + 1), hero, name, description, icon, unlockLevel: [1, 5, 10, 15, 20, 25][i], cooldownMs: [9e3, 13e3, 16e3, 19e3, 23e3, 28e3][i], juiceCost: [0, 15, 20, 25, 30, 40][i], damage: [18, 24, 30, 36, 44, 60][i], effect, iconUrl: `/assets/icons/sigil-${String(["jiju", "topfu", "lagen", "tripos", "ki"].indexOf(hero) * 6 + i + 1).padStart(2, "0")}.svg` })));
var MAX_HERO_ABILITY_RANK = 5;
function heroAbility(id) {
  return HERO_ABILITIES.find((a) => a.id === id);
}
function emptyHeroAbilityRanks() {
  return Object.fromEntries(HERO_ABILITIES.map((a) => [a.id, 0]));
}
function emptyHeroAbilityLoadouts() {
  return { jiju: ["jiju-1"], topfu: [], lagen: [], tripos: [], ki: [] };
}

// src/game/progression/rewards.ts
var EMPTY_REWARD = Object.freeze({
  score: 0,
  coins: 0,
  heroXp: 0,
  towerXp: 0,
  gems: 0,
  reason: "fruit_sliced"
});

// src/game/progression/index.ts
var MAX_HERO_XP = heroXpForLevel(MAX_HERO_LEVEL);
function heroMilestoneUnlockLevel(heroId) {
  return HERO_MILESTONES.find((m) => m.unlocksHero === heroId)?.level ?? null;
}

// src/game/progression/heroStatus.ts
function getHeroStatus(save, heroId) {
  const def = heroDef(heroId);
  const xp = Math.max(0, Number(save.xp[heroId]) || 0);
  const level = heroXpToLevel(xp);
  const owned = save.ownedHeroes.includes(heroId);
  const cost = def.purchaseOnly ? def.purchaseCost ?? null : null;
  const unlockLevel = def.purchaseOnly ? null : heroMilestoneUnlockLevel(heroId) ?? def.unlockLevel;
  const coins = Math.max(0, Number(save.coins) || 0);
  let availability;
  let requirement;
  if (owned) {
    availability = "owned";
    requirement = heroId === "jiju" ? "Starter hero" : "Owned";
  } else if (def.purchaseOnly) {
    availability = "purchasable";
    requirement = `${(cost ?? 0).toLocaleString()} Coins`;
  } else {
    availability = "locked";
    requirement = `Reach Master Jiju Lv ${unlockLevel ?? def.unlockLevel}`;
  }
  return {
    heroId,
    availability,
    owned,
    unlockLevel,
    purchaseCost: cost,
    requirement,
    level,
    xp,
    canAfford: cost !== null && coins >= cost,
    equippable: owned
  };
}
function canEquipHero(save, heroId) {
  return getHeroStatus(save, heroId).equippable;
}
function purchaseHeroAtomic(save, heroId) {
  const def = HEROES.find((h) => h.id === heroId);
  if (!def) return { ok: false, error: "invalid-hero", message: "Unknown hero" };
  if (!def.purchaseOnly || !def.purchaseCost) {
    return { ok: false, error: "not-purchasable", message: `${def.name} is not a purchasable hero` };
  }
  if (save.ownedHeroes.includes(heroId)) {
    return { ok: false, error: "already-owned", message: `${def.name} is already owned` };
  }
  const cost = def.purchaseCost;
  const coins = Math.max(0, Number(save.coins) || 0);
  if (coins < cost) {
    return {
      ok: false,
      error: "insufficient-coins",
      message: `Need ${(cost - coins).toLocaleString()} more coins`
    };
  }
  save.coins = coins - cost;
  save.ownedHeroes = [.../* @__PURE__ */ new Set([...save.ownedHeroes, heroId])];
  return { ok: true, coinsSpent: cost, coinsRemaining: save.coins };
}

// src/game/campaign.ts
function campaignWaves(level) {
  const n = Math.max(1, Math.min(100, Math.floor(level)));
  return Math.ceil(n / 10) * 5;
}

// src/game/save.ts
function emptyXp() {
  return { jiju: 0, topfu: 0, lagen: 0, tripos: 0, ki: 0 };
}
function emptyPerkRanks() {
  return { jiju: {}, topfu: {}, lagen: {}, tripos: {}, ki: {} };
}
function defaultAvatar(name) {
  const letter = (name[0] || "S").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1d4ed8"/><text x="32" y="42" text-anchor="middle" font-size="28" font-family="Arial" fill="white" font-weight="700">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function defaultSave() {
  return {
    hero: "jiju",
    xp: emptyXp(),
    ownedHeroes: ["jiju"],
    towerXp: 0,
    towerLifetimeXp: 0,
    highScore: 0,
    rankedScore: 0,
    bestWave: 1,
    bestCombo: 0,
    games: 0,
    coins: 0,
    gems: 0,
    nickname: "Slicer",
    avatar: defaultAvatar("Slicer"),
    skillPoints: 0,
    skills: emptySkills(),
    ownedSkins: ["blade-default", "wall-brick"],
    bladeSkin: "blade-default",
    wallSkin: "wall-brick",
    mode: "casual",
    heroPerkRanks: emptyPerkRanks(),
    heroAbilityRanks: emptyHeroAbilityRanks(),
    heroAbilityLoadouts: emptyHeroAbilityLoadouts(),
    vipStatus: "none",
    saveRevision: 0,
    savedAt: 0,
    campaignProgress: { unlocked: 1, cleared: [] }
  };
}
var WALL_SKINS = [
  { id: "wall-brick", name: "Ashbrick Bastion", kind: "wall", cost: 0, sellValue: 0, color: 16777215, texture: "/assets/towers/wall-ashbrick.webp", blurb: "The starter red-brick barricade. Your hero stands on the center keep." },
  { id: "wall-stone", name: "Scrapline Steel", kind: "wall", cost: 200, sellValue: 70, color: 16777215, texture: "/assets/towers/wall-scrapsteel.webp", blurb: "Bolted salvage armor built around the same center keep." },
  { id: "wall-night", name: "Ashglass Concrete", kind: "wall", cost: 280, sellValue: 95, color: 16777215, texture: "/assets/towers/wall-ashglass.webp", blurb: "Cracked concrete, copper braces, and restrained toxic seams." }
];

// server/claimWallet.ts
async function creditClaimReward(userId, receiptKey, reward, saves) {
  const col = saves ?? await getCollection("cloud_saves");
  let existing = await col.findOne({ userId });
  if (!existing) {
    try {
      await col.insertOne({
        userId,
        saveData: defaultSave(),
        revision: 0,
        claimReceipts: [],
        updatedAt: /* @__PURE__ */ new Date()
      });
    } catch (err) {
      if (err?.code !== 11e3) throw err;
    }
    existing = await col.findOne({ userId });
  }
  if (!existing) throw new Error("Could not initialize authoritative wallet");
  const now = /* @__PURE__ */ new Date();
  const set = {
    revision: { $add: [{ $ifNull: ["$revision", 0] }, 1] },
    updatedAt: now,
    claimReceipts: { $setUnion: [{ $ifNull: ["$claimReceipts", []] }, [receiptKey]] }
  };
  const cappedCredit = (field, amount, cap) => ({
    $min: [cap, { $add: [{ $ifNull: [`$saveData.${field}`, 0] }, amount] }]
  });
  set["saveData.coins"] = cappedCredit("coins", reward.coins ?? 0, 1e6);
  set["saveData.gems"] = cappedCredit("gems", reward.gems ?? 0, 1e6);
  set["saveData.skillPoints"] = cappedCredit("skillPoints", reward.skillPoints ?? 0, 1e4);
  for (const [hero, amount] of Object.entries(reward.xp ?? {})) {
    if (HEROES.some((entry) => entry.id === hero) && amount > 0) set[`saveData.xp.${hero}`] = cappedCredit(`xp.${hero}`, amount, 1e6);
  }
  if ((reward.towerXp ?? 0) > 0) {
    set["saveData.towerXp"] = cappedCredit("towerXp", reward.towerXp, 1e9);
    set["saveData.towerLifetimeXp"] = cappedCredit("towerLifetimeXp", reward.towerXp, 1e9);
  }
  if ((reward.games ?? 0) > 0) set["saveData.games"] = cappedCredit("games", reward.games, 1e6);
  if ((reward.highScore ?? 0) > 0) set["saveData.highScore"] = { $max: [{ $ifNull: ["$saveData.highScore", 0] }, reward.highScore] };
  if ((reward.rankedScore ?? 0) > 0) set["saveData.rankedScore"] = { $max: [{ $ifNull: ["$saveData.rankedScore", 0] }, reward.rankedScore] };
  if ((reward.bestWave ?? 0) > 0) set["saveData.bestWave"] = { $max: [{ $ifNull: ["$saveData.bestWave", 1] }, reward.bestWave] };
  if ((reward.bestCombo ?? 0) > 0) set["saveData.bestCombo"] = { $max: [{ $ifNull: ["$saveData.bestCombo", 0] }, reward.bestCombo] };
  if (reward.xp?.jiju !== void 0) {
    const resultingJijuXp = Math.min(1e6, (Number(existing.saveData?.xp?.jiju) || 0) + reward.xp.jiju);
    const unlocked = heroesUnlockedByJijuLevel(heroXpToLevel(resultingJijuXp));
    if (unlocked.length) set["saveData.ownedHeroes"] = { $setUnion: [{ $ifNull: ["$saveData.ownedHeroes", ["jiju"]] }, unlocked] };
  }
  if (reward.items?.length) {
    set["saveData.ownedSkins"] = { $setUnion: [{ $ifNull: ["$saveData.ownedSkins", []] }, reward.items] };
  }
  return col.findOneAndUpdate(
    {
      userId,
      claimReceipts: { $ne: receiptKey }
    },
    [{ $set: set }],
    { returnDocument: "after" }
  );
}

// src/game/powerCombat.ts
function powerStats(ability, rawRank) {
  const rank = Math.max(1, Math.min(MAX_HERO_ABILITY_RANK, Math.floor(rawRank) || 1));
  return {
    rank,
    damage: ability.damage * (1 + (rank - 1) * 0.2),
    cost: ability.juiceCost,
    slowMs: ability.effect === "frost" || ability.effect === "guard" || ability.id === "topfu-6" ? 2e3 + (rank - 1) * 350 : 0,
    slowMultiplier: ability.id === "topfu-6" ? 0.15 : 0.45,
    healFraction: ability.effect === "guard" ? 0.12 + (rank - 1) * 0.02 : 0
  };
}
function equippedPower(id, hero, loadout, ranks) {
  const ability = heroAbility(id);
  const rank = id === "jiju-1" ? Math.max(1, ranks?.[id] ?? 0) : ranks?.[id] ?? 0;
  if (!ability || ability.hero !== hero || !loadout?.includes(id) || !Number.isFinite(rank) || rank < 1) throw new Error("That power is not equipped");
  return { ability, stats: powerStats(ability, rank) };
}
function powerTargets(items, ability, point) {
  const ordered = [...items].sort((a, b) => point(b).y - point(a).y);
  if (ability.effect === "pierce") return ordered.slice(0, Math.max(1, Math.ceil(items.length * 0.4)));
  if (ability.effect === "burst" || ability.effect === "bloom") {
    const lead = ordered[0];
    if (!lead) return [];
    const origin = point(lead);
    return ordered.filter((item) => Math.hypot(point(item).x - origin.x, point(item).y - origin.y) <= 3.2);
  }
  return ordered;
}
function appendPowerCast(casts, cast) {
  return [...(casts ?? []).filter((item) => cast.at - item.at < 5e3), cast].slice(-24);
}

// src/game/onlineCoop.ts
var DEFAULT_COOP_CONFIG = { bossEveryWaves: 6, baseWaveSize: 10, extraPerWave: 2, spawnGapMs: 700, intermissionMs: 2200, bossIntroMs: 5500, coinsPerKill: 1, coinsPerWave: 10, gemsEveryWaves: 5, xpPerKill: 2, towerXpPerWave: 10, rewardCoinCap: 3e3, bladeDamage: 35, bladeRadius: 0.65, bladeCooldownMs: 100, bossHealthMultiplier: 12, bossSpeedMultiplier: 0.35, fruitSpeedMultiplier: 0.65 };
function normalizeCoopConfig(raw) {
  const row = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(Object.entries(DEFAULT_COOP_CONFIG).map(([key, fallback]) => {
    const value = Number(row[key]);
    const fractional = key.endsWith("Multiplier") || key === "bladeRadius";
    const zeroAllowed = ["extraPerWave", "coinsPerKill", "coinsPerWave", "xpPerKill", "towerXpPerWave", "rewardCoinCap"].includes(key);
    const min = fractional ? 0.05 : zeroAllowed ? 0 : key.includes("Ms") ? 100 : 1;
    const max = key.includes("Ms") ? 6e4 : key === "rewardCoinCap" ? 1e4 : key === "bladeDamage" ? 1e3 : key === "bladeRadius" ? 2 : 100;
    return [key, Number.isFinite(value) ? Math.max(min, Math.min(max, fractional ? value : Math.floor(value))) : fallback];
  }));
}
function newCoopMatch(id, player, balance) {
  return { id, revision: 0, status: "waiting", phaseUntil: 0, players: [player], wave: 1, wallHealth: balance.wallHealth, fruts: balance.startingFruts, score: 0, kills: 0, fruits: [], remainingSpawns: 0, spawnAt: 0, serial: 0, towers: [], mainLastFiredAt: 0, completedWaves: 0 };
}
function joinCoopMatch(match, player, now) {
  if (match.status !== "waiting" || match.players.length !== 1 || match.players.some((p) => p.userId === player.userId)) throw new Error("Room is unavailable.");
  match.players.push(player);
  match.status = "countdown";
  match.phaseUntil = now + 3e3;
  match.revision++;
}
var distance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
};
function applyCoopCommand(match, userId, sequence, command, now, balance, config = DEFAULT_COOP_CONFIG) {
  const player = match.players.find((p) => p.userId === userId);
  if (!player) throw new Error("Not a room member.");
  if (!Number.isSafeInteger(sequence) || sequence !== player.sequence + 1) throw new Error("Stale command. Refresh the match.");
  if (command.type === "leave") {
    match.status = "complete";
    match.reason = "left";
  } else {
    if (match.status !== "playing" && match.status !== "boss-intro") throw new Error("Wait for the match to start.");
    if (command.type === "build") {
      const stats = balance.towers[command.tower];
      if (!stats || !Number.isInteger(command.cell) || command.cell < 121 || command.cell > 128 || match.towers.some((t) => t.cell === command.cell)) throw new Error("Choose an empty wall pad.");
      if (match.fruts < stats.cost) throw new Error("Not enough shared Fruts.");
      match.fruts -= stats.cost;
      match.towers.push({ id: `${match.id}:${command.cell}`, type: command.tower, cell: command.cell, lastFiredAt: now });
    } else if (command.type === "ability") {
      const { ability, stats } = equippedPower(command.abilityId, player.hero, player.abilityLoadout, player.abilityRanks);
      if (now < (player.abilityReadyAt?.[ability.id] ?? 0)) throw new Error("That power is cooling down.");
      if (match.fruts < stats.cost) throw new Error("Not enough shared Fruts.");
      const targets = powerTargets(match.fruits.filter((f) => f.hp > 0), ability, (f) => f);
      match.fruts -= stats.cost;
      player.abilityReadyAt ??= {};
      player.abilityReadyAt[ability.id] = now + ability.cooldownMs;
      match.wallHealth = Math.min(balance.wallHealth, match.wallHealth + balance.wallHealth * stats.healFraction);
      match.powerCasts = appendPowerCast(match.powerCasts, { id: `${userId}:${sequence}`, abilityId: ability.id, at: now, rank: stats.rank, targets: targets.map((f) => ({ x: f.x, y: f.y })) });
      for (const fruit of targets) {
        fruit.hp -= stats.damage;
        if (stats.slowMs) {
          fruit.slowUntil = Math.max(fruit.slowUntil ?? 0, now + stats.slowMs);
          fruit.slowMultiplier = stats.slowMultiplier;
        }
      }
      const killed = match.fruits.filter((f) => f.hp <= 0);
      player.kills += killed.length;
      collectKills(match, balance);
    } else if (command.type === "slash") {
      for (const p of [command.from, command.to]) if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 10 || p.y < 0 || p.y > 14) throw new Error("Invalid blade stroke.");
      if (Math.hypot(command.from.x - command.to.x, command.from.y - command.to.y) < 0.15 || now - player.lastSlashAt < config.bladeCooldownMs) throw new Error("Swipe across the fruit.");
      player.lastSlashAt = now;
      player.lastStroke = { from: command.from, to: command.to, at: now };
      for (const fruit of match.fruits) if (distance(fruit, command.from, command.to) <= config.bladeRadius) fruit.hp -= config.bladeDamage;
      const killed = match.fruits.filter((f) => f.hp <= 0);
      player.kills += killed.length;
      collectKills(match, balance);
    } else throw new Error("Unsupported command.");
  }
  player.sequence = sequence;
  player.lastSeenAt = now;
  match.revision++;
}
function collectKills(match, balance) {
  for (const f of match.fruits.filter((f2) => f2.hp <= 0)) {
    match.kills++;
    match.score += f.boss ? 300 : 10;
    match.fruts += balance.attacks[f.type].rewardFruts;
  }
  match.fruits = match.fruits.filter((f) => f.hp > 0);
}
function advanceCoopMatch(match, dt, now, balance, config) {
  if (match.status === "waiting" || match.status === "complete") return;
  if (match.players.some((p) => now - p.lastSeenAt > balance.reconnectGraceSeconds * 1e3)) {
    match.status = "complete";
    match.reason = "disconnect";
    match.revision++;
    return;
  }
  const delta = Math.max(0, Math.min(dt, 0.25));
  match.fruts += balance.incomePerSecond * delta;
  if (match.status === "countdown" || match.status === "boss-intro") {
    if (now < match.phaseUntil) {
      match.revision++;
      return;
    }
    const boss = match.status === "boss-intro";
    match.status = "playing";
    match.remainingSpawns = boss ? 1 : Math.min(100, config.baseWaveSize + (match.wave - 1) * config.extraPerWave);
    match.spawnAt = now;
  }
  if (match.remainingSpawns > 0 && now >= match.spawnAt) {
    const boss = match.wave % (config.bossEveryWaves + 1) === 0;
    const kind = boss ? "armored" : match.serial % 7 === 0 ? "armored" : match.serial % 4 === 0 ? "swift" : "normal";
    const stats = balance.attacks[kind];
    const serial = ++match.serial;
    match.fruits.push({ id: `${match.id}:${serial}`, type: kind, x: boss ? 5 : 1 + serial * 37 % 80 / 10, y: 0, hp: stats.health * (boss ? config.bossHealthMultiplier : 1) * (1 + Math.floor(match.wave / 8) * 0.2), boss });
    match.remainingSpawns--;
    match.spawnAt = now + config.spawnGapMs;
  }
  for (const fruit of match.fruits) fruit.y += balance.attacks[fruit.type].speed * delta * (fruit.boss ? config.bossSpeedMultiplier : config.fruitSpeedMultiplier) * (now < (fruit.slowUntil ?? 0) ? fruit.slowMultiplier ?? 0.45 : 1);
  const fire = (x, y, stats, last) => {
    if (now - last < stats.cooldownMs) return false;
    const fruit = match.fruits.filter((f) => f.hp > 0 && Math.hypot(f.x - x, f.y - y) <= stats.range).sort((a, b) => b.y - a.y)[0];
    if (!fruit) return false;
    fruit.hp -= stats.damage;
    return true;
  };
  for (const tower of match.towers) if (fire(tower.cell % 10 + 0.5, Math.floor(tower.cell / 10) + 0.5, balance.towers[tower.type], tower.lastFiredAt)) tower.lastFiredAt = now;
  if (fire(5, 13.5, balance.mainTower, match.mainLastFiredAt)) match.mainLastFiredAt = now;
  collectKills(match, balance);
  for (const f of match.fruits.filter((f2) => f2.y >= 13.5)) match.wallHealth = Math.max(0, match.wallHealth - balance.attacks[f.type].wallDamage * (f.boss ? 10 : 1));
  match.fruits = match.fruits.filter((f) => f.y < 13.5);
  if (match.wallHealth <= 0) {
    match.status = "complete";
    match.reason = "wall";
  } else if (!match.remainingSpawns && !match.fruits.length) {
    match.completedWaves++;
    match.wave++;
    match.status = match.wave % (config.bossEveryWaves + 1) === 0 ? "boss-intro" : "countdown";
    match.phaseUntil = now + (match.status === "boss-intro" ? config.bossIntroMs : config.intermissionMs);
  }
  match.revision++;
}
function coopRewards(match, config) {
  if (match.completedWaves < 1) return { coins: 0, gems: 0, xp: 0, towerXp: 0 };
  return { coins: Math.min(config.rewardCoinCap, match.kills * config.coinsPerKill + match.completedWaves * config.coinsPerWave), gems: Math.floor(match.completedWaves / config.gemsEveryWaves), xp: Math.min(1e4, match.kills * config.xpPerKill), towerXp: Math.min(1e4, match.completedWaves * config.towerXpPerWave) };
}

// src/game/creatorMedia.ts
var number = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
function normalizeCreatorMedia(raw) {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("Creator pack must contain entities.");
  const row = raw;
  if (!row.entities || typeof row.entities !== "object" || Array.isArray(row.entities)) throw new Error("Creator pack must contain entities.");
  if (Object.keys(row.entities).length > 200 || JSON.stringify(raw).length > 25e5) throw new Error("Creator pack is too large. Use smaller sprite sheets.");
  const entities = /* @__PURE__ */ Object.create(null);
  for (const [key, value] of Object.entries(row.entities)) {
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(key) || !value || typeof value !== "object") throw new Error("Invalid Creator entity.");
    const sheet = value.sheetDataUrl;
    if (sheet && (typeof sheet !== "string" || sheet.length > 1e6 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(sheet))) throw new Error("Sprite sheets must be PNG, JPEG or WebP images under 1 MB.");
    const cols = Math.floor(number(value.cols, 1, 1, 64));
    const rows = Math.floor(number(value.rows, 1, 1, 64));
    const clips = {};
    for (const [clip, definition] of Object.entries(value.clips || {})) {
      if (!/^(idle|walk|run|hit|death)_(down|left|right|up)$/.test(clip) || !definition || typeof definition !== "object") continue;
      const startFrame = Math.floor(number(definition.startFrame, 0, 0, cols * rows - 1));
      clips[clip] = { startFrame, frameCount: Math.floor(number(definition.frameCount, 1, 1, cols * rows - startFrame)), ...definition.fps ? { fps: number(definition.fps, 10, 1, 60) } : {}, ...["none", "juice-burst", "spark", "dark-pulse", "screen-shake"].includes(definition.fx || "") ? { fx: definition.fx } : {} };
    }
    const events = {};
    for (const hook of ["onSpawn", "onHit", "onDeath"]) {
      const event = value.events?.[hook];
      if (!event) continue;
      events[hook] = { flash: Boolean(event.flash), shake: number(event.shake, 0, 0, 3), ...typeof event.sfxSlot === "string" && /^[a-z0-9-]{1,64}$/.test(event.sfxSlot) ? { sfxSlot: event.sfxSlot } : {}, ...["none", "juice-burst", "spark", "dark-pulse", "screen-shake"].includes(event.fx || "") ? { fx: event.fx } : {} };
    }
    entities[key] = { sheetDataUrl: sheet || null, cols, rows, frameW: Math.floor(number(value.frameW, 0, 0, 4096)), frameH: Math.floor(number(value.frameH, 0, 0, 4096)), clips, events, label: String(value.label || key).slice(0, 80) };
  }
  return { version: 2, entities, selectedEntity: typeof row.selectedEntity === "string" && entities[row.selectedEntity] ? row.selectedEntity : Object.keys(entities)[0] || "enemy-normal" };
}

// src/game/rankSeason.ts
var DEFAULT_RANK_TIERS = [
  { id: "bronze", title: "Bronze", minScore: 0, color: "#cd7f32", icon: "Shield", rewardCoins: 100 },
  { id: "silver", title: "Silver", minScore: 1500, color: "#c0c0c0", icon: "Medal", rewardCoins: 250, rewardGems: 5 },
  { id: "gold", title: "Gold", minScore: 4e3, color: "#f5c542", icon: "Trophy", rewardCoins: 500, rewardGems: 10 },
  { id: "platinum", title: "Platinum", minScore: 8e3, color: "#7dd3fc", icon: "BadgeCheck", rewardCoins: 750, rewardGems: 15 },
  { id: "diamond", title: "Diamond", minScore: 15e3, color: "#67e8f9", icon: "Diamond", rewardCoins: 1500, rewardGems: 30 },
  { id: "master", title: "Master", minScore: 25e3, color: "#c084fc", icon: "Crown", rewardCoins: 2500, rewardGems: 60 },
  { id: "grandmaster", title: "Grandmaster", minScore: 4e4, color: "#fb7185", icon: "Flame", rewardCoins: 5e3, rewardGems: 100 }
];
function rankFromScore(score, tiers = DEFAULT_RANK_TIERS) {
  const sorted = [...tiers].sort((a, b) => b.minScore - a.minScore);
  return sorted.find((tier) => score >= tier.minScore) ?? sorted[sorted.length - 1] ?? DEFAULT_RANK_TIERS[0];
}

// src/game/requirements.ts
var REQUIREMENT_TYPES = [
  { id: "coop_team_run", category: "social", label: "Complete six online Co-op waves", hint: "Verified by the online match server", event: "coop_result", progress: "increment", valueField: "count" },
  { id: "slice_any", category: "slicing", label: "Slice any fruit", hint: "Count every fruit sliced", event: "fruit_slice", progress: "increment" },
  { id: "slice_watermelon", category: "slicing", label: "Slice watermelons", hint: "Watermelon kills", event: "fruit_slice", progress: "increment", fruitKind: "watermelon" },
  { id: "slice_lemon", category: "slicing", label: "Slice lemons", hint: "Lemon kills", event: "fruit_slice", progress: "increment", fruitKind: "lemon" },
  { id: "slice_orange", category: "slicing", label: "Slice oranges", hint: "Orange kills", event: "fruit_slice", progress: "increment", fruitKind: "orange" },
  { id: "slice_banana", category: "slicing", label: "Slice bananas", hint: "Banana kills", event: "fruit_slice", progress: "increment", fruitKind: "banana" },
  { id: "slice_strawberry", category: "slicing", label: "Slice strawberries", hint: "Strawberry kills", event: "fruit_slice", progress: "increment", fruitKind: "strawberry" },
  { id: "slice_pineapple", category: "slicing", label: "Slice pineapples", hint: "Pineapple kills", event: "fruit_slice", progress: "increment", fruitKind: "pineapple" },
  { id: "slice_kiwi", category: "slicing", label: "Slice kiwis", hint: "Kiwi kills", event: "fruit_slice", progress: "increment", fruitKind: "kiwi" },
  { id: "slice_citrus", category: "slicing", label: "Slice citrus family", hint: "Lemon, orange, banana, pineapple", event: "fruit_slice", progress: "increment", fruitFamily: "lemon" },
  { id: "slice_berry", category: "slicing", label: "Slice berry family", hint: "Strawberry and kiwi", event: "fruit_slice", progress: "increment", fruitFamily: "berry" },
  { id: "slice_melon", category: "slicing", label: "Slice melon family", hint: "Watermelons", event: "fruit_slice", progress: "increment", fruitFamily: "melon" },
  { id: "slice_citrus_or_berry", category: "slicing", label: "Slice lemons or strawberries", hint: "Classic daily citrus mix", event: "fruit_slice", progress: "increment" },
  { id: "slice_boss", category: "slicing", label: "Defeat boss fruit", hint: "Boss kills", event: "boss_kill", progress: "increment" },
  { id: "reslice_halves", category: "slicing", label: "Re-slice fruit halves", hint: "Cut debris pieces", event: "reslice", progress: "increment" },
  { id: "slice_casual", category: "slicing", label: "Slice fruit in Casual", hint: "Casual mode slices", event: "fruit_slice", progress: "increment", mode: "casual" },
  { id: "slice_ranked", category: "slicing", label: "Slice fruit in Ranked", hint: "Ranked mode slices", event: "fruit_slice", progress: "increment", mode: "ranked" },
  { id: "slice_arena", category: "slicing", label: "Slice fruit in Arena", hint: "Arena mode slices", event: "fruit_slice", progress: "increment", mode: "arena" },
  { id: "slice_coop", category: "slicing", label: "Slice fruit in Co-op", hint: "Co-op mode slices", event: "fruit_slice", progress: "increment", mode: "coop" },
  { id: "combo_count", category: "combat", label: "Land combos", hint: "Combos at or above Min Value", event: "combo", progress: "increment", usesMinValue: true },
  { id: "combo_peak", category: "combat", label: "Reach combo size", hint: "Highest combo reached", event: "combo", progress: "max", valueField: "combo" },
  { id: "combo_reach_5", category: "combat", label: "Reach 5x combo", hint: "Hit a 5x combo", event: "combo", progress: "max", valueField: "combo" },
  { id: "combo_reach_10", category: "combat", label: "Reach 10x combo", hint: "Hit a 10x combo", event: "combo", progress: "max", valueField: "combo" },
  { id: "combo_reach_15", category: "combat", label: "Reach 15x combo", hint: "Hit a 15x combo", event: "combo", progress: "max", valueField: "combo" },
  { id: "slash_damage", category: "combat", label: "Deal slash damage", hint: "Accumulate blade damage", event: "slash_damage", progress: "increment", valueField: "damage" },
  { id: "bomb_parry", category: "combat", label: "Parry bombs", hint: "Deflect bombs with a fast slash", event: "bomb_parry", progress: "increment" },
  { id: "super_activate", category: "combat", label: "Activate Super Juice", hint: "Use Super", event: "super", progress: "increment" },
  { id: "run_max_combo", category: "combat", label: "Max combo in a run", hint: "Best combo when the run ends", event: "game_over", progress: "max", valueField: "combo" },
  { id: "run_fruits", category: "combat", label: "Fruits sliced in a run", hint: "Best single-run fruit count", event: "game_over", progress: "max", valueField: "amount" },
  { id: "wave_reach", category: "defense", label: "Reach wave number", hint: "Highest wave reached", event: "wave_clear", progress: "max", valueField: "wave" },
  { id: "waves_cleared", category: "defense", label: "Clear waves", hint: "Count of waves cleared", event: "wave_clear", progress: "increment" },
  { id: "perfect_wave", category: "defense", label: "Clear waves at full lives", hint: "No damage that wave", event: "wave_clear", progress: "increment" },
  { id: "turret_place", category: "defense", label: "Place any turret", hint: "Build turrets", event: "turret_place", progress: "increment" },
  { id: "place_guillotine", category: "defense", label: "Place Guillotine", hint: "Build Guillotine", event: "turret_place", progress: "increment", turretKind: "guillotine" },
  { id: "place_vortex", category: "defense", label: "Place Vortex Drain", hint: "Build Vortex", event: "turret_place", progress: "increment", turretKind: "vortex" },
  { id: "place_laser", category: "defense", label: "Place Lemon Laser", hint: "Build Laser", event: "turret_place", progress: "increment", turretKind: "laser" },
  { id: "place_railgun", category: "defense", label: "Place Melon Railgun", hint: "Build Railgun", event: "turret_place", progress: "increment", turretKind: "railgun" },
  { id: "place_sprinkler", category: "defense", label: "Place Citrus Sprinkler", hint: "Build Sprinkler", event: "turret_place", progress: "increment", turretKind: "sprinkler" },
  { id: "place_blender", category: "defense", label: "Place Blender Pit", hint: "Build Blender", event: "turret_place", progress: "increment", turretKind: "blender" },
  { id: "turret_upgrade", category: "defense", label: "Upgrade turrets", hint: "Level up towers", event: "turret_upgrade", progress: "increment" },
  { id: "turret_sell", category: "defense", label: "Sell turrets", hint: "Sell placed towers", event: "turret_sell", progress: "increment" },
  { id: "turret_move", category: "defense", label: "Move turrets", hint: "Relocate towers", event: "turret_move", progress: "increment" },
  { id: "prevent_leak", category: "defense", label: "Stop leaks (survive waves)", hint: "Same as waves cleared", event: "wave_clear", progress: "increment" },
  { id: "play_jiju", category: "heroes", label: "Play as Master Jiju", hint: "Start or finish a run as Jiju", event: "game_start", progress: "increment", hero: "jiju" },
  { id: "play_topfu", category: "heroes", label: "Play as Topfu", hint: "Start a run as Topfu", event: "game_start", progress: "increment", hero: "topfu" },
  { id: "play_lagen", category: "heroes", label: "Play as Lagen", hint: "Start a run as Lagen", event: "game_start", progress: "increment", hero: "lagen" },
  { id: "play_tripos", category: "heroes", label: "Play as Tripos", hint: "Start a run as Tripos", event: "game_start", progress: "increment", hero: "tripos" },
  { id: "play_ki", category: "heroes", label: "Play as Master Ki", hint: "Start a run as Ki", event: "game_start", progress: "increment", hero: "ki" },
  { id: "hero_level", category: "heroes", label: "Hero level-ups", hint: "Gain hero levels", event: "hero_level", progress: "increment" },
  { id: "buy_skill", category: "heroes", label: "Buy skill ranks", hint: "Spend skill points", event: "skill_buy", progress: "increment" },
  { id: "play_games", category: "heroes", label: "Finish matches", hint: "Game over count", event: "game_over", progress: "increment" },
  { id: "play_casual_games", category: "heroes", label: "Finish Casual matches", hint: "Casual game overs", event: "game_over", progress: "increment", mode: "casual" },
  { id: "play_ranked_games", category: "heroes", label: "Finish Ranked matches", hint: "Ranked game overs", event: "game_over", progress: "increment", mode: "ranked" },
  { id: "play_arena_games", category: "heroes", label: "Finish Arena matches", hint: "Arena game overs", event: "game_over", progress: "increment", mode: "arena" },
  { id: "play_coop_games", category: "heroes", label: "Finish Co-op matches", hint: "Co-op game overs", event: "game_over", progress: "increment", mode: "coop" },
  { id: "score_reach", category: "economy", label: "Reach score", hint: "Highest score (max)", event: "game_over", progress: "max", valueField: "score" },
  { id: "earn_score", category: "economy", label: "Earn score points", hint: "Add score as it is gained", event: "slash_damage", progress: "increment", valueField: "score" },
  { id: "buy_skin", category: "economy", label: "Buy shop skins", hint: "Purchase blades or walls", event: "skin_buy", progress: "increment" },
  { id: "juice_collect", category: "economy", label: "Collect juice", hint: "Juice bank pickups", event: "juice", progress: "increment", valueField: "amount" },
  { id: "leak_hits", category: "economy", label: "Wall leaks taken", hint: "Fruit that reach the wall", event: "leak", progress: "increment" },
  { id: "claim_daily", category: "social", label: "Claim daily bonus", hint: "Daily login claims", event: "daily_claim", progress: "increment" },
  { id: "daily_streak", category: "social", label: "Reach daily streak", hint: "Highest streak day", event: "daily_claim", progress: "max", valueField: "streak" },
  { id: "steam_link", category: "social", label: "Link Steam", hint: "Connect a Steam profile", event: "steam_link", progress: "increment" },
  { id: "claim_mission", category: "social", label: "Claim missions", hint: "Turn claimable missions in", event: "mission_claim", progress: "increment" },
  { id: "monthly_score", category: "ranked", label: "Monthly ranked score", hint: "Best score this month", event: "game_over", progress: "max", valueField: "score", mode: "ranked" },
  { id: "reach_bronze", category: "ranked", label: "Reach Bronze", hint: "Hit Bronze monthly threshold", event: "game_over", progress: "max", valueField: "score", mode: "ranked", rankId: "bronze" },
  { id: "reach_silver", category: "ranked", label: "Reach Silver", hint: "Hit Silver monthly threshold", event: "game_over", progress: "max", valueField: "score", mode: "ranked", rankId: "silver" },
  { id: "reach_gold", category: "ranked", label: "Reach Gold", hint: "Hit Gold monthly threshold", event: "game_over", progress: "max", valueField: "score", mode: "ranked", rankId: "gold" },
  { id: "reach_platinum", category: "ranked", label: "Reach Platinum", hint: "Hit Platinum monthly threshold", event: "game_over", progress: "max", valueField: "score", mode: "ranked", rankId: "platinum" },
  { id: "reach_diamond", category: "ranked", label: "Reach Diamond", hint: "Hit Diamond monthly threshold", event: "game_over", progress: "max", valueField: "score", mode: "ranked", rankId: "diamond" },
  { id: "monthly_games", category: "ranked", label: "Play monthly ranked games", hint: "Ranked finishes this period", event: "game_over", progress: "increment", mode: "ranked" },
  { id: "reach_master", category: "ranked", label: "Reach Master", hint: "Hit Master monthly threshold", event: "game_over", progress: "max", valueField: "score", mode: "ranked", rankId: "master" },
  { id: "reach_grandmaster", category: "ranked", label: "Reach Grandmaster", hint: "Hit Grandmaster monthly threshold", event: "game_over", progress: "max", valueField: "score", mode: "ranked", rankId: "grandmaster" },
  { id: "pvp_win", category: "ranked", label: "Win PvP sieges", hint: "Wins verified by the match authority", event: "pvp_result", progress: "increment", valueField: "count" },
  { id: "pvp_combo", category: "ranked", label: "Reach a PvP combo", hint: "Best server-verified PvP combo", event: "pvp_result", progress: "max", valueField: "combo" },
  { id: "pvp_multislice", category: "ranked", label: "PvP multi-slices", hint: "Fruit-zombies sliced in one command", event: "pvp_result", progress: "max", valueField: "count" },
  { id: "pvp_season", category: "ranked", label: "Finish a PvP season", hint: "Complete a ranked season", event: "pvp_result", progress: "increment", valueField: "count" },
  { id: "pvp_reach_silver", category: "ranked", label: "Reach Silver on PvP ladder", hint: "Reach 1,500 FR", event: "pvp_result", progress: "max", valueField: "score" },
  { id: "pvp_reach_gold", category: "ranked", label: "Reach Gold on PvP ladder", hint: "Reach 2,000 FR", event: "pvp_result", progress: "max", valueField: "score" },
  { id: "pvp_reach_diamond", category: "ranked", label: "Reach Diamond on PvP ladder", hint: "Reach 2,500 FR", event: "pvp_result", progress: "max", valueField: "score" },
  { id: "reach_emerald", category: "ranked", label: "Reach Emerald", hint: "Reach 2,750 FR on the PvP ladder", event: "pvp_result", progress: "max", valueField: "score" },
  { id: "reach_sapphire", category: "ranked", label: "Reach Sapphire", hint: "Reach 3,000 FR on the PvP ladder", event: "pvp_result", progress: "max", valueField: "score" },
  { id: "combo_reach_20", category: "combat", label: "Reach 20x combo", hint: "Hit a 20x combo", event: "combo", progress: "max", valueField: "combo" },
  { id: "score_casual", category: "economy", label: "Casual high score", hint: "Best casual run score", event: "game_over", progress: "max", valueField: "score", mode: "casual" },
  { id: "score_arena", category: "economy", label: "Arena high score", hint: "Best arena run score", event: "game_over", progress: "max", valueField: "score", mode: "arena" },
  { id: "score_coop", category: "economy", label: "Co-op high score", hint: "Best co-op run score", event: "game_over", progress: "max", valueField: "score", mode: "coop" },
  { id: "super_ranked", category: "combat", label: "Activate Super in Ranked", hint: "Use Super during Ranked", event: "super", progress: "increment", mode: "ranked" },
  { id: "boss_ranked", category: "slicing", label: "Defeat bosses in Ranked", hint: "Boss kills during Ranked", event: "boss_kill", progress: "increment", mode: "ranked" },
  { id: "slice_bomb", category: "slicing", label: "Parry or clear bombs", hint: "Bomb encounters you survive", event: "bomb_parry", progress: "increment" },
  { id: "wave_ranked", category: "defense", label: "Clear ranked waves", hint: "Waves cleared in Ranked", event: "wave_clear", progress: "increment", mode: "ranked" }
];
function requirementById(id) {
  return REQUIREMENT_TYPES.find((r) => r.id === id);
}
function migrateCoopCatalog(rows, defaults3, version = 0) {
  if (version >= 1 || rows.length === 0) return rows;
  const ids = new Set(rows.map((row) => row.id));
  return [...rows, ...defaults3.filter((row) => (row.id.startsWith("coop_") || row.id.startsWith("coop-")) && !ids.has(row.id))];
}
function currentMonthKey(date = /* @__PURE__ */ new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthlyLeaderboardMode(date = /* @__PURE__ */ new Date()) {
  return `monthly-${currentMonthKey(date)}`;
}
function mergeRewardDefaults(items, defaults3) {
  const byId = new Map(defaults3.map((item) => [item.id, item]));
  const configuredById = new Map(items.filter((item) => item?.id).map((item) => [item.id, item]));
  const mergedItems = [...configuredById.values(), ...defaults3.filter((item) => !configuredById.has(item.id))];
  return mergedItems.map((item) => {
    const fallback = byId.get(item.id);
    const merged = { ...fallback, ...item };
    const rewardCoins = Math.max(0, Math.min(1e6, Math.floor(Number(item.rewardCoins ?? fallback?.rewardCoins) || 0)));
    const rewardGems = Math.max(0, Math.min(1e6, Math.floor(Number(item.rewardGems ?? fallback?.rewardGems) || 0)));
    return {
      ...merged,
      rewardCoins,
      rewardGems,
      ..."rewardSp" in merged ? { rewardSp: Math.max(0, Math.min(1e4, Math.floor(Number(merged.rewardSp) || 0))) } : {}
    };
  });
}
function req(type, goal, extra = {}) {
  return { type, goal, ...extra };
}
var MISSION_SEEDS = [
  { id: "daily_lemons", type: "daily", title: "Citrus Squeeze", desc: "Slice 30 lemons or strawberries", icon: "Citrus", enabled: true, requirement: req("slice_citrus_or_berry", 30), rewardCoins: 80, rewardSp: 0 },
  { id: "daily_combos", type: "daily", title: "Combo Fiend", desc: "Perform 4 combos of 3x or higher", icon: "Zap", enabled: true, requirement: req("combo_count", 4, { minValue: 3 }), rewardCoins: 120, rewardSp: 0 },
  { id: "daily_wave", type: "daily", title: "Wave Survivor", desc: "Survive to wave 5 in any run", icon: "Waves", enabled: true, requirement: req("wave_reach", 5), rewardCoins: 100, rewardSp: 0 },
  { id: "weekly_fruits", type: "weekly", title: "Fruit Apocalypse", desc: "Slice 250 total fruits this week", icon: "Swords", enabled: true, requirement: req("slice_any", 250), rewardCoins: 350, rewardSp: 1 },
  { id: "monthly_ranked_climb", type: "monthly", title: "Monthly Climb", desc: "Score 4,000 in Ranked this month to reach Gold", icon: "Trophy", enabled: true, requirement: req("reach_gold", 4e3), rewardCoins: 500, rewardSp: 1, rewardGems: 10, rewardBadge: "gold-slicer" },
  { id: "monthly_silver_climb", type: "monthly", title: "Silver Season", desc: "Score 1,500 in Ranked this month to reach Silver", icon: "Medal", enabled: true, requirement: req("reach_silver", 1500), rewardCoins: 250, rewardSp: 0, rewardGems: 5, rewardBadge: "silver-slicer" },
  { id: "monthly_diamond_climb", type: "monthly", title: "Diamond Season", desc: "Score 15,000 in Ranked this month to reach Diamond", icon: "Diamond", enabled: true, requirement: req("reach_diamond", 15e3), rewardCoins: 800, rewardSp: 2, rewardGems: 25, rewardBadge: "diamond-slicer" },
  { id: "daily_apples", type: "daily", title: "Apple Purge", desc: "Slice 25 apples", icon: "Apple", enabled: true, requirement: req("slice_any", 25, { fruitKind: "apple" }), rewardCoins: 75, rewardSp: 0 },
  { id: "daily_watermelons", type: "daily", title: "Crack the Rind", desc: "Slice 12 watermelons", icon: "CircleDot", enabled: true, requirement: req("slice_watermelon", 12), rewardCoins: 90, rewardSp: 0 },
  { id: "daily_oranges", type: "daily", title: "Orange Alert", desc: "Slice 25 oranges", icon: "Citrus", enabled: true, requirement: req("slice_orange", 25), rewardCoins: 75, rewardSp: 0 },
  { id: "daily_bananas", type: "daily", title: "Peel Patrol", desc: "Slice 25 bananas", icon: "Banana", enabled: true, requirement: req("slice_banana", 25), rewardCoins: 75, rewardSp: 0 },
  { id: "daily_kiwis", type: "daily", title: "Kiwi Sweep", desc: "Slice 25 kiwis", icon: "Circle", enabled: true, requirement: req("slice_kiwi", 25), rewardCoins: 75, rewardSp: 0 },
  { id: "daily_pineapples", type: "daily", title: "Crown Breaker", desc: "Slice 18 pineapples", icon: "Crown", enabled: true, requirement: req("slice_pineapple", 18), rewardCoins: 90, rewardSp: 0 },
  { id: "daily_bombs", type: "daily", title: "Bomb Disposal", desc: "Parry 6 explosive fruits", icon: "Bomb", enabled: true, requirement: req("bomb_parry", 6), rewardCoins: 130, rewardSp: 0 },
  { id: "daily_juice", type: "daily", title: "Fresh Supply", desc: "Collect 120 juice", icon: "Droplets", enabled: true, requirement: req("juice_collect", 120), rewardCoins: 90, rewardSp: 0 },
  { id: "daily_damage", type: "daily", title: "Clean Cuts", desc: "Deal 1,500 slash damage", icon: "Sword", enabled: true, requirement: req("slash_damage", 1500), rewardCoins: 110, rewardSp: 0 },
  { id: "daily_perfect", type: "daily", title: "Untouched Wall", desc: "Clear 2 perfect waves", icon: "ShieldCheck", enabled: true, requirement: req("perfect_wave", 2), rewardCoins: 130, rewardSp: 0 },
  { id: "daily_super", type: "daily", title: "Vitamin Overdrive", desc: "Activate Super Juice twice", icon: "Sparkles", enabled: true, requirement: req("super_activate", 2), rewardCoins: 100, rewardSp: 0 },
  { id: "daily_build", type: "daily", title: "Wall Engineer", desc: "Place 3 turrets", icon: "Hammer", enabled: true, requirement: req("turret_place", 3), rewardCoins: 90, rewardSp: 0 },
  { id: "daily_upgrade", type: "daily", title: "Sharpen Defences", desc: "Upgrade 2 turrets", icon: "ArrowUpCircle", enabled: true, requirement: req("turret_upgrade", 2), rewardCoins: 100, rewardSp: 0 },
  { id: "daily_move", type: "daily", title: "Tactical Shift", desc: "Move a turret once", icon: "Move", enabled: true, requirement: req("turret_move", 1), rewardCoins: 70, rewardSp: 0 },
  { id: "daily_reslice", type: "daily", title: "Second Cut", desc: "Re-slice 12 fruit halves", icon: "Slice", enabled: true, requirement: req("reslice_halves", 12), rewardCoins: 100, rewardSp: 0 },
  { id: "daily_score", type: "daily", title: "Score Run", desc: "Earn 2,000 score", icon: "Gauge", enabled: true, requirement: req("earn_score", 2e3), rewardCoins: 120, rewardSp: 0 },
  { id: "daily_jiju", type: "daily", title: "Master on Duty", desc: "Start a run as Master Jiju", icon: "UserRound", enabled: true, requirement: req("play_jiju", 1), rewardCoins: 60, rewardSp: 0 },
  { id: "daily_ranked", type: "daily", title: "Ranked Deployment", desc: "Finish a Ranked match", icon: "Medal", enabled: true, requirement: req("play_ranked_games", 1), rewardCoins: 140, rewardSp: 0, rewardGems: 1 },
  { id: "weekly_fruit_raid", type: "weekly", title: "Orchard Raid", desc: "Slice 750 fruits", icon: "Swords", enabled: true, requirement: req("slice_any", 750), rewardCoins: 700, rewardSp: 1 },
  { id: "weekly_melons", type: "weekly", title: "Melon Siege", desc: "Slice 80 watermelons", icon: "CircleDot", enabled: true, requirement: req("slice_watermelon", 80), rewardCoins: 500, rewardSp: 1 },
  { id: "weekly_citrus", type: "weekly", title: "Citrus Storm", desc: "Slice 180 citrus fruits", icon: "Citrus", enabled: true, requirement: req("slice_citrus", 180), rewardCoins: 500, rewardSp: 1 },
  { id: "weekly_berries", type: "weekly", title: "Berry Cleanup", desc: "Slice 150 berry fruits", icon: "Cherry", enabled: true, requirement: req("slice_berry", 150), rewardCoins: 500, rewardSp: 1 },
  { id: "weekly_waves", type: "weekly", title: "Long Watch", desc: "Clear 30 waves", icon: "Waves", enabled: true, requirement: req("waves_cleared", 30), rewardCoins: 650, rewardSp: 1 },
  { id: "weekly_perfect", type: "weekly", title: "Perfect Defence", desc: "Clear 12 perfect waves", icon: "ShieldCheck", enabled: true, requirement: req("perfect_wave", 12), rewardCoins: 700, rewardSp: 1, rewardGems: 3 },
  { id: "weekly_combos", type: "weekly", title: "Chain Reaction", desc: "Land 30 combos of 5x or higher", icon: "Zap", enabled: true, requirement: req("combo_count", 30, { minValue: 5 }), rewardCoins: 650, rewardSp: 1 },
  { id: "weekly_bosses", type: "weekly", title: "Overlord Hunter", desc: "Defeat 5 bosses", icon: "Skull", enabled: true, requirement: req("slice_boss", 5), rewardCoins: 800, rewardSp: 1, rewardGems: 5 },
  { id: "weekly_guillotines", type: "weekly", title: "Falling Blades", desc: "Place 8 Guillotines", icon: "Scissors", enabled: true, requirement: req("place_guillotine", 8), rewardCoins: 450, rewardSp: 1 },
  { id: "weekly_vortex", type: "weekly", title: "Drain the Horde", desc: "Place 8 Vortex Drains", icon: "Tornado", enabled: true, requirement: req("place_vortex", 8), rewardCoins: 450, rewardSp: 1 },
  { id: "weekly_lasers", type: "weekly", title: "Lemon Lightshow", desc: "Place 8 Lemon Lasers", icon: "ScanLine", enabled: true, requirement: req("place_laser", 8), rewardCoins: 450, rewardSp: 1 },
  { id: "weekly_upgrades", type: "weekly", title: "Fortified", desc: "Upgrade turrets 15 times", icon: "ChevronsUp", enabled: true, requirement: req("turret_upgrade", 15), rewardCoins: 550, rewardSp: 1 },
  { id: "weekly_games", type: "weekly", title: "Active Defender", desc: "Finish 10 matches", icon: "Gamepad2", enabled: true, requirement: req("play_games", 10), rewardCoins: 600, rewardSp: 1 },
  { id: "weekly_ranked", type: "weekly", title: "Ladder Duty", desc: "Finish 5 Ranked matches", icon: "Trophy", enabled: true, requirement: req("play_ranked_games", 5), rewardCoins: 700, rewardSp: 1, rewardGems: 5 },
  { id: "weekly_horde", type: "weekly", title: "Horde Holdout", desc: "Clear 20 Horde waves", icon: "UsersRound", enabled: true, requirement: req("waves_cleared", 20, { mode: "horde" }), rewardCoins: 750, rewardSp: 1, rewardGems: 4 },
  { id: "weekly_campaign", type: "weekly", title: "Road Through Rot", desc: "Clear 20 Campaign waves", icon: "Map", enabled: true, requirement: req("waves_cleared", 20, { mode: "campaign" }), rewardCoins: 750, rewardSp: 1, rewardGems: 4 },
  { id: "weekly_damage", type: "weekly", title: "Blade Work", desc: "Deal 30,000 slash damage", icon: "Sword", enabled: true, requirement: req("slash_damage", 3e4), rewardCoins: 650, rewardSp: 1 },
  { id: "weekly_juice", type: "weekly", title: "Full Reservoir", desc: "Collect 2,000 juice", icon: "Droplets", enabled: true, requirement: req("juice_collect", 2e3), rewardCoins: 550, rewardSp: 1 },
  { id: "weekly_reslice", type: "weekly", title: "No Pulp Wasted", desc: "Re-slice 100 fruit halves", icon: "Slice", enabled: true, requirement: req("reslice_halves", 100), rewardCoins: 600, rewardSp: 1 },
  { id: "monthly_master", type: "monthly", title: "Master Season", desc: "Reach Master rank", icon: "Crown", enabled: true, requirement: req("reach_master", 25e3), rewardCoins: 2e3, rewardSp: 3, rewardGems: 60 },
  { id: "monthly_grandmaster", type: "monthly", title: "Grandmaster Season", desc: "Reach Grandmaster rank", icon: "Flame", enabled: true, requirement: req("reach_grandmaster", 4e4), rewardCoins: 4e3, rewardSp: 5, rewardGems: 100 },
  { id: "monthly_games_25", type: "monthly", title: "Season Regular", desc: "Finish 25 Ranked matches", icon: "CalendarCheck", enabled: true, requirement: req("monthly_games", 25), rewardCoins: 1200, rewardSp: 2, rewardGems: 15 },
  { id: "monthly_games_75", type: "monthly", title: "Season Veteran", desc: "Finish 75 Ranked matches", icon: "BadgeCheck", enabled: true, requirement: req("monthly_games", 75), rewardCoins: 2500, rewardSp: 4, rewardGems: 40 },
  { id: "monthly_score_50000", type: "monthly", title: "Score Vanguard", desc: "Earn a 50,000 Ranked score", icon: "Gauge", enabled: true, requirement: req("monthly_score", 5e4), rewardCoins: 3e3, rewardSp: 4, rewardGems: 60 },
  { id: "monthly_waves", type: "monthly", title: "Unbroken Line", desc: "Clear 200 Ranked waves", icon: "Shield", enabled: true, requirement: req("wave_ranked", 200), rewardCoins: 3e3, rewardSp: 4, rewardGems: 50 }
];
var DEFAULT_MISSIONS = [
  ...MISSION_SEEDS.map((mission) => ({ ...mission, type: "main" })),
  { id: "daily_slice", type: "daily", title: "Fresh Cut", desc: "Slice 20 fruits", icon: "Slice", enabled: true, requirement: req("slice_any", 20), rewardCoins: 80, rewardSp: 0 },
  { id: "daily_combo", type: "daily", title: "Quick Combo", desc: "Land 3 combos of 3x or higher", icon: "Zap", enabled: true, requirement: req("combo_count", 3, { minValue: 3 }), rewardCoins: 100, rewardSp: 0 },
  { id: "daily_hold", type: "daily", title: "Hold the Line", desc: "Reach wave 5", icon: "Shield", enabled: true, requirement: req("wave_reach", 5), rewardCoins: 120, rewardSp: 0 },
  { id: "daily_boss", type: "daily", title: "Overlord Patrol", desc: "Defeat 1 boss", icon: "Crown", enabled: true, requirement: req("slice_boss", 1), rewardCoins: 150, rewardSp: 0, rewardGems: 1 },
  { id: "daily_bomb", type: "daily", title: "Bomb Squad", desc: "Parry 3 explosive fruits", icon: "Bomb", enabled: true, requirement: req("bomb_parry", 3), rewardCoins: 120, rewardSp: 0 }
];
var DEFAULT_ACHIEVEMENTS = [
  { id: "coop_first_team_run", title: "Together We Hold", desc: "Complete six waves with an online teammate", icon: "UsersRound", enabled: true, requirement: req("coop_team_run", 1), rewardCoins: 200, rewardSp: 0, rewardGems: 2, rewardBadge: "coop-team-slicer" },
  { id: "first_slice", title: "First Blood", desc: "Slice your very first fruit", icon: "Sword", enabled: true, requirement: req("slice_any", 1), rewardCoins: 50, rewardSp: 0, rewardGems: 1, rewardBadge: "first-cut" },
  { id: "combo_5", title: "Combo Artist", desc: "Execute a 5x or higher combo slice", icon: "Zap", enabled: true, requirement: req("combo_reach_5", 5), rewardCoins: 100, rewardSp: 0 },
  { id: "combo_10", title: "Blade Master", desc: "Execute a massive 10x combo slice", icon: "Swords", enabled: true, requirement: req("combo_reach_10", 10), rewardCoins: 250, rewardSp: 1, rewardBadge: "combo-king" },
  { id: "fruit_100", title: "Fruit Peeler", desc: "Slice 100 total fruits", icon: "Apple", enabled: true, requirement: req("slice_any", 100), rewardCoins: 150, rewardSp: 0 },
  { id: "fruit_500", title: "Juice Tycoon", desc: "Slice 500 total fruits", icon: "Droplets", enabled: true, requirement: req("slice_any", 500), rewardCoins: 300, rewardSp: 1 },
  { id: "fruit_1000", title: "Legendary Samurai", desc: "Slice 1,000 total fruits", icon: "Medal", enabled: true, requirement: req("slice_any", 1e3), rewardCoins: 600, rewardSp: 2 },
  { id: "wave_5", title: "Hold The Line", desc: "Survive to wave 5", icon: "Shield", enabled: true, requirement: req("wave_reach", 5), rewardCoins: 100, rewardSp: 0 },
  { id: "wave_10", title: "Citrus Citadel", desc: "Survive to wave 10", icon: "Castle", enabled: true, requirement: req("wave_reach", 10), rewardCoins: 250, rewardSp: 1, rewardBadge: "wall-guard" },
  { id: "super_juice", title: "Max Vitamin C", desc: "Activate Super Juice mode", icon: "Sparkles", enabled: true, requirement: req("super_activate", 1), rewardCoins: 100, rewardSp: 0 },
  { id: "untouchable", title: "Pristine Wall", desc: "Clear a wave with 100% wall integrity", icon: "ShieldCheck", enabled: true, requirement: req("perfect_wave", 1), rewardCoins: 150, rewardSp: 0 },
  { id: "turret_builder", title: "Fortress Architect", desc: "Place 3 turrets on your defensive wall", icon: "Hammer", enabled: true, requirement: req("turret_place", 3), rewardCoins: 150, rewardSp: 0 },
  { id: "steam_connect", title: "Steam Cadet", desc: "Link your Steam profile to Fruit TD", icon: "Gamepad2", enabled: true, requirement: req("steam_link", 1), rewardCoins: 500, rewardSp: 1, rewardBadge: "steam-cadet" },
  { id: "diamond_rank", title: "Diamond Slicer", desc: "Reach Diamond on the monthly ranked ladder", icon: "Diamond", enabled: true, requirement: req("reach_diamond", 15e3), rewardCoins: 800, rewardSp: 2, rewardGems: 25, rewardBadge: "diamond-slicer" },
  { id: "combo_15", title: "Chain Commander", desc: "Reach a 15x combo", icon: "Link", enabled: true, requirement: req("combo_reach_15", 15), rewardCoins: 350, rewardSp: 1 },
  { id: "combo_20", title: "Unbroken Edge", desc: "Reach a 20x combo", icon: "Infinity", enabled: true, requirement: req("combo_reach_20", 20), rewardCoins: 600, rewardSp: 2, rewardGems: 5, rewardBadge: "combo-legend" },
  { id: "fruit_5000", title: "Orchard Reaper", desc: "Slice 5,000 total fruits", icon: "Skull", enabled: true, requirement: req("slice_any", 5e3), rewardCoins: 1500, rewardSp: 3, rewardGems: 15, rewardBadge: "fruit-reaper" },
  { id: "fruit_10000", title: "Extinction Event", desc: "Slice 10,000 total fruits", icon: "Flame", enabled: true, requirement: req("slice_any", 1e4), rewardCoins: 3e3, rewardSp: 5, rewardGems: 30 },
  { id: "wave_25", title: "Iron Wall", desc: "Reach wave 25", icon: "ShieldCheck", enabled: true, requirement: req("wave_reach", 25), rewardCoins: 500, rewardSp: 1 },
  { id: "wave_50", title: "Last Stronghold", desc: "Reach wave 50", icon: "Castle", enabled: true, requirement: req("wave_reach", 50), rewardCoins: 1e3, rewardSp: 2, rewardGems: 10 },
  { id: "wave_100", title: "Century Hold", desc: "Reach wave 100", icon: "Landmark", enabled: true, requirement: req("wave_reach", 100), rewardCoins: 2500, rewardSp: 4, rewardGems: 30 },
  { id: "boss_10", title: "Boss Breaker", desc: "Defeat 10 bosses", icon: "Skull", enabled: true, requirement: req("slice_boss", 10), rewardCoins: 700, rewardSp: 1, rewardBadge: "boss-breaker" },
  { id: "boss_50", title: "Overlord Bane", desc: "Defeat 50 bosses", icon: "Crown", enabled: true, requirement: req("slice_boss", 50), rewardCoins: 2e3, rewardSp: 3, rewardGems: 25 },
  { id: "bomb_50", title: "Blast Proof", desc: "Parry 50 bombs", icon: "Bomb", enabled: true, requirement: req("bomb_parry", 50), rewardCoins: 600, rewardSp: 1, rewardBadge: "bomb-tech" },
  { id: "reslice_250", title: "Pulp Specialist", desc: "Re-slice 250 fruit halves", icon: "Slice", enabled: true, requirement: req("reslice_halves", 250), rewardCoins: 700, rewardSp: 1 },
  { id: "damage_100k", title: "Six Figures of Pain", desc: "Deal 100,000 slash damage", icon: "Sword", enabled: true, requirement: req("slash_damage", 1e5), rewardCoins: 1e3, rewardSp: 2 },
  { id: "juice_5000", title: "Reservoir Master", desc: "Collect 5,000 juice", icon: "Droplets", enabled: true, requirement: req("juice_collect", 5e3), rewardCoins: 800, rewardSp: 2 },
  { id: "super_25", title: "Overcharged", desc: "Activate Super Juice 25 times", icon: "Sparkles", enabled: true, requirement: req("super_activate", 25), rewardCoins: 750, rewardSp: 2 },
  { id: "perfect_25", title: "Flawless Defender", desc: "Clear 25 perfect waves", icon: "ShieldCheck", enabled: true, requirement: req("perfect_wave", 25), rewardCoins: 1e3, rewardSp: 2, rewardGems: 10, rewardBadge: "perfect-guard" },
  { id: "turrets_50", title: "Defence Network", desc: "Place 50 turrets", icon: "TowerControl", enabled: true, requirement: req("turret_place", 50), rewardCoins: 750, rewardSp: 2 },
  { id: "upgrades_50", title: "Maximum Output", desc: "Upgrade turrets 50 times", icon: "ChevronsUp", enabled: true, requirement: req("turret_upgrade", 50), rewardCoins: 900, rewardSp: 2 },
  { id: "sales_10", title: "Field Quartermaster", desc: "Sell 10 turrets", icon: "Coins", enabled: true, requirement: req("turret_sell", 10), rewardCoins: 400, rewardSp: 1 },
  { id: "moves_25", title: "Mobile Defence", desc: "Move turrets 25 times", icon: "Move", enabled: true, requirement: req("turret_move", 25), rewardCoins: 500, rewardSp: 1 },
  { id: "games_10", title: "Standing Orders", desc: "Finish 10 matches", icon: "Gamepad2", enabled: true, requirement: req("play_games", 10), rewardCoins: 400, rewardSp: 1 },
  { id: "games_50", title: "Career Defender", desc: "Finish 50 matches", icon: "CalendarCheck", enabled: true, requirement: req("play_games", 50), rewardCoins: 1e3, rewardSp: 2, rewardGems: 10 },
  { id: "games_200", title: "Orchard Veteran", desc: "Finish 200 matches", icon: "BadgeCheck", enabled: true, requirement: req("play_games", 200), rewardCoins: 3e3, rewardSp: 5, rewardGems: 40, rewardBadge: "veteran" },
  { id: "casual_25", title: "Casual Specialist", desc: "Finish 25 Casual matches", icon: "Leaf", enabled: true, requirement: req("play_casual_games", 25), rewardCoins: 700, rewardSp: 1 },
  { id: "ranked_25", title: "Ranked Regular", desc: "Finish 25 Ranked matches", icon: "Trophy", enabled: true, requirement: req("play_ranked_games", 25), rewardCoins: 1e3, rewardSp: 2, rewardGems: 10 },
  { id: "arena_25", title: "Arena Contender", desc: "Finish 25 Arena matches", icon: "Swords", enabled: true, requirement: req("play_arena_games", 25), rewardCoins: 900, rewardSp: 2 },
  { id: "coop_25", title: "Reliable Partner", desc: "Finish 25 Co-op matches", icon: "UsersRound", enabled: true, requirement: req("play_coop_games", 25), rewardCoins: 900, rewardSp: 2 },
  { id: "topfu_10", title: "Topfu Disciple", desc: "Start 10 runs as Topfu", icon: "UserRound", enabled: true, requirement: req("play_topfu", 10), rewardCoins: 500, rewardSp: 1 },
  { id: "lagen_10", title: "Lagen Disciple", desc: "Start 10 runs as Lagen", icon: "UserRound", enabled: true, requirement: req("play_lagen", 10), rewardCoins: 500, rewardSp: 1 },
  { id: "tripos_10", title: "Triple Path", desc: "Start 10 runs as Tripos", icon: "GitBranch", enabled: true, requirement: req("play_tripos", 10), rewardCoins: 600, rewardSp: 1 },
  { id: "ki_10", title: "Spirit Path", desc: "Start 10 runs as Master Ki", icon: "Sparkles", enabled: true, requirement: req("play_ki", 10), rewardCoins: 600, rewardSp: 1 },
  { id: "skills_10", title: "Trained Operative", desc: "Buy 10 skill ranks", icon: "BrainCircuit", enabled: true, requirement: req("buy_skill", 10), rewardCoins: 600, rewardSp: 2 },
  { id: "skins_10", title: "Blade Collector", desc: "Buy 10 shop items", icon: "ShoppingBag", enabled: true, requirement: req("buy_skin", 10), rewardCoins: 700, rewardSp: 2, rewardBadge: "collector" },
  { id: "daily_7", title: "One Week Strong", desc: "Claim 7 daily bonuses", icon: "CalendarCheck", enabled: true, requirement: req("claim_daily", 7), rewardCoins: 500, rewardSp: 1, rewardGems: 5 },
  { id: "daily_30", title: "Monthly Survivor", desc: "Claim 30 daily bonuses", icon: "CalendarDays", enabled: true, requirement: req("claim_daily", 30), rewardCoins: 1500, rewardSp: 3, rewardGems: 25, rewardBadge: "daily-veteran" },
  { id: "score_10000", title: "Five Digit Run", desc: "Reach 10,000 score in a run", icon: "Gauge", enabled: true, requirement: req("score_reach", 1e4), rewardCoins: 700, rewardSp: 1 },
  { id: "score_50000", title: "Score Titan", desc: "Reach 50,000 score in a run", icon: "ChartNoAxesCombined", enabled: true, requirement: req("score_reach", 5e4), rewardCoins: 2e3, rewardSp: 3, rewardGems: 20 },
  { id: "horde_wave_50", title: "Horde Holdout", desc: "Reach wave 50 in Horde", icon: "UsersRound", enabled: true, requirement: req("wave_reach", 50, { mode: "horde" }), rewardCoins: 1500, rewardSp: 3, rewardGems: 15, rewardBadge: "horde-veteran" },
  { id: "pvp_first_win", title: "First Siege", desc: "Win your first server-verified PvP siege", icon: "Swords", enabled: true, requirement: req("pvp_win", 1), rewardCoins: 200, rewardSp: 0, rewardGems: 2, rewardBadge: "pvp-first-win" },
  { id: "pvp_ten_wins", title: "Wallbreaker", desc: "Win ten server-verified PvP sieges", icon: "ShieldCheck", enabled: true, requirement: req("pvp_win", 10), rewardCoins: 800, rewardSp: 0, rewardGems: 10, rewardBadge: "pvp-wallbreaker" },
  { id: "pvp_combo_50", title: "Fruit Storm", desc: "Reach a 50-slice combo in a PvP siege", icon: "Zap", enabled: false, requirement: req("pvp_combo", 50), rewardCoins: 500, rewardSp: 0, rewardGems: 5 },
  { id: "pvp_multislice_5", title: "Five-Fruit Cut", desc: "Slice five fruit-zombies with one server-verified cut", icon: "Sword", enabled: false, requirement: req("pvp_multislice", 5), rewardCoins: 350, rewardSp: 0, rewardGems: 3 }
];
var DEFAULT_BADGES = [
  { id: "coop-team-slicer", title: "Team Slicer", desc: "Complete six waves in server-verified online Co-op", icon: "UsersRound", rarity: "rare", enabled: true, requirement: req("coop_team_run", 1), rewardCoins: 100, rewardGems: 2 },
  { id: "first-cut", title: "First Cut", desc: "Awarded for your first slice", icon: "Sword", rarity: "common", enabled: true, requirement: req("slice_any", 1), rewardCoins: 50 },
  { id: "combo-king", title: "Combo King", desc: "Awarded for a 10x combo", icon: "Zap", rarity: "rare", enabled: true, requirement: req("combo_reach_10", 10), rewardCoins: 150, rewardGems: 2 },
  { id: "wall-guard", title: "Wall Guard", desc: "Hold the wall to wave 10", icon: "Shield", rarity: "rare", enabled: true, requirement: req("wave_reach", 10), rewardCoins: 100, rewardGems: 2 },
  { id: "steam-cadet", title: "Steam Cadet", desc: "Linked Steam account", icon: "Gamepad2", rarity: "common", enabled: true, requirement: req("steam_link", 1), rewardCoins: 100 },
  { id: "bronze-slicer", title: "Bronze Slicer", desc: "Finish a Ranked match this month", icon: "Shield", rarity: "common", enabled: true, requirement: req("monthly_games", 1), rewardCoins: 100 },
  { id: "silver-slicer", title: "Silver Slicer", desc: "Monthly Silver rank", icon: "Medal", rarity: "rare", enabled: true, requirement: req("reach_silver", 1500), rewardCoins: 250, rewardGems: 5 },
  { id: "gold-slicer", title: "Gold Slicer", desc: "Monthly Gold rank", icon: "Trophy", rarity: "epic", enabled: true, requirement: req("reach_gold", 4e3), rewardCoins: 500, rewardGems: 10 },
  { id: "diamond-slicer", title: "Diamond Slicer", desc: "Monthly Diamond rank", icon: "Diamond", rarity: "legendary", enabled: true, requirement: req("reach_diamond", 15e3), rewardCoins: 1e3, rewardGems: 25 },
  { id: "daily-regular", title: "Daily Regular", desc: "Claim 7 daily bonuses", icon: "CalendarCheck", rarity: "rare", enabled: true, requirement: req("claim_daily", 7), rewardCoins: 250, rewardGems: 5 },
  { id: "combo-legend", title: "Combo Legend", desc: "Reach a 20x combo", icon: "Infinity", rarity: "epic", enabled: true, requirement: req("combo_reach_20", 20), rewardCoins: 400, rewardGems: 8 },
  { id: "fruit-reaper", title: "Fruit Reaper", desc: "Slice 5,000 fruits", icon: "Skull", rarity: "epic", enabled: true, requirement: req("slice_any", 5e3), rewardCoins: 600, rewardGems: 10 },
  { id: "boss-breaker", title: "Boss Breaker", desc: "Defeat 10 bosses", icon: "Crown", rarity: "epic", enabled: true, requirement: req("slice_boss", 10), rewardCoins: 500, rewardGems: 10 },
  { id: "bomb-tech", title: "Bomb Technician", desc: "Parry 50 bombs", icon: "Bomb", rarity: "rare", enabled: true, requirement: req("bomb_parry", 50), rewardCoins: 350, rewardGems: 5 },
  { id: "perfect-guard", title: "Perfect Guard", desc: "Clear 25 perfect waves", icon: "ShieldCheck", rarity: "epic", enabled: true, requirement: req("perfect_wave", 25), rewardCoins: 500, rewardGems: 10 },
  { id: "collector", title: "Arsenal Collector", desc: "Buy 10 shop items", icon: "ShoppingBag", rarity: "rare", enabled: true, requirement: req("buy_skin", 10), rewardCoins: 400, rewardGems: 5 },
  { id: "daily-veteran", title: "Daily Veteran", desc: "Claim 30 daily bonuses", icon: "CalendarDays", rarity: "epic", enabled: true, requirement: req("claim_daily", 30), rewardCoins: 600, rewardGems: 15 },
  { id: "master-slicer", title: "Master Slicer", desc: "Reach Master rank", icon: "Crown", rarity: "legendary", enabled: true, requirement: req("reach_master", 25e3), rewardCoins: 1e3, rewardGems: 25 },
  { id: "horde-veteran", title: "Horde Veteran", desc: "Clear 50 Horde waves", icon: "UsersRound", rarity: "legendary", enabled: true, requirement: req("wave_reach", 50, { mode: "horde" }), rewardCoins: 1e3, rewardGems: 25 },
  { id: "campaign-pathfinder", title: "Campaign Pathfinder", desc: "Clear 100 Campaign waves", icon: "Map", rarity: "epic", enabled: true, requirement: req("waves_cleared", 100, { mode: "campaign" }), rewardCoins: 750, rewardGems: 15 },
  { id: "veteran", title: "Orchard Veteran", desc: "Finish 200 matches", icon: "BadgeCheck", rarity: "legendary", enabled: true, requirement: req("play_games", 200), rewardCoins: 1e3, rewardGems: 25 },
  { id: "pvp-first-win", title: "Siege Victor", desc: "Win a server-verified PvP siege", icon: "Swords", rarity: "common", enabled: true, requirement: req("pvp_win", 1), rewardCoins: 200, rewardGems: 2 },
  { id: "pvp-wallbreaker", title: "Wallbreaker", desc: "Win ten server-verified PvP sieges", icon: "ShieldCheck", rarity: "rare", enabled: true, requirement: req("pvp_win", 10), rewardCoins: 800, rewardGems: 10 },
  { id: "fr-silver", title: "Silver Defender", desc: "Reach Silver on the FR ladder", icon: "Medal", rarity: "rare", enabled: true, requirement: req("pvp_reach_silver", 1500), rewardCoins: 250, rewardGems: 5 },
  { id: "fr-gold", title: "Gold Defender", desc: "Reach Gold on the FR ladder", icon: "Trophy", rarity: "epic", enabled: true, requirement: req("pvp_reach_gold", 2e3), rewardCoins: 500, rewardGems: 10 },
  { id: "fr-diamond", title: "Diamond Defender", desc: "Reach Diamond on the FR ladder", icon: "Diamond", rarity: "legendary", enabled: true, requirement: req("pvp_reach_diamond", 2500), rewardCoins: 900, rewardGems: 20 },
  { id: "fr-emerald", title: "Emerald Defender", desc: "Reach Emerald on the FR ladder", icon: "Gem", rarity: "legendary", enabled: true, requirement: req("reach_emerald", 2750), rewardCoins: 1400, rewardGems: 35 },
  { id: "fr-sapphire", title: "Sapphire Defender", desc: "Reach Sapphire on the FR ladder", icon: "Gem", rarity: "legendary", enabled: true, requirement: req("reach_sapphire", 3e3), rewardCoins: 2200, rewardGems: 60 },
  { id: "pvp-bronze", title: "Bronze Season", desc: "Finish a season in Bronze", icon: "Shield", rarity: "common", enabled: true, requirement: req("pvp_season", 1), rewardCoins: 100 },
  { id: "pvp-silver", title: "Silver Season", desc: "Finish a season in Silver", icon: "Medal", rarity: "rare", enabled: true, requirement: req("pvp_season", 1), rewardCoins: 250, rewardGems: 5 },
  { id: "pvp-gold", title: "Gold Season", desc: "Finish a season in Gold", icon: "Trophy", rarity: "epic", enabled: true, requirement: req("pvp_season", 1), rewardCoins: 500, rewardGems: 10 },
  { id: "pvp-diamond", title: "Diamond Season", desc: "Finish a season in Diamond", icon: "Diamond", rarity: "legendary", enabled: true, requirement: req("pvp_season", 1), rewardCoins: 900, rewardGems: 20 },
  { id: "pvp-emerald", title: "Emerald Season", desc: "Finish a season in Emerald", icon: "Gem", rarity: "legendary", enabled: true, requirement: req("pvp_season", 1), rewardCoins: 1400, rewardGems: 35 },
  { id: "pvp-sapphire", title: "Sapphire Season", desc: "Finish a season in Sapphire", icon: "Gem", rarity: "legendary", enabled: true, requirement: req("pvp_season", 1), rewardCoins: 2200, rewardGems: 60 }
];

// src/game/slicers.ts
var DEFAULT_SLICERS = [
  {
    id: "blade-default",
    name: "Steel Blade",
    blurb: "Reliable starter edge.",
    enabled: true,
    cost: 0,
    sellValue: 0,
    rarity: "common",
    color: "#1d4ed8",
    glowColor: "#38bdf8",
    fxStyle: "solid",
    trailWidth: 1,
    glow: 0.35,
    glint: 0.2,
    damageMul: 1,
    juiceMul: 1,
    brittleBonus: 0
  },
  {
    id: "blade-gold",
    name: "Gold Blade",
    blurb: "Bright trail, richer juice.",
    enabled: true,
    cost: 180,
    sellValue: 60,
    rarity: "rare",
    color: "#f4c430",
    glowColor: "#fde68a",
    fxStyle: "spark",
    trailWidth: 1.25,
    glow: 0.55,
    glint: 0.55,
    damageMul: 1.08,
    juiceMul: 1.15,
    brittleBonus: 0
  },
  {
    id: "blade-ink",
    name: "Ink Blade",
    blurb: "Dark slash with heavy hits.",
    enabled: true,
    cost: 240,
    sellValue: 80,
    rarity: "epic",
    color: "#111827",
    glowColor: "#a78bfa",
    fxStyle: "plasma",
    trailWidth: 1.4,
    glow: 0.65,
    glint: 0.4,
    damageMul: 1.16,
    juiceMul: 1,
    brittleBonus: 0.4
  },
  {
    id: "blade-cherry",
    name: "Cherry Blade",
    blurb: "Pink glints and brittle fruit.",
    enabled: true,
    cost: 320,
    sellValue: 110,
    rarity: "legendary",
    color: "#f472b6",
    glowColor: "#fecdd3",
    fxStyle: "ember",
    trailWidth: 1.55,
    glow: 0.7,
    glint: 0.75,
    damageMul: 1.12,
    juiceMul: 1.2,
    brittleBonus: 0.8
  }
];

// src/game/campaignStory.ts
var DEFAULT_CAMPAIGN_STORIES = [
  { chapter: 1, title: "The First Signal", text: "When the first Rot King falls, the wall radios crackle with a signal that sounds almost like a heartbeat. It is travelling through the orchard roots, and every infected fruit turns toward it. Your crew marks the source and heads beyond the safe lanes." },
  { chapter: 2, title: "Beneath the Rind", text: "A broken irrigation pipe runs under the farms, carrying glowing juice instead of water. The scouts follow it until their lamps reveal fresh tool marks in the soil. Someone kept the system running after the outbreak began." },
  { chapter: 3, title: "Broken Harvest", text: "The growers burn their stores to starve the horde, but the fruit marches straight through the smoke. At dawn you find a crate stamped with the town seal among the ashes. The infection reached the harvest before anyone raised the alarm." },
  { chapter: 4, title: "The Greenhouse", text: "The sealed greenhouse opens from the inside. Rows of fruit hang beneath artificial light, each one wired to the same pulse beneath the ground. A handwritten log ends with one warning: do not let the Crown Seed wake." },
  { chapter: 5, title: "Night Watch", text: "The wall survives its longest night. Beyond the watchfires, whole trees lean together whenever the pulse sounds. The crew sees the orchard for what it is now: a single creature learning to move." },
  { chapter: 6, title: "The Lost Convoy", text: "A supply convoy vanishes on the river road. You recover its radio and hear a final message beneath the static: the water is carrying seeds. With the gate running low on parts, your crew follows the convoy tracks into the marsh." },
  { chapter: 7, title: "River of Pulp", text: "The river glows bright with infected juice. Every splash plants a new enemy on the bank, and the old filters cannot stop it. The only clean route lies upstream, toward the machine that feeds the roots." },
  { chapter: 8, title: "The Orchard Crown", text: "Inside a wrecked pump station lies a crown-shaped seed bearing the growers\u2019 seal. It answers the underground pulse with one of its own. The greenhouse logs name it a control key, but nobody knows who still holds the lock." },
  { chapter: 9, title: "Roots in Stone", text: "The blight crosses the stone road and climbs through the city foundations. Your crew cuts it away room by room while families retreat to the last gate. A map scratched into the root points to the seed vault below the orchard." },
  { chapter: 10, title: "The City Gate", text: "The evacuation begins under a red sky. Your tower holds long enough for the final transport to escape, but the root network wraps around the gate behind them. The city is lost; the people are not." },
  { chapter: 11, title: "The Seed Vault", text: "The vault records reveal an experiment built to grow food through any drought. Its Crown Seed linked every crop to one underground heart. The first test succeeded. Then the heart learned to keep growing without its makers." },
  { chapter: 12, title: "A Second Bloom", text: "The orchard changes its tactics. Rind plates harden around the fallen, runners slip past the old firing lines, and seed pods burst into fresh attackers. Each victory gives the heart another lesson, so your crew begins changing the defense between waves." },
  { chapter: 13, title: "The Silent Farm", text: "No scouts return from the silent farm. Their distress beacon repeats from an empty house, drawing the crew beneath a floor webbed with roots. You find the missing scouts alive, trapped beside a tunnel leading toward the old engine." },
  { chapter: 14, title: "The Old Engine", text: "The pumping engine drives infected juice into every root. Your turrets keep the lane clear while the crew tears out its gears. The pulse stops for one breath, then returns from deeper underground. The engine was only one of its hands." },
  { chapter: 15, title: "The Black Canopy", text: "Branches close over the road until daylight disappears. The wall\u2019s lamps become a trail through the dark, and the horde attacks every light it sees. At the canopy\u2019s center, you find a clean patch of soil guarded by the heaviest fruit yet." },
  { chapter: 16, title: "Last Harvest", text: "The surviving growers join the defense. Their oldest maps show a service path straight to the heartwood, but the path crosses every active root. They bring the last uninfected seeds with them, refusing to leave the land to rot." },
  { chapter: 17, title: "The Heartwood", text: "All the roots meet at a trunk that beats like a machine. The Crown Seed fits a socket at its base and opens the way forward. For the first time, the pulse becomes words: grow, defend, repeat. The heart believes it is saving the orchard." },
  { chapter: 18, title: "The Final Gate", text: "The heart raises a living gate around its core. Each fallen guardian becomes another wave, and the crew must hold the line while the growers break the seal. When it opens, the pulse surges through every lane at once." },
  { chapter: 19, title: "Before Dawn", text: "The last defense is built from repaired steel, salvaged blades, and every seed the growers carried. Nobody promises an easy victory. As the sky begins to pale, your crew steps into the core and gives the wall one final order: hold." },
  { chapter: 20, title: "A New Season", text: "The final overlord falls and the pulse goes quiet. The roots loosen their grip on the wall, leaving a scar across the orchard but no command to follow. In the clean soil beside the gate, the growers plant their first seed. This time, they let it grow on its own." }
];

// src/game/pvp.ts
function route(waypoints) {
  const cells = [];
  for (let i = 0; i < waypoints.length; i++) {
    const [x, y] = waypoints[i];
    const [nextX, nextY] = waypoints[i + 1] ?? [x, y];
    if (!cells.length) cells.push(y * 10 + x);
    if (nextY !== y) {
      const step = Math.sign(nextY - y);
      for (let row = y + step; row !== nextY + step; row += step) cells.push(row * 10 + x);
    } else if (nextX !== x) {
      const step = Math.sign(nextX - x);
      for (let column = x + step; column !== nextX + step; column += step) cells.push(y * 10 + column);
    }
  }
  return cells;
}
function makeMap(id, name, waypoints) {
  const width = 10;
  const height = 14;
  const pathCells = route(waypoints);
  return { id, name, width, height, pathCells, buildCells: Array.from({ length: width * height }, (_, i) => i).filter((cell) => !pathCells.includes(cell)) };
}
var DEFAULT_PVP_CONFIG = {
  version: 1,
  map: makeMap("orchard-crossing", "Orchard Crossing", [[4, 0], [4, 13]]),
  maps: [
    makeMap("orchard-crossing", "Orchard Crossing", [[4, 0], [4, 13]]),
    makeMap("windfall", "Windfall Run", [[1, 0], [1, 3], [8, 3], [8, 6], [2, 6], [2, 9], [7, 9], [7, 13]]),
    makeMap("old-grove", "Old Grove", [[8, 0], [8, 2], [2, 2], [2, 5], [7, 5], [7, 8], [1, 8], [1, 11], [6, 11], [6, 13]]),
    makeMap("riverbend", "Riverbend", [[5, 0], [5, 4], [1, 4], [1, 7], [8, 7], [8, 10], [3, 10], [3, 13]]),
    makeMap("twin-rows", "Twin Rows", [[0, 0], [0, 3], [6, 3], [6, 5], [2, 5], [2, 8], [9, 8], [9, 11], [4, 11], [4, 13]]),
    makeMap("stone-arch", "Stone Arch", [[9, 0], [9, 2], [3, 2], [3, 5], [7, 5], [7, 8], [1, 8], [1, 11], [8, 11], [8, 13]]),
    makeMap("long-harvest", "Long Harvest", [[2, 0], [2, 3], [8, 3], [8, 5], [4, 5], [4, 8], [0, 8], [0, 11], [6, 11], [6, 13]])
  ],
  durationSeconds: 180,
  wallHealth: 1e3,
  startingFruts: 180,
  incomePerSecond: 6,
  reconnectGraceSeconds: 45,
  mainTower: { damage: 18, range: 2, cooldownMs: 1e3 },
  towers: {
    guillotine: { cost: 80, damage: 28, range: 3, cooldownMs: 900 },
    vortex: { cost: 120, damage: 16, range: 4, cooldownMs: 600 },
    laser: { cost: 180, damage: 62, range: 6, cooldownMs: 1600 },
    railgun: { cost: 220, damage: 110, range: 8, cooldownMs: 2600 },
    sprinkler: { cost: 150, damage: 12, range: 3, cooldownMs: 350 },
    blender: { cost: 200, damage: 42, range: 2, cooldownMs: 700 },
    catcher: { cost: 150, damage: 8, range: 3, cooldownMs: 1800 }
  },
  attacks: {
    normal: { cost: 35, health: 100, speed: 2, wallDamage: 25, rewardFruts: 4, packSize: 3 },
    swift: { cost: 55, health: 70, speed: 3, wallDamage: 20, rewardFruts: 5, packSize: 2 },
    armored: { cost: 90, health: 260, speed: 0.65, wallDamage: 60, rewardFruts: 24 },
    explosive: { cost: 100, health: 150, speed: 0.9, wallDamage: 110, rewardFruts: 22 }
  },
  rating: {
    start: 1e3,
    win: 50,
    tie: 20,
    loss: -50,
    bonusCap: 20,
    combo: [{ at: 5, points: 1 }, { at: 10, points: 2 }, { at: 20, points: 3 }, { at: 35, points: 4 }, { at: 50, points: 5 }],
    multiKill3: 2,
    multiKill5: 3,
    seasonResetPercent: 25,
    tiers: [{ name: "Amateur", min: 0 }, { name: "Bronze", min: 500 }, { name: "Silver", min: 1500 }, { name: "Gold", min: 2e3 }, { name: "Diamond", min: 2500 }, { name: "Emerald", min: 2750 }, { name: "Sapphire", min: 3e3 }]
  },
  seasonRewards: [
    { tier: "Bronze", coins: 100, gems: 0, badgeId: "pvp-bronze" },
    { tier: "Silver", coins: 250, gems: 5, badgeId: "pvp-silver" },
    { tier: "Gold", coins: 500, gems: 10, badgeId: "pvp-gold" },
    { tier: "Diamond", coins: 900, gems: 20, badgeId: "pvp-diamond" },
    { tier: "Emerald", coins: 1400, gems: 35, badgeId: "pvp-emerald" },
    { tier: "Sapphire", coins: 2200, gems: 60, badgeId: "pvp-sapphire" }
  ]
};
function normalizePvpMaps(input) {
  if (!Array.isArray(input) || input.length !== 7) return structuredClone(DEFAULT_PVP_CONFIG.maps);
  return input.map((raw, index) => {
    const fallback = DEFAULT_PVP_CONFIG.maps[index];
    if (!raw || typeof raw !== "object") return structuredClone(fallback);
    const row = raw;
    const width = Math.max(3, Math.min(12, Math.floor(Number(row.width) || fallback.width)));
    const height = Math.max(3, Math.min(24, Math.floor(Number(row.height) || fallback.height)));
    const path = Array.isArray(row.pathCells) ? row.pathCells.map(Number) : fallback.pathCells;
    const valid = path.length >= 12 && path.length <= width * height && new Set(path).size === path.length && path.every((cell, i) => Number.isInteger(cell) && cell >= 0 && cell < width * height && (!i || Math.abs(cell % width - path[i - 1] % width) + Math.abs(Math.floor(cell / width) - Math.floor(path[i - 1] / width)) === 1)) && Math.floor(path[0] / width) === 0 && Math.floor(path.at(-1) / width) === height - 1;
    if (!valid) return structuredClone(fallback);
    return { id: String(row.id || fallback.id).slice(0, 48), name: String(row.name || fallback.name).slice(0, 64), width, height, pathCells: path, buildCells: Array.from({ length: width * height }, (_, cell) => cell).filter((cell) => !path.includes(cell)) };
  });
}
function pvpTier(points, config = DEFAULT_PVP_CONFIG) {
  return [...config.rating.tiers].sort((a, b) => a.min - b.min).filter((tier) => points >= tier.min).at(-1)?.name ?? "Amateur";
}
function resetSeasonRating(points, config = DEFAULT_PVP_CONFIG) {
  const retain = 1 - config.rating.seasonResetPercent / 100;
  return Math.max(0, Math.round(config.rating.start + (points - config.rating.start) * retain));
}
var PVP_RALLY = { durationMs: 8e3, cooldownMs: 35e3, openingMs: 15e3, damageMultiplier: 1.25 };
var PVP_CAPTURE_CAPACITY = 3;
function pvpMainUpgradeCost(level = 1) {
  return pvpTowerLevel(level) === 1 ? 220 : 340;
}
function pvpReleaseCost(attackCost, packSize = 1) {
  return Math.max(1, Math.ceil(attackCost / Math.max(1, Math.floor(packSize || 1)) * 0.5));
}
var PVP_MAX_TOWER_LEVEL = 3;
function pvpTowerLevel(level) {
  return Math.max(1, Math.min(PVP_MAX_TOWER_LEVEL, Math.floor(level || 1)));
}
function pvpUpgradeCost(baseCost, level = 1) {
  return Math.ceil(baseCost * (0.6 + 0.3 * pvpTowerLevel(level)));
}
function pvpTowerStats(base, level = 1) {
  const upgrades = pvpTowerLevel(level) - 1;
  return { ...base, damage: Math.round(base.damage * (1 + upgrades * 0.65)), range: base.range + upgrades * 0.5, cooldownMs: Math.round(base.cooldownMs / (1 + upgrades * 0.15)) };
}
function pvpSellRefund(baseCost, level = 1) {
  let spent = baseCost;
  for (let i = 1; i < pvpTowerLevel(level); i++) spent += pvpUpgradeCost(baseCost, i);
  return Math.floor(spent * 0.6);
}
function pvpHexDistance(a, b, width) {
  const axial = (cell) => {
    const r = Math.floor(cell / width);
    return { r, q: cell % width - (r - (r & 1)) / 2 };
  };
  const x = axial(a);
  const y = axial(b);
  const dq = x.q - y.q;
  const dr = x.r - y.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
function calculateArenaRating(points, opponent, outcome, config = DEFAULT_PVP_CONFIG) {
  const expected = 1 / (1 + 10 ** ((opponent - points) / 400));
  const actual = outcome === "win" ? 1 : outcome === "tie" ? 0.5 : 0;
  const change = actual - expected;
  const delta = Math.round(change * (change >= 0 ? config.rating.win : Math.abs(config.rating.loss)) * 2);
  const rating = Math.max(0, points + delta);
  return { outcome, base: delta, performance: 0, delta: rating - points, rating, tier: pvpTier(rating, config) };
}
function createPvpPlayer(userId, name, side, config, now = Date.now()) {
  return { userId, name: name.slice(0, 32), side, mainLevel: 1, wallMaxHealth: config.wallHealth, captured: [], connected: true, disconnectedAt: null, lastSeenAt: now, fruts: config.startingFruts, wallHealth: config.wallHealth, score: 0, maxCombo: 0, currentCombo: 0, lastSlashAt: null, comboMilestones: [], maxSingleSlashKills: 0, sequence: 0, towers: [], attackers: [] };
}
function newPvpMatch(id, queue, players, now = Date.now(), config = DEFAULT_PVP_CONFIG) {
  const mapPool = structuredClone(config.maps);
  players.forEach((player) => {
    player.lastSeenAt = now;
  });
  return { id, queue, status: "draft", createdAt: now, endsAt: 0, players, winnerId: null, resultReason: null, revision: 0, mapPool, vetoTurn: players[Math.floor(Math.random() * 2)].userId, map: null, vetoHistory: [] };
}
function vetoPvpMap(match, userId, mapId, sequence, now = Date.now(), config = DEFAULT_PVP_CONFIG) {
  if (match.status !== "draft") throw new Error("Map veto is already complete");
  const player = match.players.find((item) => item.userId === userId);
  if (!player) throw new Error("Player is not in this match");
  if (match.vetoTurn !== userId) throw new Error("Wait for the other player to veto a path");
  if (sequence !== player.sequence + 1) throw new Error("Invalid or replayed veto");
  if (match.mapPool.length <= 2) throw new Error("Only the final two paths remain");
  if (!match.mapPool.some((item) => item.id === mapId)) throw new Error("That path is no longer available");
  match.mapPool = match.mapPool.filter((item) => item.id !== mapId);
  match.vetoHistory.push({ userId, mapId });
  player.sequence = sequence;
  player.lastSeenAt = now;
  match.revision++;
  if (match.mapPool.length === 2) {
    match.map = structuredClone(match.mapPool[Math.floor(Math.random() * match.mapPool.length)]);
    match.status = "active";
    match.endsAt = now + config.durationSeconds * 1e3;
    match.players.forEach((item) => {
      item.wallHealth = config.wallHealth;
      item.fruts = config.startingFruts;
      item.rallyReadyAt = now + PVP_RALLY.openingMs;
    });
  } else match.vetoTurn = match.players.find((item) => item.userId !== userId).userId;
  return match;
}
function applyPvpCommand(match, userId, command, sequence, now = Date.now(), config = DEFAULT_PVP_CONFIG) {
  if (match.status !== "active") throw new Error("Match is not active");
  if (now >= match.endsAt) throw new Error("Match timer has expired");
  const player = match.players.find((item) => item.userId === userId);
  if (!player) throw new Error("Player is not in this match");
  if (sequence !== player.sequence + 1) throw new Error("Invalid or replayed command sequence");
  if (!player.connected) throw new Error("Player is disconnected");
  if (command.type === "upgrade-main") {
    const level = pvpTowerLevel(player.mainLevel);
    if (level >= PVP_MAX_TOWER_LEVEL) throw new Error("Main tower is fully upgraded");
    const cost = pvpMainUpgradeCost(level);
    if (player.fruts < cost) throw new Error("Not enough match Fruts");
    player.fruts -= cost;
    player.mainLevel = level + 1;
    const extraHealth = config.wallHealth * 0.25;
    player.wallMaxHealth = (player.wallMaxHealth ?? config.wallHealth) + extraHealth;
    player.wallHealth = Math.min(player.wallMaxHealth, player.wallHealth + extraHealth);
  } else if (command.type === "release") {
    const captured = player.captured?.find((item) => item.id === command.capturedId);
    const attack = captured ? config.attacks[captured.type] : null;
    if (!captured || !attack) throw new Error("Choose one of your captured fruit-zombies");
    const cost = pvpReleaseCost(attack.cost, attack.packSize);
    if (player.fruts < cost) throw new Error("Not enough match Fruts");
    const target = match.players.find((item) => item !== player);
    if (target.attackers.length >= 128) throw new Error("The opponent lane is full. Wait for the attack wave.");
    player.fruts -= cost;
    player.captured = player.captured.filter((item) => item !== captured);
    target.attackers.push({ id: `${userId}:${sequence}:released`, type: captured.type, hp: attack.health, maxHp: attack.health, progress: -(match.map ?? config.map).pathCells.length, released: true });
  } else if (command.type === "ability") {
    const { ability, stats } = equippedPower(command.abilityId, player.hero ?? "", player.abilityLoadout, player.abilityRanks);
    if (now < (player.abilityReadyAt?.[ability.id] ?? 0)) throw new Error("That power is cooling down");
    if (player.fruts < stats.cost) throw new Error("Not enough match Fruts");
    const map = match.map ?? config.map;
    const point = (attacker) => {
      const cell = map.pathCells[Math.min(map.pathCells.length - 1, Math.max(0, Math.round(attacker.progress)))] ?? 0;
      return { x: cell % map.width + 0.5, y: Math.floor(cell / map.width) + 0.5, progress: attacker.progress };
    };
    const targets = powerTargets(player.attackers.filter((a) => a.hp > 0), ability, point);
    player.fruts -= stats.cost;
    player.abilityReadyAt ??= {};
    player.abilityReadyAt[ability.id] = now + ability.cooldownMs;
    player.wallHealth = Math.min(player.wallMaxHealth ?? config.wallHealth, player.wallHealth + (player.wallMaxHealth ?? config.wallHealth) * stats.healFraction);
    player.powerCasts = appendPowerCast(player.powerCasts, { id: `${userId}:${sequence}`, abilityId: ability.id, at: now, rank: stats.rank, targets: targets.map(point) });
    for (const attacker of targets) {
      attacker.hp -= stats.damage;
      if (stats.slowMs) {
        attacker.slowUntil = Math.max(attacker.slowUntil ?? 0, now + stats.slowMs);
        attacker.slowMultiplier = stats.slowMultiplier;
      }
    }
    const killed = player.attackers.filter((a) => a.hp <= 0);
    player.score += killed.length * 10;
    player.fruts += killed.reduce((sum, a) => sum + (config.attacks[a.type]?.rewardFruts ?? 0), 0);
    player.attackers = player.attackers.filter((a) => a.hp > 0);
  } else if (command.type === "rally") {
    if (now < (player.rallyReadyAt ?? match.createdAt + PVP_RALLY.openingMs)) throw new Error("Rally is cooling down");
    player.rallyUntil = now + PVP_RALLY.durationMs;
    player.rallyReadyAt = now + PVP_RALLY.cooldownMs;
  } else if (command.type === "build") {
    const tower = config.towers[command.tower];
    const map = match.map ?? config.map;
    const mapSize = map.width * map.height;
    if (!tower || !Number.isInteger(command.cell) || command.cell < 0 || command.cell >= mapSize || !map.buildCells.includes(command.cell)) throw new Error("Invalid tower or build cell");
    if (player.towers.length >= 24 || player.towers.some((item) => item.cell === command.cell)) throw new Error("Build cell is occupied");
    if (player.fruts < tower.cost) throw new Error("Not enough match Fruts");
    player.fruts -= tower.cost;
    player.towers.push({ id: `${player.userId}:${sequence}`, type: command.tower, cell: command.cell, placedAt: now, level: 1 });
  } else if (command.type === "upgrade" || command.type === "sell") {
    const tower = player.towers.find((item) => item.id === command.towerId);
    if (!tower || !config.towers[tower.type]) throw new Error("Select one of your towers");
    const base = config.towers[tower.type];
    const level = pvpTowerLevel(tower.level);
    if (command.type === "upgrade") {
      if (level >= PVP_MAX_TOWER_LEVEL) throw new Error("Tower is fully upgraded");
      const cost = pvpUpgradeCost(base.cost, level);
      if (player.fruts < cost) throw new Error("Not enough match Fruts");
      player.fruts -= cost;
      tower.level = level + 1;
    } else {
      player.fruts += pvpSellRefund(base.cost, level);
      player.towers = player.towers.filter((item) => item !== tower);
    }
  } else if (command.type === "surrender") {
    match.status = "complete";
    match.resultReason = "surrender";
    match.winnerId = match.players.find((item) => item !== player).userId;
  } else if (command.type === "send") {
    const attack = config.attacks[command.enemy];
    if (!attack) throw new Error("Invalid fruit-zombie type");
    if (player.fruts < attack.cost) throw new Error("Not enough match Fruts");
    const target = match.players.find((item) => item.userId !== userId);
    const count = Math.max(1, Math.min(8, Math.floor(attack.packSize || 1)));
    if (target.attackers.length + count > 128) throw new Error("The opponent lane is full. Wait for the attack wave.");
    player.fruts -= attack.cost;
    for (let i = 0; i < count; i++) target.attackers.push({ id: `${userId}:${sequence}:${i}`, type: command.enemy, hp: attack.health, maxHp: attack.health, progress: -(match.map ?? config.map).pathCells.length - i * 0.8 });
  } else if (command.type === "slash") {
    throw new Error("Slicing is disabled in Arena. Build towers to defend.");
  } else throw new Error("Unknown match action");
  player.sequence = sequence;
  player.lastSeenAt = now;
  match.revision++;
  return match;
}
function advancePvpMatch(match, elapsedSeconds, now = Date.now(), config = DEFAULT_PVP_CONFIG) {
  if (match.status !== "active") return match;
  const dt = Math.max(0, Math.min(1, elapsedSeconds));
  const map = match.map ?? config.map;
  const path = map.pathCells;
  const before = /* @__PURE__ */ new Map();
  for (const player of match.players) {
    player.fruts += config.incomePerSecond * dt;
    for (const unit2 of player.attackers) {
      before.set(unit2.id, unit2.progress);
      unit2.fighting = false;
      delete unit2.fightTargetId;
      if (unit2.hp <= 0) continue;
      const cell = path[Math.max(0, Math.min(path.length - 1, Math.floor(unit2.progress)))];
      const slowed = unit2.progress >= 0 && player.towers.some((tower) => tower.type === "vortex" && pvpHexDistance(tower.cell, cell, map.width) <= pvpTowerStats(config.towers.vortex, tower.level).range);
      unit2.progress += config.attacks[unit2.type].speed * dt * Math.max(1, (path.length - 1) / 13) * Math.min(slowed ? 0.6 : 1, now < (unit2.slowUntil ?? 0) ? unit2.slowMultiplier ?? 0.45 : 1);
    }
  }
  const [a, b] = match.players;
  const reach = 0.8;
  const pairs = a.attackers.filter((u) => u.hp > 0 && u.progress >= -path.length).flatMap((left) => b.attackers.filter((u) => u.hp > 0 && u.progress >= -path.length).map((right) => ({ left, right, distance: Math.abs(left.progress + right.progress + 1) }))).sort((x, y) => x.distance - y.distance);
  for (const { left, right } of pairs) {
    const oldLeft = before.get(left.id), oldRight = before.get(right.id);
    const oldSum = oldLeft + oldRight + 1, newSum = left.progress + right.progress + 1;
    if (oldSum <= -reach && newSum >= -reach) {
      const movement = left.progress - oldLeft + (right.progress - oldRight);
      const fraction = movement > 0 ? Math.max(0, Math.min(1, (-reach - oldSum) / movement)) : 0;
      left.progress = oldLeft + (left.progress - oldLeft) * fraction;
      right.progress = oldRight + (right.progress - oldRight) * fraction;
    } else if (Math.abs(oldSum) <= reach && Math.abs(newSum) <= reach + 10) {
      left.progress = oldLeft;
      right.progress = oldRight;
    }
  }
  const damage = /* @__PURE__ */ new Map();
  for (const [team, enemy] of [[a, b], [b, a]]) for (const unit2 of team.attackers.filter((u) => u.hp > 0 && u.progress >= -path.length)) {
    const target = enemy.attackers.filter((u) => u.hp > 0 && u.progress >= -path.length && Math.abs(unit2.progress + u.progress + 1) <= reach + 1e-4).sort((x, y) => Math.abs(unit2.progress + x.progress + 1) - Math.abs(unit2.progress + y.progress + 1) || x.id.localeCompare(y.id))[0];
    if (!target) continue;
    unit2.fighting = true;
    unit2.fightTargetId = target.id;
    unit2.lastClashAt = Math.floor(now / 300) * 300;
    const hit = config.attacks[unit2.type].wallDamage * 0.45 * dt * (now < (enemy.rallyUntil ?? 0) ? PVP_RALLY.damageMultiplier : 1);
    damage.set(target.id, (damage.get(target.id) ?? 0) + hit);
  }
  for (const player of match.players) for (const unit2 of player.attackers) unit2.hp -= damage.get(unit2.id) ?? 0;
  for (const player of match.players) {
    const shoot = (cell, stats, lastFiredAt, type = "main", level = 1) => {
      if (now - lastFiredAt < stats.cooldownMs) return false;
      const target = [...player.attackers].filter((attacker) => {
        const pathCell = path[Math.max(0, Math.min(path.length - 1, Math.floor(attacker.progress)))];
        return attacker.progress >= 0 && attacker.hp > 0 && pvpHexDistance(pathCell, cell, map.width) <= stats.range;
      }).sort((a2, b2) => b2.progress - a2.progress)[0];
      if (!target) return false;
      if (type === "catcher" && !target.released && target.hp <= (target.maxHp ?? config.attacks[target.type].health) * (0.3 + (pvpTowerLevel(level) - 1) * 0.1) && (player.captured?.length ?? 0) < PVP_CAPTURE_CAPACITY) {
        player.captured ??= [];
        player.captured.push({ id: `captured:${target.id}`, type: target.type });
        player.attackers = player.attackers.filter((item) => item !== target);
        return true;
      }
      const hit = (attacker, mul = 1) => {
        attacker.hp -= Math.round(stats.damage * mul * (now < (player.rallyUntil ?? 0) ? PVP_RALLY.damageMultiplier : 1) * (attacker.type === "armored" && type !== "laser" && type !== "railgun" ? 0.55 : 1));
      };
      hit(target);
      if (type === "sprinkler" || type === "blender") {
        const targetCell = path[Math.floor(Math.max(0, Math.min(path.length - 1, target.progress)))];
        const nearby = player.attackers.filter((item) => item !== target && item.hp > 0 && item.progress >= 0 && pvpHexDistance(path[Math.floor(Math.min(path.length - 1, item.progress))], targetCell, map.width) <= 1).slice(0, type === "blender" ? 3 : 2);
        for (const item of nearby) hit(item, type === "blender" ? 1 : 0.65);
      }
      return true;
    };
    for (const tower of player.towers) {
      const stats = config.towers[tower.type];
      if (stats && shoot(tower.cell, pvpTowerStats(stats, tower.level), tower.lastFiredAt ?? tower.placedAt, tower.type, pvpTowerLevel(tower.level))) tower.lastFiredAt = now;
    }
    if (shoot(path.at(-1), pvpTowerStats({ cost: 0, ...config.mainTower }, player.mainLevel), player.mainLastFiredAt ?? 0)) player.mainLastFiredAt = now;
    for (const attacker of [...player.attackers]) {
      if (attacker.hp <= 0) {
        player.attackers = player.attackers.filter((item) => item.id !== attacker.id);
        player.score += 10;
        player.fruts += config.attacks[attacker.type].rewardFruts;
      } else if (attacker.progress >= path.length - 1) {
        attacker.progress = path.length - 1;
        attacker.attackingTower = true;
        if (now - (attacker.lastTowerHitAt ?? 0) >= 1e3) {
          player.wallHealth = Math.max(0, player.wallHealth - config.attacks[attacker.type].wallDamage);
          attacker.lastTowerHitAt = now;
        }
      }
    }
  }
  const dead = match.players.find((player) => player.wallHealth <= 0);
  if (dead) {
    match.status = "complete";
    match.winnerId = match.players.every((player) => player.wallHealth <= 0) ? null : match.players.find((player) => player !== dead).userId;
    match.resultReason = "wall";
  } else if (match.players.some((player) => player.connected && now - player.lastSeenAt >= config.reconnectGraceSeconds * 1e3)) {
    for (const player of match.players) if (player.connected && now - player.lastSeenAt >= config.reconnectGraceSeconds * 1e3) {
      player.connected = false;
      player.disconnectedAt = player.lastSeenAt;
    }
    const forfeiter = match.players.find((player) => !player.connected);
    match.status = "complete";
    match.winnerId = match.players.find((player) => player !== forfeiter)?.userId ?? null;
    match.resultReason = "disconnect";
  } else if (match.players.some((player) => player.disconnectedAt !== null && now - player.disconnectedAt >= config.reconnectGraceSeconds * 1e3)) {
    match.status = "complete";
    match.winnerId = match.players.find((player) => player.connected)?.userId ?? null;
    match.resultReason = "disconnect";
  } else if (now >= match.endsAt) {
    match.status = "complete";
    match.resultReason = "timeout";
    const [a2, b2] = match.players;
    const aHealth = a2.wallHealth / (a2.wallMaxHealth ?? config.wallHealth);
    const bHealth = b2.wallHealth / (b2.wallMaxHealth ?? config.wallHealth);
    match.winnerId = Math.abs(aHealth - bHealth) < 1e-6 ? null : aHealth > bHealth ? a2.userId : b2.userId;
  }
  match.revision++;
  return match;
}

// src/services/admin.ts
var DEFAULT_ADMIN_CONFIG = {
  configKey: "game_config",
  dailyRewards: [
    { day: 1, coins: 50, skillPoints: 0, gems: 5, label: "50 Coins + 5 Gems", iconType: "coin" },
    { day: 2, coins: 100, skillPoints: 1, gems: 10, label: "100 Coins + 1 SP + 10 Gems", iconType: "gem" },
    { day: 3, coins: 150, skillPoints: 0, gems: 15, label: "150 Coins + 15 Gems", iconType: "coin" },
    { day: 4, coins: 200, skillPoints: 0, gems: 20, label: "200 Coins + 20 Gems", iconType: "coin" },
    { day: 5, coins: 300, skillPoints: 2, gems: 25, label: "300 Coins + 2 SP + 25 Gems", iconType: "gem" },
    { day: 6, coins: 450, skillPoints: 0, gems: 30, label: "450 Coins + 30 Gems", iconType: "chest" },
    { day: 7, coins: 1e3, skillPoints: 2, gems: 50, skinUnlock: "blade-gold", label: "1,000 Coins + Gold Blade + 50 Gems!", iconType: "blade" }
  ],
  vipTiers: [
    { tier: "bronze", title: "Bronze VIP", price: 500, coinBonus: 10, xpBonus: 5, dailyCoins: 25, dailySp: 0, exclusiveSkins: [], description: "+10% coins, +5% XP, 25 daily coins" },
    { tier: "silver", title: "Silver VIP", price: 1500, coinBonus: 25, xpBonus: 15, dailyCoins: 75, dailySp: 1, exclusiveSkins: ["blade-silver-vip"], description: "+25% coins, +15% XP, 75 daily coins + 1 SP" },
    { tier: "gold", title: "Gold VIP", price: 5e3, coinBonus: 50, xpBonus: 30, dailyCoins: 200, dailySp: 2, exclusiveSkins: ["blade-gold-vip", "wall-gold-vip"], description: "+50% coins, +30% XP, 200 daily coins + 2 SP, exclusive skins" }
  ],
  menuConfig: {
    eyebrow: "FRUIT TD \xB7 HOLD THE WALL",
    title: "Slice.\nHold the Wall.",
    subtitle: "Chem flooded the world with fruit. Then the fruit woke up. Build towers. Defend the wall.",
    announcement: "WALL BRIEFING: Daily supply drop is live. Ranked ladder is hot. Guest assist ready in Co-op.",
    themeColor: "#ffca28",
    backgroundImage: "",
    logoImage: "",
    faviconImage: ""
  },
  landscapeConfig: {
    locationName: "Fallen Orchard",
    skyColor: "#4a5f3e",
    outerGroundColor: "#5a8a42",
    groundColor: "#6fa052",
    groundGlowColor: "#2a3a1f",
    foliageColor: "#3d8b3a",
    ambientLight: 0.92,
    sunLight: 0.85,
    foliageEnabled: true
  },
  gameplayConfig: {
    startMoney: 140,
    startLives: 15,
    scoreMultiplier: 1,
    superChargeMultiplier: 1
  },
  pvpConfig: structuredClone(DEFAULT_PVP_CONFIG),
  missions: DEFAULT_MISSIONS,
  achievements: DEFAULT_ACHIEVEMENTS,
  badges: DEFAULT_BADGES,
  ranks: DEFAULT_RANK_TIERS,
  slicers: DEFAULT_SLICERS,
  enemies: [],
  waves: { version: 1, levels: {} },
  campaignBosses: [],
  campaignStories: structuredClone(DEFAULT_CAMPAIGN_STORIES)
};
function mergeAdminConfig(raw) {
  const src = raw || {};
  return {
    ...DEFAULT_ADMIN_CONFIG,
    ...src,
    dailyRewards: Array.isArray(src.dailyRewards) && src.dailyRewards.length === 7 ? src.dailyRewards : DEFAULT_ADMIN_CONFIG.dailyRewards,
    vipTiers: Array.isArray(src.vipTiers) && src.vipTiers.length === 3 ? src.vipTiers : DEFAULT_ADMIN_CONFIG.vipTiers,
    menuConfig: { ...DEFAULT_ADMIN_CONFIG.menuConfig, ...src.menuConfig || {} },
    landscapeConfig: { ...DEFAULT_ADMIN_CONFIG.landscapeConfig, ...src.landscapeConfig || {} },
    gameplayConfig: { ...DEFAULT_ADMIN_CONFIG.gameplayConfig, ...src.gameplayConfig || {} },
    coopConfig: normalizeCoopConfig(src.coopConfig),
    pvpConfig: mergePvpConfig(src.pvpConfig),
    creatorMedia: normalizeCreatorMedia(src.creatorMedia),
    coopCatalogVersion: 1,
    // A present catalogue is authoritative: Admin must be able to remove an entry
    // without the defaults silently restoring it on the next load.
    missions: structuredClone(Array.isArray(src.missions) ? src.missions : DEFAULT_ADMIN_CONFIG.missions),
    achievements: structuredClone(migrateCoopCatalog(Array.isArray(src.achievements) ? src.achievements : DEFAULT_ADMIN_CONFIG.achievements, DEFAULT_ACHIEVEMENTS, src.coopCatalogVersion)),
    badges: structuredClone(migrateCoopCatalog(Array.isArray(src.badges) ? src.badges : DEFAULT_ADMIN_CONFIG.badges, DEFAULT_BADGES, src.coopCatalogVersion)),
    ranks: mergeRewardDefaults(structuredClone(Array.isArray(src.ranks) && src.ranks.length ? src.ranks : DEFAULT_ADMIN_CONFIG.ranks), DEFAULT_ADMIN_CONFIG.ranks),
    slicers: structuredClone(Array.isArray(src.slicers) && src.slicers.length ? src.slicers : DEFAULT_ADMIN_CONFIG.slicers),
    enemies: structuredClone(Array.isArray(src.enemies) && src.enemies.length ? src.enemies : DEFAULT_ADMIN_CONFIG.enemies),
    waves: src.waves && typeof src.waves === "object" ? structuredClone(src.waves) : structuredClone(DEFAULT_ADMIN_CONFIG.waves),
    campaignBosses: Array.isArray(src.campaignBosses) ? structuredClone(src.campaignBosses.slice(0, 100)) : [],
    campaignStories: Array.isArray(src.campaignStories) && src.campaignStories.length === 20 ? structuredClone(src.campaignStories) : structuredClone(DEFAULT_CAMPAIGN_STORIES)
  };
}
function mergePvpConfig(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const bounded = (n, fallback, min, max) => Number.isFinite(Number(n)) ? Math.max(min, Math.min(max, Number(n))) : fallback;
  const maps = normalizePvpMaps(value.maps);
  const towers = { ...DEFAULT_PVP_CONFIG.towers };
  for (const [id, fallback] of Object.entries(towers)) {
    const row = value.towers?.[id];
    if (row) towers[id] = { cost: bounded(row.cost, fallback.cost, 1, 1e4), damage: bounded(row.damage, fallback.damage, 1, 1e4), range: bounded(row.range, fallback.range, 1, 24), cooldownMs: bounded(row.cooldownMs, fallback.cooldownMs, 100, 6e4) };
  }
  const attacks = { ...DEFAULT_PVP_CONFIG.attacks };
  for (const [id, fallback] of Object.entries(attacks)) {
    const row = value.attacks?.[id];
    if (row) attacks[id] = { cost: bounded(row.cost, fallback.cost, 1, 1e4), health: bounded(row.health, fallback.health, 1, 1e4), speed: bounded(row.speed, fallback.speed, 0.1, 10), wallDamage: bounded(row.wallDamage, fallback.wallDamage, 1, 1e4), rewardFruts: bounded(row.rewardFruts, fallback.rewardFruts, 0, 1e4), packSize: Math.floor(bounded(row.packSize, fallback.packSize || 1, 1, 8)) };
  }
  const tiers = Array.isArray(value.rating?.tiers) ? value.rating.tiers.slice(0, 7) : DEFAULT_PVP_CONFIG.rating.tiers;
  return {
    version: 1,
    maps,
    map: maps[0],
    durationSeconds: bounded(value.durationSeconds, DEFAULT_PVP_CONFIG.durationSeconds, 60, 600),
    wallHealth: bounded(value.wallHealth, DEFAULT_PVP_CONFIG.wallHealth, 100, 1e5),
    startingFruts: bounded(value.startingFruts, DEFAULT_PVP_CONFIG.startingFruts, 0, 1e5),
    incomePerSecond: bounded(value.incomePerSecond, DEFAULT_PVP_CONFIG.incomePerSecond, 0, 1e3),
    reconnectGraceSeconds: bounded(value.reconnectGraceSeconds, DEFAULT_PVP_CONFIG.reconnectGraceSeconds, 10, 300),
    mainTower: {
      damage: bounded(value.mainTower?.damage, DEFAULT_PVP_CONFIG.mainTower.damage, 0, 1e4),
      range: bounded(value.mainTower?.range, DEFAULT_PVP_CONFIG.mainTower.range, 0, 24),
      cooldownMs: bounded(value.mainTower?.cooldownMs, DEFAULT_PVP_CONFIG.mainTower.cooldownMs, 100, 6e4)
    },
    towers,
    attacks,
    rating: {
      ...DEFAULT_PVP_CONFIG.rating,
      ...value.rating || {},
      start: bounded(value.rating?.start, 1e3, 0, 1e6),
      win: bounded(value.rating?.win, 50, 0, 1e3),
      tie: bounded(value.rating?.tie, 20, 0, 1e3),
      loss: -bounded(Math.abs(value.rating?.loss ?? -50), 50, 1, 1e3),
      bonusCap: bounded(value.rating?.bonusCap, 20, 0, 1e3),
      seasonResetPercent: bounded(value.rating?.seasonResetPercent, 25, 0, 100),
      combo: DEFAULT_PVP_CONFIG.rating.combo,
      tiers: tiers.map((tier, i) => ({ name: DEFAULT_PVP_CONFIG.rating.tiers[i].name, min: bounded(tier?.min, DEFAULT_PVP_CONFIG.rating.tiers[i].min, 0, 1e6) }))
    },
    seasonRewards: DEFAULT_PVP_CONFIG.seasonRewards.map((item, i) => ({ ...item, ...value.seasonRewards?.[i] || {}, tier: item.tier }))
  };
}

// server/notifications.ts
import { randomUUID } from "node:crypto";
async function saveNotification(source, input) {
  try {
    const collection = typeof source === "function" ? await source() : source;
    await collection.insertOne({
      notificationId: randomUUID(),
      userId: input.userId,
      actorId: input.actorId ?? "system",
      actorName: input.actorName ?? "Fruit TD",
      type: input.type,
      title: input.title.slice(0, 100),
      body: input.body.slice(0, 240),
      ...input.eventKey ? { eventKey: input.eventKey } : {},
      createdAt: /* @__PURE__ */ new Date()
    });
  } catch (error2) {
    if (error2?.code !== 11e3) console.error("Could not save notification:", error2);
  }
}

// server/routes/coop.ts
function createCoopService(deps = {}) {
  const getCollection2 = deps.collection ?? getCollection;
  const resolveRequestUser2 = deps.resolveUser ?? resolveRequestUser;
  const creditClaimReward2 = deps.creditReward ?? creditClaimReward;
  const coopRouter2 = Router();
  let publisher = null;
  let authority = null;
  let ticking = false;
  const fail2 = (res, code, error2) => res.status(code).json({ success: false, error: error2 });
  async function config() {
    const row = await (await getCollection2("admin_config")).findOne({ configKey: "game_config" });
    const balance = mergeAdminConfig(row).pvpConfig;
    delete balance.towers.catcher;
    return { balance, coop: normalizeCoopConfig(row?.coopConfig) };
  }
  async function publish(room) {
    try {
      if (deps.publish) {
        await deps.publish(`fruittd-coop-${room.id}`, room);
        return;
      }
      if (!process.env.ABLY_API_KEY) return;
      publisher ??= new Rest({ key: process.env.ABLY_API_KEY });
      await publisher.channels.get(`fruittd-coop-${room.id}`).publish("match.snapshot", room);
    } catch (error2) {
      console.error("Co-op publish failed", error2);
    }
  }
  async function settle(room) {
    if (room.status !== "complete" || room.settled) return;
    const cfg = await config();
    const reward = coopRewards(room, cfg.coop);
    for (const player2 of room.players) {
      if (room.completedWaves < 1) continue;
      await creditClaimReward2(player2.userId, "coop:" + room.id, { coins: reward.coins, gems: reward.gems, xp: { [player2.hero]: reward.xp }, towerXp: reward.towerXp, games: 1, bestWave: room.completedWaves, highScore: room.score });
      const board = await getCollection2("leaderboards");
      const record = { userId: player2.userId, nickname: player2.name, avatar: "", hero: player2.hero, mode: "coop", score: room.score, wave: room.completedWaves, fruitsSliced: room.kills, maxCombo: 0, createdAt: /* @__PURE__ */ new Date() };
      await board.updateOne({ userId: player2.userId, mode: "coop" }, { $setOnInsert: record }, { upsert: true });
      await board.updateOne({ userId: player2.userId, mode: "coop", $or: [{ score: { $lt: room.score } }, { score: room.score, wave: { $lt: room.completedWaves } }] }, { $set: record });
      await saveNotification(() => getCollection2("notifications"), { userId: player2.userId, type: "coop_result", title: "Co-op run finished", body: room.completedWaves + " waves \xB7 " + reward.coins + " coins \xB7 " + reward.gems + " gems", eventKey: "coop-result:" + player2.userId + ":" + room.id });
      if (room.completedWaves >= 6) {
        const achievements = await getCollection2("achievements");
        const achievement = await achievements.findOne({ userId: player2.userId, achievementId: "coop_first_team_run" });
        await achievements.updateOne({ userId: player2.userId, achievementId: "coop_first_team_run" }, { $set: { unlocked: true, unlockedAt: achievement?.unlockedAt || /* @__PURE__ */ new Date(), progress: 1, maxProgress: 1 }, $setOnInsert: { claimed: false } }, { upsert: true });
        if (!achievement?.unlocked) await saveNotification(() => getCollection2("notifications"), { userId: player2.userId, type: "achievement_unlocked", title: "Achievement unlocked", body: "Co-op Team Slicer \xB7 Claim your achievement reward.", eventKey: "achievement-unlocked:" + player2.userId + ":coop_first_team_run" });
        const badges = await getCollection2("badges");
        const badge = await badges.findOne({ userId: player2.userId, badgeId: "coop-team-slicer" });
        await badges.updateOne({ userId: player2.userId, badgeId: "coop-team-slicer" }, { $set: { unlocked: true, unlockedAt: badge?.unlockedAt || /* @__PURE__ */ new Date(), progress: 1, maxProgress: 1 } }, { upsert: true });
        if (!badge?.unlocked) await saveNotification(() => getCollection2("notifications"), { userId: player2.userId, type: "badge_unlocked", title: "Badge unlocked", body: "Co-op Team Slicer badge added to your collection.", eventKey: "badge-unlocked:" + player2.userId + ":coop-team-slicer" });
      }
    }
    await (await getCollection2("coop_matches")).updateOne({ id: room.id }, { $set: { settled: true } });
    room.settled = true;
  }
  async function tick(room, now) {
    if (room.status === "complete") return room;
    const cfg = await config();
    const revision = room.revision;
    if (room.status === "waiting") {
      if (now - room.players[0].lastSeenAt <= cfg.balance.reconnectGraceSeconds * 1e3) return room;
      room.status = "complete";
      room.reason = "disconnect";
      room.revision++;
    }
    let remaining = Math.min(2, Math.max(0, (now - room.updatedAt.getTime()) / 1e3));
    let at = now - remaining * 1e3;
    while (remaining > 0 && room.status !== "complete") {
      const dt = Math.min(0.2, remaining);
      at += dt * 1e3;
      advanceCoopMatch(room, dt, at, cfg.balance, cfg.coop);
      remaining -= dt;
    }
    room.updatedAt = new Date(now);
    if (room.status === "complete") delete room.activePlayers;
    const saved = await (await getCollection2("coop_matches")).replaceOne({ id: room.id, revision }, room);
    if (!saved.modifiedCount) return null;
    void publish(room);
    if (room.status === "complete") await settle(room);
    return room;
  }
  async function player(user) {
    const save = await (await getCollection2("cloud_saves")).findOne({ userId: user.userId });
    const data = save?.saveData ?? {};
    const hero = data.hero;
    const validHero = HEROES.some((h) => h.id === hero) ? hero : "jiju";
    const loadout = Array.isArray(data.heroAbilityLoadouts?.[validHero]) ? data.heroAbilityLoadouts[validHero].filter((id) => heroAbility(id)?.hero === validHero).slice(0, 3) : validHero === "jiju" ? ["jiju-1"] : [];
    return { userId: user.userId, name: String(user.nickname || "Slicer").slice(0, 64), hero: validHero, abilityLoadout: loadout, abilityRanks: data.heroAbilityRanks ?? {}, abilityReadyAt: {}, sequence: 0, lastSeenAt: Date.now(), lastSlashAt: 0, kills: 0 };
  }
  coopRouter2.get("/status", async (req2, res) => {
    const user = await resolveRequestUser2(req2);
    if (!user) return fail2(res, 401, "Sign in to play online Co-op.");
    try {
      const rooms = await getCollection2("coop_matches");
      let room = await rooms.findOne({ "players.userId": user.userId, expiresAt: { $gt: /* @__PURE__ */ new Date() }, $or: [{ status: { $ne: "complete" } }, { status: "complete", seenBy: { $ne: user.userId } }] });
      if (room) {
        await rooms.updateOne({ id: room.id }, { $set: { "players.$[self].lastSeenAt": Date.now() }, $inc: { revision: 1 } }, { arrayFilters: [{ "self.userId": user.userId }] });
        room = await rooms.findOne({ id: room.id });
        if (room) {
          await tick(room, Date.now());
          room = await rooms.findOne({ id: room.id });
          if (room?.status === "complete") await settle(room);
        }
      }
      const cfg = await config();
      res.json({ success: true, room, balance: cfg.balance, coop: cfg.coop, yourId: user.userId });
    } catch (error2) {
      console.error("Co-op status failed", error2);
      fail2(res, 503, "Co-op storage is unavailable.");
    }
  });
  coopRouter2.post("/create", async (req2, res) => {
    const user = await resolveRequestUser2(req2);
    if (!user) return fail2(res, 401, "Sign in first.");
    try {
      await (await getCollection2("coop_matches")).updateOne({ activePlayers: user.userId, expiresAt: { $lte: /* @__PURE__ */ new Date() } }, { $unset: { activePlayers: "" }, $set: { status: "complete", reason: "expired" } });
      const rooms = await getCollection2("coop_matches");
      const existing = await rooms.findOne({ "players.userId": user.userId, status: { $ne: "complete" }, expiresAt: { $gt: /* @__PURE__ */ new Date() } });
      if (existing) return fail2(res, 409, "Leave your current room first.");
      const cfg = await config();
      const self = await player(user);
      if (req2.body?.public === true) {
        const open = await rooms.findOne({ public: true, status: "waiting", "players.0.lastSeenAt": { $gt: Date.now() - cfg.balance.reconnectGraceSeconds * 1e3 }, "players.userId": { $ne: user.userId }, expiresAt: { $gt: /* @__PURE__ */ new Date() } });
        if (open) {
          const revision = open.revision;
          joinCoopMatch(open, self, Date.now());
          open.activePlayers = open.players.map((p) => p.userId);
          open.updatedAt = /* @__PURE__ */ new Date();
          const updated = await rooms.replaceOne({ id: open.id, revision, status: "waiting" }, open);
          if (updated.modifiedCount) {
            void publish(open);
            return res.json({ success: true, room: open });
          }
        }
      }
      const room = { ...newCoopMatch(randomUUID2().replace(/-/g, "").slice(0, 10), self, cfg.balance), public: req2.body?.public === true, activePlayers: [user.userId], updatedAt: /* @__PURE__ */ new Date(), expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1e3) };
      await rooms.insertOne(room);
      res.json({ success: true, room });
    } catch (error2) {
      if (error2.code === 11e3) return fail2(res, 409, "You already have an active Co-op room.");
      console.error("Co-op room creation failed", error2);
      fail2(res, 503, "Could not create the room.");
    }
  });
  coopRouter2.post("/join", async (req2, res) => {
    const user = await resolveRequestUser2(req2);
    if (!user) return fail2(res, 401, "Sign in first.");
    try {
      await (await getCollection2("coop_matches")).updateOne({ activePlayers: user.userId, expiresAt: { $lte: /* @__PURE__ */ new Date() } }, { $unset: { activePlayers: "" }, $set: { status: "complete", reason: "expired" } });
      const rooms = await getCollection2("coop_matches");
      if (await rooms.findOne({ "players.userId": user.userId, status: { $ne: "complete" }, expiresAt: { $gt: /* @__PURE__ */ new Date() } })) return fail2(res, 409, "Leave your current room first.");
      const id = String(req2.body?.code || "").trim().toLowerCase();
      if (!/^[a-f0-9]{10}$/.test(id)) return fail2(res, 400, "Enter the 10-character room code.");
      const room = await rooms.findOne({ id, status: "waiting", expiresAt: { $gt: /* @__PURE__ */ new Date() } });
      if (!room) return fail2(res, 404, "Room is full or no longer available.");
      const revision = room.revision;
      joinCoopMatch(room, await player(user), Date.now());
      room.activePlayers = room.players.map((p) => p.userId);
      room.updatedAt = /* @__PURE__ */ new Date();
      const saved = await rooms.replaceOne({ id, revision, status: "waiting" }, room);
      if (!saved.modifiedCount) return fail2(res, 409, "Another player joined this room.");
      void publish(room);
      res.json({ success: true, room });
    } catch (error2) {
      if (error2.code === 11e3) return fail2(res, 409, "You already have an active Co-op room.");
      console.error("Co-op join failed", error2);
      fail2(res, 503, "Could not join the room.");
    }
  });
  coopRouter2.post("/:id/invite", async (req2, res) => {
    const user = await resolveRequestUser2(req2);
    if (!user) return fail2(res, 401, "Sign in first.");
    try {
      const username = typeof req2.body?.username === "string" ? req2.body.username.trim() : "";
      if (!/^[a-z0-9_]{3,24}$/i.test(username)) return fail2(res, 400, "Enter a valid friend username.");
      const rooms = await getCollection2("coop_matches");
      const room = await rooms.findOne({ id: req2.params.id, status: "waiting", "players.userId": user.userId, expiresAt: { $gt: /* @__PURE__ */ new Date() } });
      if (!room) return fail2(res, 404, "Your waiting room is no longer available.");
      const friend = await (await getCollection2("users")).findOne({ username: { $regex: "^" + username + "$", $options: "i" } });
      if (!friend || friend.userId === user.userId) return fail2(res, 404, "Friend not found.");
      const relation = await (await getCollection2("friends")).findOne({ $or: [{ userId: user.userId, friendId: friend.userId, state: "accepted" }, { userId: friend.userId, friendId: user.userId, state: "accepted" }] });
      if (!relation) return fail2(res, 403, "Co-op invites are available to accepted friends only.");
      await saveNotification(() => getCollection2("notifications"), { userId: friend.userId, actorId: user.userId, actorName: String(user.username || user.nickname || "Slicer").slice(0, 32), type: "coop_invite", title: "Co-op room invitation", body: "Join " + String(user.username || user.nickname || "your friend") + " in Co-op with code " + room.id.toUpperCase() + "." });
      res.json({ success: true, username: String(friend.username || username) });
    } catch (error2) {
      console.error("Co-op invite failed", error2);
      fail2(res, 503, "Could not send Co-op invite.");
    }
  });
  coopRouter2.post("/:id/command", async (req2, res) => {
    const user = await resolveRequestUser2(req2);
    if (!user) return fail2(res, 401, "Sign in first.");
    try {
      const rooms = await getCollection2("coop_matches");
      const room = await rooms.findOne({ id: req2.params.id, "players.userId": user.userId, expiresAt: { $gt: /* @__PURE__ */ new Date() } });
      if (!room) return fail2(res, 404, "Room is unavailable.");
      if (room.status === "complete") return fail2(res, 409, "Match has finished.");
      const cfg = await config();
      const revision = room.revision;
      try {
        applyCoopCommand(room, user.userId, req2.body.sequence, req2.body.command, Date.now(), cfg.balance, cfg.coop);
      } catch (error2) {
        return fail2(res, 400, error2 instanceof Error ? error2.message : "Invalid action.");
      }
      if (room.status === "complete") delete room.activePlayers;
      const saved = await rooms.replaceOne({ id: room.id, revision }, room);
      if (!saved.modifiedCount) return fail2(res, 409, "Match updated. Try the action again.");
      void publish(room);
      await settle(room);
      res.json({ success: true, room });
    } catch (error2) {
      console.error("Co-op command failed", error2);
      fail2(res, 503, "Could not apply the action.");
    }
  });
  coopRouter2.post("/:id/ack", async (req2, res) => {
    const user = await resolveRequestUser2(req2);
    if (!user) return fail2(res, 401, "Sign in first.");
    await (await getCollection2("coop_matches")).updateOne({ id: req2.params.id, status: "complete", "players.userId": user.userId }, { $addToSet: { seenBy: user.userId } });
    res.json({ success: true });
  });
  coopRouter2.post("/:id/token", async (req2, res) => {
    const user = await resolveRequestUser2(req2);
    if (!user) return fail2(res, 401, "Sign in first.");
    const room = await (await getCollection2("coop_matches")).findOne({ id: req2.params.id, "players.userId": user.userId, status: { $ne: "complete" }, expiresAt: { $gt: /* @__PURE__ */ new Date() } });
    if (!room) return fail2(res, 404, "Room unavailable.");
    if (!process.env.ABLY_API_KEY && !deps.token) return fail2(res, 503, "Realtime service is not configured.");
    try {
      const params = { clientId: user.userId, ttl: 6e4, capability: JSON.stringify({ [`fruittd-coop-${room.id}`]: ["subscribe"] }) };
      let token;
      if (deps.token) token = await deps.token(params);
      else {
        publisher ??= new Rest({ key: process.env.ABLY_API_KEY });
        token = await publisher.auth.createTokenRequest(params);
      }
      res.json(token);
    } catch (error2) {
      console.error("Co-op token failed", error2);
      fail2(res, 503, "Could not authorize realtime.");
    }
  });
  function startCoopAuthority2() {
    if (authority) return;
    authority = setInterval(async () => {
      if (ticking) return;
      ticking = true;
      try {
        const rooms = await (await getCollection2("coop_matches")).find({ status: { $in: ["waiting", "countdown", "playing", "boss-intro"] }, expiresAt: { $gt: /* @__PURE__ */ new Date() } }).limit(100).toArray();
        for (const room of rooms) await tick(room, Date.now());
      } catch (error2) {
        console.error("Co-op authority failed", error2);
      } finally {
        ticking = false;
      }
    }, 200);
    authority.unref?.();
  }
  return { router: coopRouter2, startAuthority: startCoopAuthority2 };
}
var service = createCoopService();
var coopRouter = service.router;
var startCoopAuthority = service.startAuthority;

// server/app.ts
import express from "express";
import cors from "cors";

// server/routes/leaderboard.ts
import { Router as Router2 } from "express";
import crypto2 from "node:crypto";

// server/catalog.ts
var cache = null;
function invalidateCatalogCache() {
  cache = null;
}
async function loadQuestCatalog() {
  if (cache && Date.now() - cache.at < 4e3) return cache;
  try {
    const col = await getCollection("admin_config");
    const doc = await col.findOne({ configKey: "game_config" });
    cache = {
      at: Date.now(),
      missions: Array.isArray(doc?.missions) ? doc.missions : DEFAULT_MISSIONS,
      achievements: migrateCoopCatalog(Array.isArray(doc?.achievements) ? doc.achievements : DEFAULT_ACHIEVEMENTS, DEFAULT_ACHIEVEMENTS, doc?.coopCatalogVersion),
      badges: migrateCoopCatalog(Array.isArray(doc?.badges) ? doc.badges : DEFAULT_BADGES, DEFAULT_BADGES, doc?.coopCatalogVersion),
      ranks: mergeRewardDefaults(Array.isArray(doc?.ranks) && doc.ranks.length ? doc.ranks : DEFAULT_RANK_TIERS, DEFAULT_RANK_TIERS),
      slicers: Array.isArray(doc?.slicers) && doc.slicers.length ? doc.slicers : DEFAULT_SLICERS
    };
    return cache;
  } catch {
    return {
      missions: DEFAULT_MISSIONS,
      achievements: DEFAULT_ACHIEVEMENTS,
      badges: DEFAULT_BADGES,
      ranks: DEFAULT_RANK_TIERS,
      slicers: DEFAULT_SLICERS
    };
  }
}
function getMonthKey() {
  return currentMonthKey();
}

// server/validation.ts
import { isDeepStrictEqual } from "node:util";
function safeInput(value, depth = 0) {
  if (depth > 24) return false;
  if (value === null || typeof value !== "object") return true;
  return Object.entries(value).every(([key, child]) => !key.startsWith("$") && !key.includes(".") && !["__proto__", "prototype", "constructor"].includes(key) && safeInput(child, depth + 1));
}
function validId(value) {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
}
function boundedInteger(value, max, min = 0) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}
var HEROES2 = ["jiju", "topfu", "lagen", "tripos", "ki"];
var SKILLS2 = ["edge", "reach", "flow", "steel", "storm"];
var HERO_PERKS2 = ["combo", "juice", "tower", "critical", "survival"];
var DEFAULT_OWNABLE_SKINS = /* @__PURE__ */ new Set(["blade-default", "blade-gold", "blade-ink", "blade-cherry", "wall-brick", "wall-stone", "wall-night"]);
var SAVE_KEYS = /* @__PURE__ */ new Set(["hero", "xp", "ownedHeroes", "towerXp", "towerLifetimeXp", "highScore", "rankedScore", "bestWave", "bestCombo", "games", "coins", "gems", "nickname", "avatar", "skillPoints", "skills", "ownedSkins", "bladeSkin", "wallSkin", "mode", "heroPerkRanks", "heroAbilityRanks", "heroAbilityLoadouts", "vipStatus", "saveRevision", "savedAt", "campaignProgress"]);
var SERVER_OWNED_SAVE_KEYS = [
  "xp",
  "ownedHeroes",
  "towerXp",
  "towerLifetimeXp",
  "highScore",
  "rankedScore",
  "bestWave",
  "bestCombo",
  "games",
  "coins",
  "gems",
  "skillPoints",
  "skills",
  "ownedSkins",
  "heroPerkRanks",
  "heroAbilityRanks",
  "heroAbilityLoadouts",
  "vipStatus",
  "hero",
  "bladeSkin",
  "wallSkin"
];
function sameJsonValue(a, b) {
  return isDeepStrictEqual(a, b);
}
function serverOwnedSaveError(incoming, authoritative) {
  for (const key of SERVER_OWNED_SAVE_KEYS) {
    if (incoming[key] !== void 0 && !sameJsonValue(incoming[key], authoritative[key])) {
      return `Server-owned field cannot be changed by profile sync: ${key}`;
    }
  }
  return null;
}
function saveValidationError(value, allowedSkinIds = DEFAULT_OWNABLE_SKINS) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !safeInput(value)) return "Invalid save object";
  const save = value;
  if (Object.keys(save).some((key) => !SAVE_KEYS.has(key))) return "Unknown save field";
  const limits = { coins: 1e6, gems: 1e6, skillPoints: 1e4, towerXp: 1e8, towerLifetimeXp: 1e8, highScore: 1e8, rankedScore: 1e8, bestWave: 9999, bestCombo: 1e5, games: 1e6, saveRevision: Number.MAX_SAFE_INTEGER, savedAt: Number.MAX_SAFE_INTEGER };
  for (const [key, max] of Object.entries(limits)) {
    if (save[key] !== void 0 && !boundedInteger(save[key], max)) return `Invalid ${key}: expected a nonnegative integer within maximum`;
  }
  for (const key of ["xp", "skills", "heroPerkRanks", "heroAbilityRanks", "heroAbilityLoadouts"]) {
    const field = save[key];
    if (field !== void 0 && (!field || typeof field !== "object" || Array.isArray(field))) return `Invalid ${key}`;
  }
  if (save.xp && Object.entries(save.xp).some(([hero, xp]) => !HEROES2.includes(hero) || !boundedInteger(xp, 1e6))) return "Invalid hero XP";
  if (save.skills && Object.entries(save.skills).some(([id, rank]) => !SKILLS2.includes(id) || !boundedInteger(rank, 3))) return "Invalid skill ranks";
  if (save.heroAbilityRanks && Object.entries(save.heroAbilityRanks).some(([id, rank]) => !/^(jiju|topfu|lagen|tripos|ki)-[1-6]$/.test(id) || !boundedInteger(rank, 5))) return "Invalid hero ability ranks";
  if (save.heroAbilityLoadouts && Object.entries(save.heroAbilityLoadouts).some(([hero, ids]) => !HEROES2.includes(hero) || !Array.isArray(ids) || ids.length > 3 || new Set(ids).size !== ids.length || ids.some((id) => typeof id !== "string" || !new RegExp("^" + hero + "-[1-6]$").test(id)))) return "Invalid hero ability loadout";
  if (save.heroPerkRanks && Object.entries(save.heroPerkRanks).some(([hero, ranks]) => !HEROES2.includes(hero) || !ranks || typeof ranks !== "object" || Array.isArray(ranks) || Object.entries(ranks).some(([id, rank]) => !HERO_PERKS2.includes(id) || !boundedInteger(rank, 3)))) return "Invalid hero perk ranks";
  for (const key of ["ownedSkins", "ownedHeroes"]) {
    const list = save[key];
    if (list !== void 0 && (!Array.isArray(list) || list.length > 500 || !list.every(validId))) return `Invalid ${key}`;
  }
  if (Array.isArray(save.ownedHeroes) && save.ownedHeroes.some((id) => !HEROES2.includes(id))) return "Unknown hero";
  if (Array.isArray(save.ownedSkins) && save.ownedSkins.some((id) => !allowedSkinIds.has(id))) return "Unknown owned skin";
  if (Array.isArray(save.ownedSkins) && new Set(save.ownedSkins).size !== save.ownedSkins.length) return "Duplicate owned skin";
  if (Array.isArray(save.ownedHeroes) && new Set(save.ownedHeroes).size !== save.ownedHeroes.length) return "Duplicate owned hero";
  if (save.hero !== void 0 && (typeof save.hero !== "string" || !HEROES2.includes(save.hero))) return "Invalid hero";
  if (save.mode !== void 0 && (typeof save.mode !== "string" || !["casual", "ranked", "coop", "arena", "horde", "campaign"].includes(save.mode))) return "Invalid mode";
  if (save.campaignProgress !== void 0) {
    const progress = save.campaignProgress;
    if (!progress || typeof progress !== "object" || Array.isArray(progress) || Object.keys(progress).some((key) => !["unlocked", "cleared"].includes(key)) || !boundedInteger(progress.unlocked, 100, 1) || !Array.isArray(progress.cleared) || progress.cleared.length > 100 || progress.cleared.some((level) => !boundedInteger(level, 100, 1))) return "Invalid campaign progress";
  }
  if (save.vipStatus !== void 0 && (typeof save.vipStatus !== "string" || !["none", "bronze", "silver", "gold"].includes(save.vipStatus))) return "Invalid VIP status";
  for (const [key, max] of [["nickname", 64], ["avatar", 9e5], ["bladeSkin", 120], ["wallSkin", 120]]) {
    if (save[key] !== void 0 && (typeof save[key] !== "string" || save[key].length > max)) return `Invalid ${key}`;
  }
  for (const key of ["bladeSkin", "wallSkin"]) {
    const equipped = save[key];
    if (typeof equipped === "string" && equipped !== "" && equipped !== "none" && !allowedSkinIds.has(equipped)) return `Unknown ${key}`;
    if (typeof equipped === "string" && equipped !== "" && equipped !== "none" && Array.isArray(save.ownedSkins) && !save.ownedSkins.includes(equipped)) return `${key} is not owned`;
  }
  return null;
}
function validProgressUpdates(value, idKey) {
  return Array.isArray(value) && value.length <= 100 && value.every((row) => row && typeof row === "object" && validId(row[idKey]) && (row.setProgress !== void 0 && row.progressDelta === void 0 && boundedInteger(row.setProgress, 1e8) || row.progressDelta !== void 0 && row.setProgress === void 0 && boundedInteger(row.progressDelta, 1e8)));
}

// server/routes/leaderboard.ts
var defaultDeps = {
  resolveUser: resolveRequestUser,
  collection: getCollection,
  catalog: loadQuestCatalog
};
var RUN_TOKEN_TTL_MS = 15 * 60 * 1e3;
function resolveMode(mode) {
  if (mode === "monthly") return monthlyLeaderboardMode();
  return mode || "ranked";
}
function createLeaderboardRouter(deps = defaultDeps) {
  const router = Router2();
  router.get("/boards", async (req2, res) => {
    const category = String(req2.query.category || "ranked"), scope = String(req2.query.scope || "global");
    if (!["ranked", "casual", "horde", "coop", "campaign", "coins", "gems"].includes(category) || !["global", "friends"].includes(scope)) return res.status(400).json({ error: "Invalid leaderboard category." });
    try {
      const user = await deps.resolveUser(req2);
      const filter = {};
      if (scope === "friends") {
        if (!user) return res.status(401).json({ error: "Sign in to compare with friends." });
        const friends = await (await deps.collection("friends")).find({ userId: user.userId, state: "accepted" }).toArray();
        filter.userId = { $in: [user.userId, ...friends.map((friend) => friend.friendId)] };
      }
      const wallet = category === "coins" || category === "gems", ranked = category === "ranked";
      const collection = ranked ? "pvp_ratings" : wallet ? "cloud_saves" : "leaderboards";
      const field = ranked ? "points" : wallet ? `saveData.${category}` : category === "horde" ? "wave" : "score";
      if (ranked) {
        filter.season = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
        filter.matches = { $gt: 0 };
      } else if (!wallet) filter.mode = category;
      const rows = await (await deps.collection(collection)).find(filter).sort({ [field]: -1, ...category === "horde" ? { score: -1 } : {}, userId: 1 }).limit(50).toArray();
      const users = rows.length ? await (await deps.collection("users")).find({ userId: { $in: rows.map((row) => row.userId) } }).toArray() : [];
      const names2 = new Map(users.map((person) => [person.userId, person.username || person.nickname || "Slicer"]));
      res.json({ metric: ranked ? "FR points" : wallet ? category : category === "horde" ? "highest wave" : "high score", entries: rows.map((row, index) => ({ rank: index + 1, name: names2.get(row.userId) || row.nickname || "Slicer", value: Number(ranked ? row.points : wallet ? row.saveData?.[category] || 0 : row[field]), detail: ranked ? `${row.wins || 0} wins \xB7 ${row.matches} matches` : wallet ? "Current balance" : `Wave ${row.wave} \xB7 Best combo \xD7${row.maxCombo || 0}`, isYou: row.userId === user?.userId })) });
    } catch {
      res.status(503).json({ error: "Leaderboards are temporarily unavailable. Try again." });
    }
  });
  router.post("/run", async (req2, res) => {
    try {
      const mode = req2.body?.mode ?? "casual";
      if (!["casual", "ranked", "coop", "arena", "horde", "campaign"].includes(mode)) return res.status(400).json({ success: false, error: "Invalid mode" });
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to start a leaderboard run" });
      const runToken = crypto2.randomBytes(32).toString("hex");
      const createdAt = /* @__PURE__ */ new Date();
      const expiresAt = new Date(createdAt.getTime() + RUN_TOKEN_TTL_MS);
      const col = await deps.collection("run_tokens");
      await col.insertOne({ tokenHash: hashToken(runToken), userId: user.userId, mode, createdAt, expiresAt });
      res.status(201).json({ success: true, runToken, expiresAt });
    } catch (err) {
      console.error("Error issuing run token:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.get("/monthly-rank", async (req2, res) => {
    try {
      const userId = (await deps.resolveUser(req2))?.userId;
      const catalog = await deps.catalog();
      const seasonMode = monthlyLeaderboardMode();
      const col = await deps.collection("leaderboards");
      const entry = userId ? await col.findOne({ userId, mode: seasonMode }, { sort: { score: -1 } }) : null;
      const score = entry?.score || 0;
      const rank = rankFromScore(score, catalog.ranks);
      const sorted = [...catalog.ranks].sort((a, b) => a.minScore - b.minScore);
      const next = sorted.find((t) => t.minScore > rank.minScore) || null;
      const wallet = userId ? await (await deps.collection("cloud_saves")).findOne({ userId }) : null;
      const rewardReceipt = `rank:${seasonMode}:${rank.id}`;
      res.json({
        success: true,
        season: seasonMode,
        score,
        rank,
        next,
        hasEntry: !!entry,
        claimed: (wallet?.claimReceipts || []).includes(rewardReceipt),
        claimedRankIds: (wallet?.claimReceipts || []).filter((receipt) => receipt.startsWith(`rank:${seasonMode}:`)).map((receipt) => receipt.slice(`rank:${seasonMode}:`.length))
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/monthly-rank/claim", async (req2, res) => {
    try {
      const userId = (await deps.resolveUser(req2))?.userId;
      if (!userId) return res.status(401).json({ success: false, error: "Sign in to claim rank rewards" });
      const catalog = await deps.catalog();
      const season = monthlyLeaderboardMode();
      const board = await deps.collection("leaderboards");
      const entry = await board.findOne({ userId, mode: season }, { sort: { score: -1 } });
      if (!entry) return res.status(422).json({ success: false, error: "Play a ranked match to earn a season rank" });
      const currentRank = rankFromScore(entry.score, catalog.ranks);
      const requestedRankId = req2.body?.rankId;
      const rank = requestedRankId === void 0 ? currentRank : catalog.ranks.find((tier) => tier.id === requestedRankId);
      if (!rank) return res.status(400).json({ success: false, error: "Invalid rank reward tier" });
      if (entry.score < rank.minScore) return res.status(422).json({ success: false, error: "That rank reward has not been earned yet" });
      const receiptKey = `rank:${season}:${rank.id}`;
      const saves = await deps.collection("cloud_saves");
      const wallet = await creditClaimReward(userId, receiptKey, {
        coins: rank.rewardCoins ?? 0,
        gems: rank.rewardGems ?? 0
      }, saves);
      if (!wallet) return res.status(409).json({ success: false, error: "This rank reward has already been claimed" });
      res.json({ success: true, rankId: rank.id, rewardCoins: rank.rewardCoins ?? 0, rewardGems: rank.rewardGems ?? 0, saveData: wallet.saveData, revision: wallet.revision });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.get("/", async (req2, res) => {
    try {
      if (req2.query.mode !== void 0 && (typeof req2.query.mode !== "string" || !/^(casual|ranked|coop|arena|horde|campaign|monthly|monthly-\d{4}-\d{2})$/.test(req2.query.mode))) return res.status(400).json({ success: false, error: "Invalid mode" });
      const mode = resolveMode(req2.query.mode || "ranked");
      const limit = Math.max(1, Math.min(parseInt(String(req2.query.limit)) || 50, 100));
      const userId = (await deps.resolveUser(req2))?.userId;
      const col = await deps.collection("leaderboards");
      const order = mode === "horde" ? { wave: -1, score: -1 } : { score: -1, wave: -1 };
      const topEntries = await col.find({ mode }).sort(order).limit(limit).toArray();
      const leaderboard = topEntries.map((entry, idx) => ({
        rank: idx + 1,
        userId: entry.userId,
        nickname: entry.nickname,
        avatar: entry.avatar,
        hero: entry.hero,
        mode: entry.mode,
        score: entry.score,
        wave: entry.wave,
        fruitsSliced: entry.fruitsSliced,
        maxCombo: entry.maxCombo,
        steamId: entry.steamId,
        steamPersona: entry.steamPersona,
        steamAvatar: entry.steamAvatar,
        date: entry.createdAt
      }));
      let userRank = null;
      if (userId) {
        const userBest = await col.findOne({ userId, mode }, { sort: order });
        if (userBest) {
          const higherCount = await col.countDocuments({
            mode,
            $or: mode === "horde" ? [{ wave: { $gt: userBest.wave } }, { wave: userBest.wave, score: { $gt: userBest.score } }] : [{ score: { $gt: userBest.score } }, { score: userBest.score, wave: { $gt: userBest.wave } }]
          });
          userRank = {
            rank: higherCount + 1,
            score: userBest.score,
            wave: userBest.wave,
            hero: userBest.hero
          };
        }
      }
      res.json({
        success: true,
        mode,
        leaderboard,
        userRank,
        totalEntries: await col.countDocuments({ mode })
      });
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/", async (req2, res) => {
    try {
      const {
        nickname,
        avatar,
        hero,
        mode,
        score,
        wave,
        fruitsSliced,
        maxCombo,
        runToken,
        rewards,
        completed
      } = req2.body;
      if (mode !== void 0 && !["casual", "ranked", "coop", "arena", "horde", "campaign"].includes(mode)) return res.status(400).json({ success: false, error: "Invalid mode" });
      if (hero !== void 0 && !["jiju", "topfu", "lagen", "tripos", "ki"].includes(hero)) return res.status(400).json({ success: false, error: "Invalid hero" });
      if (wave !== void 0 && !boundedInteger(wave, 1e3, 1) || fruitsSliced !== void 0 && !boundedInteger(fruitsSliced, 1e5) || maxCombo !== void 0 && !boundedInteger(maxCombo, 5e3)) return res.status(400).json({ success: false, error: "Invalid match counters" });
      if (nickname !== void 0 && (typeof nickname !== "string" || nickname.length > 64) || avatar !== void 0 && (typeof avatar !== "string" || avatar.length > 9e5)) return res.status(400).json({ success: false, error: "Invalid profile fields" });
      if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
        return res.status(400).json({ success: false, error: "Invalid score submission payload" });
      }
      if (rewards !== void 0) {
        const keys = ["coins", "heroXp", "towerXp", "skillPoints"];
        if (!rewards || typeof rewards !== "object" || Array.isArray(rewards) || Object.keys(rewards).some((key) => ![...keys, "gems"].includes(key)) || keys.some((key) => !boundedInteger(rewards[key], key === "coins" ? 1e5 : 1e4)) || rewards.gems !== void 0 && !boundedInteger(rewards.gems, 100)) {
          return res.status(400).json({ success: false, error: "Invalid run reward payload" });
        }
        const rewardCaps = {
          coins: Math.min(1e5, Math.ceil(score * 2 + (wave || 1) * 100)),
          heroXp: Math.min(1e4, Math.ceil(score / 5 + (wave || 1) * 100 + 100)),
          towerXp: Math.min(1e4, Math.ceil(score / 3 + (wave || 1) * 150 + 100)),
          skillPoints: Math.min(100, Math.ceil(score / 1e3) + 5),
          // Boss bounties plus one rare gem per 100 kills; match receipts are
          // still token-bound and each reward is credited only once.
          gems: Math.min(100, Math.floor((wave || 0) / 5) + Math.floor((fruitsSliced || 0) / 100))
        };
        if (keys.some((key) => rewards[key] > rewardCaps[key]) || (rewards.gems ?? 0) > rewardCaps.gems) {
          return res.status(422).json({ success: false, error: "Run rewards exceed the score and wave limits" });
        }
      }
      if (completed !== void 0 && typeof completed !== "boolean") return res.status(400).json({ success: false, error: "Invalid run completion state" });
      const MAX_REASONABLE_SCORE = 1e7;
      const MAX_REASONABLE_WAVE = 1e3;
      const MAX_REASONABLE_FRUITS = 1e5;
      const MAX_REASONABLE_COMBO = 5e3;
      if (score > MAX_REASONABLE_SCORE) {
        return res.status(400).json({ success: false, error: "Score exceeds reasonable maximum" });
      }
      if (wave && wave > MAX_REASONABLE_WAVE) {
        return res.status(400).json({ success: false, error: "Wave exceeds reasonable maximum" });
      }
      if (fruitsSliced && fruitsSliced > MAX_REASONABLE_FRUITS) {
        return res.status(400).json({ success: false, error: "Fruits sliced exceeds reasonable maximum" });
      }
      if (maxCombo && maxCombo > MAX_REASONABLE_COMBO) {
        return res.status(400).json({ success: false, error: "Combo exceeds reasonable maximum" });
      }
      const user = await deps.resolveUser(req2);
      if (!user) {
        return res.status(401).json({ success: false, error: "Sign in to submit leaderboard scores" });
      }
      const userId = user.userId;
      if (typeof runToken !== "string" || !/^[a-f0-9]{64}$/.test(runToken)) {
        return res.status(401).json({ success: false, error: "A valid run token is required" });
      }
      const playMode = mode || "casual";
      const rewardTokenKey = hashToken(runToken);
      const runs = await deps.collection("run_tokens");
      const consumed = await runs.findOneAndUpdate(
        {
          tokenHash: hashToken(runToken),
          userId,
          mode: playMode,
          expiresAt: { $gt: /* @__PURE__ */ new Date() },
          consumedAt: { $exists: false }
        },
        { $set: { consumedAt: /* @__PURE__ */ new Date() } },
        { returnDocument: "before" }
      );
      if (!consumed) return res.status(401).json({ success: false, error: "Run token is invalid, expired, or already used" });
      const elapsedSeconds = Math.max(0, (Date.now() - new Date(consumed.createdAt).getTime()) / 1e3);
      if (!Number.isFinite(elapsedSeconds) || score > 2500 + elapsedSeconds * 600 || (wave || 1) > 10 + Math.floor(elapsedSeconds / 2) || (fruitsSliced || 0) > 100 + Math.floor(elapsedSeconds * 12) || (maxCombo || 0) > 100 + Math.floor(elapsedSeconds * 12)) {
        return res.status(422).json({ success: false, error: "Run counters exceed the time available since match start" });
      }
      let settledWallet = null;
      if (rewards) {
        const wallet = await creditClaimReward(userId, `run:${rewardTokenKey}`, {
          coins: rewards.coins,
          gems: rewards.gems ?? 0,
          skillPoints: rewards.skillPoints,
          xp: { [hero || "jiju"]: rewards.heroXp },
          towerXp: rewards.towerXp,
          games: completed === false ? 0 : 1,
          highScore: score,
          rankedScore: playMode === "ranked" && completed !== false ? score : 0,
          bestWave: wave || 1,
          bestCombo: maxCombo || 0
        }, await deps.collection("cloud_saves"));
        if (!wallet) return res.status(500).json({ success: false, error: "Could not settle run rewards" });
        settledWallet = { saveData: wallet.saveData, revision: wallet.revision ?? 0 };
      }
      const col = await deps.collection("leaderboards");
      const upsertBest = async (modeKey) => {
        const existing = await col.findOne({ userId, mode: modeKey });
        if (!existing) {
          await col.insertOne({
            userId,
            nickname: nickname || user.nickname || "Slicer",
            avatar: avatar || user.avatar || "",
            hero: hero || "jiju",
            mode: modeKey,
            score,
            wave: wave || 1,
            fruitsSliced: fruitsSliced || 0,
            maxCombo: maxCombo || 0,
            steamId: user.steamId,
            steamPersona: user.steamPersona,
            steamAvatar: user.steamAvatar,
            createdAt: /* @__PURE__ */ new Date()
          });
          return true;
        }
        if (modeKey === "horde" && ((wave || 1) > existing.wave || (wave || 1) === existing.wave && score > existing.score) || modeKey !== "horde" && (score > existing.score || score === existing.score && (wave || 1) > existing.wave)) {
          await col.updateOne(
            { _id: existing._id },
            {
              $set: {
                nickname: nickname || existing.nickname,
                avatar: avatar || existing.avatar,
                hero: hero || existing.hero,
                score,
                wave: wave || existing.wave,
                fruitsSliced: Math.max(fruitsSliced || 0, existing.fruitsSliced),
                maxCombo: Math.max(maxCombo || 0, existing.maxCombo),
                steamId: user.steamId || existing.steamId,
                steamPersona: user.steamPersona || existing.steamPersona,
                steamAvatar: user.steamAvatar || existing.steamAvatar,
                createdAt: /* @__PURE__ */ new Date()
              }
            }
          );
          return true;
        }
        return false;
      };
      const isNewHigh = completed !== false ? await upsertBest(playMode) : false;
      if (playMode === "ranked" && completed !== false) {
        await upsertBest(monthlyLeaderboardMode());
      }
      const higherCount = await col.countDocuments(playMode === "horde" ? { mode: playMode, $or: [{ wave: { $gt: wave || 1 } }, { wave: wave || 1, score: { $gt: score } }] } : { mode: playMode, score: { $gt: score } });
      const catalog = playMode === "ranked" ? await deps.catalog() : null;
      const monthlyScore = playMode === "ranked" ? (await col.findOne({ userId, mode: monthlyLeaderboardMode() }))?.score || score : score;
      res.json({
        success: true,
        isNewHigh,
        rank: higherCount + 1,
        score,
        monthlyRank: catalog ? rankFromScore(monthlyScore, catalog.ranks) : void 0,
        wallet: settledWallet
      });
    } catch (err) {
      console.error("Error submitting score:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  return router;
}
var leaderboardRouter = createLeaderboardRouter();

// server/routes/achievements.ts
import { Router as Router3 } from "express";
var defaultDeps2 = { resolveUser: resolveRequestUser, collection: getCollection, catalog: loadQuestCatalog };
function createAchievementsRouter(deps = defaultDeps2) {
  const router = Router3();
  router.get("/", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to view achievements" });
      const userId = user.userId;
      const catalog = await deps.catalog();
      const defs = catalog.achievements.filter((a) => a.enabled !== false);
      const col = await deps.collection("achievements");
      const userDocs = await col.find({ userId }).toArray();
      const docMap = new Map(userDocs.map((d) => [d.achievementId, d]));
      const list = defs.map((def) => {
        const doc = docMap.get(def.id);
        const maxProgress = def.requirement?.goal || 1;
        const progress = Math.min(doc?.progress || 0, maxProgress);
        const unlocked = !!doc?.unlocked || progress >= maxProgress;
        return {
          id: def.id,
          title: def.title,
          desc: def.desc,
          icon: def.icon,
          maxProgress,
          rewardCoins: def.rewardCoins,
          rewardSp: def.rewardSp,
          rewardGems: def.rewardGems ?? 0,
          rewardBadge: def.rewardBadge,
          progress,
          unlocked,
          claimed: !!doc?.claimed,
          unlockedAt: doc?.unlockedAt
        };
      });
      res.json({
        success: true,
        achievements: list,
        stats: {
          total: defs.length,
          unlocked: list.filter((a) => a.unlocked).length,
          claimable: list.filter((a) => a.unlocked && !a.claimed).length
        }
      });
    } catch (err) {
      console.error("Error fetching achievements:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/progress", async (req2, res) => {
    try {
      const { updates } = req2.body;
      if (!validProgressUpdates(updates, "achievementId")) {
        return res.status(400).json({ success: false, error: "Invalid payload" });
      }
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to update achievements" });
      const userId = user.userId;
      const catalog = await deps.catalog();
      const col = await deps.collection("achievements");
      const newlyUnlocked = [];
      for (const update of updates) {
        const def = catalog.achievements.find((a) => a.id === update.achievementId && a.enabled !== false);
        if (!def) continue;
        const authorityEvent = def.requirement && requirementById(def.requirement.type)?.event;
        if (authorityEvent === "pvp_result" || authorityEvent === "coop_result") continue;
        const existing = await col.findOne({ userId, achievementId: def.id });
        let currentProgress = existing?.progress || 0;
        const maxProgress = def.requirement?.goal || 1;
        if (typeof update.setProgress === "number") {
          currentProgress = Math.max(currentProgress, update.setProgress);
        } else if (typeof update.progressDelta === "number") {
          currentProgress += update.progressDelta;
        }
        const unlocked = currentProgress >= maxProgress;
        const wasUnlocked = existing?.unlocked ?? false;
        if (unlocked && !wasUnlocked) newlyUnlocked.push(def.id);
        await col.updateOne(
          { userId, achievementId: def.id },
          {
            $set: {
              progress: Math.min(maxProgress, currentProgress),
              maxProgress,
              unlocked,
              unlockedAt: unlocked && !wasUnlocked ? /* @__PURE__ */ new Date() : existing?.unlockedAt
            },
            $setOnInsert: { claimed: false }
          },
          { upsert: true }
        );
      }
      for (const achievementId of newlyUnlocked) {
        const def = catalog.achievements.find((achievement) => achievement.id === achievementId);
        if (!def) continue;
        const reward = [
          def.rewardCoins ? `${def.rewardCoins} coins` : "",
          def.rewardGems ? `${def.rewardGems} gems` : "",
          def.rewardSp ? `${def.rewardSp} skill points` : ""
        ].filter(Boolean).join(" \xB7 ");
        await saveNotification(() => deps.collection("notifications"), {
          userId,
          type: "achievement_unlocked",
          title: "Achievement unlocked",
          body: `${def.title}${reward ? ` \xB7 Claim ${reward}` : ""}`,
          eventKey: `achievement-unlocked:${userId}:${achievementId}`
        });
      }
      res.json({ success: true, newlyUnlocked });
    } catch (err) {
      console.error("Error updating achievement progress:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/claim", async (req2, res) => {
    try {
      const { achievementId } = req2.body;
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to claim achievements" });
      const userId = user.userId;
      const catalog = await deps.catalog();
      const def = catalog.achievements.find((a) => a.id === achievementId && a.enabled !== false);
      if (!def) {
        return res.status(400).json({ success: false, error: "Invalid achievementId" });
      }
      const col = await deps.collection("achievements");
      const existing = await col.findOne({ userId, achievementId });
      if (!existing || !existing.unlocked) {
        return res.status(400).json({ success: false, error: "Achievement is not yet unlocked" });
      }
      if (existing.claimed) {
        return res.status(400).json({ success: false, error: "Reward already claimed" });
      }
      const saves = await deps.collection("cloud_saves");
      const wallet = await creditClaimReward(userId, `achievement:${achievementId}`, {
        coins: def.rewardCoins,
        gems: def.rewardGems ?? 0,
        skillPoints: def.rewardSp
      }, saves);
      if (!wallet) return res.status(400).json({ success: false, error: "Reward already claimed" });
      const claim = await col.updateOne({ _id: existing._id, claimed: { $ne: true }, unlocked: true }, { $set: { claimed: true } });
      if (claim.modifiedCount !== 1) return res.status(400).json({ success: false, error: "Reward already claimed" });
      const reward = [
        def.rewardCoins ? `${def.rewardCoins} coins` : "",
        def.rewardGems ? `${def.rewardGems} gems` : "",
        def.rewardSp ? `${def.rewardSp} skill points` : ""
      ].filter(Boolean).join(" \xB7 ");
      await saveNotification(() => deps.collection("notifications"), {
        userId,
        type: "achievement_reward",
        title: "Achievement reward received",
        body: `${def.title}${reward ? ` \xB7 ${reward}` : ""}`,
        eventKey: `achievement-reward:${userId}:${achievementId}`
      });
      res.json({
        success: true,
        achievementId,
        rewardCoins: def.rewardCoins,
        rewardSp: def.rewardSp,
        rewardGems: def.rewardGems ?? 0,
        rewardBadge: def.rewardBadge,
        saveData: wallet.saveData,
        revision: wallet.revision
      });
    } catch (err) {
      console.error("Error claiming achievement reward:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  return router;
}
var achievementsRouter = createAchievementsRouter();

// server/routes/missions.ts
import { Router as Router4 } from "express";
var defaultDeps3 = { resolveUser: resolveRequestUser, collection: getCollection, catalog: loadQuestCatalog };
function getDayKey() {
  const d = /* @__PURE__ */ new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function getWeekKey() {
  const d = /* @__PURE__ */ new Date();
  const oneJan = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - oneJan.getTime()) / 864e5 + oneJan.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNum}`;
}
function periodKey(type) {
  if (type === "main") return "MAIN";
  if (type === "weekly") return getWeekKey();
  if (type === "monthly") return `M-${getMonthKey()}`;
  return getDayKey();
}
function createMissionsRouter(deps = defaultDeps3) {
  const router = Router4();
  router.get("/", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to view missions" });
      const userId = user.userId;
      const catalog = await deps.catalog();
      const defs = catalog.missions.filter((m) => m.enabled !== false);
      const keys = [...new Set(defs.map((d) => periodKey(d.type)))];
      const col = await deps.collection("missions");
      const userDocs = await col.find({ userId, dayKey: { $in: keys } }).toArray();
      const docMap = new Map(userDocs.map((d) => [d.missionId, d]));
      const missions = defs.map((def) => {
        const activeKey = periodKey(def.type);
        const doc = docMap.get(def.id);
        const goal = def.requirement?.goal || 1;
        const progress = Math.min(doc?.progress || 0, goal);
        return {
          id: def.id,
          type: def.type,
          title: def.title,
          desc: def.desc,
          icon: def.icon,
          goal,
          rewardCoins: def.rewardCoins,
          rewardSp: def.rewardSp,
          rewardGems: def.rewardGems ?? 0,
          rewardBadge: def.rewardBadge,
          periodKey: activeKey,
          progress,
          completed: progress >= goal,
          claimed: !!doc?.claimed
        };
      });
      res.json({
        success: true,
        dayKey: getDayKey(),
        weekKey: getWeekKey(),
        monthKey: getMonthKey(),
        missions,
        totalClaimable: missions.filter((m) => m.completed && !m.claimed).length
      });
    } catch (err) {
      console.error("Error fetching missions:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/progress", async (req2, res) => {
    try {
      const { updates } = req2.body;
      if (!validProgressUpdates(updates, "missionId")) {
        return res.status(400).json({ success: false, error: "Invalid payload" });
      }
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to update missions" });
      const userId = user.userId;
      const catalog = await deps.catalog();
      const col = await deps.collection("missions");
      const newlyCompleted = [];
      for (const update of updates) {
        const def = catalog.missions.find((m) => m.id === update.missionId && m.enabled !== false);
        if (!def) continue;
        const authorityEvent = def.requirement && requirementById(def.requirement.type)?.event;
        if (authorityEvent === "pvp_result" || authorityEvent === "coop_result") continue;
        const activeKey = periodKey(def.type);
        const existing = await col.findOne({ userId, missionId: def.id, dayKey: activeKey });
        let currentProgress = existing?.progress || 0;
        const goal = def.requirement?.goal || 1;
        if (typeof update.setProgress === "number") {
          currentProgress = Math.max(currentProgress, update.setProgress);
        } else if (typeof update.progressDelta === "number") {
          currentProgress += update.progressDelta;
        }
        if (currentProgress >= goal && !existing?.completed) newlyCompleted.push(def.id);
        await col.updateOne(
          { userId, missionId: def.id, dayKey: activeKey },
          {
            $set: {
              progress: Math.min(goal, currentProgress),
              goal,
              completed: currentProgress >= goal,
              updatedAt: /* @__PURE__ */ new Date()
            },
            $setOnInsert: { claimed: false }
          },
          { upsert: true }
        );
      }
      for (const missionId of newlyCompleted) {
        const def = catalog.missions.find((mission) => mission.id === missionId);
        if (!def) continue;
        const reward = [
          def.rewardCoins ? `${def.rewardCoins} coins` : "",
          def.rewardGems ? `${def.rewardGems} gems` : "",
          def.rewardSp ? `${def.rewardSp} skill points` : ""
        ].filter(Boolean).join(" \xB7 ");
        await saveNotification(() => deps.collection("notifications"), {
          userId,
          type: "mission_ready",
          title: "Mission completed",
          body: `${def.title}${reward ? ` \xB7 Claim ${reward}` : " \xB7 Claim your reward"}`,
          eventKey: `mission-ready:${userId}:${periodKey(def.type)}:${missionId}`
        });
      }
      res.json({ success: true, newlyCompleted });
    } catch (err) {
      console.error("Error updating missions:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/claim", async (req2, res) => {
    try {
      const { missionId } = req2.body;
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to claim missions" });
      const userId = user.userId;
      const catalog = await deps.catalog();
      const def = catalog.missions.find((m) => m.id === missionId && m.enabled !== false);
      if (!def) {
        return res.status(400).json({ success: false, error: "Invalid missionId" });
      }
      const activeKey = periodKey(def.type);
      const col = await deps.collection("missions");
      const existing = await col.findOne({ userId, missionId, dayKey: activeKey });
      if (!existing || !existing.completed) {
        return res.status(400).json({ success: false, error: "Mission is not completed yet" });
      }
      if (existing.claimed) {
        return res.status(400).json({ success: false, error: "Mission reward already claimed" });
      }
      const saves = await deps.collection("cloud_saves");
      const wallet = await creditClaimReward(userId, `mission:${activeKey}:${missionId}`, {
        coins: def.rewardCoins,
        gems: def.rewardGems ?? 0,
        skillPoints: def.rewardSp
      }, saves);
      if (!wallet) return res.status(400).json({ success: false, error: "Mission reward already claimed" });
      const claim = await col.updateOne({ _id: existing._id, claimed: { $ne: true }, completed: true }, { $set: { claimed: true, updatedAt: /* @__PURE__ */ new Date() } });
      if (claim.modifiedCount !== 1) return res.status(400).json({ success: false, error: "Mission reward already claimed" });
      const reward = [
        def.rewardCoins ? `${def.rewardCoins} coins` : "",
        def.rewardGems ? `${def.rewardGems} gems` : "",
        def.rewardSp ? `${def.rewardSp} skill points` : ""
      ].filter(Boolean).join(" \xB7 ");
      await saveNotification(() => deps.collection("notifications"), {
        userId,
        type: "mission_reward",
        title: "Mission reward received",
        body: `${def.title}${reward ? ` \xB7 ${reward}` : ""}`,
        eventKey: `mission-reward:${userId}:${activeKey}:${missionId}`
      });
      res.json({
        success: true,
        missionId,
        rewardCoins: def.rewardCoins,
        rewardSp: def.rewardSp,
        rewardGems: def.rewardGems ?? 0,
        rewardBadge: def.rewardBadge,
        saveData: wallet.saveData,
        revision: wallet.revision
      });
    } catch (err) {
      console.error("Error claiming mission reward:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  return router;
}
var missionsRouter = createMissionsRouter();

// server/routes/daily.ts
import { Router as Router6 } from "express";

// server/routes/admin.ts
import { Router as Router5 } from "express";
import { ObjectId } from "mongodb";
var adminRouter = Router5();
var ADMIN_STEAM_ID = process.env.ADMIN_STEAM_ID || "";
var ICON_TYPES = /* @__PURE__ */ new Set(["coin", "gem", "chest", "blade"]);
function campaignBossRosterError(value) {
  if (!Array.isArray(value) || value.length > 100) return "Invalid campaign boss roster. Provide up to 100 stages.";
  const invalid = value.some(
    (boss, index) => !boss || typeof boss !== "object" || typeof boss.name !== "string" || boss.name.length > 80 || typeof boss.title !== "string" || boss.title.length > 100 || typeof boss.description !== "string" || boss.description.length > 500 || !Number.isFinite(boss.difficulty) || boss.difficulty < 1 || boss.difficulty > 8 || !Number.isInteger(boss.rewardCoins) || boss.rewardCoins < 0 || boss.rewardCoins > Math.floor((campaignWaves(index + 1) + 1) * 100 / 1.5) || !Number.isInteger(boss.rewardGems) || boss.rewardGems < 0 || boss.rewardGems > Math.floor((campaignWaves(index + 1) + 1) / 5) || boss.revealImage !== void 0 && (typeof boss.revealImage !== "string" || boss.revealImage.length > 3e4 || !/^data:image\/webp;base64,/.test(boss.revealImage))
  );
  return invalid ? "Invalid campaign boss roster. Check field ranges and keep each optimized reveal image under 30 KB." : null;
}
function campaignStoriesError(value) {
  if (!Array.isArray(value) || value.length !== 20) return "Provide exactly 20 campaign chapters.";
  return value.some((chapter, index) => !chapter || typeof chapter !== "object" || chapter.chapter !== index + 1 || typeof chapter.title !== "string" || !chapter.title.trim() || chapter.title.length > 80 || typeof chapter.text !== "string" || !chapter.text.trim() || chapter.text.length > 900) ? "Each chapter needs its numbered slot, a title under 80 characters and story under 900 characters." : null;
}
function normalizeDailyRewards(input) {
  const rows = Array.isArray(input) ? input : [];
  return DEFAULT_ADMIN_CONFIG2.dailyRewards.map((fallback, i) => {
    const row = rows[i] ?? {};
    const iconType = ICON_TYPES.has(row.iconType) ? row.iconType : fallback.iconType;
    const coins = Math.max(0, Number(row.coins ?? fallback.coins) || 0);
    const skillPoints = Math.max(0, Number(row.skillPoints ?? fallback.skillPoints) || 0);
    const gems = Math.max(0, Number(row.gems ?? fallback.gems ?? 0) || 0);
    const skinUnlock = typeof row.skinUnlock === "string" && row.skinUnlock.trim() ? row.skinUnlock.trim() : fallback.skinUnlock;
    return {
      day: i + 1,
      coins,
      skillPoints,
      ...gems ? { gems } : {},
      ...skinUnlock ? { skinUnlock } : {},
      label: String(row.label || fallback.label),
      iconType
    };
  });
}
function normalizePrizeCatalog(input, defaults3) {
  const rows = Array.isArray(input) ? input : defaults3;
  return rows.map((item) => ({
    ...item,
    rewardCoins: Math.max(0, Math.min(1e6, Math.floor(Number(item.rewardCoins) || 0))),
    rewardGems: Math.max(0, Math.min(1e6, Math.floor(Number(item.rewardGems) || 0))),
    ..."rewardSp" in item ? { rewardSp: Math.max(0, Math.min(1e4, Math.floor(Number(item.rewardSp) || 0))) } : {}
  }));
}
function normalizeMenuConfig(input, fallback = DEFAULT_ADMIN_CONFIG2.menuConfig) {
  const row = input && typeof input === "object" ? input : {};
  const text = (value, previous, max) => typeof value === "string" ? value.slice(0, max) : previous;
  const asset = (value, previous = "") => {
    if (value === void 0) return previous;
    if (typeof value !== "string" || !value) return "";
    if (/^https:\/\/[^\s]+$/i.test(value) && value.length <= 2048) return value;
    if (/^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 9e5) return value;
    return "";
  };
  const themeColor = typeof row.themeColor === "string" && /^#[0-9a-f]{6}$/i.test(row.themeColor) ? row.themeColor : fallback.themeColor;
  return {
    eyebrow: text(row.eyebrow, fallback.eyebrow, 120),
    title: text(row.title, fallback.title, 160),
    subtitle: text(row.subtitle, fallback.subtitle, 500),
    announcement: text(row.announcement, fallback.announcement, 500),
    themeColor,
    backgroundImage: asset(row.backgroundImage, fallback.backgroundImage),
    logoImage: asset(row.logoImage, fallback.logoImage),
    faviconImage: asset(row.faviconImage, fallback.faviconImage)
  };
}
function normalizeGameplayConfig(input) {
  const row = input && typeof input === "object" ? input : {};
  const num = (value, fallback, min, max) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    startMoney: num(row.startMoney, DEFAULT_ADMIN_CONFIG2.gameplayConfig.startMoney, 0, 1e5),
    startLives: num(row.startLives, DEFAULT_ADMIN_CONFIG2.gameplayConfig.startLives, 1, 100),
    scoreMultiplier: num(row.scoreMultiplier, DEFAULT_ADMIN_CONFIG2.gameplayConfig.scoreMultiplier, 0.1, 10),
    superChargeMultiplier: num(
      row.superChargeMultiplier,
      DEFAULT_ADMIN_CONFIG2.gameplayConfig.superChargeMultiplier,
      0.5,
      5
    )
  };
}
var DEFAULT_ADMIN_CONFIG2 = {
  configKey: "game_config",
  dailyRewards: [
    { day: 1, coins: 50, skillPoints: 0, gems: 5, label: "50 Coins + 5 Gems", iconType: "coin" },
    { day: 2, coins: 100, skillPoints: 1, gems: 10, label: "100 Coins + 1 SP + 10 Gems", iconType: "gem" },
    { day: 3, coins: 150, skillPoints: 0, gems: 15, label: "150 Coins + 15 Gems", iconType: "coin" },
    { day: 4, coins: 200, skillPoints: 0, gems: 20, label: "200 Coins + 20 Gems", iconType: "coin" },
    { day: 5, coins: 300, skillPoints: 2, gems: 25, label: "300 Coins + 2 SP + 25 Gems", iconType: "gem" },
    { day: 6, coins: 450, skillPoints: 0, gems: 30, label: "450 Coins + 30 Gems", iconType: "chest" },
    { day: 7, coins: 1e3, skillPoints: 2, gems: 50, skinUnlock: "blade-gold", label: "1,000 Coins + Gold Blade + 50 Gems!", iconType: "blade" }
  ],
  vipTiers: [
    { tier: "bronze", title: "Bronze VIP", price: 500, coinBonus: 10, xpBonus: 5, dailyCoins: 25, dailySp: 0, exclusiveSkins: [], description: "+10% coins, +5% XP, 25 daily coins" },
    { tier: "silver", title: "Silver VIP", price: 1500, coinBonus: 25, xpBonus: 15, dailyCoins: 75, dailySp: 1, exclusiveSkins: ["blade-silver-vip"], description: "+25% coins, +15% XP, 75 daily coins + 1 SP" },
    { tier: "gold", title: "Gold VIP", price: 5e3, coinBonus: 50, xpBonus: 30, dailyCoins: 200, dailySp: 2, exclusiveSkins: ["blade-gold-vip", "wall-gold-vip"], description: "+50% coins, +30% XP, 200 daily coins + 2 SP, exclusive skins" }
  ],
  menuConfig: {
    eyebrow: "FRUIT TD \xB7 LIVE ONLINE",
    title: "Slice.\nHold the Wall.",
    subtitle: "High-speed tower defense with fruit-slashing action.",
    announcement: "Welcome Slicers! Daily bonus is live. Climb the Global Leaderboard!",
    themeColor: "#a3e635",
    backgroundImage: "",
    logoImage: "",
    faviconImage: ""
  },
  gameplayConfig: {
    startMoney: 140,
    startLives: 15,
    scoreMultiplier: 1,
    superChargeMultiplier: 1
  },
  pvpConfig: DEFAULT_PVP_CONFIG,
  missions: DEFAULT_MISSIONS,
  achievements: DEFAULT_ACHIEVEMENTS,
  badges: DEFAULT_BADGES,
  ranks: DEFAULT_RANK_TIERS,
  slicers: DEFAULT_SLICERS,
  enemies: [],
  waves: { version: 1, levels: {} },
  campaignStories: structuredClone(DEFAULT_CAMPAIGN_STORIES)
};
async function isAuthorized(req2) {
  const user = await resolveRequestUser(req2);
  return Boolean(ADMIN_STEAM_ID && user?.steamId === ADMIN_STEAM_ID);
}
adminRouter.get("/config", async (_req, res) => {
  try {
    const col = await getCollection("admin_config");
    let doc = await col.findOne({ configKey: "game_config" });
    if (!doc) {
      const seed = {
        ...DEFAULT_ADMIN_CONFIG2,
        updatedAt: /* @__PURE__ */ new Date()
      };
      await col.insertOne(seed);
      doc = seed;
    }
    const cfg = doc;
    res.json({
      success: true,
      config: {
        ...DEFAULT_ADMIN_CONFIG2,
        ...cfg,
        menuConfig: normalizeMenuConfig(cfg.menuConfig),
        vipTiers: Array.isArray(cfg.vipTiers) && cfg.vipTiers.length ? cfg.vipTiers : DEFAULT_ADMIN_CONFIG2.vipTiers,
        missions: normalizePrizeCatalog(cfg.missions, DEFAULT_MISSIONS),
        achievements: migrateCoopCatalog(normalizePrizeCatalog(cfg.achievements, DEFAULT_ACHIEVEMENTS), DEFAULT_ACHIEVEMENTS, cfg.coopCatalogVersion),
        badges: migrateCoopCatalog(normalizePrizeCatalog(cfg.badges, DEFAULT_BADGES), DEFAULT_BADGES, cfg.coopCatalogVersion),
        ranks: normalizePrizeCatalog(cfg.ranks, DEFAULT_RANK_TIERS),
        slicers: Array.isArray(cfg.slicers) && cfg.slicers.length ? cfg.slicers : DEFAULT_SLICERS,
        enemies: Array.isArray(cfg.enemies) && cfg.enemies.length ? cfg.enemies : [],
        waves: cfg.waves && typeof cfg.waves === "object" ? cfg.waves : DEFAULT_ADMIN_CONFIG2.waves,
        campaignBosses: Array.isArray(cfg.campaignBosses) ? cfg.campaignBosses.slice(0, 100) : [],
        campaignStories: Array.isArray(cfg.campaignStories) && !campaignStoriesError(cfg.campaignStories) ? cfg.campaignStories : DEFAULT_ADMIN_CONFIG2.campaignStories
      }
    });
  } catch (err) {
    console.error("Error getting admin config:", err);
    res.json({
      success: true,
      offline: true,
      config: { ...DEFAULT_ADMIN_CONFIG2, updatedAt: /* @__PURE__ */ new Date() }
    });
  }
});
adminRouter.post("/verify", async (req2, res) => {
  const valid = await isAuthorized(req2);
  res.json({
    success: true,
    isAdmin: valid
  });
});
adminRouter.post("/config", async (req2, res) => {
  if (!await isAuthorized(req2)) {
    return res.status(403).json({ success: false, error: "Unauthorized: Admin privileges required." });
  }
  try {
    const { dailyRewards, vipTiers, menuConfig, gameplayConfig, missions, achievements, badges, ranks, slicers, enemies, waves, campaignBosses, campaignStories } = req2.body;
    if (req2.body.creatorMedia !== void 0) {
      try {
        normalizeCreatorMedia(req2.body.creatorMedia);
      } catch (error2) {
        return res.status(400).json({ success: false, error: error2 instanceof Error ? error2.message : "Invalid Creator media." });
      }
    }
    const bossRosterError = campaignBosses === void 0 ? null : campaignBossRosterError(campaignBosses);
    if (bossRosterError) return res.status(400).json({ success: false, error: bossRosterError });
    const storyError = campaignStories === void 0 ? null : campaignStoriesError(campaignStories);
    if (storyError) return res.status(400).json({ success: false, error: storyError });
    const col = await getCollection("admin_config");
    const existing = await col.findOne({ configKey: "game_config" });
    const updated = {
      configKey: "game_config",
      dailyRewards: dailyRewards ? normalizeDailyRewards(dailyRewards) : existing?.dailyRewards || DEFAULT_ADMIN_CONFIG2.dailyRewards,
      vipTiers: vipTiers || existing?.vipTiers || DEFAULT_ADMIN_CONFIG2.vipTiers,
      menuConfig: menuConfig ? normalizeMenuConfig(menuConfig, normalizeMenuConfig(existing?.menuConfig)) : normalizeMenuConfig(existing?.menuConfig),
      gameplayConfig: gameplayConfig ? normalizeGameplayConfig(gameplayConfig) : existing?.gameplayConfig || DEFAULT_ADMIN_CONFIG2.gameplayConfig,
      pvpConfig: normalizePvpConfig(req2.body.pvpConfig ?? existing?.pvpConfig ?? DEFAULT_PVP_CONFIG),
      missions: normalizePrizeCatalog(Array.isArray(missions) ? missions : existing?.missions, DEFAULT_MISSIONS),
      coopCatalogVersion: 1,
      achievements: migrateCoopCatalog(normalizePrizeCatalog(Array.isArray(achievements) ? achievements : existing?.achievements, DEFAULT_ACHIEVEMENTS), DEFAULT_ACHIEVEMENTS, req2.body.coopCatalogVersion ?? existing?.coopCatalogVersion),
      badges: migrateCoopCatalog(normalizePrizeCatalog(Array.isArray(badges) ? badges : existing?.badges, DEFAULT_BADGES), DEFAULT_BADGES, req2.body.coopCatalogVersion ?? existing?.coopCatalogVersion),
      ranks: normalizePrizeCatalog(Array.isArray(ranks) ? ranks : existing?.ranks, DEFAULT_RANK_TIERS),
      slicers: Array.isArray(slicers) ? slicers : existing?.slicers || DEFAULT_SLICERS,
      enemies: Array.isArray(enemies) ? enemies : existing?.enemies || [],
      coopConfig: normalizeCoopConfig(req2.body.coopConfig ?? existing?.coopConfig),
      creatorMedia: normalizeCreatorMedia(req2.body.creatorMedia === void 0 ? existing?.creatorMedia : req2.body.creatorMedia),
      waves: waves && typeof waves === "object" ? waves : existing?.waves || DEFAULT_ADMIN_CONFIG2.waves,
      campaignBosses: campaignBosses !== void 0 ? campaignBosses : existing?.campaignBosses || [],
      campaignStories: campaignStories !== void 0 ? campaignStories : existing?.campaignStories || DEFAULT_ADMIN_CONFIG2.campaignStories,
      updatedAt: /* @__PURE__ */ new Date()
    };
    await col.updateOne({ configKey: "game_config" }, { $set: updated }, { upsert: true });
    invalidateCatalogCache();
    res.json({
      success: true,
      message: "Admin configuration saved successfully to MongoDB Atlas!",
      config: updated
    });
  } catch (err) {
    console.error("Error saving admin config:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
function normalizePvpConfig(input) {
  const row = input && typeof input === "object" ? input : {};
  const bounded = (value, fallback, min, max) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const maps = normalizePvpMaps(row.maps);
  const towers = Object.fromEntries(Object.entries(DEFAULT_PVP_CONFIG.towers).map(([id, base]) => {
    const item = row.towers?.[id];
    return [id, {
      cost: bounded(item?.cost, base.cost, 1, 1e4),
      damage: bounded(item?.damage, base.damage, 1, 1e4),
      range: bounded(item?.range, base.range, 1, 24),
      cooldownMs: bounded(item?.cooldownMs, base.cooldownMs, 100, 6e4)
    }];
  }));
  const attacks = Object.fromEntries(Object.entries(DEFAULT_PVP_CONFIG.attacks).map(([id, base]) => {
    const item = row.attacks?.[id];
    return [id, { cost: bounded(item?.cost, base.cost, 1, 1e4), health: bounded(item?.health, base.health, 1, 1e4), speed: bounded(item?.speed, base.speed, 0.1, 10), wallDamage: bounded(item?.wallDamage, base.wallDamage, 1, 1e4), rewardFruts: bounded(item?.rewardFruts, base.rewardFruts, 0, 1e4), packSize: Math.floor(bounded(item?.packSize, base.packSize || 1, 1, 8)) }];
  }));
  const tiers = Array.isArray(row.rating?.tiers) ? row.rating.tiers : DEFAULT_PVP_CONFIG.rating.tiers;
  return {
    version: 1,
    maps,
    map: maps[0],
    durationSeconds: bounded(row.durationSeconds, 180, 60, 600),
    wallHealth: bounded(row.wallHealth, 1e3, 100, 1e5),
    startingFruts: bounded(row.startingFruts, 180, 0, 1e5),
    incomePerSecond: bounded(row.incomePerSecond, DEFAULT_PVP_CONFIG.incomePerSecond, 0, 1e3),
    reconnectGraceSeconds: bounded(row.reconnectGraceSeconds, 45, 10, 300),
    towers,
    attacks,
    mainTower: { damage: bounded(row.mainTower?.damage, 18, 0, 1e4), range: bounded(row.mainTower?.range, 2, 0, 24), cooldownMs: bounded(row.mainTower?.cooldownMs, 1e3, 100, 6e4) },
    rating: { ...DEFAULT_PVP_CONFIG.rating, ...row.rating || {}, start: bounded(row.rating?.start, 1e3, 0, 1e6), win: bounded(row.rating?.win, 50, 0, 1e3), tie: bounded(row.rating?.tie, 20, 0, 1e3), loss: -bounded(Math.abs(row.rating?.loss ?? -50), 50, 1, 1e3), bonusCap: bounded(row.rating?.bonusCap, 20, 0, 1e3), seasonResetPercent: bounded(row.rating?.seasonResetPercent, 25, 0, 100), combo: DEFAULT_PVP_CONFIG.rating.combo, tiers: DEFAULT_PVP_CONFIG.rating.tiers.map((base, i) => ({ name: base.name, min: bounded(tiers[i]?.min, base.min, 0, 1e6) })) },
    seasonRewards: DEFAULT_PVP_CONFIG.seasonRewards.map((base, i) => ({ ...base, ...row.seasonRewards?.[i] || {}, tier: base.tier }))
  };
}
adminRouter.post("/reset-daily", async (req2, res) => {
  if (!await isAuthorized(req2)) {
    return res.status(403).json({ success: false, error: "Unauthorized: Admin privileges required." });
  }
  try {
    const { userId } = req2.body;
    if (!validId(userId)) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }
    const col = await getCollection("daily_bonus");
    await col.deleteOne({ userId });
    res.json({
      success: true,
      message: `Daily streak reset for user ${userId}. You can now claim Day 1 immediately!`
    });
  } catch (err) {
    console.error("Error resetting daily bonus:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
adminRouter.get("/leaderboard", async (req2, res) => {
  if (!await isAuthorized(req2)) {
    return res.status(403).json({ success: false, error: "Unauthorized: Admin privileges required." });
  }
  try {
    const col = await getCollection("leaderboards");
    const entries = await col.find({}).sort({ createdAt: -1 }).limit(100).toArray();
    res.json({ success: true, entries });
  } catch (err) {
    console.error("Error fetching admin leaderboard:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
adminRouter.post("/leaderboard/delete", async (req2, res) => {
  if (!await isAuthorized(req2)) {
    return res.status(403).json({ success: false, error: "Unauthorized: Admin privileges required." });
  }
  try {
    const { id, wipeAll, mode } = req2.body;
    const col = await getCollection("leaderboards");
    if (wipeAll && mode) {
      const resolved = mode === "monthly" ? monthlyLeaderboardMode() : mode;
      const result = await col.deleteMany({ mode: resolved });
      return res.json({ success: true, message: `Deleted ${result.deletedCount} scores in mode ${resolved}.` });
    }
    if (id) {
      await col.deleteOne({ _id: new ObjectId(id) });
      return res.json({ success: true, message: `Score entry ${id} deleted.` });
    }
    res.status(400).json({ success: false, error: "Missing entry id or wipeAll parameters." });
  } catch (err) {
    console.error("Error deleting leaderboard entry:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/daily.ts
var defaultDeps4 = {
  resolveUser: resolveRequestUser,
  collection: getCollection,
  rewards: getActiveDailyRewards,
  vipTiers: async () => {
    const col = await getCollection("admin_config");
    const doc = await col.findOne({ configKey: "game_config" });
    return doc?.vipTiers?.length ? doc.vipTiers : DEFAULT_ADMIN_CONFIG2.vipTiers || [];
  },
  allowedSkinIds: async () => {
    const catalog = await loadQuestCatalog();
    return /* @__PURE__ */ new Set([...catalog.slicers.map((item) => item.id), ...WALL_SKINS.map((item) => item.id)]);
  }
};
async function getActiveDailyRewards() {
  try {
    const col = await getCollection("admin_config");
    const doc = await col.findOne({ configKey: "game_config" });
    if (doc?.dailyRewards && Array.isArray(doc.dailyRewards) && doc.dailyRewards.length > 0) {
      return DEFAULT_ADMIN_CONFIG2.dailyRewards.map((fallback, i) => ({
        ...fallback,
        ...doc.dailyRewards[i] || {},
        day: i + 1
      }));
    }
  } catch {
  }
  return DEFAULT_ADMIN_CONFIG2.dailyRewards;
}
async function withVipDailyBonus(userId, rewards, deps) {
  if (!deps.vipTiers) return rewards;
  const saves = await deps.collection("cloud_saves");
  const wallet = await saves.findOne({ userId });
  const status = wallet?.saveData?.vipStatus;
  const vip = (await deps.vipTiers()).find((tier) => tier.tier === status);
  if (!vip) return rewards;
  const coinBonus = Math.max(0, Math.min(1e6, Math.floor(Number(vip.dailyCoins) || 0)));
  const skillBonus = Math.max(0, Math.min(1e4, Math.floor(Number(vip.dailySp) || 0)));
  return rewards.map((reward) => ({
    ...reward,
    coins: Math.min(1e6, reward.coins + coinBonus),
    skillPoints: Math.min(1e4, reward.skillPoints + skillBonus),
    label: `${reward.label} \xB7 VIP +${coinBonus} Coins${skillBonus ? ` +${skillBonus} SP` : ""}`
  }));
}
function getDayKey2(date = /* @__PURE__ */ new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
function createDailyRouter(deps = defaultDeps4) {
  const router = Router6();
  router.get("/", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to view daily rewards" });
      const userId = user.userId;
      const todayStr = getDayKey2();
      const col = await deps.collection("daily_bonus");
      const existing = await col.findOne({ userId });
      const activeRewards = await withVipDailyBonus(userId, await deps.rewards(), deps);
      let currentStreak = existing?.streak || 0;
      let canClaim = false;
      if (!existing || !existing.lastClaimDate) {
        canClaim = true;
        currentStreak = 1;
      } else {
        const lastDate = new Date(existing.lastClaimDate);
        const todayDate = new Date(todayStr);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1e3 * 60 * 60 * 24));
        if (diffDays === 0) {
          canClaim = false;
        } else if (diffDays === 1) {
          canClaim = true;
          currentStreak = existing.streak % 7 + 1;
        } else {
          canClaim = true;
          currentStreak = 1;
        }
      }
      res.json({
        success: true,
        streak: currentStreak,
        canClaim,
        lastClaimDate: existing?.lastClaimDate || null,
        today: todayStr,
        rewards: activeRewards
      });
    } catch (err) {
      console.error("Error getting daily bonus status:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/claim", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to claim daily rewards" });
      const userId = user.userId;
      const todayStr = getDayKey2();
      const col = await deps.collection("daily_bonus");
      const existing = await col.findOne({ userId });
      const activeRewards = await withVipDailyBonus(userId, await deps.rewards(), deps);
      let newStreak = 1;
      if (existing && existing.lastClaimDate) {
        const lastDate = new Date(existing.lastClaimDate);
        const todayDate = new Date(todayStr);
        const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1e3 * 60 * 60 * 24));
        if (diffDays === 0) {
          return res.status(400).json({ success: false, error: "Daily bonus already claimed for today" });
        } else if (diffDays === 1) {
          newStreak = existing.streak % 7 + 1;
        } else {
          newStreak = 1;
        }
      }
      const reward = activeRewards[newStreak - 1] || activeRewards[0];
      if (reward.skinUnlock && !(await deps.allowedSkinIds()).has(reward.skinUnlock)) {
        return res.status(500).json({ success: false, error: "Configured daily reward item is unavailable" });
      }
      const saves = await deps.collection("cloud_saves");
      const wallet = await creditClaimReward(userId, `daily:${todayStr}`, {
        coins: reward.coins,
        gems: reward.gems,
        skillPoints: reward.skillPoints,
        items: reward.skinUnlock ? [reward.skinUnlock] : []
      }, saves);
      if (!wallet) return res.status(400).json({ success: false, error: "Daily bonus already claimed for today" });
      const consumed = await col.updateOne(
        { userId, lastClaimDate: { $ne: todayStr } },
        {
          $set: {
            streak: newStreak,
            lastClaimDate: todayStr,
            updatedAt: /* @__PURE__ */ new Date()
          },
          $inc: {
            totalClaimed: 1
          }
        },
        { upsert: true }
      );
      if (consumed.modifiedCount !== 1 && consumed.upsertedCount !== 1) {
        return res.status(409).json({ success: false, error: "Daily claim receipt was recorded; reload your wallet" });
      }
      const rewardParts = [
        reward.coins ? `${reward.coins} coins` : "",
        reward.gems ? `${reward.gems} gems` : "",
        reward.skillPoints ? `${reward.skillPoints} skill points` : "",
        reward.skinUnlock ? "a new item" : ""
      ].filter(Boolean).join(" \xB7 ");
      await saveNotification(() => deps.collection("notifications"), {
        userId,
        type: "daily_reward",
        title: "Daily drop received",
        body: `Day ${newStreak}: ${rewardParts || reward.label}`,
        eventKey: `daily-reward:${userId}:${todayStr}`
      });
      res.json({
        success: true,
        streak: newStreak,
        reward,
        saveData: wallet.saveData,
        revision: wallet.revision
      });
    } catch (err) {
      if (err?.code === 11e3) return res.status(400).json({ success: false, error: "Daily bonus already claimed for today" });
      console.error("Error claiming daily bonus:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  return router;
}
var dailyRouter = createDailyRouter();

// server/routes/steam.ts
import { Router as Router8 } from "express";
import crypto4 from "crypto";

// server/steam.ts
import dotenv2 from "dotenv";
dotenv2.config({ quiet: true });
var STEAM_API_KEY = process.env.STEAM_API_KEY || "";
async function fetchSteamPlayerSummary(steamId) {
  if (!STEAM_API_KEY) {
    console.warn("STEAM_API_KEY is not set");
    return null;
  }
  try {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId}`;
    const res = await fetch(url);
    const data = await res.json();
    const player = data?.response?.players?.[0];
    if (!player) return null;
    return {
      steamId: player.steamid,
      personaName: player.personaname,
      profileUrl: player.profileurl,
      avatar: player.avatar,
      avatarMedium: player.avatarmedium,
      avatarFull: player.avatarfull,
      countryCode: player.loccountrycode,
      realName: player.realname
    };
  } catch (err) {
    console.error("Error fetching Steam player summary:", err);
    return null;
  }
}

// server/username.ts
var BLOCKED = new Set(
  [
    "admin",
    "administrator",
    "mod",
    "moderator",
    "nigger",
    "nigga",
    "faggot",
    "fag",
    "retard",
    "rape",
    "rapist",
    "pedo",
    "pedophile",
    "hitler",
    "nazi",
    "fuck",
    "fucker",
    "fucking",
    "shit",
    "asshole",
    "bitch",
    "cunt",
    "dick",
    "cock",
    "pussy",
    "whore",
    "slut",
    "bastard",
    "motherfucker",
    "cum",
    "porn",
    "sex",
    "xxx",
    "kill",
    "suicide",
    "terrorist"
  ].map((w) => w.toLowerCase())
);
function sanitizeSteamUsername(persona) {
  const cleaned = persona.replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  if (cleaned.length >= 3 && !validateUsername(cleaned).ok) {
    return `Slicer${cleaned.slice(0, 8) || Date.now().toString(36).slice(-4)}`;
  }
  if (cleaned.length >= 3) return cleaned;
  return `Slicer${Date.now().toString(36).slice(-6)}`;
}
function validateUsername(raw) {
  const username = raw.trim();
  if (!username) return { ok: false, error: "Username is required." };
  if (/\s/.test(username)) return { ok: false, error: "Username cannot contain spaces." };
  if (!/^[A-Za-z0-9]+$/.test(username)) {
    return { ok: false, error: "Username can only use letters and numbers (no symbols)." };
  }
  if (username.length < 3 || username.length > 16) {
    return { ok: false, error: "Username must be 3\u201316 characters." };
  }
  const lower = username.toLowerCase();
  for (const word of BLOCKED) {
    if (lower === word || lower.includes(word)) {
      return { ok: false, error: "That username is not allowed. Pick another." };
    }
  }
  return { ok: true, username };
}

// server/routes/auth.ts
import { Router as Router7 } from "express";
import crypto3 from "crypto";
var authRouter = Router7();
function bearer(req2) {
  const h = req2.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  const q = req2.query.token;
  if (typeof q === "string" && q) return q;
  const body = req2.body?.token;
  if (typeof body === "string" && body) return body;
  return null;
}
async function unlockSteamAchievement(userId) {
  try {
    const achCol = await getCollection("achievements");
    await achCol.updateOne(
      { userId, achievementId: "steam_connect" },
      {
        $set: {
          progress: 1,
          maxProgress: 1,
          unlocked: true,
          unlockedAt: /* @__PURE__ */ new Date(),
          claimed: false
        }
      },
      { upsert: true }
    );
  } catch {
  }
}
authRouter.get("/me", async (req2, res) => {
  try {
    const user = await resolveSession(bearer(req2));
    if (!user) return res.status(401).json({ success: false, error: "Not signed in" });
    res.json({ success: true, user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
authRouter.post("/logout", async (req2, res) => {
  try {
    await destroySession(bearer(req2));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
authRouter.post("/register", async (req2, res) => {
  try {
    const email = String(req2.body?.email || "").trim().toLowerCase();
    const password = String(req2.body?.password || "");
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: "Enter a valid email address." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters." });
    }
    const users = await getCollection("users");
    const existing = await users.findOne({ email });
    if (existing) {
      return res.status(409).json({ success: false, error: "An account with that email already exists. Log in instead." });
    }
    const userId = "user_" + crypto3.randomBytes(8).toString("hex");
    const code = makeVerifyCode();
    const now = /* @__PURE__ */ new Date();
    const doc = {
      userId,
      email,
      emailVerified: false,
      emailVerifyCodeHash: hashToken(code),
      emailVerifyExpires: new Date(Date.now() + 30 * 60 * 1e3),
      passwordHash: hashPassword(password),
      authProvider: "email",
      nickname: "Slicer",
      avatar: "",
      profileComplete: false,
      createdAt: now,
      updatedAt: now
    };
    await users.insertOne(doc);
    const delivery = await deliverVerifyCode(email, code);
    if (!delivery.emailed && !delivery.previewCode) {
      await users.deleteOne({ userId });
      return res.status(503).json({ success: false, error: delivery.error || "Email delivery is unavailable." });
    }
    const token = await createSession(userId);
    res.json({
      success: true,
      token,
      user: publicUser(doc),
      needsEmailConfirm: true,
      needsProfileSetup: true,
      ...delivery
    });
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ success: false, error: err.message });
  }
});
authRouter.post("/login", async (req2, res) => {
  try {
    const email = String(req2.body?.email || "").trim().toLowerCase();
    const password = String(req2.body?.password || "");
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }
    const users = await getCollection("users");
    const user = await users.findOne({ email });
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ success: false, error: "Wrong email or password." });
    }
    const token = await createSession(user.userId);
    res.json({
      success: true,
      token,
      user: publicUser(user),
      needsEmailConfirm: !user.emailVerified,
      needsProfileSetup: !user.profileComplete
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
authRouter.post("/verify-email", async (req2, res) => {
  try {
    const user = await resolveSession(bearer(req2));
    if (!user) return res.status(401).json({ success: false, error: "Not signed in" });
    const code = String(req2.body?.code || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ success: false, error: "Enter the 6-digit code from your email." });
    }
    if (!user.emailVerifyCodeHash || !user.emailVerifyExpires) {
      return res.status(400).json({ success: false, error: "No verification pending. Press Send code for a new one." });
    }
    if (user.emailVerifyExpires.getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: "Code expired. Request a new one." });
    }
    if (hashToken(code) !== user.emailVerifyCodeHash) {
      return res.status(400).json({ success: false, error: "Incorrect code." });
    }
    const users = await getCollection("users");
    await users.updateOne(
      { userId: user.userId },
      {
        $set: { emailVerified: true, updatedAt: /* @__PURE__ */ new Date() },
        $unset: { emailVerifyCodeHash: "", emailVerifyExpires: "" }
      }
    );
    const updated = await users.findOne({ userId: user.userId });
    res.json({
      success: true,
      user: updated ? publicUser(updated) : null,
      needsProfileSetup: updated ? !updated.profileComplete : true
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
authRouter.post("/resend-verify", async (req2, res) => {
  try {
    const user = await resolveSession(bearer(req2));
    if (!user) return res.status(401).json({ success: false, error: "Not signed in" });
    if (user.emailVerified) return res.json({ success: true, alreadyVerified: true });
    let email = user.email;
    const bodyEmail = String(req2.body?.email || "").trim().toLowerCase();
    if (bodyEmail) {
      if (!isValidEmail(bodyEmail)) {
        return res.status(400).json({ success: false, error: "Enter a valid email address." });
      }
      const users2 = await getCollection("users");
      const taken = await users2.findOne({ email: bodyEmail, userId: { $ne: user.userId } });
      if (taken) return res.status(409).json({ success: false, error: "That email is already used." });
      email = bodyEmail;
    }
    if (!email) return res.status(400).json({ success: false, error: "Email is required." });
    const code = makeVerifyCode();
    const users = await getCollection("users");
    await users.updateOne(
      { userId: user.userId },
      {
        $set: {
          email,
          emailVerified: false,
          emailVerifyCodeHash: hashToken(code),
          emailVerifyExpires: new Date(Date.now() + 30 * 60 * 1e3),
          updatedAt: /* @__PURE__ */ new Date()
        }
      }
    );
    const delivery = await deliverVerifyCode(email, code);
    if (!delivery.emailed && !delivery.previewCode) {
      return res.status(503).json({ success: false, error: delivery.error || "Email delivery is unavailable." });
    }
    res.json({ success: true, email, ...delivery });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
authRouter.post("/set-email", async (req2, res) => {
  try {
    const user = await resolveSession(bearer(req2));
    if (!user) return res.status(401).json({ success: false, error: "Not signed in" });
    const email = String(req2.body?.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: "Enter a valid email address." });
    }
    const users = await getCollection("users");
    const taken = await users.findOne({ email, userId: { $ne: user.userId } });
    if (taken) return res.status(409).json({ success: false, error: "That email is already used." });
    const code = makeVerifyCode();
    await users.updateOne(
      { userId: user.userId },
      {
        $set: {
          email,
          emailVerified: false,
          emailVerifyCodeHash: hashToken(code),
          emailVerifyExpires: new Date(Date.now() + 30 * 60 * 1e3),
          updatedAt: /* @__PURE__ */ new Date()
        }
      }
    );
    const delivery = await deliverVerifyCode(email, code);
    if (!delivery.emailed && !delivery.previewCode) {
      return res.status(503).json({ success: false, error: delivery.error || "Email delivery is unavailable." });
    }
    res.json({ success: true, email, ...delivery });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
authRouter.post("/complete-profile", async (req2, res) => {
  try {
    const user = await resolveSession(bearer(req2));
    if (!user) return res.status(401).json({ success: false, error: "Not signed in" });
    if (!user.emailVerified) {
      return res.status(403).json({ success: false, error: "Confirm your email first." });
    }
    const check = validateUsername(String(req2.body?.username || ""));
    if (!check.ok) return res.status(400).json({ success: false, error: check.error });
    const avatar = String(req2.body?.avatar || "").trim();
    if (!avatar || avatar.length < 32) {
      return res.status(400).json({ success: false, error: "Upload an avatar image." });
    }
    if (avatar.length > 9e5) {
      return res.status(400).json({ success: false, error: "Avatar is too large. Use a smaller image." });
    }
    const users = await getCollection("users");
    const taken = await users.findOne({
      username: { $regex: new RegExp(`^${check.username}$`, "i") },
      userId: { $ne: user.userId }
    });
    if (taken) return res.status(409).json({ success: false, error: "That username is already taken." });
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
          updatedAt: /* @__PURE__ */ new Date()
        }
      }
    );
    const updated = await users.findOne({ userId: user.userId });
    res.json({ success: true, user: updated ? publicUser(updated) : null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/steam.ts
var steamRouter = Router8();
function frontendOrigin() {
  return (process.env.APP_URL || process.env.PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
}
function apiCallbackOrigin(req2) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.API_URL) return process.env.API_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  const host = String(req2.headers["x-forwarded-host"] || req2.headers.host || "");
  if (host && !host.includes("localhost:3001") && !host.startsWith("127.0.0.1:3001")) {
    const proto = req2.headers["x-forwarded-proto"] || req2.protocol || "https";
    return `${proto}://${host}`;
  }
  const port = process.env.PORT || "3001";
  return `http://localhost:${port}`;
}
steamRouter.get("/login", async (req2, res) => {
  try {
    const mode = String(req2.query.mode || "login");
    const existingToken = typeof req2.query.token === "string" ? req2.query.token : "";
    const returnBase = apiCallbackOrigin(req2);
    const returnTo = `${returnBase}/api/steam/callback?mode=${encodeURIComponent(mode)}${existingToken ? `&linkToken=${encodeURIComponent(existingToken)}` : ""}`;
    const realm = frontendOrigin();
    const params = new URLSearchParams({
      "openid.ns": "http://specs.openid.net/auth/2.0",
      "openid.mode": "checkid_setup",
      "openid.return_to": returnTo,
      "openid.realm": realm,
      "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
      "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select"
    });
    res.redirect(`https://steamcommunity.com/openid/login?${params.toString()}`);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
async function verifySteamOpenId(query) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (typeof v === "string") params.set(k, v);
  }
  params.set("openid.mode", "check_authentication");
  const verifyRes = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const text = await verifyRes.text();
  if (!text.includes("is_valid:true")) return null;
  const claimed = String(query["openid.claimed_id"] || "");
  const match = claimed.match(/\/openid\/id\/(\d{17})$/);
  return match?.[1] || null;
}
steamRouter.get("/callback", async (req2, res) => {
  const front = frontendOrigin();
  const fail2 = (msg) => res.redirect(`${front}/?auth_error=${encodeURIComponent(msg)}`);
  try {
    const steamId = await verifySteamOpenId(req2.query);
    if (!steamId) return fail2("Steam login could not be verified.");
    const summary = await fetchSteamPlayerSummary(steamId);
    if (!summary) return fail2("Could not load your Steam profile.");
    const users = await getCollection("users");
    const mode = String(req2.query.mode || "login");
    const linkToken = typeof req2.query.linkToken === "string" ? req2.query.linkToken : "";
    let user = null;
    let bonus = false;
    if (linkToken) {
      const sessionUser = await resolveSession(linkToken);
      if (sessionUser) {
        const other = await users.findOne({ steamId, userId: { $ne: sessionUser.userId } });
        if (other) return fail2("That Steam account is already linked to another player.");
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
              authProvider: sessionUser.passwordHash ? "steam+email" : "steam",
              updatedAt: /* @__PURE__ */ new Date()
            }
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
      const userId = "user_" + crypto4.randomBytes(8).toString("hex");
      const username = sanitizeSteamUsername(summary.personaName);
      const now = /* @__PURE__ */ new Date();
      const doc = {
        userId,
        steamId: summary.steamId,
        steamPersona: summary.personaName,
        steamAvatar: summary.avatarFull,
        nickname: summary.personaName,
        username,
        avatar: summary.avatarFull,
        authProvider: "steam",
        emailVerified: false,
        profileComplete: true,
        steamBonusGranted: false,
        createdAt: now,
        updatedAt: now
      };
      await users.insertOne(doc);
      await unlockSteamAchievement(userId);
      user = doc;
      bonus = true;
    } else {
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
            updatedAt: /* @__PURE__ */ new Date()
          }
        }
      );
      user = await users.findOne({ userId: user.userId });
    }
    if (bonus && user) {
      await creditClaimReward(user.userId, "steam-welcome", { coins: 500, skillPoints: 1 });
      await users.updateOne({ userId: user.userId }, { $set: { steamBonusGranted: true, updatedAt: /* @__PURE__ */ new Date() } });
    }
    const token = await createSession(user.userId);
    const needsEmail = !user.emailVerified;
    const qs = new URLSearchParams({
      auth_token: token,
      steam: "1",
      needs_email: needsEmail ? "1" : "0",
      bonus: bonus ? "1" : "0",
      mode
    });
    res.redirect(`${front}/?${qs.toString()}`);
  } catch (err) {
    console.error("Steam callback error", err);
    return fail2(err.message || "Steam login failed.");
  }
});
steamRouter.post("/link", async (req2, res) => {
  try {
    const user = await resolveSession(bearer(req2));
    if (!user) return res.status(401).json({ success: false, error: "Sign in first to link Steam." });
    return res.status(400).json({
      success: false,
      error: "Use Sign in through Steam. Manual Steam ID entry is disabled.",
      useOpenId: true
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
steamRouter.get("/status", async (req2, res) => {
  try {
    const user = await resolveSession(bearer(req2));
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
      email: user.email || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/profile.ts
import { Router as Router9 } from "express";
var defaultDeps5 = {
  resolveUser: resolveRequestUser,
  collection: getCollection,
  allowedSkinIds: async () => {
    const catalog = await loadQuestCatalog();
    return /* @__PURE__ */ new Set([...catalog.slicers.map((item) => item.id), ...WALL_SKINS.map((item) => item.id)]);
  }
};
function etag(revision) {
  return `"${revision}"`;
}
function serverRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function createProfileRouter(deps = defaultDeps5) {
  const router = Router9();
  router.get("/", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to view a cloud save" });
      const userId = user.userId;
      const col = await deps.collection("cloud_saves");
      const doc = await col.findOne({ userId });
      const revision = serverRevision(doc?.revision);
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("ETag", etag(revision));
      const usersCol = await deps.collection("users");
      const userDoc = await usersCol.findOne({ userId });
      res.json({
        success: true,
        saveData: doc?.saveData || null,
        revision,
        updatedAt: doc?.updatedAt || null,
        user: userDoc ? {
          nickname: userDoc.nickname,
          avatar: userDoc.avatar,
          steamId: userDoc.steamId,
          steamPersona: userDoc.steamPersona,
          steamAvatar: userDoc.steamAvatar
        } : null
      });
    } catch (err) {
      console.error("Error fetching profile cloud save:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/sync", async (req2, res) => {
    try {
      const { saveData: incoming, revision } = req2.body ?? {};
      const allowedSkinIds = await deps.allowedSkinIds();
      const invalid = saveValidationError(incoming, allowedSkinIds);
      if (invalid) return res.status(400).json({ success: false, error: invalid });
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to sync a profile" });
      if (!Number.isSafeInteger(revision) || revision < 0) {
        return res.status(428).json({ success: false, error: "A current server revision is required" });
      }
      const userId = user.userId;
      const col = await deps.collection("cloud_saves");
      const current = await col.findOne({ userId });
      const currentRevision = serverRevision(current?.revision);
      if (revision !== currentRevision) {
        res.setHeader("ETag", etag(currentRevision));
        return res.status(409).json({ success: false, error: "Save conflict: reload the current server revision", revision: currentRevision });
      }
      const authoritative = current?.saveData ?? defaultSave();
      const authorityError = serverOwnedSaveError(incoming, authoritative);
      if (authorityError) return res.status(422).json({ success: false, error: authorityError, revision: currentRevision });
      const saveData = { ...authoritative, ...incoming };
      const nextRevision = currentRevision + 1;
      const updatedAt = /* @__PURE__ */ new Date();
      let written = false;
      if (current) {
        const result = await col.updateOne(
          current.revision === void 0 ? { userId, revision: { $exists: false } } : { userId, revision: currentRevision },
          { $set: { saveData, revision: nextRevision, updatedAt } }
        );
        written = result.matchedCount === 1;
      } else {
        try {
          await col.insertOne({ userId, saveData, revision: nextRevision, updatedAt });
          written = true;
        } catch (err) {
          if (err?.code !== 11e3) throw err;
        }
      }
      if (!written) {
        const latest = await col.findOne({ userId });
        const latestRevision = latest ? serverRevision(latest.revision) : currentRevision;
        res.setHeader("ETag", etag(latestRevision));
        return res.status(409).json({ success: false, error: "Save conflict: reload the current server revision", revision: latestRevision });
      }
      const usersCol = await deps.collection("users");
      await usersCol.updateOne(
        { userId },
        {
          $set: {
            nickname: saveData.nickname || user.nickname || "Slicer",
            avatar: saveData.avatar || user.avatar || "",
            updatedAt
          },
          $setOnInsert: { createdAt: updatedAt }
        },
        { upsert: true }
      );
      res.setHeader("ETag", etag(nextRevision));
      res.json({ success: true, revision: nextRevision, saveData, timestamp: updatedAt });
    } catch (err) {
      if (err?.code === 11e3) return res.status(409).json({ success: false, error: "Save conflict: reload the current server revision" });
      console.error("Error syncing cloud save:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
  return router;
}
var profileRouter = createProfileRouter();

// server/routes/badges.ts
import { Router as Router10 } from "express";
var badgesRouter = Router10();
badgesRouter.get("/", async (req2, res) => {
  try {
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to view badges" });
    const userId = user.userId;
    const catalog = await loadQuestCatalog();
    const defs = catalog.badges.filter((b) => b.enabled !== false);
    const col = await getCollection("badges");
    const docs = await col.find({ userId }).toArray();
    const wallet = await (await getCollection("cloud_saves")).findOne({ userId });
    const receipts = new Set(wallet?.claimReceipts || []);
    const rewardedBadgeIds = /* @__PURE__ */ new Set();
    for (const mission of catalog.missions) {
      if (mission.rewardBadge && [...receipts].some((receipt) => receipt.startsWith("mission:") && receipt.endsWith(`:${mission.id}`))) {
        rewardedBadgeIds.add(mission.rewardBadge);
      }
    }
    for (const achievement of catalog.achievements) {
      if (achievement.rewardBadge && receipts.has(`achievement:${achievement.id}`)) rewardedBadgeIds.add(achievement.rewardBadge);
    }
    const map = new Map(docs.map((d) => [d.badgeId, d]));
    const badges = defs.map((def) => {
      const doc = map.get(def.id);
      const maxProgress = def.requirement?.goal || 1;
      const progress = Math.min(doc?.progress || 0, maxProgress);
      const unlocked = !!doc?.unlocked || progress >= maxProgress || rewardedBadgeIds.has(def.id);
      return {
        id: def.id,
        title: def.title,
        desc: def.desc,
        icon: def.icon,
        rarity: def.rarity,
        rewardCoins: def.rewardCoins ?? 0,
        rewardGems: def.rewardGems ?? 0,
        claimed: receipts.has(`badge:${def.id}`),
        progress: rewardedBadgeIds.has(def.id) ? maxProgress : progress,
        maxProgress,
        unlocked
      };
    });
    res.json({
      success: true,
      badges,
      unlocked: badges.filter((b) => b.unlocked).length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
badgesRouter.post("/claim", async (req2, res) => {
  try {
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to claim badge rewards" });
    const badgeId = req2.body?.badgeId;
    if (typeof badgeId !== "string") return res.status(400).json({ success: false, error: "Invalid badge id" });
    const catalog = await loadQuestCatalog();
    const def = catalog.badges.find((badge2) => badge2.id === badgeId && badge2.enabled !== false);
    if (!def) return res.status(404).json({ success: false, error: "Badge not found" });
    const badges = await getCollection("badges");
    const badge = await badges.findOne({ userId: user.userId, badgeId });
    const walletCol = await getCollection("cloud_saves");
    const currentWallet = await walletCol.findOne({ userId: user.userId });
    const receipts = currentWallet?.claimReceipts || [];
    const missionReceiptUnlock = catalog.missions.some((mission) => mission.rewardBadge === badgeId && receipts.some((receipt) => receipt.startsWith("mission:") && receipt.endsWith(`:${mission.id}`)));
    const achievementReceiptUnlock = catalog.achievements.some((achievement) => achievement.rewardBadge === badgeId && receipts.includes(`achievement:${achievement.id}`));
    if (!badge?.unlocked && (badge?.progress ?? 0) < (def.requirement?.goal ?? 1) && !missionReceiptUnlock && !achievementReceiptUnlock) {
      return res.status(422).json({ success: false, error: "Badge has not been unlocked" });
    }
    const wallet = await creditClaimReward(user.userId, `badge:${badgeId}`, {
      coins: def.rewardCoins ?? 0,
      gems: def.rewardGems ?? 0
    });
    if (!wallet) return res.status(409).json({ success: false, error: "Badge reward already claimed" });
    await saveNotification(() => getCollection("notifications"), {
      userId: user.userId,
      type: "badge_reward",
      title: "Badge reward received",
      body: `${def.title} \xB7 ${def.rewardCoins ?? 0} coins \xB7 ${def.rewardGems ?? 0} gems`,
      eventKey: `badge-reward:${user.userId}:${badgeId}`
    });
    res.json({ success: true, badgeId, rewardCoins: def.rewardCoins ?? 0, rewardGems: def.rewardGems ?? 0, saveData: wallet.saveData, revision: wallet.revision });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
badgesRouter.post("/progress", async (req2, res) => {
  try {
    const { updates } = req2.body;
    if (!validProgressUpdates(updates, "badgeId")) {
      return res.status(400).json({ success: false, error: "Invalid payload" });
    }
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to update badges" });
    const userId = user.userId;
    const catalog = await loadQuestCatalog();
    const col = await getCollection("badges");
    const newlyUnlocked = [];
    for (const update of updates) {
      const def = catalog.badges.find((b) => b.id === update.badgeId && b.enabled !== false);
      if (!def) continue;
      const authorityEvent = def.requirement && requirementById(def.requirement.type)?.event;
      if (authorityEvent === "pvp_result" || authorityEvent === "coop_result") continue;
      const existing = await col.findOne({ userId, badgeId: def.id });
      let currentProgress = existing?.progress || 0;
      const maxProgress = def.requirement?.goal || 1;
      if (typeof update.setProgress === "number") {
        currentProgress = Math.max(currentProgress, update.setProgress);
      } else if (typeof update.progressDelta === "number") {
        currentProgress += update.progressDelta;
      }
      const unlocked = currentProgress >= maxProgress;
      if (unlocked && !existing?.unlocked) newlyUnlocked.push(def.id);
      await col.updateOne(
        { userId, badgeId: def.id },
        {
          $set: {
            progress: Math.min(maxProgress, currentProgress),
            maxProgress,
            unlocked,
            unlockedAt: unlocked && !existing?.unlocked ? /* @__PURE__ */ new Date() : existing?.unlockedAt
          }
        },
        { upsert: true }
      );
    }
    for (const badgeId of newlyUnlocked) {
      const def = catalog.badges.find((badge) => badge.id === badgeId);
      if (!def) continue;
      await saveNotification(() => getCollection("notifications"), {
        userId,
        type: "badge_unlocked",
        title: "Badge unlocked",
        body: `${def.title}${def.rewardCoins || def.rewardGems ? ` \xB7 ${def.rewardCoins ?? 0} coins \xB7 ${def.rewardGems ?? 0} gems` : ""}`,
        eventKey: `badge-unlocked:${userId}:${badgeId}`
      });
    }
    res.json({ success: true, newlyUnlocked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/social.ts
import { Router as Router11 } from "express";
import { randomUUID as randomUUID3 } from "node:crypto";
var defaults = { resolveUser: resolveRequestUser, collection: getCollection };
var fail = (res, status, error2) => res.status(status).json({ success: false, error: error2 });
var safeName = (user) => String(user.username || user.nickname || "Slicer").slice(0, 32);
var usernamePattern = /^[a-z0-9_]{3,24}$/i;
var pairKey = (a, b) => [a, b].sort().join(":");
async function byUsername(col, username) {
  if (!usernamePattern.test(username)) return null;
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return col.findOne({ username: { $regex: `^${escaped}$`, $options: "i" } });
}
async function notify(col, userId, actorId, actorName, type, title, body) {
  try {
    await col.insertOne({ notificationId: randomUUID3(), userId, actorId, actorName, type, title, body: body.slice(0, 240), createdAt: /* @__PURE__ */ new Date() });
  } catch (err) {
    console.error("Could not save social notification:", err);
  }
}
function createSocialRouter(deps = defaults) {
  const router = Router11();
  router.get("/forum", async (_req, res) => {
    try {
      const posts = await (await deps.collection("forum_posts")).find({}).sort({ createdAt: -1 }).limit(50).toArray();
      res.setHeader("Cache-Control", "no-store");
      res.json({ success: true, posts });
    } catch (err) {
      console.error("Forum load failed:", err);
      fail(res, 500, "Could not load forum");
    }
  });
  router.post("/forum", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return fail(res, 401, "Sign in to post");
      const title = typeof req2.body?.title === "string" ? req2.body.title.trim() : "";
      const body = typeof req2.body?.body === "string" ? req2.body.body.trim() : "";
      if (title.length < 3 || title.length > 100 || body.length < 3 || body.length > 2e3) return fail(res, 400, "Title must be 3\u2013100 characters and post 3\u20132,000 characters");
      const post = { postId: randomUUID3(), userId: user.userId, author: safeName(user), title, body, createdAt: /* @__PURE__ */ new Date(), replies: [] };
      await (await deps.collection("forum_posts")).insertOne(post);
      res.status(201).json({ success: true, post });
    } catch (err) {
      console.error("Forum post failed:", err);
      fail(res, 500, "Could not save post");
    }
  });
  router.post("/forum/:postId/replies", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return fail(res, 401, "Sign in to reply");
      const body = typeof req2.body?.body === "string" ? req2.body.body.trim() : "";
      if (!body || body.length > 1e3) return fail(res, 400, "Reply must contain 1\u20131,000 characters");
      const reply = { replyId: randomUUID3(), userId: user.userId, author: safeName(user), body, createdAt: /* @__PURE__ */ new Date() };
      const posts = await deps.collection("forum_posts");
      const post = await posts.findOne({ postId: String(req2.params.postId) });
      if (!post) return fail(res, 404, "Post not found");
      if ((post.replies?.length ?? 0) >= 100) return fail(res, 400, "This topic has reached its reply limit");
      await posts.updateOne({ postId: post.postId, "replies.99": { $exists: false } }, { $push: { replies: reply } });
      res.status(201).json({ success: true, reply });
    } catch (err) {
      console.error("Forum reply failed:", err);
      fail(res, 500, "Could not save reply");
    }
  });
  router.get("/profiles/:username", async (req2, res) => {
    try {
      const users = await deps.collection("users");
      const profile = await byUsername(users, String(req2.params.username || ""));
      if (!profile) return fail(res, 404, "Player not found");
      const [save, best, badges] = await Promise.all([
        (await deps.collection("cloud_saves")).findOne({ userId: profile.userId }),
        (await deps.collection("leaderboards")).findOne({ userId: profile.userId }, { sort: { score: -1 } }),
        (await deps.collection("badges")).find({ userId: profile.userId, unlocked: true }).limit(30).toArray()
      ]);
      const score = Math.max(Number(best?.score) || 0, Number(save?.saveData?.rankedScore) || 0);
      res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
      res.json({ success: true, profile: {
        username: safeName(profile),
        nickname: String(profile.nickname || safeName(profile)).slice(0, 32),
        avatar: typeof profile.avatar === "string" ? profile.avatar.slice(0, 9e5) : "",
        hero: String(save?.saveData?.hero || "jiju"),
        highScore: Number(save?.saveData?.highScore) || 0,
        rankedScore: score,
        rank: rankFromScore(score).title,
        bestWave: Number(save?.saveData?.bestWave) || 1,
        games: Number(save?.saveData?.games) || 0,
        badges: badges.map((badge) => String(badge.badgeId)).slice(0, 30)
      } });
    } catch (err) {
      console.error("Error loading public player profile:", err);
      fail(res, 500, "Could not load player profile");
    }
  });
  router.get("/friends", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return fail(res, 401, "Sign in to view friends");
      const relations = await (await deps.collection("friends")).find({ $or: [{ userId: user.userId }, { friendId: user.userId }] }).sort({ updatedAt: -1 }).limit(200).toArray();
      const users = await deps.collection("users");
      const uniqueRelations = [...new Map(relations.map((row) => {
        const friendId = row.userId === user.userId ? row.friendId : row.userId;
        return [friendId, row];
      })).values()];
      const friends = await Promise.all(uniqueRelations.map(async (row) => {
        const friendId = row.userId === user.userId ? row.friendId : row.userId;
        const friend = await users.findOne({ userId: friendId });
        return friend ? { userId: friend.userId, username: safeName(friend), nickname: friend.nickname, avatar: friend.avatar, state: row.state, direction: row.userId === user.userId ? "incoming" : "outgoing" } : null;
      }));
      res.json({ success: true, friends: friends.filter(Boolean) });
    } catch (err) {
      console.error("Error loading friends:", err);
      fail(res, 500, "Could not load friends");
    }
  });
  router.post("/friends/request", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return fail(res, 401, "Sign in to add friends");
      const target = await byUsername(await deps.collection("users"), String(req2.body?.username || "").trim());
      if (!target) return fail(res, 404, "Player not found. Check the username and try again.");
      if (target.userId === user.userId) return fail(res, 400, "You cannot add yourself as a friend");
      const friends = await deps.collection("friends");
      const existing = await friends.findOne({ $or: [
        { userId: user.userId, friendId: target.userId },
        { userId: target.userId, friendId: user.userId }
      ] });
      if (existing) return fail(res, 409, existing.state === "accepted" ? "You are already friends" : "A friend request is already waiting");
      const now = /* @__PURE__ */ new Date();
      await friends.insertOne({ userId: target.userId, friendId: user.userId, state: "pending", createdAt: now, updatedAt: now });
      await notify(await deps.collection("notifications"), target.userId, user.userId, safeName(user), "friend_request", "Friend request", `${safeName(user)} wants to join your friends list.`);
      res.status(201).json({ success: true, username: safeName(target) });
    } catch (err) {
      if (err?.code === 11e3) return fail(res, 409, "A friend request is already waiting");
      console.error("Error sending friend request:", err);
      fail(res, 500, "Could not send friend request");
    }
  });
  router.post("/friends/respond", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return fail(res, 401, "Sign in to respond to friend requests");
      const friendId = typeof req2.body?.friendId === "string" ? req2.body.friendId : "";
      const accept = req2.body?.accept === true;
      if (!friendId || friendId === user.userId) return fail(res, 400, "Invalid friend request");
      const friends = await deps.collection("friends");
      const update = accept ? await friends.updateOne({ userId: user.userId, friendId, state: "pending" }, { $set: { state: "accepted", updatedAt: /* @__PURE__ */ new Date() } }) : await friends.deleteOne({ userId: user.userId, friendId, state: "pending" });
      if (!("matchedCount" in update ? update.matchedCount : update.deletedCount)) return fail(res, 404, "Friend request is no longer available");
      if (accept) {
        try {
          await friends.insertOne({ userId: friendId, friendId: user.userId, state: "accepted", createdAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() });
        } catch (err) {
          if (err?.code !== 11e3) throw err;
        }
        const actor = await (await deps.collection("users")).findOne({ userId: user.userId });
        await notify(await deps.collection("notifications"), friendId, user.userId, safeName(user), "friend_accepted", "Friend request accepted", `${safeName(actor || user)} accepted your request.`);
      }
      res.json({ success: true, state: accept ? "accepted" : "declined" });
    } catch (err) {
      console.error("Error responding to friend request:", err);
      fail(res, 500, "Could not update friend request");
    }
  });
  router.get("/notifications", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return fail(res, 401, "Sign in to view notifications");
      const notifications = await (await deps.collection("notifications")).find({ userId: user.userId }).sort({ createdAt: -1 }).limit(50).toArray();
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ success: true, unread: notifications.filter((item) => !item.readAt).length, notifications });
    } catch (err) {
      console.error("Error loading notifications:", err);
      fail(res, 500, "Could not load notifications");
    }
  });
  router.post("/notifications/read", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return fail(res, 401, "Sign in to update notifications");
      const ids = Array.isArray(req2.body?.ids) ? req2.body.ids.filter((id) => typeof id === "string").slice(0, 50) : [];
      const filter = { userId: user.userId, readAt: { $exists: false } };
      if (ids.length) filter.notificationId = { $in: ids };
      const result = await (await deps.collection("notifications")).updateMany(filter, { $set: { readAt: /* @__PURE__ */ new Date() } });
      res.json({ success: true, markedRead: result.modifiedCount });
    } catch (err) {
      console.error("Error updating notifications:", err);
      fail(res, 500, "Could not update notifications");
    }
  });
  router.get("/messages/:username", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return fail(res, 401, "Sign in to open messages");
      const peer = await byUsername(await deps.collection("users"), String(req2.params.username || ""));
      if (!peer) return fail(res, 404, "Player not found");
      const relation = await (await deps.collection("friends")).findOne({ userId: user.userId, friendId: peer.userId, state: "accepted" });
      if (!relation) return fail(res, 403, "You can message friends only");
      const conversationId = pairKey(user.userId, peer.userId);
      const messages = await (await deps.collection("messages")).find({ conversationId }).sort({ createdAt: 1 }).limit(100).toArray();
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ success: true, friend: { username: safeName(peer), nickname: peer.nickname, avatar: peer.avatar }, messages });
    } catch (err) {
      console.error("Error loading messages:", err);
      fail(res, 500, "Could not load messages");
    }
  });
  router.post("/messages/:username", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return fail(res, 401, "Sign in to send messages");
      const peer = await byUsername(await deps.collection("users"), String(req2.params.username || ""));
      if (!peer) return fail(res, 404, "Player not found");
      const body = typeof req2.body?.body === "string" ? req2.body.body.trim() : "";
      if (!body || body.length > 1e3) return fail(res, 400, "Messages must contain 1 to 1,000 characters");
      const relation = await (await deps.collection("friends")).findOne({ userId: user.userId, friendId: peer.userId, state: "accepted" });
      if (!relation) return fail(res, 403, "You can message friends only");
      const message = { messageId: randomUUID3(), conversationId: pairKey(user.userId, peer.userId), senderId: user.userId, recipientId: peer.userId, body, createdAt: /* @__PURE__ */ new Date() };
      await (await deps.collection("messages")).insertOne(message);
      await notify(await deps.collection("notifications"), peer.userId, user.userId, safeName(user), "message", "New message", body.slice(0, 100));
      res.status(201).json({ success: true, message });
    } catch (err) {
      console.error("Error sending message:", err);
      fail(res, 500, "Could not send message");
    }
  });
  return router;
}
var socialRouter = createSocialRouter();

// server/routes/lobbies.ts
import { randomBytes, randomUUID as randomUUID4 } from "node:crypto";
import { Router as Router12 } from "express";
var defaults2 = { resolveUser: resolveRequestUser, collection: getCollection };
var error = (res, status, message) => res.status(status).json({ success: false, error: message });
var active = () => ({ status: "waiting", expiresAt: { $gt: /* @__PURE__ */ new Date() } });
function createLobbyRouter(deps = defaults2) {
  const router = Router12();
  const identity = async (req2, res) => {
    const user = await deps.resolveUser(req2);
    if (!user) error(res, 401, "Sign in to use online lobbies");
    return user;
  };
  router.get("/mine", async (req2, res) => {
    try {
      const user = await identity(req2, res);
      if (!user) return;
      const room = await (await deps.collection("coop_lobbies")).findOne({ "members.userId": user.userId, ...active() });
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ success: true, userId: user.userId, lobby: room || null });
    } catch {
      error(res, 503, "Lobbies are unavailable");
    }
  });
  router.get("/public", async (req2, res) => {
    try {
      const user = await identity(req2, res);
      if (!user) return;
      const rooms = await (await deps.collection("coop_lobbies")).find({ visibility: "public", ...active(), $expr: { $lt: [{ $size: "$members" }, 2] } }).sort({ createdAt: 1 }).limit(12).toArray();
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ success: true, lobbies: rooms });
    } catch {
      error(res, 503, "Lobbies are unavailable");
    }
  });
  router.post("/", async (req2, res) => {
    try {
      const user = await identity(req2, res);
      if (!user) return;
      const rooms = await deps.collection("coop_lobbies");
      const existing = await rooms.findOne({ "members.userId": user.userId, ...active() });
      if (existing) return error(res, 409, "Leave your current lobby first");
      const lobby = {
        lobbyId: randomUUID4(),
        code: randomBytes(4).toString("hex").toUpperCase(),
        hostId: user.userId,
        visibility: req2.body?.visibility === "public" ? "public" : "friends",
        status: "waiting",
        members: [{ userId: user.userId, name: String(user.username || user.nickname || "Slicer").slice(0, 32), ready: false }],
        createdAt: /* @__PURE__ */ new Date(),
        expiresAt: new Date(Date.now() + 2 * 60 * 6e4)
      };
      await rooms.insertOne(lobby);
      res.status(201).json({ success: true, lobby });
    } catch (err) {
      error(res, err?.code === 11e3 ? 409 : 503, "Could not create lobby");
    }
  });
  router.post("/join", async (req2, res) => {
    try {
      const user = await identity(req2, res);
      if (!user) return;
      const rooms = await deps.collection("coop_lobbies");
      const existing = await rooms.findOne({ "members.userId": user.userId, ...active() });
      if (existing) return error(res, 409, "Leave your current lobby first");
      const code = typeof req2.body?.code === "string" ? req2.body.code.trim().toUpperCase() : "";
      if (code && !/^[A-F0-9]{8}$/.test(code)) return error(res, 400, "Enter an eight character invite code");
      const where = code ? { code } : { visibility: "public" };
      const room = await rooms.findOneAndUpdate(
        {
          ...where,
          ...active(),
          "members.userId": { $ne: user.userId },
          $expr: { $lt: [{ $size: "$members" }, 2] }
        },
        { $push: { members: { userId: user.userId, name: String(user.username || user.nickname || "Slicer").slice(0, 32), ready: false } } },
        { sort: { createdAt: 1 }, returnDocument: "after" }
      );
      if (!room) return error(res, 404, code ? "Lobby unavailable or full" : "No open public lobby yet");
      res.json({ success: true, lobby: room });
    } catch {
      error(res, 503, "Could not join lobby");
    }
  });
  router.post("/ready", async (req2, res) => {
    try {
      const user = await identity(req2, res);
      if (!user) return;
      if (typeof req2.body?.ready !== "boolean") return error(res, 400, "Invalid ready state");
      const room = await (await deps.collection("coop_lobbies")).findOneAndUpdate(
        { "members.userId": user.userId, ...active() },
        { $set: { "members.$.ready": req2.body.ready } },
        { returnDocument: "after" }
      );
      if (!room) return error(res, 404, "Lobby no longer available");
      res.json({ success: true, lobby: room });
    } catch {
      error(res, 503, "Could not update ready state");
    }
  });
  router.post("/leave", async (req2, res) => {
    try {
      const user = await identity(req2, res);
      if (!user) return;
      const rooms = await deps.collection("coop_lobbies");
      const hosted = await rooms.findOneAndDelete({ hostId: user.userId, ...active() });
      if (!hosted) await rooms.updateOne({ "members.userId": user.userId, ...active() }, { $pull: { members: { userId: user.userId } } });
      res.json({ success: true });
    } catch {
      error(res, 503, "Could not leave lobby");
    }
  });
  router.post("/invite", async (req2, res) => {
    try {
      const user = await identity(req2, res);
      if (!user) return;
      const username = typeof req2.body?.username === "string" ? req2.body.username.trim() : "";
      const friendId = typeof req2.body?.friendId === "string" ? req2.body.friendId : "";
      if (!/^[a-z0-9_]{3,24}$/i.test(username) && (!friendId || friendId.length > 128)) return error(res, 400, "Choose a friend or enter a valid username");
      const room = await (await deps.collection("coop_lobbies")).findOne({ hostId: user.userId, ...active() });
      if (!room) return error(res, 403, "Only the lobby host can invite friends");
      const friend = await (await deps.collection("users")).findOne(friendId ? { userId: friendId } : { username: { $regex: `^${username}$`, $options: "i" } });
      if (!friend || friend.userId === user.userId) return error(res, 404, "Friend not found");
      const relationship = await (await deps.collection("friends")).findOne({ userId: user.userId, friendId: friend.userId, state: "accepted" });
      if (!relationship) return error(res, 403, "Invite accepted friends only");
      await (await deps.collection("notifications")).insertOne({
        notificationId: randomUUID4(),
        userId: friend.userId,
        actorId: user.userId,
        actorName: String(user.username || user.nickname || "Slicer").slice(0, 32),
        type: "coop_invite",
        title: "Co-op lobby invitation",
        body: `Join with code ${room.code}`,
        createdAt: /* @__PURE__ */ new Date()
      });
      res.json({ success: true });
    } catch {
      error(res, 503, "Could not send invite");
    }
  });
  return router;
}
var lobbyRouter = createLobbyRouter();

// server/routes/items.ts
import { Router as Router13 } from "express";
var VIP_FALLBACK = {
  bronze: { price: 500, coins: 1e3 },
  silver: { price: 1500, coins: 2500 },
  gold: { price: 5e3, coins: 5e3 }
};
var defaultDeps6 = {
  resolveUser: resolveRequestUser,
  collection: getCollection,
  slicers: async () => (await loadQuestCatalog()).slicers
};
function serverRevision2(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
function isSlicer(id, slicers) {
  return slicers.find((item) => item.id === id && item.enabled !== false);
}
function createItemsRouter(deps = defaultDeps6) {
  const router = Router13();
  router.post("/action", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to manage gear" });
      const action = req2.body?.action;
      const id = req2.body?.id;
      if (!["buy", "equip", "unequip", "sell", "buy-vip", "buy-skill", "buy-ability", "equip-ability"].includes(action) || typeof id !== "string" || id.length > 120) {
        return res.status(400).json({ success: false, error: "Invalid gear action" });
      }
      const slicers = await deps.slicers();
      const slicer = isSlicer(id, slicers);
      const wall = WALL_SKINS.find((item) => item.id === id);
      const heroId = id.startsWith("hero:") ? id.slice(5) : null;
      const hero = heroId && HEROES.find((item) => item.id === heroId);
      if (!["buy-vip", "buy-skill", "buy-ability", "equip-ability"].includes(action) && !slicer && !wall && !hero) return res.status(404).json({ success: false, error: "Gear not found" });
      const col = await deps.collection("cloud_saves");
      const current = await col.findOne({ userId: user.userId });
      const currentRevision = serverRevision2(current?.revision);
      const saveData = { ...defaultSave(), ...structuredClone(current?.saveData ?? {}) };
      const ownedSkins = Array.isArray(saveData.ownedSkins) ? saveData.ownedSkins : [];
      const ownedHeroes = Array.isArray(saveData.ownedHeroes) ? saveData.ownedHeroes : [];
      const owned = hero ? ownedHeroes.includes(hero.id) : ownedSkins.includes(id);
      if (action === "buy-vip") {
        if (!["bronze", "silver", "gold"].includes(id)) return res.status(400).json({ success: false, error: "Invalid VIP tier" });
        const tier = id;
        const configCol = await deps.collection("admin_config");
        const config = await configCol.findOne({ configKey: "game_config" });
        const configuredPrice = Number(config?.vipTiers?.find((entry) => entry?.tier === tier)?.price);
        const price = Number.isSafeInteger(configuredPrice) && configuredPrice >= 0 && configuredPrice <= 1e6 ? configuredPrice : VIP_FALLBACK[tier].price;
        const tiers = ["none", "bronze", "silver", "gold"];
        const currentTier = tiers.indexOf(saveData.vipStatus || "none");
        if (currentTier >= tiers.indexOf(tier)) return res.status(409).json({ success: false, error: "Already own this VIP tier or higher" });
        if (!Number.isSafeInteger(saveData.gems) || saveData.gems < price) return res.status(422).json({ success: false, error: "Not enough gems" });
        saveData.gems -= price;
        saveData.vipStatus = tier;
        saveData.coins = Math.min(1e6, (Number.isSafeInteger(saveData.coins) ? saveData.coins : 0) + VIP_FALLBACK[tier].coins);
      } else if (action === "buy-ability" || action === "equip-ability") {
        const ability = heroAbility(id);
        if (!ability) return res.status(404).json({ success: false, error: "Ability not found" });
        if (!ownedHeroes.includes(ability.hero)) return res.status(403).json({ success: false, error: "Unlock this hero first" });
        if (heroXpToLevel(Number(saveData.xp?.[ability.hero] || 0)) < ability.unlockLevel) return res.status(403).json({ success: false, error: `Unlocks at hero level ${ability.unlockLevel}` });
        saveData.heroAbilityRanks ??= {};
        saveData.heroAbilityLoadouts ??= { jiju: ["jiju-1"], topfu: [], lagen: [], tripos: [], ki: [] };
        const rank = Number(saveData.heroAbilityRanks[id] || 0);
        if (action === "buy-ability") {
          if (rank >= MAX_HERO_ABILITY_RANK) return res.status(409).json({ success: false, error: "Ability is fully upgraded" });
          if (!Number.isSafeInteger(saveData.skillPoints) || saveData.skillPoints < 1) return res.status(422).json({ success: false, error: "Not enough skill points" });
          saveData.skillPoints -= 1;
          saveData.heroAbilityRanks[id] = rank + 1;
          if (rank === 0 && (saveData.heroAbilityLoadouts[ability.hero] || []).length < 3) saveData.heroAbilityLoadouts[ability.hero] = [...saveData.heroAbilityLoadouts[ability.hero] || [], id];
        } else {
          if (rank < 1 && !(ability.id === "jiju-1" && ability.hero === "jiju")) return res.status(403).json({ success: false, error: "Unlock the ability first" });
          const loadout = saveData.heroAbilityLoadouts[ability.hero] || [];
          if (!loadout.includes(id) && loadout.length >= 3) return res.status(409).json({ success: false, error: "Choose at most three abilities" });
          saveData.heroAbilityLoadouts[ability.hero] = loadout.includes(id) ? loadout.filter((item) => item !== id) : [...loadout, id];
        }
      } else if (action === "buy-skill") {
        const skill = SKILLS.find((entry) => entry.id === id);
        if (!skill) return res.status(404).json({ success: false, error: "Skill not found" });
        if (!Number.isSafeInteger(saveData.skillPoints) || saveData.skillPoints < 1) return res.status(422).json({ success: false, error: "Not enough skill points" });
        if (!saveData.skills || !Number.isSafeInteger(saveData.skills[skill.id]) || saveData.skills[skill.id] >= skill.max) return res.status(409).json({ success: false, error: "Skill is already at maximum rank" });
        saveData.skillPoints -= 1;
        saveData.skills[skill.id] += 1;
      }
      if (action === "buy") {
        if (hero) {
          const result = purchaseHeroAtomic(saveData, hero.id);
          if (!result.ok) return res.status(result.error === "already-owned" ? 409 : 422).json({ success: false, error: result.message });
        } else {
          const price = slicer?.cost ?? wall?.cost ?? 0;
          if (owned) return res.status(409).json({ success: false, error: "Gear is already owned" });
          if (price <= 0) return res.status(400).json({ success: false, error: "This gear cannot be purchased" });
          if (!Number.isSafeInteger(saveData.coins) || saveData.coins < price) {
            return res.status(422).json({ success: false, error: "Not enough coins" });
          }
          saveData.coins -= price;
          saveData.ownedSkins = [...ownedSkins, id];
        }
      } else if (action === "equip") {
        if (!owned) return res.status(403).json({ success: false, error: "Gear is not owned" });
        if (hero) {
          if (!canEquipHero(saveData, hero.id)) return res.status(403).json({ success: false, error: "Hero is not unlocked" });
          saveData.hero = hero.id;
        } else if (slicer) saveData.bladeSkin = id;
        else saveData.wallSkin = id;
      } else if (action === "unequip") {
        if (hero) return res.status(422).json({ success: false, error: "A hero must remain selected" });
        if (slicer && saveData.bladeSkin === id) saveData.bladeSkin = "";
        else if (wall && saveData.wallSkin === id) saveData.wallSkin = "";
        else return res.status(409).json({ success: false, error: "Gear is not equipped" });
      } else if (action === "sell") {
        if (hero) return res.status(422).json({ success: false, error: "Heroes cannot be sold" });
        const sellValue = slicer?.sellValue ?? wall?.sellValue ?? 0;
        if (!owned) return res.status(403).json({ success: false, error: "Gear is not owned" });
        if (id === "blade-default" || id === "wall-brick" || sellValue <= 0) {
          return res.status(422).json({ success: false, error: "Starter gear cannot be sold" });
        }
        saveData.ownedSkins = ownedSkins.filter((ownedId) => ownedId !== id);
        saveData.coins = Math.min(1e6, (Number.isSafeInteger(saveData.coins) ? saveData.coins : 0) + sellValue);
        if (saveData.bladeSkin === id) saveData.bladeSkin = "";
        if (saveData.wallSkin === id) saveData.wallSkin = "";
      }
      const nextRevision = currentRevision + 1;
      const updatedAt = /* @__PURE__ */ new Date();
      let written = false;
      if (current) {
        const result = await col.updateOne(
          current.revision === void 0 ? { userId: user.userId, revision: { $exists: false } } : { userId: user.userId, revision: currentRevision },
          { $set: { saveData, revision: nextRevision, updatedAt } }
        );
        written = result.matchedCount === 1;
      } else {
        try {
          await col.insertOne({ userId: user.userId, saveData, revision: nextRevision, updatedAt });
          written = true;
        } catch (err) {
          if (err?.code !== 11e3) throw err;
        }
      }
      if (!written) return res.status(409).json({ success: false, error: "Save changed; reload and try again" });
      res.setHeader("ETag", `"${nextRevision}"`);
      return res.json({ success: true, saveData, revision: nextRevision });
    } catch (err) {
      console.error("Error applying catalogue action:", err);
      return res.status(500).json({ success: false, error: "Could not update gear" });
    }
  });
  return router;
}
var itemsRouter = createItemsRouter();

// server/rateLimit.ts
function rateLimit(maxRequests, windowMs) {
  const buckets = /* @__PURE__ */ new Map();
  return (req2, res, next) => {
    const now = Date.now();
    const key = req2.ip || req2.socket.remoteAddress || "unknown";
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 1e4) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    if (bucket.count > maxRequests) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1e3));
      res.status(429).json({ success: false, error: "Too many requests" });
      return;
    }
    next();
  };
}

// server/routes/pvp.ts
import { Router as Router14 } from "express";
import { randomUUID as randomUUID5 } from "node:crypto";
import { Rest as Rest2 } from "ably";

// src/game/pvpMatchmaking.ts
function pvpSearchRange(player, now) {
  const waited = Math.max(0, now - player.createdAt);
  return Math.min(player.queue === "ranked" ? 300 : 500, 100 + Math.floor(waited / 15e3) * 50);
}
function pvpCanMatch(a, b, now, config = DEFAULT_PVP_CONFIG) {
  if (a.userId === b.userId || a.queue !== b.queue || !Number.isFinite(a.points) || !Number.isFinite(b.points)) return false;
  if (Math.abs(a.points - b.points) > Math.min(pvpSearchRange(a, now), pvpSearchRange(b, now))) return false;
  const tiers = [...config.rating.tiers].sort((x, y) => x.min - y.min);
  const tier = (points) => tiers.findIndex((item) => item.name === pvpTier(points, config));
  const gap = Math.abs(tier(a.points) - tier(b.points));
  return gap === 0 || gap === 1 && Math.min(now - a.createdAt, now - b.createdAt) >= 3e4;
}

// src/game/pvpBot.ts
function choosePvpBotCommand(match, botUserId, config, now = match.createdAt) {
  if (match.status !== "active" || !match.map) return null;
  const bot = match.players.find((player) => player.userId === botUserId);
  if (!bot || match.players.length !== 2) return null;
  const map = match.map;
  if (bot.attackers.length >= 3 && now >= (bot.rallyReadyAt ?? match.createdAt + 15e3)) return { type: "rally" };
  const captured = bot.captured?.find((item) => bot.fruts >= pvpReleaseCost(config.attacks[item.type].cost, config.attacks[item.type].packSize));
  if (captured) return { type: "release", capturedId: captured.id };
  if (bot.towers.length && pvpTowerLevel(bot.mainLevel) < 3 && bot.wallHealth / (bot.wallMaxHealth ?? config.wallHealth) < 0.75 && bot.fruts >= pvpMainUpgradeCost(bot.mainLevel)) return { type: "upgrade-main" };
  const availableTowers = Object.entries(config.towers).filter(([, stats]) => bot.fruts >= stats.cost);
  if (bot.towers.length < 5 && availableTowers.length && (bot.towers.length === 0 || bot.attackers.length > bot.towers.length)) {
    const [type] = availableTowers[Math.min(bot.towers.length, availableTowers.length - 1)];
    const cells = map.buildCells.filter((cell) => !bot.towers.some((tower) => tower.cell === cell));
    const middle = map.pathCells.slice(Math.floor(map.pathCells.length * 0.25), Math.ceil(map.pathCells.length * 0.8));
    cells.sort((a, b) => {
      const distance2 = (cell) => Math.min(...middle.map((pathCell) => Math.abs(cell % map.width - pathCell % map.width) + Math.abs(Math.floor(cell / map.width) - Math.floor(pathCell / map.width))));
      return distance2(a) - distance2(b) || Math.abs(Math.floor(a / map.width) - map.height * 0.55) - Math.abs(Math.floor(b / map.width) - map.height * 0.55);
    });
    if (cells.length) return { type: "build", tower: type, cell: cells[0] };
  }
  const upgrade = bot.towers.find((tower) => pvpTowerLevel(tower.level) < 3 && bot.fruts >= pvpUpgradeCost(config.towers[tower.type].cost, pvpTowerLevel(tower.level)));
  if (upgrade && bot.attackers.length >= 2) return { type: "upgrade", towerId: upgrade.id };
  const attacks = Object.entries(config.attacks).filter(([, stats]) => bot.fruts >= stats.cost);
  if (attacks.length) {
    const index = Math.min(Math.floor(bot.sequence / 3) % attacks.length, attacks.length - 1);
    return { type: "send", enemy: attacks[index][0] };
  }
  return null;
}
function playPvpBotTurn(match, botUserId, now, config) {
  const bot = match.players.find((player) => player.userId === botUserId);
  if (!bot || match.status !== "active") return false;
  bot.connected = true;
  bot.disconnectedAt = null;
  bot.lastSeenAt = now;
  const command = choosePvpBotCommand(match, botUserId, config, now);
  if (!command) return false;
  applyPvpCommand(match, botUserId, command, bot.sequence + 1, now, config);
  return true;
}

// src/game/pvpIdentity.ts
function pvpAccountIdentity(account, fallbackName = "Player") {
  const steamLinked = Boolean(account?.steamId);
  const name = (steamLinked ? account?.steamPersona : account?.username) || account?.nickname || fallbackName;
  const avatar = (steamLinked ? account?.steamAvatar : account?.avatar) || account?.avatar || "";
  return { name: String(name).trim().slice(0, 32) || "Player", avatar: String(avatar).slice(0, 9e5) };
}

// server/routes/pvp.ts
var pvpRouter = Router14();
var seasonKey = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
var routerError = (res, status, message) => res.status(status).json({ success: false, error: message });
var settlingMatches = /* @__PURE__ */ new Set();
var ablyPublisher = null;
var ablySubscriber = null;
async function currentPvpConfig() {
  const doc = await (await getCollection("admin_config")).findOne({ configKey: "game_config" });
  return doc?.pvpConfig ? mergeAdminConfig({ pvpConfig: doc.pvpConfig }).pvpConfig : DEFAULT_PVP_CONFIG;
}
async function ratingFor(userId, config) {
  const col = await getCollection("pvp_ratings");
  const season = seasonKey();
  let row = await col.findOne({ userId });
  if (!row) {
    row = { userId, points: config.rating.start, season, matches: 0, wins: 0, ties: 0, losses: 0, updatedAt: /* @__PURE__ */ new Date() };
    await col.updateOne({ userId }, { $setOnInsert: row }, { upsert: true });
    row = await col.findOne({ userId });
  } else if (row.season !== season) {
    if (row.matches > 0) {
      const finalTier = pvpTier(row.points, config);
      const reward = config.seasonRewards.find((item) => item.tier === finalTier);
      if (reward) {
        await creditClaimReward(userId, `pvp-season:${row.season}`, { coins: reward.coins, gems: reward.gems });
        await (await getCollection("badges")).updateOne({ userId, badgeId: reward.badgeId }, { $set: { unlocked: true, unlockedAt: /* @__PURE__ */ new Date(), progress: 1, maxProgress: 1 } }, { upsert: true });
      }
    }
    const points = resetSeasonRating(row.points, config);
    await col.updateOne({ userId, season: row.season }, { $set: { points, season, matches: 0, wins: 0, ties: 0, losses: 0, updatedAt: /* @__PURE__ */ new Date() } });
    row = { ...row, points, season, matches: 0, wins: 0, ties: 0, losses: 0 };
  }
  return row;
}
async function arenaRecordFor(userId) {
  const row = await (await getCollection("pvp_arena_records")).findOne({ userId });
  return { matches: row?.matches || 0, wins: row?.wins || 0, ties: row?.ties || 0, losses: row?.losses || 0 };
}
function publicRating(row, config) {
  const tier = pvpTier(row.points, config);
  const tiers = [...config.rating.tiers].sort((a, b) => a.min - b.min);
  return { points: row.points, tier, season: row.season, matches: row.matches, wins: row.wins, ties: row.ties, losses: row.losses, tierMin: tiers.find((item) => item.name === tier)?.min ?? 0, nextTier: tiers.find((item) => item.min > row.points) ?? null };
}
pvpRouter.get("/rating", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in for Ranked Arena.");
  try {
    const config = await currentPvpConfig();
    res.json({ success: true, rating: { ...publicRating(await ratingFor(user.userId, config), config), arena: await arenaRecordFor(user.userId) } });
  } catch {
    routerError(res, 503, "Ranked rating is unavailable.");
  }
});
function ablyKey() {
  const value = process.env.ABLY_API_KEY || "";
  const match = /^([^.\s]+)\.([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(value);
  return match ? { app: match[1], keyName: match[2], secret: match[3] } : null;
}
function subscriberKey() {
  const value = process.env.ABLY_SUBSCRIBE_KEY || "";
  const match = /^([^.\s]+)\.([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(value);
  return match ? { app: match[1], keyName: match[2], secret: match[3] } : null;
}
async function publishMatch(match) {
  const key = process.env.ABLY_API_KEY;
  if (!key) return;
  try {
    ablyPublisher ??= new Rest2({ key });
    await ablyPublisher.channels.get(`fruittd-pvp-${match.id}`).publish("match.snapshot", { id: match.id, revision: match.revision, status: match.status, endsAt: match.endsAt, map: match.map, mapPool: match.mapPool, vetoTurn: match.vetoTurn, players: match.players, winnerId: match.winnerId, resultReason: match.resultReason });
  } catch (error2) {
    console.error("Ably match event publish failed:", error2);
  }
}
function publicMatch(match, userId) {
  if (!match.players.some((player) => player.userId === userId)) return null;
  return {
    id: match.id,
    queue: match.queue,
    status: match.status,
    testMatch: Boolean(match.testMatch),
    remainingMs: Math.max(0, match.endsAt - Date.now()),
    revision: match.revision,
    map: match.map,
    mapPool: match.mapPool.map(({ id, name, width, height, pathCells }) => ({ id, name, width, height, pathCells })),
    vetoTurnId: match.vetoTurn,
    yourVetoTurn: match.vetoTurn === userId,
    vetoesRemaining: Math.max(0, match.mapPool.length - 2),
    players: match.players.map(({ userId: id, name, avatar, side, fruts, wallHealth, score, towers, attackers, connected, ratingDelta, lastStroke, hero, wallSkin, rallyUntil, rallyReadyAt, mainLevel, wallMaxHealth, captured, powerCasts, abilityLoadout, abilityRanks, abilityReadyAt }) => ({ userId: id, name, avatar, side, fruts: Math.floor(fruts), wallHealth, score, towers, attackers, connected, lastStroke, hero, wallSkin, rallyUntil, rallyReadyAt, mainLevel, wallMaxHealth, captured, powerCasts, ...id === userId ? { abilityLoadout, abilityRanks, abilityReadyAt } : {}, ...match.status === "complete" && match.queue === "ranked" && !match.testMatch ? { ratingDelta } : {} })),
    yourSequence: match.players.find((player) => player.userId === userId)?.sequence ?? 0,
    yourCombo: match.players.find((player) => player.userId === userId)?.currentCombo ?? 0,
    yourSide: match.players.find((player) => player.userId === userId)?.side,
    winnerId: match.winnerId,
    resultReason: match.resultReason
  };
}
async function equippedAppearance(userId) {
  const cloud = await (await getCollection("cloud_saves")).findOne({ userId });
  const save = cloud?.saveData;
  const hero = HEROES.some((item) => item.id === save?.hero) && (save?.hero === "jiju" || save?.ownedHeroes?.includes(save.hero)) ? save.hero : "jiju";
  const wallSkin = WALL_SKINS.some((item) => item.id === save?.wallSkin) && (save?.wallSkin === "wall-brick" || save?.ownedSkins?.includes(save.wallSkin)) ? save.wallSkin : "wall-brick";
  const rawLoadout = save?.heroAbilityLoadouts?.[hero];
  const abilityLoadout = Array.isArray(rawLoadout) ? rawLoadout.filter((id) => heroAbility(id)?.hero === hero).slice(0, 3) : hero === "jiju" ? ["jiju-1"] : [];
  return { hero, wallSkin, abilityLoadout, abilityRanks: save?.heroAbilityRanks ?? {}, abilityReadyAt: {} };
}
async function makeMatch(queue, left, right, config) {
  const match = newPvpMatch(randomUUID5(), queue, [createPvpPlayer(left.userId, left.name, "blue", config), createPvpPlayer(right.userId, right.name, "red", config)], Date.now(), config);
  match.updatedAt = /* @__PURE__ */ new Date();
  match.balance = structuredClone(config);
  match.activePlayers = [left.userId, right.userId];
  const [accounts, ratings] = await Promise.all([
    (await getCollection("users")).find({ userId: { $in: match.players.map((player) => player.userId) } }).toArray(),
    Promise.all(match.players.map(async (player) => (await ratingFor(player.userId, config)).points))
  ]);
  for (const player of match.players) {
    const account = accounts.find((row) => row.userId === player.userId);
    Object.assign(player, pvpAccountIdentity(account, player.name));
    Object.assign(player, await equippedAppearance(player.userId));
  }
  match.startRatings = Object.fromEntries(match.players.map((player, index) => [player.userId, ratings[index]]));
  await (await getCollection("pvp_matches")).insertOne(match);
  void publishMatch(match);
  return match;
}
async function settleMatch(match, config) {
  config = match.balance ?? config;
  if (match.status !== "complete" || match.settled) return;
  if (settlingMatches.has(match.id)) return;
  settlingMatches.add(match.id);
  const matches = await getCollection("pvp_matches");
  try {
    if (match.testMatch) {
      match.settled = true;
      await matches.updateOne({ id: match.id, testMatch: true }, { $set: { settled: true } });
      return;
    }
    const achievements = await getCollection("achievements");
    const badges = await getCollection("badges");
    for (const player of match.players) {
      const outcome = match.winnerId === null ? "tie" : match.winnerId === player.userId ? "win" : "loss";
      const achievement = async (achievementId) => achievements.updateOne({ userId: player.userId, achievementId }, { $set: { unlocked: true, unlockedAt: /* @__PURE__ */ new Date(), progress: 1, maxProgress: 1 }, $setOnInsert: { claimed: false } }, { upsert: true });
      const badge = async (badgeId) => badges.updateOne({ userId: player.userId, badgeId }, { $set: { unlocked: true, unlockedAt: /* @__PURE__ */ new Date(), progress: 1, maxProgress: 1 } }, { upsert: true });
      if (outcome === "win") {
        await achievement("pvp_first_win");
        await badge("pvp-first-win");
      }
      if (match.queue === "arena") {
        const records = await getCollection("pvp_arena_records");
        await records.updateOne({ userId: player.userId }, { $setOnInsert: { userId: player.userId, matches: 0, wins: 0, ties: 0, losses: 0, settledMatchIds: [] } }, { upsert: true });
        await records.updateOne({ userId: player.userId, settledMatchIds: { $ne: match.id } }, { $inc: { matches: 1, [outcome === "win" ? "wins" : outcome === "tie" ? "ties" : "losses"]: 1 }, $addToSet: { settledMatchIds: match.id } });
      }
      if (match.queue === "ranked") {
        const row = await ratingFor(player.userId, config);
        const ratings = await getCollection("pvp_ratings");
        if (row.settledMatchIds?.includes(match.id)) player.ratingDelta = row.lastMatchId === match.id ? row.lastDelta ?? 0 : 0;
        else {
          const result = calculateArenaRating(row.points, match.startRatings?.[match.players.find((item) => item !== player).userId] ?? row.points, outcome, config);
          const updated = await ratings.updateOne({ userId: player.userId, season: row.season, settledMatchIds: { $ne: match.id } }, {
            $set: { points: result.rating, updatedAt: /* @__PURE__ */ new Date(), lastMatchId: match.id, lastDelta: result.delta },
            $inc: { matches: 1, [outcome === "win" ? "wins" : outcome === "tie" ? "ties" : "losses"]: 1 },
            $addToSet: { settledMatchIds: match.id }
          });
          player.ratingDelta = updated.modifiedCount ? result.delta : (await ratings.findOne({ userId: player.userId }))?.lastDelta ?? 0;
        }
        const current = await ratings.findOne({ userId: player.userId });
        if (current && current.wins >= 10) await achievement("pvp_ten_wins");
        if (current) {
          const topTier = pvpTier(current.points, config);
          const badgeByTier = { Silver: "fr-silver", Gold: "fr-gold", Diamond: "fr-diamond", Emerald: "fr-emerald", Sapphire: "fr-sapphire" };
          const reached = badgeByTier[topTier];
          if (reached) await badge(reached);
        }
      }
      await saveNotification(() => getCollection("notifications"), {
        userId: player.userId,
        type: "pvp_result",
        title: "Arena match finished",
        body: `${outcome === "win" ? "Victory" : outcome === "loss" ? "Defeat" : "Tie"} \xB7 ${match.queue === "ranked" && player.ratingDelta !== void 0 ? `${player.ratingDelta > 0 ? "+" : ""}${player.ratingDelta} rating` : "Casual Arena"}`,
        eventKey: `pvp-result:${player.userId}:${match.id}`
      });
    }
    match.settled = true;
    await matches.updateOne({ id: match.id }, { $set: { settled: true, players: match.players }, $unset: { activePlayers: "" } });
  } finally {
    settlingMatches.delete(match.id);
  }
}
async function tickMatch(match, config, now) {
  config = match.balance ?? config;
  if (match.status !== "active") return match;
  const col = await getCollection("pvp_matches");
  const priorRevision = match.revision;
  const elapsed = Math.max(0, Math.min(1, (now - match.updatedAt.getTime()) / 1e3));
  if (match.testMatch && match.botUserId) {
    const bot = match.players.find((player) => player.userId === match.botUserId);
    if (bot) {
      bot.connected = true;
      bot.disconnectedAt = null;
      bot.lastSeenAt = now;
    }
  }
  advancePvpMatch(match, elapsed, now, config);
  if (match.status === "active" && match.testMatch && match.botUserId && now >= (match.botNextActionAt ?? 0)) {
    try {
      playPvpBotTurn(match, match.botUserId, now, config);
    } catch (error2) {
      console.error("PvP bot action failed:", error2);
    }
    match.botNextActionAt = now + 1300;
  }
  if (match.status === "complete") delete match.activePlayers;
  match.updatedAt = new Date(now);
  const saved = await col.replaceOne({ id: match.id, revision: priorRevision, status: "active" }, match);
  if (!saved.modifiedCount) return null;
  void publishMatch(match);
  if (match.status === "complete") await settleMatch(match, config);
  return match;
}
pvpRouter.get("/status", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in to play PvP.");
  try {
    const config = await currentPvpConfig();
    const matches = await getCollection("pvp_matches");
    let match = await matches.findOne({ "players.userId": user.userId, $or: [{ status: { $in: ["draft", "active"] } }, { status: "complete", resultsSeenBy: { $ne: user.userId } }] });
    if (match?.status === "draft" && Date.now() - match.createdAt >= 12e4) {
      const revision = match.revision;
      match.status = "complete";
      match.resultReason = "draft-cancelled";
      match.settled = true;
      delete match.activePlayers;
      match.revision++;
      await matches.replaceOne({ id: match.id, revision, status: "draft" }, match);
      match = await matches.findOne({ id: match.id });
    }
    if (match?.status === "complete" && !match.settled) {
      await settleMatch(match, config);
      match = await matches.findOne({ id: match.id });
    }
    if (match && match.status !== "complete") {
      const player = match.players.find((item) => item.userId === user.userId);
      player.connected = true;
      player.disconnectedAt = null;
      player.lastSeenAt = Date.now();
      match.revision++;
      await matches.replaceOne({ id: match.id, revision: match.revision - 1, status: match.status }, match);
      match = await matches.findOne({ id: match.id });
      if (match?.status === "active") {
        await tickMatch(match, config, Date.now());
        match = await matches.findOne({ id: match.id });
      }
    }
    if (!match) {
      const waiting = await (await getCollection("pvp_queue")).findOne({ userId: user.userId, expiresAt: { $gt: /* @__PURE__ */ new Date() } });
      if (waiting) match = await pairQueued(waiting, config);
    }
    const rating = await ratingFor(user.userId, config);
    const challenge = await (await getCollection("pvp_challenges")).findOne({ toId: user.userId, expiresAt: { $gt: /* @__PURE__ */ new Date() }, acceptedAt: { $exists: false } });
    const queued = await (await getCollection("pvp_queue")).findOne({ userId: user.userId, expiresAt: { $gt: /* @__PURE__ */ new Date() } });
    res.json({ success: true, canStartBotMatch: Boolean(process.env.ADMIN_STEAM_ID && user.steamId === process.env.ADMIN_STEAM_ID), rating: { ...publicRating(rating, config), arena: await arenaRecordFor(user.userId) }, match: match ? publicMatch(match, user.userId) : null, queued: queued ? queued.queue : null, challenge: challenge ? { challengeId: challenge.challengeId, fromId: challenge.fromId, fromName: challenge.fromName } : null, config: { incomePerSecond: (match?.balance ?? config).incomePerSecond, wallHealth: (match?.balance ?? config).wallHealth, durationSeconds: (match?.balance ?? config).durationSeconds, reconnectGraceSeconds: (match?.balance ?? config).reconnectGraceSeconds, towers: (match?.balance ?? config).towers, attacks: (match?.balance ?? config).attacks, maps: (match?.balance ?? config).maps } });
  } catch (error2) {
    console.error(error2);
    routerError(res, 503, "PvP storage is unavailable.");
  }
});
pvpRouter.post("/admin/bot", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  if (!process.env.ADMIN_STEAM_ID || user.steamId !== process.env.ADMIN_STEAM_ID) return routerError(res, 403, "Admin access required.");
  const queue = req2.body?.queue;
  if (queue !== "arena" && queue !== "ranked") return routerError(res, 400, "Choose Arena or Ranked.");
  try {
    const config = await currentPvpConfig();
    const selectedMap = config.maps.find((map) => map.id === req2.body?.mapId);
    if (!selectedMap) return routerError(res, 400, "Choose a valid Arena path.");
    const matches = await getCollection("pvp_matches");
    const active2 = await matches.findOne({ status: { $in: ["draft", "active"] }, "players.userId": user.userId });
    if (active2) return routerError(res, 409, "Finish your current match before starting a test.");
    const now = Date.now();
    const id = randomUUID5();
    const botUserId = `bot:${id}`;
    const match = newPvpMatch(id, queue, [createPvpPlayer(user.userId, user.username || user.nickname || "Slicer", "blue", config, now), createPvpPlayer(botUserId, "Orchard Siege Bot", "red", config, now)], now, config);
    match.status = "active";
    match.map = structuredClone(selectedMap);
    match.endsAt = now + config.durationSeconds * 1e3;
    match.balance = structuredClone(config);
    match.activePlayers = [user.userId];
    match.nextWaveAt = now + 15e3;
    match.neutralWave = 0;
    Object.assign(match.players[0], await equippedAppearance(user.userId));
    match.players.forEach((player) => {
      player.rallyReadyAt = now + 15e3;
    });
    match.testMatch = true;
    match.botUserId = botUserId;
    match.botNextActionAt = now + 1200;
    match.updatedAt = new Date(now);
    await (await getCollection("pvp_queue")).deleteOne({ userId: user.userId });
    await matches.insertOne(match);
    void publishMatch(match);
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error2) {
    console.error(error2);
    routerError(res, 503, "Could not create the bot test match.");
  }
});
async function pairQueued(entry, config) {
  const queues = await getCollection("pvp_queue");
  const matches = await getCollection("pvp_matches");
  const now = Date.now();
  const candidates = await queues.find({ queue: entry.queue, userId: { $ne: entry.userId }, season: seasonKey(), expiresAt: { $gt: new Date(now) } }).sort({ createdAt: 1 }).limit(100).toArray();
  for (const candidate of candidates) {
    if (!pvpCanMatch({ ...entry, createdAt: entry.createdAt.getTime() }, { ...candidate, createdAt: candidate.createdAt.getTime() }, now, config)) continue;
    if (await matches.findOne({ status: { $in: ["draft", "active"] }, "players.userId": { $in: [entry.userId, candidate.userId] } })) continue;
    const other = await queues.findOneAndDelete({ userId: candidate.userId, queue: candidate.queue, createdAt: candidate.createdAt, expiresAt: { $gt: new Date(now) } });
    if (!other) continue;
    const own = await queues.findOneAndDelete({ userId: entry.userId, queue: entry.queue, createdAt: entry.createdAt, expiresAt: { $gt: new Date(now) } });
    if (!own) {
      await queues.updateOne({ userId: other.userId }, { $setOnInsert: other }, { upsert: true });
      return null;
    }
    try {
      return await makeMatch(entry.queue, other, own, config);
    } catch (error2) {
      for (const waiting of [other, own]) if (!await matches.findOne({ status: { $in: ["draft", "active"] }, "players.userId": waiting.userId })) await queues.updateOne({ userId: waiting.userId }, { $setOnInsert: waiting }, { upsert: true });
      throw error2;
    }
  }
  return null;
}
pvpRouter.post("/queue", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in to play PvP.");
  const queue = req2.body?.queue;
  if (!["arena", "ranked"].includes(queue)) return routerError(res, 400, "Choose Arena or Ranked.");
  try {
    const matches = await getCollection("pvp_matches");
    const active2 = await matches.findOne({ status: { $in: ["draft", "active"] }, "players.userId": user.userId });
    if (active2) return res.json({ success: true, match: publicMatch(active2, user.userId) });
    const queues = await getCollection("pvp_queue");
    const config = await currentPvpConfig();
    const now = /* @__PURE__ */ new Date();
    const rating = await ratingFor(user.userId, config);
    const existing = await queues.findOne({ userId: user.userId, queue, expiresAt: { $gt: now } });
    const entry = { userId: user.userId, name: user.steamPersona || user.username || user.nickname || "Player", queue, points: rating.points, season: seasonKey(), createdAt: existing?.createdAt ?? now, expiresAt: new Date(Date.now() + 12e4) };
    await queues.updateOne({ userId: user.userId }, { $set: entry }, { upsert: true });
    const match = await pairQueued(entry, config);
    if (match) return res.json({ success: true, match: publicMatch(match, user.userId) });
    return res.json({ success: true, queued: true, expiresInSeconds: 120 });
  } catch (error2) {
    console.error(error2);
    routerError(res, 503, "Matchmaking is unavailable.");
  }
});
pvpRouter.delete("/queue", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  await (await getCollection("pvp_queue")).deleteOne({ userId: user.userId });
  res.json({ success: true });
});
pvpRouter.post("/challenge", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in to challenge a friend.");
  const friendId = String(req2.body?.friendId || "");
  if (!friendId || friendId === user.userId) return routerError(res, 400, "Choose a friend to challenge.");
  try {
    const active2 = await (await getCollection("pvp_matches")).findOne({ status: { $in: ["draft", "active"] }, "players.userId": { $in: [user.userId, friendId] } });
    if (active2) return routerError(res, 409, "One of you is already in a PvP match.");
    const friends = await getCollection("friends");
    const relation = await friends.findOne({ userId: user.userId, friendId, state: "accepted" }) || await friends.findOne({ userId: friendId, friendId: user.userId, state: "accepted" });
    if (!relation) return routerError(res, 403, "Private challenges are only available to accepted friends.");
    const users = await getCollection("users");
    const friend = await users.findOne({ userId: friendId });
    if (!friend) return routerError(res, 404, "Friend not found.");
    const challenge = { challengeId: randomUUID5(), fromId: user.userId, fromName: user.steamPersona || user.username || user.nickname || "Player", toId: friendId, createdAt: /* @__PURE__ */ new Date(), expiresAt: new Date(Date.now() + 12e4) };
    await (await getCollection("pvp_challenges")).insertOne(challenge);
    try {
      await (await getCollection("notifications")).insertOne({ notificationId: randomUUID5(), userId: friendId, actorId: user.userId, actorName: challenge.fromName, type: "pvp_challenge", title: "Arena challenge", body: `${challenge.fromName} challenged you to an Arena siege. Open Arena to accept within two minutes.`, createdAt: /* @__PURE__ */ new Date() });
    } catch (error2) {
      console.error("Could not create the Arena challenge notification:", error2);
    }
    res.json({ success: true, challengeId: challenge.challengeId });
  } catch (error2) {
    console.error(error2);
    routerError(res, 503, "Friend challenges are unavailable.");
  }
});
pvpRouter.post("/challenge/:id/accept", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  try {
    const challenges = await getCollection("pvp_challenges");
    const pending = await challenges.findOne({ challengeId: req2.params.id, toId: user.userId, expiresAt: { $gt: /* @__PURE__ */ new Date() }, acceptedAt: { $exists: false } });
    if (!pending) return routerError(res, 404, "Challenge expired or already accepted.");
    const active2 = await (await getCollection("pvp_matches")).findOne({ status: { $in: ["draft", "active"] }, "players.userId": { $in: [pending.fromId, user.userId] } });
    if (active2) return routerError(res, 409, "One of you is already in a PvP match.");
    const invite = await challenges.findOneAndUpdate({ challengeId: req2.params.id, toId: user.userId, expiresAt: { $gt: /* @__PURE__ */ new Date() }, acceptedAt: { $exists: false } }, { $set: { acceptedAt: /* @__PURE__ */ new Date() } }, { returnDocument: "before" });
    if (!invite) return routerError(res, 404, "Challenge expired or already accepted.");
    const config = await currentPvpConfig();
    const match = await makeMatch("arena", { userId: invite.fromId, name: invite.fromName }, { userId: user.userId, name: user.username || user.nickname || "Slicer" }, config);
    await challenges.updateOne({ challengeId: req2.params.id }, { $set: { matchId: match.id } });
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error2) {
    console.error(error2);
    routerError(res, 503, "Could not start the friend match.");
  }
});
pvpRouter.post("/match/:id/cancel-draft", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  try {
    const matches = await getCollection("pvp_matches");
    const match = await matches.findOne({ id: req2.params.id, status: "draft", "players.userId": user.userId });
    if (!match) return routerError(res, 409, "Draft already ended. Refresh the match.");
    const revision = match.revision;
    match.status = "complete";
    match.resultReason = "draft-cancelled";
    match.settled = true;
    delete match.activePlayers;
    match.revision++;
    const saved = await matches.replaceOne({ id: match.id, revision, status: "draft" }, match);
    if (!saved.modifiedCount) return routerError(res, 409, "Draft changed. Refresh the match.");
    void publishMatch(match);
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch {
    routerError(res, 503, "Could not cancel the draft.");
  }
});
pvpRouter.post("/match/:id/command", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  const sequence = Number(req2.body?.sequence);
  const command = req2.body?.command;
  if (!Number.isSafeInteger(sequence) || !command || typeof command !== "object") return routerError(res, 400, "Command sequence and command are required.");
  try {
    const matches = await getCollection("pvp_matches");
    const match = await matches.findOne({ id: req2.params.id, status: "active", "players.userId": user.userId });
    if (!match) return routerError(res, 404, "Active match not found.");
    const config = match.balance ?? await currentPvpConfig();
    const priorRevision = match.revision;
    applyPvpCommand(match, user.userId, command, sequence, Date.now(), config);
    if (match.status === "complete") delete match.activePlayers;
    const result = await matches.replaceOne({ id: match.id, revision: priorRevision, status: "active" }, match);
    if (!result.modifiedCount) return routerError(res, 409, "Match changed. Refresh the board and retry.");
    if (match.status === "complete") await settleMatch(match, config);
    void publishMatch(match);
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error2) {
    routerError(res, 400, error2 instanceof Error ? error2.message : "Invalid command.");
  }
});
pvpRouter.post("/match/:id/veto", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  const sequence = Number(req2.body?.sequence);
  const mapId = String(req2.body?.mapId || "");
  if (!Number.isSafeInteger(sequence) || !mapId) return routerError(res, 400, "Choose a path to veto.");
  try {
    const matches = await getCollection("pvp_matches");
    const match = await matches.findOne({ id: req2.params.id, status: "draft", "players.userId": user.userId });
    if (!match) return routerError(res, 404, "Path draft not found.");
    const priorRevision = match.revision;
    vetoPvpMap(match, user.userId, mapId, sequence, Date.now(), match.balance ?? await currentPvpConfig());
    const saved = await matches.replaceOne({ id: match.id, revision: priorRevision, status: "draft" }, match);
    if (!saved.modifiedCount) return routerError(res, 409, "The other player vetoed first. Refresh the path list.");
    void publishMatch(match);
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error2) {
    routerError(res, 400, error2 instanceof Error ? error2.message : "Path veto failed.");
  }
});
pvpRouter.get("/match/:id", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  try {
    const match = await (await getCollection("pvp_matches")).findOne({ id: req2.params.id, "players.userId": user.userId });
    if (!match) return routerError(res, 404, "Match not found.");
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch {
    routerError(res, 503, "Match storage is unavailable.");
  }
});
pvpRouter.post("/match/:id/ack", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  try {
    await (await getCollection("pvp_matches")).updateOne({ id: req2.params.id, status: "complete", "players.userId": user.userId }, { $addToSet: { resultsSeenBy: user.userId } });
    res.json({ success: true });
  } catch {
    routerError(res, 503, "Could not close the match result.");
  }
});
pvpRouter.post("/match/:id/end-test", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  if (!process.env.ADMIN_STEAM_ID || user.steamId !== process.env.ADMIN_STEAM_ID) return routerError(res, 403, "Admin access required.");
  try {
    const matches = await getCollection("pvp_matches");
    const match = await matches.findOne({ id: req2.params.id, status: "active", testMatch: true, "players.userId": user.userId });
    if (!match) return routerError(res, 404, "Active bot test match not found.");
    const priorRevision = match.revision;
    match.status = "complete";
    delete match.activePlayers;
    match.resultReason = "test-ended";
    match.winnerId = null;
    match.revision++;
    match.updatedAt = /* @__PURE__ */ new Date();
    const saved = await matches.replaceOne({ id: match.id, revision: priorRevision, status: "active", testMatch: true }, match);
    if (!saved.modifiedCount) return routerError(res, 409, "Match changed. Refresh the board.");
    await settleMatch(match, await currentPvpConfig());
    void publishMatch(match);
    res.json({ success: true, match: publicMatch(match, user.userId) });
  } catch (error2) {
    console.error(error2);
    routerError(res, 503, "Could not end the bot test match.");
  }
});
pvpRouter.post("/match/:id/connection", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  try {
    const matches = await getCollection("pvp_matches");
    const match = await matches.findOne({ id: req2.params.id, status: { $in: ["draft", "active"] }, "players.userId": user.userId });
    if (!match) return routerError(res, 404, "Active match not found.");
    const player = match.players.find((item) => item.userId === user.userId);
    player.connected = req2.body?.connected === true;
    player.disconnectedAt = player.connected ? null : Date.now();
    player.lastSeenAt = Date.now();
    match.revision++;
    const saved = await matches.replaceOne({ id: match.id, revision: match.revision - 1, status: match.status }, match);
    if (!saved.modifiedCount) return routerError(res, 409, "Match changed. Retry connection update.");
    void publishMatch(match);
    res.json({ success: true });
  } catch {
    routerError(res, 503, "Could not update connection state.");
  }
});
pvpRouter.post("/match/:id/token", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!user) return routerError(res, 401, "Sign in first.");
  try {
    const match = await (await getCollection("pvp_matches")).findOne({ id: req2.params.id, "players.userId": user.userId });
    if (!match) return routerError(res, 404, "Match not found.");
    const key = ablyKey();
    const scopedKey = subscriberKey();
    if (!key || !scopedKey || key.app !== scopedKey.app) return routerError(res, 503, "Ably server and subscribe-only keys are not configured for the same app.");
    const capability = JSON.stringify({ [`fruittd-pvp-${match.id}`]: ["subscribe"] });
    ablySubscriber ??= new Rest2({ key: process.env.ABLY_SUBSCRIBE_KEY });
    const token = await ablySubscriber.auth.requestToken({ clientId: `player-${user.userId}`, capability, ttl: 10 * 60 * 1e3 });
    res.json({ success: true, token, channel: `fruittd-pvp-${match.id}` });
  } catch {
    routerError(res, 502, "Could not issue the scoped match token.");
  }
});

// server/routes/maps.ts
import { Router as Router15 } from "express";

// src/game/battleMaps.ts
var baseWorld = { width: ARENA_W, depth: ARENA_D, columns: 11, rows: 132 };
var routeEndY = 0.5 - LEAK_Z / ARENA_D;
var topGateY = 0.025;
var laneRoutes = [
  { id: "west-outer", xs: [0.12, 0.18, 0.31, 0.42, 0.5] },
  { id: "west-inner", xs: [0.31, 0.38, 0.26, 0.42, 0.5] },
  { id: "center", xs: [0.5, 0.44, 0.56, 0.48, 0.5] },
  { id: "east-inner", xs: [0.69, 0.62, 0.77, 0.58, 0.5] },
  { id: "east-outer", xs: [0.88, 0.82, 0.67, 0.56, 0.5] }
];
var standardRoutes = () => laneRoutes.map((lane) => ({
  id: lane.id,
  name: lane.id.replace("-", " "),
  width: 5,
  points: lane.xs.map((x, i) => ({ x, y: [0.025, 0.18, 0.34, 0.47, routeEndY][i] }))
}));
var entity = (id, kind, x, y, width, height = width, extra = {}) => ({
  id,
  kind,
  x,
  y,
  width,
  height,
  rotation: 0,
  visible: true,
  asset: "",
  collision: kind === "solid" ? "solid" : kind === "hazard" || kind === "pit" ? "trigger" : "none",
  damage: kind === "hazard" || kind === "pit" ? 1 : 0,
  slow: 0,
  label: id,
  ...extra
});
function standardMap(mode, name, background) {
  return {
    schemaVersion: 1,
    id: `sample-${mode}`,
    mode,
    name,
    background,
    world: { ...baseWorld },
    routes: standardRoutes(),
    spawns: laneRoutes.map((lane, i) => ({
      id: `${lane.id}-gate`,
      routeId: lane.id,
      x: lane.xs[0],
      y: 0.025,
      enabled: true,
      label: `${["West", "West-center", "Center", "East-center", "East"][i]} top spawn`
    })),
    entities: [
      entity("left-lantern", "light", 0.16, 0.43, 0.08, 0.08, { collision: "none", damage: 0, label: "Path light" }),
      entity("right-ruin", "prop", 0.84, 0.62, 0.14, 0.1, { collision: "none", label: "Ruin prop" }),
      entity("rock-blocker", "solid", 0.15, 0.73, 0.1, 0.07, { asset: "/assets/maps/samples/sample-rock.svg", label: "Solid rock sample" }),
      entity("pit-hazard", "pit", 0.83, 0.3, 0.12, 0.08, { asset: "/assets/maps/samples/sample-pit.svg", label: "Pit sample" }),
      ...PADS.filter((pad) => !pad.main).map((pad, i) => entity(
        `tower-slot-${i + 1}`,
        "turret-slot",
        pad.x / ARENA_W + 0.5,
        0.5 - (pad.z - WALL_Z) / ARENA_D,
        0.05,
        0.04,
        { collision: "none", damage: 0, visible: true, label: `Tower slot ${i + 1}` }
      ))
    ],
    tower: { x: 0.5, y: 0.5 - WALL_Z / ARENA_D },
    published: true,
    revision: 1
  };
}
var DEFAULT_BATTLE_MAPS = {
  casual: standardMap("casual", "Ashen Road", "/assets/maps/samples/casual-fallen-orchard.webp"),
  horde: standardMap("horde", "Scrapline", "/assets/maps/samples/horde-night-harvest.webp"),
  campaign: standardMap("campaign", "Ruined Causeway", "/assets/maps/samples/campaign-old-orchard.webp"),
  coop: {
    ...standardMap("coop", "Broken Junction", "/assets/maps/samples/coop-shared-grove.webp"),
    routes: [
      { id: "west-route", name: "West approach", width: 5, points: [{ x: 0.18, y: 0.025 }, { x: 0.3, y: 0.2 }, { x: 0.22, y: 0.38 }, { x: 0.5, y: routeEndY }] },
      { id: "east-route", name: "East approach", width: 5, points: [{ x: 0.82, y: 0.025 }, { x: 0.7, y: 0.2 }, { x: 0.78, y: 0.38 }, { x: 0.5, y: routeEndY }] }
    ],
    spawns: [
      { id: "west-gate", routeId: "west-route", x: 0.18, y: 0.025, enabled: true, label: "West spawn" },
      { id: "east-gate", routeId: "east-route", x: 0.82, y: 0.025, enabled: true, label: "East spawn" }
    ]
  },
  pvp: {
    ...standardMap("pvp", "Twin Wastes", "/assets/maps/samples/pvp-twin-pass.webp"),
    tower: { x: 0.5, y: 0.94 },
    opponentTower: { x: 0.5, y: 0.06 },
    routes: [{ id: "duel-route", name: "Duel route", width: 4.5, points: [{ x: 0.5, y: 0.94 }, { x: 0.38, y: 0.72 }, { x: 0.62, y: 0.5 }, { x: 0.38, y: 0.28 }, { x: 0.5, y: 0.06 }] }],
    spawns: [{ id: "opponent-gate", routeId: "duel-route", x: 0.5, y: 0.06, enabled: true, label: "Opponent side" }]
  }
};
var modes = /* @__PURE__ */ new Set(["casual", "horde", "campaign", "coop", "pvp"]);
var kinds = /* @__PURE__ */ new Set(["prop", "solid", "hazard", "pit", "light", "spawn", "turret-slot"]);
var safeAsset = (value) => typeof value === "string" && value.length <= 12e5 && (value === "" || value.startsWith("/") || /^data:image\/(png|webp|jpeg);base64,/.test(value));
var unit = (value, fallback = 0.5) => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;
function normalizeBattleMap(raw, fallbackMode = "casual") {
  const row = raw && typeof raw === "object" ? raw : {};
  const mode = modes.has(row.mode) ? row.mode : fallbackMode;
  const fallback = DEFAULT_BATTLE_MAPS[mode];
  const storedDepth = Number.isFinite(Number(row.world?.depth)) ? Math.max(1, Number(row.world?.depth)) : ARENA_D;
  const migrateY = (value, fallbackY = 0.5) => {
    const y = Math.max(topGateY, unit(value, fallbackY));
    if (storedDepth >= ARENA_D) return y;
    const oldEnd = 0.5 - LEAK_Z / storedDepth;
    const ratio = (routeEndY - topGateY) / Math.max(1e-3, oldEnd - topGateY);
    return Math.max(0, Math.min(1, topGateY + (y - topGateY) * ratio));
  };
  const routes = Array.isArray(row.routes) ? row.routes.slice(0, 12).map((r, i) => ({
    id: typeof r?.id === "string" ? r.id.slice(0, 64) : `route-${i + 1}`,
    name: typeof r?.name === "string" ? r.name.slice(0, 64) : `Route ${i + 1}`,
    width: Number.isFinite(Number(r?.width)) ? Math.max(0.5, Math.min(12, Number(r?.width))) : 4,
    points: Array.isArray(r?.points) ? r.points.slice(0, 256).map((p) => ({ x: unit(p?.x), y: migrateY(p?.y) })) : []
  })) : fallback.routes;
  const routeIds = new Set(routes.map((r) => r.id));
  const spawns = Array.isArray(row.spawns) ? row.spawns.slice(0, 32).map((s, i) => ({
    id: typeof s?.id === "string" ? s.id.slice(0, 64) : `spawn-${i + 1}`,
    routeId: routeIds.has(s?.routeId || "") ? s.routeId : routes[0]?.id || "main-route",
    x: unit(s?.x),
    y: migrateY(s?.y, topGateY),
    enabled: s?.enabled !== false,
    label: typeof s?.label === "string" ? s.label.slice(0, 80) : `Spawn ${i + 1}`
  })) : fallback.spawns;
  const entities = Array.isArray(row.entities) ? row.entities.slice(0, 256).filter((e) => e && kinds.has(e.kind)).map((e, i) => ({
    id: typeof e.id === "string" ? e.id.slice(0, 64) : `entity-${i + 1}`,
    kind: e.kind,
    x: unit(e.x),
    y: migrateY(e.y),
    width: Number.isFinite(Number(e.width)) ? Math.max(5e-3, Math.min(1, Number(e.width))) : 0.05,
    height: Number.isFinite(Number(e.height)) ? Math.max(5e-3, Math.min(1, Number(e.height))) : 0.05,
    rotation: Number.isFinite(Number(e.rotation)) ? Math.max(-360, Math.min(360, Number(e.rotation))) : 0,
    visible: e.visible !== false,
    asset: safeAsset(e.asset) ? e.asset : "",
    collision: e.collision === "solid" || e.collision === "trigger" ? e.collision : "none",
    damage: Number.isFinite(Number(e.damage)) ? Math.max(0, Math.min(1e3, Number(e.damage))) : 0,
    slow: Number.isFinite(Number(e.slow)) ? Math.max(0, Math.min(1, Number(e.slow))) : 0,
    label: typeof e.label === "string" ? e.label.slice(0, 80) : `Entity ${i + 1}`
  })) : fallback.entities;
  const point = (p, def) => p && typeof p === "object" ? { x: unit(p.x, def.x), y: unit(p.y, def.y) } : def;
  const bg = safeAsset(row.background) && row.background ? row.background : fallback.background;
  const width = ARENA_W;
  const depth = ARENA_D;
  const storedRows = Math.floor(Number(row.world?.rows) || fallback.world.rows);
  const rows = storedDepth < ARENA_D ? Math.round(storedRows * ARENA_D / storedDepth) : storedRows;
  return {
    schemaVersion: 1,
    id: typeof row.id === "string" && /^[a-z0-9_-]{1,80}$/i.test(row.id) ? row.id : fallback.id,
    mode,
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim().slice(0, 80) : fallback.name,
    background: bg,
    ...safeAsset(row.nightBackground) && row.nightBackground ? { nightBackground: row.nightBackground } : {},
    world: { width, depth, columns: Math.max(4, Math.min(64, Math.floor(Number(row.world?.columns) || fallback.world.columns))), rows: Math.max(8, Math.min(256, rows)) },
    routes,
    spawns,
    entities,
    tower: row.tower && storedDepth < ARENA_D ? { ...point(row.tower, fallback.tower), y: migrateY(row.tower.y, fallback.tower.y) } : point(row.tower, fallback.tower),
    ...mode === "pvp" ? { opponentTower: row.opponentTower && storedDepth < ARENA_D ? { ...point(row.opponentTower, fallback.opponentTower), y: migrateY(row.opponentTower.y, fallback.opponentTower.y) } : point(row.opponentTower, fallback.opponentTower) } : {},
    published: row.published !== false,
    revision: Number.isSafeInteger(row.revision) && Number(row.revision) > 0 ? Number(row.revision) : 1
  };
}

// server/routes/maps.ts
var MODES = /* @__PURE__ */ new Set(["casual", "horde", "campaign", "coop", "pvp"]);
var mapsRouter = Router15();
var adminMapsRouter = Router15();
function validAdmin(user) {
  return Boolean(process.env.ADMIN_STEAM_ID && user?.steamId === process.env.ADMIN_STEAM_ID);
}
function mapError(map) {
  if (!map.routes.length) return "Add at least one enemy route.";
  const routeIds = new Set(map.routes.map((route2) => route2.id));
  if (!map.spawns.some((spawn) => spawn.enabled)) return "Enable at least one spawn point.";
  if (map.spawns.some((spawn) => !routeIds.has(spawn.routeId))) return "Every spawn must connect to a saved route.";
  if (map.routes.some((route2) => route2.points.length < 2)) return "Each route needs at least two points.";
  if (map.mode !== "pvp" && map.spawns.some((spawn) => spawn.y > 0.2)) return "Standard-mode spawns must be at the top of the map.";
  if (map.mode === "pvp" && !map.opponentTower) return "PvP needs both tower anchors.";
  return null;
}
mapsRouter.get("/:mode", async (req2, res) => {
  const mode = req2.params.mode;
  if (!MODES.has(mode)) return res.status(404).json({ success: false, error: "Map mode not found." });
  try {
    const col = await getCollection("battle_maps");
    const map = await col.findOne({ mode, published: true }, { projection: { _id: 0 } });
    return res.json({ success: true, map: map || DEFAULT_BATTLE_MAPS[mode] });
  } catch (error2) {
    console.error("Battle map read failed:", error2);
    return res.status(503).json({ success: false, error: "Battle map service is unavailable." });
  }
});
adminMapsRouter.get("/", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!validAdmin(user)) return res.status(403).json({ success: false, error: "Admin access required." });
  try {
    const col = await getCollection("battle_maps");
    await col.bulkWrite(Object.values(DEFAULT_BATTLE_MAPS).map((map) => ({
      updateOne: { filter: { id: map.id }, update: { $setOnInsert: { ...map, updatedAt: /* @__PURE__ */ new Date() } }, upsert: true }
    })));
    const maps = await col.find({}, { projection: { _id: 0 } }).sort({ mode: 1, id: 1 }).toArray();
    return res.json({ success: true, maps });
  } catch (error2) {
    console.error("Admin battle map read failed:", error2);
    return res.status(503).json({ success: false, error: "Could not load maps from MongoDB." });
  }
});
adminMapsRouter.post("/", async (req2, res) => {
  const user = await resolveRequestUser(req2);
  if (!validAdmin(user)) return res.status(403).json({ success: false, error: "Admin access required." });
  try {
    const raw = req2.body?.map;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return res.status(400).json({ success: false, error: "Map data is required." });
    if (Buffer.byteLength(JSON.stringify(raw), "utf8") > 35e5) return res.status(413).json({ success: false, error: "Map is too large. Optimize uploaded images before saving." });
    const mode = MODES.has(raw.mode) ? raw.mode : "casual";
    const map = normalizeBattleMap(raw, mode);
    const error2 = mapError(map);
    if (error2) return res.status(400).json({ success: false, error: error2 });
    const col = await getCollection("battle_maps");
    const existing = await col.findOne({ id: map.id });
    const expected = Number(req2.body?.expectedRevision);
    if (existing && (!Number.isSafeInteger(expected) || expected !== existing.revision)) {
      return res.status(409).json({ success: false, error: "This map changed in another admin session. Reload it before saving.", currentRevision: existing.revision });
    }
    map.revision = existing ? existing.revision + 1 : 1;
    const document = { ...map, updatedAt: /* @__PURE__ */ new Date() };
    if (existing) {
      const result = await col.replaceOne({ id: map.id, revision: existing.revision }, document);
      if (!result.matchedCount) return res.status(409).json({ success: false, error: "This map changed while you were saving. Reload and try again." });
    } else {
      await col.insertOne(document);
    }
    return res.json({ success: true, map: document });
  } catch (error2) {
    console.error("Admin battle map save failed:", error2);
    return res.status(500).json({ success: false, error: "Could not save the map to MongoDB." });
  }
});

// server/app.ts
function createApp() {
  const app2 = express();
  const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
  app2.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : ["http://localhost:5173"],
    credentials: true
  }));
  app2.use(express.json({ limit: "4mb" }));
  app2.use(express.urlencoded({ extended: true }));
  app2.use((req2, res, next) => {
    if (!safeInput(req2.body) || !safeInput(req2.query)) {
      res.status(400).json({ success: false, error: "Invalid request fields" });
      return;
    }
    next();
  });
  app2.use((req2, _res, next) => {
    if (req2.path.startsWith("/api")) {
      console.log(`[API] ${req2.method} ${req2.path}`);
    }
    next();
  });
  app2.get("/api/health", async (_req, res) => {
    try {
      const db2 = await getDb();
      const ping = await db2.command({ ping: 1 });
      res.json({ status: "ok", mongo: ping.ok === 1, time: /* @__PURE__ */ new Date() });
    } catch (err) {
      res.status(500).json({ status: "error", error: err.message });
    }
  });
  app2.use("/api/coop", rateLimit(900, 6e4), coopRouter);
  app2.use("/api/auth", rateLimit(30, 6e4), authRouter);
  app2.use("/api/leaderboard", rateLimit(60, 6e4), leaderboardRouter);
  app2.use("/api/achievements", achievementsRouter);
  app2.use("/api/missions", missionsRouter);
  app2.use("/api/daily", rateLimit(20, 6e4), dailyRouter);
  app2.use("/api/steam", steamRouter);
  app2.use("/api/profile", profileRouter);
  app2.use("/api/maps", mapsRouter);
  app2.use("/api/admin/maps", rateLimit(30, 6e4), adminMapsRouter);
  app2.use("/api/items", rateLimit(60, 6e4), itemsRouter);
  app2.use("/api/admin", rateLimit(30, 6e4), adminRouter);
  app2.use("/api/badges", badgesRouter);
  app2.use("/api/social", rateLimit(90, 6e4), socialRouter);
  app2.use("/api/lobbies", rateLimit(90, 6e4), lobbyRouter);
  app2.use("/api/pvp", rateLimit(180, 6e4), pvpRouter);
  return app2;
}

// api/entry.ts
var app = createApp();
function normalizeApiUrl(req2) {
  const raw = req2.url || "/";
  const requestTarget = raw.startsWith("/") ? raw : (() => {
    try {
      const parsed = new URL(raw, "https://fruit-td.invalid");
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return "/";
    }
  })();
  const qIndex = requestTarget.indexOf("?");
  const pathOnly = qIndex >= 0 ? requestTarget.slice(0, qIndex) : requestTarget;
  const query = qIndex >= 0 ? requestTarget.slice(qIndex) : "";
  if (pathOnly === "/api" || pathOnly.startsWith("/api/")) return;
  const nextPath = pathOnly.startsWith("/") ? `/api${pathOnly}` : `/api/${pathOnly}`;
  req2.url = `${nextPath}${query}`;
}
function handler(req2, res) {
  normalizeApiUrl(req2);
  return app(req2, res);
}
export {
  handler as default,
  normalizeApiUrl
};
