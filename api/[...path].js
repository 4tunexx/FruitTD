// Bundled Fruit TD API for Vercel


// server/app.ts
import express from "express";
import cors from "cors";

// server/routes/leaderboard.ts
import { Router } from "express";

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
  { id: "bronze", title: "Bronze", minScore: 0, color: "#cd7f32", icon: "B" },
  { id: "silver", title: "Silver", minScore: 1500, color: "#c0c0c0", icon: "S" },
  { id: "gold", title: "Gold", minScore: 4e3, color: "#f5c542", icon: "G" },
  { id: "platinum", title: "Platinum", minScore: 8e3, color: "#7dd3fc", icon: "P" },
  { id: "diamond", title: "Diamond", minScore: 15e3, color: "#67e8f9", icon: "D" },
  { id: "master", title: "Master", minScore: 25e3, color: "#c084fc", icon: "M" },
  { id: "grandmaster", title: "Grandmaster", minScore: 4e4, color: "#fb7185", icon: "GM" }
];
function rankFromScore(score, tiers = DEFAULT_RANK_TIERS) {
  const sorted = [...tiers].sort((a, b) => b.minScore - a.minScore);
  return sorted.find((t) => score >= t.minScore) ?? sorted[sorted.length - 1] ?? DEFAULT_RANK_TIERS[0];
}
function req(type, goal, extra = {}) {
  return { type, goal, ...extra };
}
var DEFAULT_MISSIONS = [
  { id: "daily_lemons", type: "daily", title: "Citrus Squeeze", desc: "Slice 30 Lemons or Strawberries", icon: "C", enabled: true, requirement: req("slice_citrus_or_berry", 30), rewardCoins: 80, rewardSp: 0 },
  { id: "daily_combos", type: "daily", title: "Combo Fiend", desc: "Perform 4 combos of 3x or higher", icon: "X", enabled: true, requirement: req("combo_count", 4, { minValue: 3 }), rewardCoins: 120, rewardSp: 0 },
  { id: "daily_wave", type: "daily", title: "Wave Survivor", desc: "Survive to Wave 5 in any run", icon: "W", enabled: true, requirement: req("wave_reach", 5), rewardCoins: 100, rewardSp: 0 },
  { id: "weekly_fruits", type: "weekly", title: "Fruit Apocalypse", desc: "Slice 250 total fruits this week", icon: "F", enabled: true, requirement: req("slice_any", 250), rewardCoins: 350, rewardSp: 1 },
  { id: "monthly_ranked_climb", type: "monthly", title: "Monthly Climb", desc: "Score 4,000 in Ranked this month to reach Gold", icon: "G", enabled: true, requirement: req("reach_gold", 4e3), rewardCoins: 500, rewardSp: 1, rewardBadge: "gold-slicer" },
  { id: "monthly_silver_climb", type: "monthly", title: "Silver Season", desc: "Score 1,500 in Ranked this month to reach Silver", icon: "S", enabled: true, requirement: req("reach_silver", 1500), rewardCoins: 250, rewardSp: 0, rewardBadge: "silver-slicer" },
  { id: "monthly_diamond_climb", type: "monthly", title: "Diamond Season", desc: "Score 15,000 in Ranked this month to reach Diamond", icon: "D", enabled: true, requirement: req("reach_diamond", 15e3), rewardCoins: 800, rewardSp: 2, rewardBadge: "diamond-slicer" }
];
var DEFAULT_ACHIEVEMENTS = [
  { id: "first_slice", title: "First Blood", desc: "Slice your very first fruit", icon: "1", enabled: true, requirement: req("slice_any", 1), rewardCoins: 50, rewardSp: 0, rewardBadge: "first-cut" },
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
  { id: "diamond_rank", title: "Diamond Slicer", desc: "Reach Diamond on the monthly ranked ladder", icon: "D", enabled: true, requirement: req("reach_diamond", 15e3), rewardCoins: 800, rewardSp: 2, rewardBadge: "diamond-slicer" }
];
var DEFAULT_BADGES = [
  { id: "first-cut", title: "First Cut", desc: "Awarded for your first slice", icon: "FC", rarity: "common", enabled: true, requirement: req("slice_any", 1) },
  { id: "combo-king", title: "Combo King", desc: "Awarded for a 10x combo", icon: "CK", rarity: "rare", enabled: true, requirement: req("combo_reach_10", 10) },
  { id: "wall-guard", title: "Wall Guard", desc: "Hold the wall to wave 10", icon: "WG", rarity: "rare", enabled: true, requirement: req("wave_reach", 10) },
  { id: "steam-cadet", title: "Steam Cadet", desc: "Linked Steam account", icon: "SC", rarity: "common", enabled: true, requirement: req("steam_link", 1) },
  { id: "bronze-slicer", title: "Bronze Slicer", desc: "Finish a Ranked match this month", icon: "BR", rarity: "common", enabled: true, requirement: req("monthly_games", 1) },
  { id: "silver-slicer", title: "Silver Slicer", desc: "Monthly Silver rank", icon: "SS", rarity: "rare", enabled: true, requirement: req("reach_silver", 1500) },
  { id: "gold-slicer", title: "Gold Slicer", desc: "Monthly Gold rank", icon: "GS", rarity: "epic", enabled: true, requirement: req("reach_gold", 4e3) },
  { id: "diamond-slicer", title: "Diamond Slicer", desc: "Monthly Diamond rank", icon: "DS", rarity: "legendary", enabled: true, requirement: req("reach_diamond", 15e3) },
  { id: "daily-regular", title: "Daily Regular", desc: "Claim 7 daily bonuses", icon: "DR", rarity: "rare", enabled: true, requirement: req("claim_daily", 7) }
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
      missions: Array.isArray(doc?.missions) && doc.missions.length ? doc.missions : DEFAULT_MISSIONS,
      achievements: Array.isArray(doc?.achievements) && doc.achievements.length ? doc.achievements : DEFAULT_ACHIEVEMENTS,
      badges: Array.isArray(doc?.badges) && doc.badges.length ? doc.badges : DEFAULT_BADGES,
      ranks: Array.isArray(doc?.ranks) && doc.ranks.length ? doc.ranks : DEFAULT_RANK_TIERS,
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
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return process.env.NODE_ENV === "production" ? { emailed: false, error: "Email delivery is not configured." } : { previewCode: code, emailed: false };
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
      console.error("[auth] Resend failed:", res.status, body);
      return process.env.NODE_ENV === "production" ? { emailed: false, error: "Email delivery failed." } : { previewCode: code, emailed: false, error: "Email send failed" };
    }
    return { emailed: true };
  } catch (err) {
    console.error("[auth] Resend error:", err);
    return process.env.NODE_ENV === "production" ? { emailed: false, error: "Email delivery failed." } : { previewCode: code, emailed: false, error: "Email send failed" };
  }
}

// server/validation.ts
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
var SAVE_KEYS = /* @__PURE__ */ new Set(["hero", "xp", "ownedHeroes", "towerXp", "towerLifetimeXp", "highScore", "rankedScore", "bestWave", "bestCombo", "games", "coins", "gems", "nickname", "avatar", "skillPoints", "skills", "ownedSkins", "bladeSkin", "wallSkin", "mode", "heroPerkRanks", "vipStatus", "saveRevision", "savedAt"]);
function saveValidationError(value) {
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
  if (save.skills && Object.entries(save.skills).some(([id, rank]) => !validId(id) || !boundedInteger(rank, 100))) return "Invalid skill ranks";
  if (save.heroPerkRanks && Object.entries(save.heroPerkRanks).some(([hero, ranks]) => !HEROES.includes(hero) || !ranks || typeof ranks !== "object" || Array.isArray(ranks) || Object.entries(ranks).some(([id, rank]) => !validId(id) || !boundedInteger(rank, 100)))) return "Invalid hero perk ranks";
  for (const key of ["ownedSkins", "ownedHeroes"]) {
    const list = save[key];
    if (list !== void 0 && (!Array.isArray(list) || list.length > 500 || !list.every(validId))) return `Invalid ${key}`;
  }
  if (Array.isArray(save.ownedHeroes) && save.ownedHeroes.some((id) => !HEROES.includes(id))) return "Unknown hero";
  if (save.hero !== void 0 && (typeof save.hero !== "string" || !HEROES.includes(save.hero))) return "Invalid hero";
  if (save.mode !== void 0 && (typeof save.mode !== "string" || !["casual", "ranked", "coop", "arena"].includes(save.mode))) return "Invalid mode";
  if (save.vipStatus !== void 0 && (typeof save.vipStatus !== "string" || !["none", "bronze", "silver", "gold"].includes(save.vipStatus))) return "Invalid VIP status";
  for (const [key, max] of [["nickname", 64], ["avatar", 9e5], ["bladeSkin", 120], ["wallSkin", 120]]) {
    if (save[key] !== void 0 && (typeof save[key] !== "string" || save[key].length > max)) return `Invalid ${key}`;
  }
  return null;
}
function validProgressUpdates(value, idKey) {
  return Array.isArray(value) && value.length <= 100 && value.every((row) => row && typeof row === "object" && validId(row[idKey]) && (row.setProgress !== void 0 && row.progressDelta === void 0 && boundedInteger(row.setProgress, 1e8) || row.progressDelta !== void 0 && row.setProgress === void 0 && boundedInteger(row.progressDelta, 1e8)));
}

// server/routes/leaderboard.ts
var leaderboardRouter = Router();
function resolveMode(mode) {
  if (mode === "monthly") return monthlyLeaderboardMode();
  return mode || "ranked";
}
leaderboardRouter.get("/monthly-rank", async (req2, res) => {
  try {
    const userId = (await resolveRequestUser(req2))?.userId;
    const catalog = await loadQuestCatalog();
    const seasonMode = monthlyLeaderboardMode();
    const col = await getCollection("leaderboards");
    const entry = userId ? await col.findOne({ userId, mode: seasonMode }, { sort: { score: -1 } }) : null;
    const score = entry?.score || 0;
    const rank = rankFromScore(score, catalog.ranks);
    const sorted = [...catalog.ranks].sort((a, b) => a.minScore - b.minScore);
    const next = sorted.find((t) => t.minScore > rank.minScore) || null;
    res.json({
      success: true,
      season: seasonMode,
      score,
      rank,
      next
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
leaderboardRouter.get("/", async (req2, res) => {
  try {
    if (req2.query.mode !== void 0 && (typeof req2.query.mode !== "string" || !/^(casual|ranked|coop|arena|monthly|monthly-\d{4}-\d{2})$/.test(req2.query.mode))) return res.status(400).json({ success: false, error: "Invalid mode" });
    const mode = resolveMode(req2.query.mode || "ranked");
    const limit = Math.max(1, Math.min(parseInt(String(req2.query.limit)) || 50, 100));
    const userId = (await resolveRequestUser(req2))?.userId;
    const col = await getCollection("leaderboards");
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
leaderboardRouter.post("/", async (req2, res) => {
  try {
    const {
      nickname,
      avatar,
      hero,
      mode,
      score,
      wave,
      fruitsSliced,
      maxCombo
    } = req2.body;
    if (mode !== void 0 && !["casual", "ranked", "coop", "arena"].includes(mode)) return res.status(400).json({ success: false, error: "Invalid mode" });
    if (hero !== void 0 && !["jiju", "topfu", "lagen", "tripos", "ki"].includes(hero)) return res.status(400).json({ success: false, error: "Invalid hero" });
    if (wave !== void 0 && !boundedInteger(wave, 1e3, 1) || fruitsSliced !== void 0 && !boundedInteger(fruitsSliced, 1e5) || maxCombo !== void 0 && !boundedInteger(maxCombo, 5e3)) return res.status(400).json({ success: false, error: "Invalid match counters" });
    if (nickname !== void 0 && (typeof nickname !== "string" || nickname.length > 64) || avatar !== void 0 && (typeof avatar !== "string" || avatar.length > 9e5)) return res.status(400).json({ success: false, error: "Invalid profile fields" });
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
      return res.status(400).json({ success: false, error: "Invalid score submission payload" });
    }
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
    const user = await resolveRequestUser(req2);
    if (!user) {
      return res.status(401).json({ success: false, error: "Sign in to submit leaderboard scores" });
    }
    const userId = user.userId;
    const col = await getCollection("leaderboards");
    const playMode = mode || "casual";
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
    const catalog = playMode === "ranked" ? await loadQuestCatalog() : null;
    const monthlyScore = playMode === "ranked" ? (await col.findOne({ userId, mode: monthlyLeaderboardMode() }))?.score || score : score;
    res.json({
      success: true,
      isNewHigh,
      rank: higherCount + 1,
      score,
      monthlyRank: catalog ? rankFromScore(monthlyScore, catalog.ranks) : void 0
    });
  } catch (err) {
    console.error("Error submitting score:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/achievements.ts
import { Router as Router2 } from "express";
var achievementsRouter = Router2();
achievementsRouter.get("/", async (req2, res) => {
  try {
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to view achievements" });
    const userId = user.userId;
    const catalog = await loadQuestCatalog();
    const defs = catalog.achievements.filter((a) => a.enabled !== false);
    const col = await getCollection("achievements");
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
achievementsRouter.post("/progress", async (req2, res) => {
  try {
    const { updates } = req2.body;
    if (!validProgressUpdates(updates, "achievementId")) {
      return res.status(400).json({ success: false, error: "Invalid payload" });
    }
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to update achievements" });
    const userId = user.userId;
    const catalog = await loadQuestCatalog();
    const col = await getCollection("achievements");
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
achievementsRouter.post("/claim", async (req2, res) => {
  try {
    const { achievementId } = req2.body;
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to claim achievements" });
    const userId = user.userId;
    const catalog = await loadQuestCatalog();
    const def = catalog.achievements.find((a) => a.id === achievementId && a.enabled !== false);
    if (!def) {
      return res.status(400).json({ success: false, error: "Invalid achievementId" });
    }
    const col = await getCollection("achievements");
    const existing = await col.findOne({ userId, achievementId });
    if (!existing || !existing.unlocked) {
      return res.status(400).json({ success: false, error: "Achievement is not yet unlocked" });
    }
    if (existing.claimed) {
      return res.status(400).json({ success: false, error: "Reward already claimed" });
    }
    const claim = await col.updateOne({ _id: existing._id, claimed: { $ne: true }, unlocked: true }, { $set: { claimed: true } });
    if (claim.modifiedCount !== 1) return res.status(400).json({ success: false, error: "Reward already claimed" });
    res.json({
      success: true,
      achievementId,
      rewardCoins: def.rewardCoins,
      rewardSp: def.rewardSp,
      rewardBadge: def.rewardBadge
    });
  } catch (err) {
    console.error("Error claiming achievement reward:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/missions.ts
import { Router as Router3 } from "express";
var missionsRouter = Router3();
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
missionsRouter.get("/", async (req2, res) => {
  try {
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to view missions" });
    const userId = user.userId;
    const catalog = await loadQuestCatalog();
    const defs = catalog.missions.filter((m) => m.enabled !== false);
    const keys = [...new Set(defs.map((d) => periodKey(d.type)))];
    const col = await getCollection("missions");
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
missionsRouter.post("/progress", async (req2, res) => {
  try {
    const { updates } = req2.body;
    if (!validProgressUpdates(updates, "missionId")) {
      return res.status(400).json({ success: false, error: "Invalid payload" });
    }
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to update missions" });
    const userId = user.userId;
    const catalog = await loadQuestCatalog();
    const col = await getCollection("missions");
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
missionsRouter.post("/claim", async (req2, res) => {
  try {
    const { missionId } = req2.body;
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to claim missions" });
    const userId = user.userId;
    const catalog = await loadQuestCatalog();
    const def = catalog.missions.find((m) => m.id === missionId && m.enabled !== false);
    if (!def) {
      return res.status(400).json({ success: false, error: "Invalid missionId" });
    }
    const activeKey = periodKey(def.type);
    const col = await getCollection("missions");
    const existing = await col.findOne({ userId, missionId, dayKey: activeKey });
    if (!existing || !existing.completed) {
      return res.status(400).json({ success: false, error: "Mission is not completed yet" });
    }
    if (existing.claimed) {
      return res.status(400).json({ success: false, error: "Mission reward already claimed" });
    }
    const claim = await col.updateOne({ _id: existing._id, claimed: { $ne: true }, completed: true }, { $set: { claimed: true, updatedAt: /* @__PURE__ */ new Date() } });
    if (claim.modifiedCount !== 1) return res.status(400).json({ success: false, error: "Mission reward already claimed" });
    res.json({
      success: true,
      missionId,
      rewardCoins: def.rewardCoins,
      rewardSp: def.rewardSp,
      rewardBadge: def.rewardBadge
    });
  } catch (err) {
    console.error("Error claiming mission reward:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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
        missions: Array.isArray(cfg.missions) && cfg.missions.length ? cfg.missions : DEFAULT_MISSIONS,
        achievements: Array.isArray(cfg.achievements) && cfg.achievements.length ? cfg.achievements : DEFAULT_ACHIEVEMENTS,
        badges: Array.isArray(cfg.badges) && cfg.badges.length ? cfg.badges : DEFAULT_BADGES,
        ranks: Array.isArray(cfg.ranks) && cfg.ranks.length ? cfg.ranks : DEFAULT_RANK_TIERS,
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
      missions: Array.isArray(missions) ? missions : existing?.missions || DEFAULT_MISSIONS,
      achievements: Array.isArray(achievements) ? achievements : existing?.achievements || DEFAULT_ACHIEVEMENTS,
      badges: Array.isArray(badges) ? badges : existing?.badges || DEFAULT_BADGES,
      ranks: Array.isArray(ranks) ? ranks : existing?.ranks || DEFAULT_RANK_TIERS,
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
var dailyRouter = Router5();
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
function getDayKey2(date = /* @__PURE__ */ new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
dailyRouter.get("/", async (req2, res) => {
  try {
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to view daily rewards" });
    const userId = user.userId;
    const todayStr = getDayKey2();
    const col = await getCollection("daily_bonus");
    const existing = await col.findOne({ userId });
    const activeRewards = await getActiveDailyRewards();
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
dailyRouter.post("/claim", async (req2, res) => {
  try {
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to claim daily rewards" });
    const userId = user.userId;
    const todayStr = getDayKey2();
    const col = await getCollection("daily_bonus");
    const existing = await col.findOne({ userId });
    const activeRewards = await getActiveDailyRewards();
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
    await col.updateOne(
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
    res.json({
      success: true,
      streak: newStreak,
      reward
    });
  } catch (err) {
    if (err?.code === 11e3) return res.status(400).json({ success: false, error: "Daily bonus already claimed for today" });
    console.error("Error claiming daily bonus:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// server/routes/steam.ts
import { Router as Router7 } from "express";
import crypto3 from "crypto";

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
import crypto2 from "crypto";
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
    const userId = "user_" + crypto2.randomBytes(8).toString("hex");
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
              updatedAt: /* @__PURE__ */ new Date(),
              ...sessionUser.steamBonusGranted ? {} : { steamBonusGranted: true }
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
      const userId = "user_" + crypto3.randomBytes(8).toString("hex");
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
        steamBonusGranted: true,
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
var profileRouter = Router8();
profileRouter.get("/", async (req2, res) => {
  try {
    const user = await resolveRequestUser(req2);
    if (!user) return res.status(401).json({ success: false, error: "Sign in to view a cloud save" });
    const userId = user.userId;
    const col = await getCollection("cloud_saves");
    const doc = await col.findOne({ userId });
    const usersCol = await getCollection("users");
    const userDoc = await usersCol.findOne({ userId });
    res.json({
      success: true,
      saveData: doc?.saveData || null,
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
profileRouter.post("/sync", async (req2, res) => {
  try {
    const { saveData: incoming } = req2.body ?? {};
    const invalid = saveValidationError(incoming);
    if (invalid) return res.status(400).json({ success: false, error: invalid });
    const saveData = { ...incoming, saveRevision: incoming.saveRevision ?? 0 };
    if (!saveData) {
      return res.status(400).json({ success: false, error: "saveData is required" });
    }
    const MAX_REASONABLE_COINS = 1e6;
    const MAX_REASONABLE_SKILL_POINTS = 1e4;
    const MAX_REASONABLE_XP = 1e6;
    if (saveData.coins && saveData.coins > MAX_REASONABLE_COINS) {
      return res.status(400).json({ success: false, error: "Coins exceed reasonable maximum" });
    }
    if (saveData.skillPoints && saveData.skillPoints > MAX_REASONABLE_SKILL_POINTS) {
      return res.status(400).json({ success: false, error: "Skill points exceed reasonable maximum" });
    }
    if (saveData.xp) {
      for (const heroXp of Object.values(saveData.xp)) {
        if (typeof heroXp === "number" && heroXp > MAX_REASONABLE_XP) {
          return res.status(400).json({ success: false, error: "Hero XP exceeds reasonable maximum" });
        }
      }
    }
    const user = await resolveRequestUser(req2);
    if (!user) {
      return res.status(401).json({ success: false, error: "Sign in to sync a profile" });
    }
    const userId = user.userId;
    const col = await getCollection("cloud_saves");
    await col.updateOne(
      { userId, $or: [{ "saveData.saveRevision": { $lt: saveData.saveRevision } }, { "saveData.saveRevision": { $exists: false } }] },
      {
        $set: {
          saveData,
          updatedAt: /* @__PURE__ */ new Date()
        }
      },
      { upsert: true }
    );
    const usersCol = await getCollection("users");
    await usersCol.updateOne(
      { userId },
      {
        $set: {
          nickname: saveData.nickname || user.nickname || "Slicer",
          avatar: saveData.avatar || user.avatar || "",
          updatedAt: /* @__PURE__ */ new Date()
        },
        $setOnInsert: {
          createdAt: /* @__PURE__ */ new Date()
        }
      },
      { upsert: true }
    );
    res.json({ success: true, timestamp: /* @__PURE__ */ new Date() });
  } catch (err) {
    if (err?.code === 11e3) return res.status(409).json({ success: false, error: "Save conflict: a newer or equal revision already exists. Reload to reconcile." });
    console.error("Error syncing cloud save:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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
    const map = new Map(docs.map((d) => [d.badgeId, d]));
    const badges = defs.map((def) => {
      const doc = map.get(def.id);
      const maxProgress = def.requirement?.goal || 1;
      const progress = Math.min(doc?.progress || 0, maxProgress);
      const unlocked = !!doc?.unlocked || progress >= maxProgress;
      return {
        id: def.id,
        title: def.title,
        desc: def.desc,
        icon: def.icon,
        rarity: def.rarity,
        progress,
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
