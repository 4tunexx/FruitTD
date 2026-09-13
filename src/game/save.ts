import { HEROES, heroXpToLevel, type HeroId } from './heroes';
import { SKILLS, emptySkills, type SkillId, type SkillMap } from './skills';
import { getTowerProgression, syncTowerProgression } from './towerProgression';

const KEY = 'fruit-td-save-v1';
export type GameMode = 'casual' | 'ranked' | 'coop' | 'arena';

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
}

function emptyXp(): Record<HeroId, number> { return { jiju:0, topfu:0, lagen:0, tripos:0, ki:0 }; }

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
  };
}

/** Unlocks are driven by the first hero's level. Premium heroes never auto-unlock. */
export function syncHeroUnlocks(data: SaveData): SaveData {
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

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY); if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>; const base = defaultSave();
    const hero = HEROES.some((h) => h.id === parsed.hero) ? parsed.hero as HeroId : 'jiju';
    const towerLocal = getTowerProgression();
    const towerXp = Math.max(towerLocal.xp, Number(parsed.towerXp) || 0);
    const towerLifetimeXp = Math.max(towerLocal.lifetimeXp, Number(parsed.towerLifetimeXp) || 0);
    syncTowerProgression(towerXp, towerLifetimeXp);
    const data: SaveData = {
      ...base, ...parsed, hero,
      xp:{...base.xp,...(parsed.xp ?? {})},
      ownedHeroes:(parsed.ownedHeroes ?? ['jiju']).filter((id): id is HeroId => HEROES.some((h)=>h.id===id)),
      towerXp, towerLifetimeXp,
      skills:{...base.skills,...(parsed.skills ?? {})},
      ownedSkins:parsed.ownedSkins?.length ? parsed.ownedSkins : base.ownedSkins,
      avatar:parsed.avatar || defaultAvatar(parsed.nickname || 'Slicer'), nickname:parsed.nickname || 'Slicer',
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
  return syncHeroUnlocks({ ...local, ...remote, xp, skills, towerXp, towerLifetimeXp,
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
