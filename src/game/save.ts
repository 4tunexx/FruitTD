import { HEROES, heroXpToLevel, type HeroId } from './heroes';
import { SKILLS, emptySkills, type SkillId, type SkillMap } from './skills';

const KEY = 'fruit-td-save-v1';

export type GameMode = 'casual' | 'ranked' | 'coop' | 'arena';

export interface SaveData {
  hero: HeroId;
  xp: Record<HeroId, number>;
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

function emptyXp(): Record<HeroId, number> {
  return { jiju: 0, topfu: 0, lagen: 0, tripos: 0, ki: 0 };
}

export function defaultAvatar(name: string): string {
  const letter = (name[0] || 'S').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1d4ed8"/><text x="32" y="42" text-anchor="middle" font-size="28" font-family="Arial" fill="white" font-weight="700">${letter}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function defaultSave(): SaveData {
  return {
    hero: 'jiju',
    xp: emptyXp(),
    highScore: 0,
    rankedScore: 0,
    bestWave: 1,
    games: 0,
    coins: 0,
    nickname: 'Slicer',
    avatar: defaultAvatar('Slicer'),
    skillPoints: 0,
    skills: emptySkills(),
    ownedSkins: ['blade-default', 'wall-brick'],
    bladeSkin: 'blade-default',
    wallSkin: 'wall-brick',
    mode: 'casual',
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = defaultSave();
    const hero = HEROES.some((h) => h.id === parsed.hero) ? (parsed.hero as HeroId) : 'jiju';
    return {
      ...base,
      ...parsed,
      hero,
      xp: { ...base.xp, ...(parsed.xp ?? {}) },
      skills: { ...base.skills, ...(parsed.skills ?? {}) },
      ownedSkins: parsed.ownedSkins?.length ? parsed.ownedSkins : base.ownedSkins,
      avatar: parsed.avatar || defaultAvatar(parsed.nickname || 'Slicer'),
      nickname: parsed.nickname || 'Slicer',
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* local only for now — Steam / Mongo later */
  }
}

export function heroLevelFromSave(data: SaveData, id: HeroId): number {
  return heroXpToLevel(data.xp[id] ?? 0);
}

export function canBuySkill(data: SaveData, id: SkillId): boolean {
  const def = SKILLS.find((s) => s.id === id);
  return data.skillPoints > 0 && (data.skills[id] ?? 0) < (def?.max ?? 3);
}

export const SHOP_SKINS = [
  { id: 'blade-default', name: 'Steel blade', kind: 'blade', cost: 0, color: 0x1d4ed8 },
  { id: 'blade-gold', name: 'Gold blade', kind: 'blade', cost: 180, color: 0xf4c430 },
  { id: 'blade-ink', name: 'Ink blade', kind: 'blade', cost: 240, color: 0x111827 },
  { id: 'blade-cherry', name: 'Cherry blade', kind: 'blade', cost: 320, color: 0xf472b6 },
  { id: 'wall-brick', name: 'Brick wall', kind: 'wall', cost: 0, color: 0xa33d32 },
  { id: 'wall-stone', name: 'Stone wall', kind: 'wall', cost: 200, color: 0x8b8f99 },
  { id: 'wall-night', name: 'Night wall', kind: 'wall', cost: 280, color: 0x2b3350 },
] as const;
