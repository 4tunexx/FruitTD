import { HEROES, heroXpForLevel, heroXpToLevel, MAX_HERO_LEVEL, type HeroId } from './heroes';
import { SKILLS, emptySkills, type SkillId, type SkillMap } from './skills';
import { getTowerProgression, syncTowerProgression } from './towerProgression';
import { HERO_PERKS, type HeroPerkId } from './heroProgression';
import { heroesUnlockedByJijuLevel } from './progression/heroMilestones';
import { purchaseHeroAtomic } from './progression/heroStatus';

const KEY = 'fruit-td-save-v1';
const OLD_PERK_KEY = 'fruit-td-hero-perks-v1';
export type GameMode = 'casual' | 'ranked' | 'coop' | 'arena';
export type HeroPerkRanks = Record<HeroId, Partial<Record<HeroPerkId, number>>>;

export interface SaveData {
  hero: HeroId;
  xp: Record<HeroId, number>;
  ownedHeroes: HeroId[];
  towerXp: number;
  towerLifetimeXp: number;
  highScore: number;
  rankedScore: number;
  bestWave: number;
  /** Highest combo ever reached, for the profile screen. */
  bestCombo: number;
  games: number;
  coins: number;
  gems: number; // P1-2: Premium currency
  nickname: string;
  avatar: string;
  skillPoints: number;
  skills: SkillMap;
  ownedSkins: string[];
  bladeSkin: string;
  wallSkin: string;
  mode: GameMode;
  heroPerkRanks?: HeroPerkRanks;
  vipStatus?: 'none' | 'bronze' | 'silver' | 'gold'; // P1-2: VIP tier
  /**
   * Monotonic write counter. Spendable balances (coins, gems, skill points)
   * merge by revision — last writer wins — instead of by max, which would let
   * a player spend on one device and recover the balance from another (§9).
   */
  saveRevision?: number;
  /** Wall-clock of the last local write, used to break revision ties. */
  savedAt?: number;
}

function emptyXp(): Record<HeroId, number> { return { jiju:0, topfu:0, lagen:0, tripos:0, ki:0 }; }
function emptyPerkRanks(): HeroPerkRanks { return { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} }; }
function safeInt(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const bounded = Math.max(min, Math.min(max, Math.floor(n)));
  // Additional validation: reject if original value was absurdly large
  if (typeof value === 'number' && value > 1e15) return fallback;
  return bounded;
}
function uniqueStrings(values: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(values)) return [...fallback];
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

export function defaultAvatar(name: string): string {
  const letter = (name[0] || 'S').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1d4ed8"/><text x="32" y="42" text-anchor="middle" font-size="28" font-family="Arial" fill="white" font-weight="700">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function defaultSave(): SaveData {
  return {
    hero:'jiju', xp:emptyXp(), ownedHeroes:['jiju'], towerXp:0, towerLifetimeXp:0,
    highScore:0, rankedScore:0, bestWave:1, bestCombo:0, games:0, coins:0, gems:0, nickname:'Slicer', avatar:defaultAvatar('Slicer'),
    skillPoints:0, skills:emptySkills(), ownedSkins:['blade-default','wall-brick'], bladeSkin:'blade-default', wallSkin:'wall-brick', mode:'casual',
    heroPerkRanks:emptyPerkRanks(), vipStatus:'none',
    saveRevision:0, savedAt:0,
  };
}

/** Keep old/local/cloud saves valid even when a field is missing, duplicated or malformed. */
export function sanitiseSave(data: SaveData): SaveData {
  const base = defaultSave();

  // Reasonable maximums for economy values (PR7 security hardening)
  const MAX_COINS = 1_000_000;
  const MAX_SKILL_POINTS = 10_000;
  const MAX_HERO_XP = 1_000_000;
  const MAX_GEMS = 1_000_000;

  for (const hero of HEROES) data.xp[hero.id] = safeInt(data.xp[hero.id], 0, 0, Math.min(MAX_HERO_XP, heroXpForLevel(MAX_HERO_LEVEL)));
  data.ownedHeroes = [...new Set(data.ownedHeroes.filter((id) => HEROES.some((h) => h.id === id)))];
  data.ownedSkins = uniqueStrings(data.ownedSkins, base.ownedSkins);
  for (const skill of SKILLS) data.skills[skill.id] = safeInt(data.skills[skill.id], 0, 0, skill.max);
  data.towerXp = safeInt(data.towerXp, 0);
  data.towerLifetimeXp = safeInt(data.towerLifetimeXp, 0);
  data.highScore = safeInt(data.highScore, 0, 0, 100_000_000);
  data.rankedScore = safeInt(data.rankedScore, 0, 0, 100_000_000);
  data.bestWave = safeInt(data.bestWave, 1, 1, 9999);
  data.bestCombo = safeInt(data.bestCombo, 0, 0, 100000);
  data.games = safeInt(data.games, 0, 0, 1_000_000);
  data.coins = safeInt(data.coins, 0, 0, MAX_COINS);
  data.gems = safeInt(data.gems ?? 0, 0, 0, MAX_GEMS);
  data.skillPoints = safeInt(data.skillPoints, 0, 0, MAX_SKILL_POINTS);
  data.nickname = typeof data.nickname === 'string' ? data.nickname.trim().slice(0, 16) || 'Slicer' : 'Slicer';
  data.avatar = typeof data.avatar === 'string' && data.avatar ? data.avatar : defaultAvatar(data.nickname);
  if (!HEROES.some((h) => h.id === data.hero)) data.hero = 'jiju';
  if (!['casual','ranked','coop','arena'].includes(data.mode)) data.mode = 'casual';
  if (!data.ownedSkins.includes('blade-default')) data.ownedSkins.push('blade-default');
  if (!data.ownedSkins.includes('wall-brick')) data.ownedSkins.push('wall-brick');
  // Unequipped slots use '' or 'none' — do not force starters back on.
  data.bladeSkin = typeof data.bladeSkin === 'string' ? data.bladeSkin : '';
  data.wallSkin = typeof data.wallSkin === 'string' ? data.wallSkin : '';
  const unequipped = (id: string) => !id || id === 'none';
  if (!unequipped(data.bladeSkin) && !data.ownedSkins.includes(data.bladeSkin)) data.bladeSkin = '';
  if (!unequipped(data.wallSkin) && !data.ownedSkins.includes(data.wallSkin)) data.wallSkin = '';
  if (data.bladeSkin === 'none') data.bladeSkin = '';
  if (data.wallSkin === 'none') data.wallSkin = '';
  if (!data.vipStatus || !['none','bronze','silver','gold'].includes(data.vipStatus)) data.vipStatus = 'none';
  data.saveRevision = safeInt(data.saveRevision ?? 0, 0, 0, Number.MAX_SAFE_INTEGER);
  data.savedAt = safeInt(data.savedAt ?? 0, 0, 0, Number.MAX_SAFE_INTEGER);
  
  if (!data.heroPerkRanks || typeof data.heroPerkRanks !== 'object') data.heroPerkRanks = emptyPerkRanks();
  for (const hero of HEROES) {
    if (!data.heroPerkRanks[hero.id]) data.heroPerkRanks[hero.id] = {};
    for (const perk of HERO_PERKS) {
      const rank = Number(data.heroPerkRanks[hero.id][perk.id]) || 0;
      data.heroPerkRanks[hero.id][perk.id] = Math.max(0, Math.min(perk.maxRank, Math.floor(rank)));
    }
  }
  return data;
}

/**
 * Unlocks are driven by Master Jiju's level via the milestone table
 * (single source of truth). Purchase-only heroes NEVER auto-unlock.
 */
export function syncHeroUnlocks(data: SaveData): SaveData {
  sanitiseSave(data);
  const jijuLevel = heroXpToLevel(data.xp.jiju ?? 0);
  const owned = new Set<HeroId>(data.ownedHeroes?.length ? data.ownedHeroes : ['jiju']);
  owned.add('jiju');
  for (const heroId of heroesUnlockedByJijuLevel(jijuLevel)) owned.add(heroId);
  // A purchased hero stays owned; an unowned purchase-only hero never unlocks for free.
  data.ownedHeroes = HEROES.map((h) => h.id).filter((id) => owned.has(id));
  if (!data.ownedHeroes.includes(data.hero)) data.hero = 'jiju';
  return data;
}

export function isHeroOwned(data: SaveData, id: HeroId): boolean { return syncHeroUnlocks(data).ownedHeroes.includes(id); }
export function heroUnlockRequirement(id: HeroId): number { return HEROES.find((h) => h.id === id)?.unlockLevel ?? 1; }
export function heroPurchaseCost(id: HeroId): number | null { return HEROES.find((h) => h.id === id)?.purchaseCost ?? null; }

export function canPurchaseHero(data: SaveData, id: HeroId): boolean {
  const def = HEROES.find((h) => h.id === id);
  return Boolean(def?.purchaseOnly && !isHeroOwned(data,id) && def.purchaseCost && data.coins >= def.purchaseCost);
}

/** Atomic hero purchase + persist. Shares one implementation with the UI. */
export function purchaseHero(data: SaveData, id: HeroId): boolean {
  const result = purchaseHeroAtomic(data, id);
  if (!result.ok) return false;
  writeSave(data);
  return true;
}

function migrateOldPerks(): HeroPerkRanks | null {
  try {
    const raw = localStorage.getItem(OLD_PERK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HeroPerkRanks>;
    const out = emptyPerkRanks();
    for (const hero of Object.keys(out) as HeroId[]) {
      for (const perk of HERO_PERKS) {
        const rank = Number(parsed[hero]?.[perk.id]) || 0;
        out[hero][perk.id] = Math.max(0, Math.min(perk.maxRank, Math.floor(rank)));
      }
    }
    localStorage.removeItem(OLD_PERK_KEY);
    return out;
  } catch { return null; }
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>; const base = defaultSave();
    const hero = HEROES.some((h) => h.id === parsed.hero) ? parsed.hero as HeroId : 'jiju';
    const towerLocal = getTowerProgression();
    const towerXp = Math.max(towerLocal.xp, safeInt(parsed.towerXp));
    const towerLifetimeXp = Math.max(towerLocal.lifetimeXp, safeInt(parsed.towerLifetimeXp));
    syncTowerProgression(towerXp, towerLifetimeXp);
    
    let heroPerkRanks = parsed.heroPerkRanks;
    if (!heroPerkRanks || typeof heroPerkRanks !== 'object') {
      const migrated = migrateOldPerks();
      heroPerkRanks = migrated || emptyPerkRanks();
    }
    
    const data: SaveData = {
      ...base, ...parsed, hero,
      xp:{...base.xp,...(parsed.xp ?? {})},
      ownedHeroes:uniqueStrings(parsed.ownedHeroes, ['jiju']).filter((id): id is HeroId => HEROES.some((h)=>h.id===id)),
      towerXp, towerLifetimeXp,
      skills:{...base.skills,...(parsed.skills ?? {})},
      ownedSkins:uniqueStrings(parsed.ownedSkins, base.ownedSkins),
      avatar:parsed.avatar || defaultAvatar(parsed.nickname || 'Slicer'), nickname:parsed.nickname || 'Slicer',
      heroPerkRanks,
    };
    return syncHeroUnlocks(data);
  } catch { return defaultSave(); }
}

/**
 * Incremented on every write. Hot paths (per-frame perk lookups) cache derived
 * values against this instead of re-parsing the whole save each call.
 */
let saveEpoch = 0;
export function getSaveEpoch(): number { return saveEpoch; }

export function writeSave(data: SaveData): void {
  saveEpoch++;
  try {
    syncHeroUnlocks(data);
    const tower = getTowerProgression();
    data.towerXp = tower.xp;
    data.towerLifetimeXp = tower.lifetimeXp;
    data.saveRevision = Math.max(0, Number(data.saveRevision) || 0) + 1;
    data.savedAt = Date.now();
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* best effort */ }
}

export function mergeSaves(local: SaveData, remote: Partial<SaveData> | null | undefined): SaveData {
  if (!remote) return syncHeroUnlocks(local);

  // Reasonable maximums for merge validation (PR7)
  const MAX_COINS = 1_000_000;
  const MAX_SKILL_POINTS = 10_000;
  const MAX_HERO_XP = 1_000_000;
  const MAX_GEMS = 1_000_000;

  const xp = emptyXp();
  for (const hero of HEROES) {
    const localXp = local.xp[hero.id] ?? 0;
    const remoteXp = remote.xp?.[hero.id] ?? 0;
    xp[hero.id] = Math.min(Math.max(localXp, remoteXp), MAX_HERO_XP);
  }
  const skills = emptySkills();
  for (const skill of SKILLS) {
    skills[skill.id] = Math.min(Math.max(local.skills[skill.id] ?? 0, remote.skills?.[skill.id] ?? 0), skill.max);
  }
  const owned = new Set([...(local.ownedSkins || []), ...(remote.ownedSkins || [])]);
  const heroes = new Set<HeroId>([...(local.ownedHeroes || ['jiju']), ...(remote.ownedHeroes || [])]);
  const towerXp = Math.max(local.towerXp ?? 0, remote.towerXp ?? 0);
  const towerLifetimeXp = Math.max(local.towerLifetimeXp ?? 0, remote.towerLifetimeXp ?? 0);
  syncTowerProgression(towerXp, towerLifetimeXp);
  
  const heroPerkRanks = emptyPerkRanks();
  for (const hero of HEROES) {
    for (const perk of HERO_PERKS) {
      const localRank = Number(local.heroPerkRanks?.[hero.id]?.[perk.id]) || 0;
      const remoteRank = Number(remote.heroPerkRanks?.[hero.id]?.[perk.id]) || 0;
      heroPerkRanks[hero.id][perk.id] = Math.max(localRank, remoteRank);
    }
  }

  /**
   * Spendable balances are AUTHORITATIVE, not monotonic: max-merging them would
   * refund anything the player spent on another device. Whichever save was
   * written most recently wins (§9).
   */
  const localRev = Math.max(0, Number(local.saveRevision) || 0);
  const remoteRev = Math.max(0, Number(remote.saveRevision) || 0);
  const localTime = Math.max(0, Number(local.savedAt) || 0);
  const remoteTime = Math.max(0, Number(remote.savedAt) || 0);
  const remoteIsNewer =
    remoteRev > localRev || (remoteRev === localRev && remoteTime > localTime);
  // With no revision data on either side (legacy saves) fall back to the
  // safer-for-the-player maximum, since we cannot tell which is newer.
  const legacy = localRev === 0 && remoteRev === 0 && localTime === 0 && remoteTime === 0;
  const authoritative = (localValue: number, remoteValue: number, cap: number): number => {
    const chosen = legacy
      ? Math.max(localValue, remoteValue)
      : remoteIsNewer
        ? remoteValue
        : localValue;
    return Math.min(Math.max(0, chosen), cap);
  };

  const mergedCoins = authoritative(local.coins ?? 0, remote.coins ?? 0, MAX_COINS);
  const mergedSkillPoints = authoritative(local.skillPoints ?? 0, remote.skillPoints ?? 0, MAX_SKILL_POINTS);
  const mergedGems = authoritative(local.gems ?? 0, remote.gems ?? 0, MAX_GEMS);
  
  return syncHeroUnlocks({
    ...local,
    ...remote,
    xp,
    skills,
    towerXp,
    towerLifetimeXp,
    heroPerkRanks,
    ownedHeroes:[...heroes],
    ownedSkins:owned.size ? [...owned] : local.ownedSkins,
    highScore:Math.max(local.highScore,remote.highScore??0),
    rankedScore:Math.max(local.rankedScore,remote.rankedScore??0),
    bestWave:Math.max(local.bestWave,remote.bestWave??0),
    bestCombo:Math.max(local.bestCombo??0,remote.bestCombo??0),
    games:Math.max(local.games,remote.games??0),
    coins: mergedCoins,
    gems: mergedGems,
    skillPoints: mergedSkillPoints,
    hero:HEROES.some((h)=>h.id===remote.hero) ? remote.hero as HeroId : local.hero,
    nickname:remote.nickname||local.nickname,
    avatar:remote.avatar||local.avatar,
    bladeSkin:remote.bladeSkin||local.bladeSkin,
    wallSkin:remote.wallSkin||local.wallSkin,
    mode:remote.mode||local.mode,
    vipStatus: remote.vipStatus || local.vipStatus,
    saveRevision: Math.max(localRev, remoteRev),
    savedAt: Math.max(localTime, remoteTime),
  });
}

export function heroLevelFromSave(data: SaveData, id: HeroId): number { return heroXpToLevel(data.xp[id] ?? 0); }
export function canBuySkill(data: SaveData, id: SkillId): boolean { const def=SKILLS.find((s)=>s.id===id); return data.skillPoints>0 && (data.skills[id]??0)<(def?.max??3); }

export const WALL_SKINS = [
  { id:'wall-brick', name:'Brick wall', kind:'wall' as const, cost:0, sellValue:0, color:0xa33d32, blurb:'Default clay bricks.' },
  { id:'wall-stone', name:'Stone wall', kind:'wall' as const, cost:200, sellValue:70, color:0x8b8f99, blurb:'Cool grey stone.' },
  { id:'wall-night', name:'Night wall', kind:'wall' as const, cost:280, sellValue:95, color:0x2b3350, blurb:'Dark midnight fort.' },
];
