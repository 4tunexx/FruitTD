import { HEROES, heroXpForLevel, heroXpToLevel, MAX_HERO_LEVEL, type HeroId } from './heroes';
import { SKILLS, emptySkills, type SkillId, type SkillMap } from './skills';
import { getTowerProgression, syncTowerProgression } from './towerProgression';
import { HERO_PERKS, type HeroPerkId } from './heroProgression';

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
  games: number;
  coins: number;
  nickname: string;
  avatar: string;
  skillPoints: number;
  skills: SkillMap;
  ownedSkins: string[];
  bladeSkin: string;
  wallSkin: string;
  mode: GameMode;
  heroPerkRanks?: HeroPerkRanks;
}

function emptyXp(): Record<HeroId, number> { return { jiju:0, topfu:0, lagen:0, tripos:0, ki:0 }; }
function emptyPerkRanks(): HeroPerkRanks { return { jiju:{}, topfu:{}, lagen:{}, tripos:{}, ki:{} }; }
function safeInt(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.floor(n))) : fallback;
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
    highScore:0, rankedScore:0, bestWave:1, games:0, coins:0, nickname:'Slicer', avatar:defaultAvatar('Slicer'),
    skillPoints:0, skills:emptySkills(), ownedSkins:['blade-default','wall-brick'], bladeSkin:'blade-default', wallSkin:'wall-brick', mode:'casual',
    heroPerkRanks:emptyPerkRanks(),
  };
}

/** Keep old/local/cloud saves valid even when a field is missing, duplicated or malformed. */
export function sanitiseSave(data: SaveData): SaveData {
  const base = defaultSave();
  for (const hero of HEROES) data.xp[hero.id] = safeInt(data.xp[hero.id], 0, 0, heroXpForLevel(MAX_HERO_LEVEL));
  data.ownedHeroes = [...new Set(data.ownedHeroes.filter((id) => HEROES.some((h) => h.id === id)))];
  data.ownedSkins = uniqueStrings(data.ownedSkins, base.ownedSkins);
  for (const skill of SKILLS) data.skills[skill.id] = safeInt(data.skills[skill.id], 0, 0, skill.max);
  data.towerXp = safeInt(data.towerXp, 0);
  data.towerLifetimeXp = safeInt(data.towerLifetimeXp, 0);
  data.highScore = safeInt(data.highScore, 0, 0, 100_000_000);
  data.rankedScore = safeInt(data.rankedScore, 0, 0, 100_000_000);
  data.bestWave = safeInt(data.bestWave, 1, 1, 9999);
  data.games = safeInt(data.games, 0, 0, 1_000_000);
  data.coins = safeInt(data.coins, 0, 0, 10_000_000);
  data.skillPoints = safeInt(data.skillPoints, 0, 0, 1000);
  data.nickname = typeof data.nickname === 'string' ? data.nickname.trim().slice(0, 16) || 'Slicer' : 'Slicer';
  data.avatar = typeof data.avatar === 'string' && data.avatar ? data.avatar : defaultAvatar(data.nickname);
  if (!HEROES.some((h) => h.id === data.hero)) data.hero = 'jiju';
  if (!['casual','ranked','coop','arena'].includes(data.mode)) data.mode = 'casual';
  if (!data.ownedSkins.includes('blade-default')) data.ownedSkins.push('blade-default');
  if (!data.ownedSkins.includes('wall-brick')) data.ownedSkins.push('wall-brick');
  if (!data.ownedSkins.includes(data.bladeSkin)) data.bladeSkin = 'blade-default';
  if (!data.ownedSkins.includes(data.wallSkin)) data.wallSkin = 'wall-brick';
  
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

/** Unlocks are driven by the first hero's level. Premium heroes never auto-unlock. */
export function syncHeroUnlocks(data: SaveData): SaveData {
  sanitiseSave(data);
  const firstHeroLevel = heroXpToLevel(data.xp.jiju ?? 0);
  const owned = new Set<HeroId>(data.ownedHeroes?.length ? data.ownedHeroes : ['jiju']);
  owned.add('jiju');
  for (const hero of HEROES) if (!hero.purchaseOnly && firstHeroLevel >= hero.unlockLevel) owned.add(hero.id);
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

export function purchaseHero(data: SaveData, id: HeroId): boolean {
  const def = HEROES.find((h) => h.id === id);
  if (!def?.purchaseOnly || !def.purchaseCost || isHeroOwned(data,id) || data.coins < def.purchaseCost) return false;
  data.coins -= def.purchaseCost;
  data.ownedHeroes = [...new Set([...data.ownedHeroes, id])];
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

export function writeSave(data: SaveData): void {
  try {
    syncHeroUnlocks(data);
    const tower = getTowerProgression();
    data.towerXp = tower.xp;
    data.towerLifetimeXp = tower.lifetimeXp;
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* best effort */ }
}

export function mergeSaves(local: SaveData, remote: Partial<SaveData> | null | undefined): SaveData {
  if (!remote) return syncHeroUnlocks(local);
  const xp = emptyXp(); for (const hero of HEROES) xp[hero.id] = Math.max(local.xp[hero.id] ?? 0, remote.xp?.[hero.id] ?? 0);
  const skills = emptySkills(); for (const skill of SKILLS) skills[skill.id] = Math.max(local.skills[skill.id] ?? 0, remote.skills?.[skill.id] ?? 0);
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
  
  return syncHeroUnlocks({ ...local, ...remote, xp, skills, towerXp, towerLifetimeXp, heroPerkRanks,
    ownedHeroes:[...heroes], ownedSkins:owned.size ? [...owned] : local.ownedSkins,
    highScore:Math.max(local.highScore,remote.highScore??0), rankedScore:Math.max(local.rankedScore,remote.rankedScore??0), bestWave:Math.max(local.bestWave,remote.bestWave??0),
    games:Math.max(local.games,remote.games??0), coins:Math.max(local.coins,remote.coins??0), skillPoints:Math.max(local.skillPoints,remote.skillPoints??0),
    hero:HEROES.some((h)=>h.id===remote.hero) ? remote.hero as HeroId : local.hero, nickname:remote.nickname||local.nickname, avatar:remote.avatar||local.avatar,
    bladeSkin:remote.bladeSkin||local.bladeSkin, wallSkin:remote.wallSkin||local.wallSkin, mode:remote.mode||local.mode });
}

export function heroLevelFromSave(data: SaveData, id: HeroId): number { return heroXpToLevel(data.xp[id] ?? 0); }
export function canBuySkill(data: SaveData, id: SkillId): boolean { const def=SKILLS.find((s)=>s.id===id); return data.skillPoints>0 && (data.skills[id]??0)<(def?.max??3); }

export const WALL_SKINS = [
  { id:'wall-brick', name:'Brick wall', kind:'wall' as const, cost:0, sellValue:0, color:0xa33d32, blurb:'Default clay bricks.' },
  { id:'wall-stone', name:'Stone wall', kind:'wall' as const, cost:200, sellValue:70, color:0x8b8f99, blurb:'Cool grey stone.' },
  { id:'wall-night', name:'Night wall', kind:'wall' as const, cost:280, sellValue:95, color:0x2b3350, blurb:'Dark midnight fort.' },
];
