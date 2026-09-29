// Bundled Fruit TD API for Vercel


// server/app.ts
import express from "express";
import cors from "cors";

// server/routes/leaderboard.ts
import { Router } from "express";
import crypto2 from "node:crypto";

// server/db.ts
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
dotenv.config();
var uri = process.env.MONGODB_URI;
if (!uri) {
  console.warn("\u26A0\uFE0F MONGODB_URI not found in environment variables. Falling back to local/mock mode.");
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
    await db.collection("badges").createIndex({ userId: 1, badgeId: 1 }, { unique: true });
  } catch (err) {
    console.warn("Index creation notice:", err);
  }
  return db;
}
async function getCollection(name) {
  const database = await getDb();
  return database.collection(name);
}

// src/game/requirements.ts
function currentMonthKey(date = /* @__PURE__ */ new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthlyLeaderboardMode(date = /* @__PURE__ */ new Date()) {
  return `monthly-${currentMonthKey(date)}`;
}
var DEFAULT_RANK_TIERS = [
  { id: "bronze", title: "Bronze", minScore: 0, color: "#cd7f32", icon: "B", rewardCoins: 100 },
  { id: "silver", title: "Silver", minScore: 1500, color: "#c0c0c0", icon: "S", rewardCoins: 250, rewardGems: 5 },
  { id: "gold", title: "Gold", minScore: 4e3, color: "#f5c542", icon: "G", rewardCoins: 500, rewardGems: 10 },
  { id: "platinum", title: "Platinum", minScore: 8e3, color: "#7dd3fc", icon: "P", rewardCoins: 750, rewardGems: 15 },
  { id: "diamond", title: "Diamond", minScore: 15e3, color: "#67e8f9", icon: "D", rewardCoins: 1500, rewardGems: 30 },
  { id: "master", title: "Master", minScore: 25e3, color: "#c084fc", icon: "M", rewardCoins: 2500, rewardGems: 60 },
  { id: "grandmaster", title: "Grandmaster", minScore: 4e4, color: "#fb7185", icon: "GM", rewardCoins: 5e3, rewardGems: 100 }
];
function rankFromScore(score, tiers = DEFAULT_RANK_TIERS) {
  const sorted = [...tiers].sort((a, b) => b.minScore - a.minScore);
  return sorted.find((t) => score >= t.minScore) ?? sorted[sorted.length - 1] ?? DEFAULT_RANK_TIERS[0];
}
function mergeRewardDefaults(items, defaults) {
  const byId = new Map(defaults.map((item) => [item.id, item]));
  return items.map((item) => {
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
var DEFAULT_MISSIONS = [
  { id: "daily_lemons", type: "daily", title: "Citrus Squeeze", desc: "Slice 30 Lemons or Strawberries", icon: "C", enabled: true, requirement: req("slice_citrus_or_berry", 30), rewardCoins: 80, rewardSp: 0 },
  { id: "daily_combos", type: "daily", title: "Combo Fiend", desc: "Perform 4 combos of 3x or higher", icon: "X", enabled: true, requirement: req("combo_count", 4, { minValue: 3 }), rewardCoins: 120, rewardSp: 0 },
  { id: "daily_wave", type: "daily", title: "Wave Survivor", desc: "Survive to Wave 5 in any run", icon: "W", enabled: true, requirement: req("wave_reach", 5), rewardCoins: 100, rewardSp: 0 },
  { id: "weekly_fruits", type: "weekly", title: "Fruit Apocalypse", desc: "Slice 250 total fruits this week", icon: "F", enabled: true, requirement: req("slice_any", 250), rewardCoins: 350, rewardSp: 1 },
  { id: "monthly_ranked_climb", type: "monthly", title: "Monthly Climb", desc: "Score 4,000 in Ranked this month to reach Gold", icon: "G", enabled: true, requirement: req("reach_gold", 4e3), rewardCoins: 500, rewardSp: 1, rewardGems: 10, rewardBadge: "gold-slicer" },
  { id: "monthly_silver_climb", type: "monthly", title: "Silver Season", desc: "Score 1,500 in Ranked this month to reach Silver", icon: "S", enabled: true, requirement: req("reach_silver", 1500), rewardCoins: 250, rewardSp: 0, rewardGems: 5, rewardBadge: "silver-slicer" },
  { id: "monthly_diamond_climb", type: "monthly", title: "Diamond Season", desc: "Score 15,000 in Ranked this month to reach Diamond", icon: "D", enabled: true, requirement: req("reach_diamond", 15e3), rewardCoins: 800, rewardSp: 2, rewardGems: 25, rewardBadge: "diamond-slicer" }
];
var DEFAULT_ACHIEVEMENTS = [
  { id: "first_slice", title: "First Blood", desc: "Slice your very first fruit", icon: "1", enabled: true, requirement: req("slice_any", 1), rewardCoins: 50, rewardSp: 0, rewardGems: 1, rewardBadge: "first-cut" },
  { id: "combo_5", title: "Combo Artist", desc: "Execute a 5x or higher combo slice", icon: "5", enabled: true, requirement: req("combo_reach_5", 5), rewardCoins: 100, rewardSp: 0 },
  { id: "combo_10", title: "Blade Master", desc: "Execute a massive 10x combo slice", icon: "X", enabled: true, requirement: req("combo_reach_10", 10), rewardCoins: 250, rewardSp: 1, rewardBadge: "combo-king" },
  { id: "fruit_100", title: "Fruit Peeler", desc: "Slice 100 total fruits", icon: "F", enabled: true, requirement: req("slice_any", 100), rewardCoins: 150, rewardSp: 0 },
  { id: "fruit_500", title: "Juice Tycoon", desc: "Slice 500 total fruits", icon: "J", enabled: true, requirement: req("slice_any", 500), rewardCoins: 300, rewardSp: 1 },
  { id: "fruit_1000", title: "Legendary Samurai", desc: "Slice 1,000 total fruits", icon: "S", enabled: true, requirement: req("slice_any", 1e3), rewardCoins: 600, rewardSp: 2 },
  { id: "wave_5", title: "Hold The Line", desc: "Survive to Wave 5", icon: "W", enabled: true, requirement: req("wave_reach", 5), rewardCoins: 100, rewardSp: 0 },
  { id: "wave_10", title: "Citrus Citadel", desc: "Survive to Wave 10", icon: "C", enabled: true, requirement: req("wave_reach", 10), rewardCoins: 250, rewardSp: 1, rewardBadge: "wall-guard" },
  { id: "super_juice", title: "Max Vitamin C", desc: "Activate Super Juice mode", icon: "V", enabled: true, requirement: req("super_activate", 1), rewardCoins: 100, rewardSp: 0 },
  { id: "untouchable", title: "Pristine Wall", desc: "Clear a wave with 100% wall integrity", icon: "P", enabled: true, requirement: req("perfect_wave", 1), rewardCoins: 150, rewardSp: 0 },
  { id: "turret_builder", title: "Fortress Architect", desc: "Place 3 turrets on your defensive wall", icon: "T", enabled: true, requirement: req("turret_place", 3), rewardCoins: 150, rewardSp: 0 },
  { id: "steam_connect", title: "Steam Cadet", desc: "Link your Steam profile to Fruit TD", icon: "ST", enabled: true, requirement: req("steam_link", 1), rewardCoins: 500, rewardSp: 1, rewardBadge: "steam-cadet" },
  { id: "diamond_rank", title: "Diamond Slicer", desc: "Reach Diamond on the monthly ranked ladder", icon: "D", enabled: true, requirement: req("reach_diamond", 15e3), rewardCoins: 800, rewardSp: 2, rewardGems: 25, rewardBadge: "diamond-slicer" }
];
var DEFAULT_BADGES = [
  { id: "first-cut", title: "First Cut", desc: "Awarded for your first slice", icon: "FC", rarity: "common", enabled: true, requirement: req("slice_any", 1), rewardCoins: 50 },
  { id: "combo-king", title: "Combo King", desc: "Awarded for a 10x combo", icon: "CK", rarity: "rare", enabled: true, requirement: req("combo_reach_10", 10), rewardCoins: 150, rewardGems: 2 },
  { id: "wall-guard", title: "Wall Guard", desc: "Hold the wall to wave 10", icon: "WG", rarity: "rare", enabled: true, requirement: req("wave_reach", 10), rewardCoins: 100, rewardGems: 2 },
  { id: "steam-cadet", title: "Steam Cadet", desc: "Linked Steam account", icon: "SC", rarity: "common", enabled: true, requirement: req("steam_link", 1), rewardCoins: 100 },
  { id: "bronze-slicer", title: "Bronze Slicer", desc: "Finish a Ranked match this month", icon: "BR", rarity: "common", enabled: true, requirement: req("monthly_games", 1), rewardCoins: 100 },
  { id: "silver-slicer", title: "Silver Slicer", desc: "Monthly Silver rank", icon: "SS", rarity: "rare", enabled: true, requirement: req("reach_silver", 1500), rewardCoins: 250, rewardGems: 5 },
  { id: "gold-slicer", title: "Gold Slicer", desc: "Monthly Gold rank", icon: "GS", rarity: "epic", enabled: true, requirement: req("reach_gold", 4e3), rewardCoins: 500, rewardGems: 10 },
  { id: "diamond-slicer", title: "Diamond Slicer", desc: "Monthly Diamond rank", icon: "DS", rarity: "legendary", enabled: true, requirement: req("reach_diamond", 15e3), rewardCoins: 1e3, rewardGems: 25 },
  { id: "daily-regular", title: "Daily Regular", desc: "Claim 7 daily bonuses", icon: "DR", rarity: "rare", enabled: true, requirement: req("claim_daily", 7), rewardCoins: 250, rewardGems: 5 }
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
      missions: mergeRewardDefaults(Array.isArray(doc?.missions) && doc.missions.length ? doc.missions : DEFAULT_MISSIONS, DEFAULT_MISSIONS),
      achievements: mergeRewardDefaults(Array.isArray(doc?.achievements) && doc.achievements.length ? doc.achievements : DEFAULT_ACHIEVEMENTS, DEFAULT_ACHIEVEMENTS),
      badges: mergeRewardDefaults(Array.isArray(doc?.badges) && doc.badges.length ? doc.badges : DEFAULT_BADGES, DEFAULT_BADGES),
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
  const fallback = (error) => exposePreview ? { previewCode: code, emailed: false, ...error ? { error } : {} } : { emailed: false, error: error || "Email delivery is unavailable." };
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
var HEROES = ["jiju", "topfu", "lagen", "tripos", "ki"];
var SKILLS = ["edge", "reach", "flow", "steel", "storm"];
var HERO_PERKS = ["combo", "juice", "tower", "critical", "survival"];
var DEFAULT_OWNABLE_SKINS = /* @__PURE__ */ new Set(["blade-default", "blade-gold", "blade-ink", "blade-cherry", "wall-brick", "wall-stone", "wall-night"]);
var SAVE_KEYS = /* @__PURE__ */ new Set(["hero", "xp", "ownedHeroes", "towerXp", "towerLifetimeXp", "highScore", "rankedScore", "bestWave", "bestCombo", "games", "coins", "gems", "nickname", "avatar", "skillPoints", "skills", "ownedSkins", "bladeSkin", "wallSkin", "mode", "heroPerkRanks", "vipStatus", "saveRevision", "savedAt"]);
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
  for (const key of ["xp", "skills", "heroPerkRanks"]) {
    const field = save[key];
    if (field !== void 0 && (!field || typeof field !== "object" || Array.isArray(field))) return `Invalid ${key}`;
  }
  if (save.xp && Object.entries(save.xp).some(([hero, xp]) => !HEROES.includes(hero) || !boundedInteger(xp, 1e6))) return "Invalid hero XP";
  if (save.skills && Object.entries(save.skills).some(([id, rank]) => !SKILLS.includes(id) || !boundedInteger(rank, 3))) return "Invalid skill ranks";
  if (save.heroPerkRanks && Object.entries(save.heroPerkRanks).some(([hero, ranks]) => !HEROES.includes(hero) || !ranks || typeof ranks !== "object" || Array.isArray(ranks) || Object.entries(ranks).some(([id, rank]) => !HERO_PERKS.includes(id) || !boundedInteger(rank, 3)))) return "Invalid hero perk ranks";
  for (const key of ["ownedSkins", "ownedHeroes"]) {
    const list = save[key];
    if (list !== void 0 && (!Array.isArray(list) || list.length > 500 || !list.every(validId))) return `Invalid ${key}`;
  }
  if (Array.isArray(save.ownedHeroes) && save.ownedHeroes.some((id) => !HEROES.includes(id))) return "Unknown hero";
  if (Array.isArray(save.ownedSkins) && save.ownedSkins.some((id) => !allowedSkinIds.has(id))) return "Unknown owned skin";
  if (Array.isArray(save.ownedSkins) && new Set(save.ownedSkins).size !== save.ownedSkins.length) return "Duplicate owned skin";
  if (Array.isArray(save.ownedHeroes) && new Set(save.ownedHeroes).size !== save.ownedHeroes.length) return "Duplicate owned hero";
  if (save.hero !== void 0 && (typeof save.hero !== "string" || !HEROES.includes(save.hero))) return "Invalid hero";
  if (save.mode !== void 0 && (typeof save.mode !== "string" || !["casual", "ranked", "coop", "arena"].includes(save.mode))) return "Invalid mode";
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
var HEROES2 = [
  { id: "jiju", name: "Master Jiju", title: "Clean blade", color: 3108845, trail: 1920728, blurb: "Classic wide cuts. Combos stack if you keep slicing.", mouse: "Precise flicks. Combo builds fast.", touch: "Wider finger slash. Easier to clip packs.", damage: 18, radius: 0.16, shake: 0.55, unlockLevel: 1 },
  { id: "topfu", name: "Topfu", title: "Soft pressure", color: 16040810, trail: 15251530, blurb: "Shorter reach, but fruit go brittle and slow.", mouse: "Short snap cuts. Stacks brittle.", touch: "Fat squash pad. Bigger slow zone.", damage: 13, radius: 0.1, shake: 0.35, unlockLevel: 10 },
  { id: "lagen", name: "Lagen", title: "Long reach", color: 3842906, trail: 2278750, blurb: "Lance slash. The swipe keeps going past your cursor.", mouse: "Fast flick = extra spear length.", touch: "Stable long line, a bit less extra reach.", damage: 16, radius: 0.12, shake: 0.45, unlockLevel: 25 },
  { id: "tripos", name: "Tripos", title: "Triple path", color: 12860298, trail: 15235520, blurb: "One swipe becomes three parallel cuts.", mouse: "Tight triple lines.", touch: "Wider triple spread.", damage: 11, radius: 0.1, shake: 0.4, unlockLevel: 50, purchaseOnly: true, purchaseCost: heroPrice("tripos") ?? 1800 },
  { id: "ki", name: "Master Ki", title: "Charged spirit", color: 8141549, trail: 10980346, blurb: "Hold to charge. Tap empty grass for a Ki pulse.", mouse: "Hold, then flick for a heavy cut.", touch: "Tap to pulse. Swipe to slash.", damage: 15, radius: 0.14, shake: 0.7, unlockLevel: 75, purchaseOnly: true, purchaseCost: heroPrice("ki") ?? 3e3 }
];
var MAX_HERO_LEVEL = 100;
function heroDef(id) {
  return HEROES2.find((h) => h.id === id) ?? HEROES2[0];
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
var SKILLS2 = [
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
var SIM_DT = 1 / 60;
var IMPACT_FREEZE = 1 / 60;
var WALL_Z = -9.2;
var EXTRA_Z = -7.85;
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
  const def = HEROES2.find((h) => h.id === heroId);
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
    vipStatus: "none",
    saveRevision: 0,
    savedAt: 0
  };
}
var WALL_SKINS = [
  { id: "wall-brick", name: "Brick wall", kind: "wall", cost: 0, sellValue: 0, color: 10698034, blurb: "Default clay bricks." },
  { id: "wall-stone", name: "Stone wall", kind: "wall", cost: 200, sellValue: 70, color: 9146265, blurb: "Cool grey stone." },
  { id: "wall-night", name: "Night wall", kind: "wall", cost: 280, sellValue: 95, color: 2831184, blurb: "Dark midnight fort." }
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
    if (HEROES2.some((entry) => entry.id === hero) && amount > 0) set[`saveData.xp.${hero}`] = cappedCredit(`xp.${hero}`, amount, 1e6);
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
  const router = Router();
  router.post("/run", async (req2, res) => {
    try {
      const mode = req2.body?.mode ?? "casual";
      if (!["casual", "ranked", "coop", "arena"].includes(mode)) return res.status(400).json({ success: false, error: "Invalid mode" });
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
      if (req2.query.mode !== void 0 && (typeof req2.query.mode !== "string" || !/^(casual|ranked|coop|arena|monthly|monthly-\d{4}-\d{2})$/.test(req2.query.mode))) return res.status(400).json({ success: false, error: "Invalid mode" });
      const mode = resolveMode(req2.query.mode || "ranked");
      const limit = Math.max(1, Math.min(parseInt(String(req2.query.limit)) || 50, 100));
      const userId = (await deps.resolveUser(req2))?.userId;
      const col = await deps.collection("leaderboards");
      const topEntries = await col.find({ mode }).sort({ score: -1, wave: -1 }).limit(limit).toArray();
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
        const userBest = await col.findOne({ userId, mode }, { sort: { score: -1 } });
        if (userBest) {
          const higherCount = await col.countDocuments({
            mode,
            $or: [
              { score: { $gt: userBest.score } },
              { score: userBest.score, wave: { $gt: userBest.wave } }
            ]
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
      if (mode !== void 0 && !["casual", "ranked", "coop", "arena"].includes(mode)) return res.status(400).json({ success: false, error: "Invalid mode" });
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
          gems: Math.min(100, Math.floor((wave || 0) / 5))
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
          rankedScore: playMode === "ranked" ? score : 0,
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
        if (score > existing.score || score === existing.score && (wave || 1) > existing.wave) {
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
      const isNewHigh = await upsertBest(playMode);
      if (playMode === "ranked") {
        await upsertBest(monthlyLeaderboardMode());
      }
      const higherCount = await col.countDocuments({
        mode: playMode,
        score: { $gt: score }
      });
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
import { Router as Router2 } from "express";
var defaultDeps2 = { resolveUser: resolveRequestUser, collection: getCollection, catalog: loadQuestCatalog };
function createAchievementsRouter(deps = defaultDeps2) {
  const router = Router2();
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
import { Router as Router3 } from "express";
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
  if (type === "weekly") return getWeekKey();
  if (type === "monthly") return `M-${getMonthKey()}`;
  return getDayKey();
}
function createMissionsRouter(deps = defaultDeps3) {
  const router = Router3();
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
      for (const update of updates) {
        const def = catalog.missions.find((m) => m.id === update.missionId && m.enabled !== false);
        if (!def) continue;
        const activeKey = periodKey(def.type);
        const existing = await col.findOne({ userId, missionId: def.id, dayKey: activeKey });
        let currentProgress = existing?.progress || 0;
        const goal = def.requirement?.goal || 1;
        if (typeof update.setProgress === "number") {
          currentProgress = Math.max(currentProgress, update.setProgress);
        } else if (typeof update.progressDelta === "number") {
          currentProgress += update.progressDelta;
        }
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
      res.json({ success: true });
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
import { Router as Router5 } from "express";

// server/routes/admin.ts
import { Router as Router4 } from "express";
import { ObjectId } from "mongodb";
var adminRouter = Router4();
var ADMIN_STEAM_ID = process.env.ADMIN_STEAM_ID || "";
var ICON_TYPES = /* @__PURE__ */ new Set(["coin", "gem", "chest", "blade"]);
function normalizeDailyRewards(input) {
  const rows = Array.isArray(input) ? input : [];
  return DEFAULT_ADMIN_CONFIG.dailyRewards.map((fallback, i) => {
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
function normalizePrizeCatalog(input, defaults) {
  const rows = mergeRewardDefaults(Array.isArray(input) && input.length ? input : defaults, defaults);
  return rows.map((item) => ({
    ...item,
    rewardCoins: Math.max(0, Math.min(1e6, Math.floor(Number(item.rewardCoins) || 0))),
    rewardGems: Math.max(0, Math.min(1e6, Math.floor(Number(item.rewardGems) || 0))),
    ..."rewardSp" in item ? { rewardSp: Math.max(0, Math.min(1e4, Math.floor(Number(item.rewardSp) || 0))) } : {}
  }));
}
function normalizeMenuConfig(input) {
  const row = input && typeof input === "object" ? input : {};
  return {
    eyebrow: String(row.eyebrow ?? DEFAULT_ADMIN_CONFIG.menuConfig.eyebrow),
    title: String(row.title ?? DEFAULT_ADMIN_CONFIG.menuConfig.title),
    subtitle: String(row.subtitle ?? DEFAULT_ADMIN_CONFIG.menuConfig.subtitle),
    announcement: String(row.announcement ?? DEFAULT_ADMIN_CONFIG.menuConfig.announcement),
    themeColor: String(row.themeColor ?? DEFAULT_ADMIN_CONFIG.menuConfig.themeColor)
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
    startMoney: num(row.startMoney, DEFAULT_ADMIN_CONFIG.gameplayConfig.startMoney, 0, 1e5),
    startLives: num(row.startLives, DEFAULT_ADMIN_CONFIG.gameplayConfig.startLives, 1, 100),
    scoreMultiplier: num(row.scoreMultiplier, DEFAULT_ADMIN_CONFIG.gameplayConfig.scoreMultiplier, 0.1, 10),
    superChargeMultiplier: num(
      row.superChargeMultiplier,
      DEFAULT_ADMIN_CONFIG.gameplayConfig.superChargeMultiplier,
      0.5,
      5
    )
  };
}
var DEFAULT_ADMIN_CONFIG = {
  configKey: "game_config",
  dailyRewards: [
    { day: 1, coins: 50, skillPoints: 0, gems: 5, label: "50 Coins + 5 \u{1F48E}", iconType: "coin" },
    { day: 2, coins: 100, skillPoints: 1, gems: 10, label: "100 Coins + 1 SP + 10 \u{1F48E}", iconType: "gem" },
    { day: 3, coins: 150, skillPoints: 0, gems: 15, label: "150 Coins + 15 \u{1F48E}", iconType: "coin" },
    { day: 4, coins: 200, skillPoints: 0, gems: 20, label: "200 Coins + 20 \u{1F48E}", iconType: "coin" },
    { day: 5, coins: 300, skillPoints: 2, gems: 25, label: "300 Coins + 2 SP + 25 \u{1F48E}", iconType: "gem" },
    { day: 6, coins: 450, skillPoints: 0, gems: 30, label: "450 Coins + 30 \u{1F48E}", iconType: "chest" },
    { day: 7, coins: 1e3, skillPoints: 2, gems: 50, skinUnlock: "blade-gold", label: "1,000 Coins + Gold Blade + 50 \u{1F48E}!", iconType: "blade" }
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
    themeColor: "#a3e635"
  },
  gameplayConfig: {
    startMoney: 140,
    startLives: 15,
    scoreMultiplier: 1,
    superChargeMultiplier: 1
  },
  missions: DEFAULT_MISSIONS,
  achievements: DEFAULT_ACHIEVEMENTS,
  badges: DEFAULT_BADGES,
  ranks: DEFAULT_RANK_TIERS,
  slicers: DEFAULT_SLICERS,
  enemies: [],
  waves: { version: 1, levels: {} }
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
        ...DEFAULT_ADMIN_CONFIG,
        updatedAt: /* @__PURE__ */ new Date()
      };
      await col.insertOne(seed);
      doc = seed;
    }
    const cfg = doc;
    res.json({
      success: true,
      config: {
        ...DEFAULT_ADMIN_CONFIG,
        ...cfg,
        vipTiers: Array.isArray(cfg.vipTiers) && cfg.vipTiers.length ? cfg.vipTiers : DEFAULT_ADMIN_CONFIG.vipTiers,
        missions: normalizePrizeCatalog(cfg.missions, DEFAULT_MISSIONS),
        achievements: normalizePrizeCatalog(cfg.achievements, DEFAULT_ACHIEVEMENTS),
        badges: normalizePrizeCatalog(cfg.badges, DEFAULT_BADGES),
        ranks: normalizePrizeCatalog(cfg.ranks, DEFAULT_RANK_TIERS),
        slicers: Array.isArray(cfg.slicers) && cfg.slicers.length ? cfg.slicers : DEFAULT_SLICERS,
        enemies: Array.isArray(cfg.enemies) && cfg.enemies.length ? cfg.enemies : [],
        waves: cfg.waves && typeof cfg.waves === "object" ? cfg.waves : DEFAULT_ADMIN_CONFIG.waves
      }
    });
  } catch (err) {
    console.error("Error getting admin config:", err);
    res.json({
      success: true,
      offline: true,
      config: { ...DEFAULT_ADMIN_CONFIG, updatedAt: /* @__PURE__ */ new Date() }
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
    const { dailyRewards, vipTiers, menuConfig, gameplayConfig, missions, achievements, badges, ranks, slicers, enemies, waves } = req2.body;
    const col = await getCollection("admin_config");
    const existing = await col.findOne({ configKey: "game_config" });
    const updated = {
      configKey: "game_config",
      dailyRewards: dailyRewards ? normalizeDailyRewards(dailyRewards) : existing?.dailyRewards || DEFAULT_ADMIN_CONFIG.dailyRewards,
      vipTiers: vipTiers || existing?.vipTiers || DEFAULT_ADMIN_CONFIG.vipTiers,
      menuConfig: menuConfig ? normalizeMenuConfig(menuConfig) : existing?.menuConfig || DEFAULT_ADMIN_CONFIG.menuConfig,
      gameplayConfig: gameplayConfig ? normalizeGameplayConfig(gameplayConfig) : existing?.gameplayConfig || DEFAULT_ADMIN_CONFIG.gameplayConfig,
      missions: normalizePrizeCatalog(Array.isArray(missions) ? missions : existing?.missions, DEFAULT_MISSIONS),
      achievements: normalizePrizeCatalog(Array.isArray(achievements) ? achievements : existing?.achievements, DEFAULT_ACHIEVEMENTS),
      badges: normalizePrizeCatalog(Array.isArray(badges) ? badges : existing?.badges, DEFAULT_BADGES),
      ranks: normalizePrizeCatalog(Array.isArray(ranks) ? ranks : existing?.ranks, DEFAULT_RANK_TIERS),
      slicers: Array.isArray(slicers) ? slicers : existing?.slicers || DEFAULT_SLICERS,
      enemies: Array.isArray(enemies) ? enemies : existing?.enemies || [],
      waves: waves && typeof waves === "object" ? waves : existing?.waves || DEFAULT_ADMIN_CONFIG.waves,
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
    return doc?.vipTiers?.length ? doc.vipTiers : DEFAULT_ADMIN_CONFIG.vipTiers || [];
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
      return DEFAULT_ADMIN_CONFIG.dailyRewards.map((fallback, i) => ({
        ...fallback,
        ...doc.dailyRewards[i] || {},
        day: i + 1
      }));
    }
  } catch {
  }
  return DEFAULT_ADMIN_CONFIG.dailyRewards;
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
  const router = Router5();
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
import { Router as Router7 } from "express";
import crypto4 from "crypto";

// server/steam.ts
import dotenv2 from "dotenv";
dotenv2.config();
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
import { Router as Router6 } from "express";
import crypto3 from "crypto";
var authRouter = Router6();
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
var steamRouter = Router7();
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
  const fail = (msg) => res.redirect(`${front}/?auth_error=${encodeURIComponent(msg)}`);
  try {
    const steamId = await verifySteamOpenId(req2.query);
    if (!steamId) return fail("Steam login could not be verified.");
    const summary = await fetchSteamPlayerSummary(steamId);
    if (!summary) return fail("Could not load your Steam profile.");
    const users = await getCollection("users");
    const mode = String(req2.query.mode || "login");
    const linkToken = typeof req2.query.linkToken === "string" ? req2.query.linkToken : "";
    let user = null;
    let bonus = false;
    if (linkToken) {
      const sessionUser = await resolveSession(linkToken);
      if (sessionUser) {
        const other = await users.findOne({ steamId, userId: { $ne: sessionUser.userId } });
        if (other) return fail("That Steam account is already linked to another player.");
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
    return fail(err.message || "Steam login failed.");
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
import { Router as Router8 } from "express";
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
  const router = Router8();
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
import { Router as Router9 } from "express";
var badgesRouter = Router9();
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
    res.json({ success: true, newlyUnlocked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/items.ts
import { Router as Router10 } from "express";
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
  const router = Router10();
  router.post("/action", async (req2, res) => {
    try {
      const user = await deps.resolveUser(req2);
      if (!user) return res.status(401).json({ success: false, error: "Sign in to manage gear" });
      const action = req2.body?.action;
      const id = req2.body?.id;
      if (!["buy", "equip", "unequip", "sell", "buy-vip", "buy-skill"].includes(action) || typeof id !== "string" || id.length > 120) {
        return res.status(400).json({ success: false, error: "Invalid gear action" });
      }
      const slicers = await deps.slicers();
      const slicer = isSlicer(id, slicers);
      const wall = WALL_SKINS.find((item) => item.id === id);
      const heroId = id.startsWith("hero:") ? id.slice(5) : null;
      const hero = heroId && HEROES2.find((item) => item.id === heroId);
      if (!["buy-vip", "buy-skill"].includes(action) && !slicer && !wall && !hero) return res.status(404).json({ success: false, error: "Gear not found" });
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
      } else if (action === "buy-skill") {
        const skill = SKILLS2.find((entry) => entry.id === id);
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

// server/app.ts
function createApp() {
  const app2 = express();
  const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean);
  app2.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : ["http://localhost:5173"],
    credentials: true
  }));
  app2.use(express.json({ limit: "2mb" }));
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
  app2.use("/api/auth", rateLimit(30, 6e4), authRouter);
  app2.use("/api/leaderboard", rateLimit(60, 6e4), leaderboardRouter);
  app2.use("/api/achievements", achievementsRouter);
  app2.use("/api/missions", missionsRouter);
  app2.use("/api/daily", rateLimit(20, 6e4), dailyRouter);
  app2.use("/api/steam", steamRouter);
  app2.use("/api/profile", profileRouter);
  app2.use("/api/items", rateLimit(60, 6e4), itemsRouter);
  app2.use("/api/admin", rateLimit(30, 6e4), adminRouter);
  app2.use("/api/badges", badgesRouter);
  return app2;
}

// api/entry.ts
var app = createApp();
function normalizeApiUrl(req2) {
  const raw = req2.url || "/";
  const qIndex = raw.indexOf("?");
  const pathOnly = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
  const query = qIndex >= 0 ? raw.slice(qIndex) : "";
  if (pathOnly === "/api" || pathOnly.startsWith("/api/")) return;
  const nextPath = pathOnly.startsWith("/") ? `/api${pathOnly}` : `/api/${pathOnly}`;
  req2.url = `${nextPath}${query}`;
}
function handler(req2, res) {
  normalizeApiUrl(req2);
  return app(req2, res);
}
export {
  handler as default
};
