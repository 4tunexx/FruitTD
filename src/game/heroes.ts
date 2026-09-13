import './phase1Runtime';

export type HeroId = 'jiju' | 'topfu' | 'lagen' | 'tripos' | 'ki';
export type PointerKind = 'mouse' | 'touch';

export interface HeroDef {
  id: HeroId; name: string; title: string; color: number; trail: number; blurb: string;
  mouse: string; touch: string; damage: number; radius: number; shake: number;
  unlockLevel: number; purchaseOnly?: boolean; purchaseCost?: number;
}

export const HEROES: HeroDef[] = [
  { id:'jiju', name:'Master Jiju', title:'Clean blade', color:0x2f6fed, trail:0x1d4ed8, blurb:'Classic wide cuts. Combos stack if you keep slicing.', mouse:'Precise flicks. Combo builds fast.', touch:'Wider finger slash. Easier to clip packs.', damage:18, radius:0.16, shake:0.55, unlockLevel:1 },
  { id:'topfu', name:'Topfu', title:'Soft pressure', color:0xf4c36a, trail:0xe8b84a, blurb:'Shorter reach, but fruit go brittle and slow.', mouse:'Short snap cuts. Stacks brittle.', touch:'Fat squash pad. Bigger slow zone.', damage:13, radius:0.1, shake:0.35, unlockLevel:10 },
  { id:'lagen', name:'Lagen', title:'Long reach', color:0x3aa35a, trail:0x22c55e, blurb:'Lance slash. The swipe keeps going past your cursor.', mouse:'Fast flick = extra spear length.', touch:'Stable long line, a bit less extra reach.', damage:16, radius:0.12, shake:0.45, unlockLevel:25 },
  { id:'tripos', name:'Tripos', title:'Triple path', color:0xc43b8a, trail:0xe879c0, blurb:'One swipe becomes three parallel cuts.', mouse:'Tight triple lines.', touch:'Wider triple spread.', damage:11, radius:0.1, shake:0.4, unlockLevel:50, purchaseOnly:true, purchaseCost:1800 },
  { id:'ki', name:'Master Ki', title:'Charged spirit', color:0x7c3aed, trail:0xa78bfa, blurb:'Hold to charge. Tap empty grass for a Ki pulse.', mouse:'Hold, then flick for a heavy cut.', touch:'Tap to pulse. Swipe to slash.', damage:15, radius:0.14, shake:0.7, unlockLevel:75, purchaseOnly:true, purchaseCost:3000 },
];

export const MAX_HERO_LEVEL = 100;

export function heroDef(id: HeroId): HeroDef { return HEROES.find((h) => h.id === id) ?? HEROES[0]; }

export function heroXpForLevel(level: number): number {
  const lv = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.floor(level)));
  return lv === 1 ? 0 : Math.floor(35 * Math.pow(lv - 1, 1.58) + 20 * (lv - 1));
}

export function heroXpToLevel(xp: number): number {
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

export function xpForNext(level: number): number | null { return level >= MAX_HERO_LEVEL ? null : heroXpForLevel(level + 1); }

export function heroXpProgress(xp: number): number {
  const level = heroXpToLevel(xp);
  if (level >= MAX_HERO_LEVEL) return 1;
  const current = heroXpForLevel(level);
  const next = heroXpForLevel(level + 1);
  return Math.max(0, Math.min(1, (Math.max(0, xp) - current) / Math.max(1, next - current)));
}

export function heroUnlockLevel(id: HeroId): number { return heroDef(id).unlockLevel; }
export function heroRequiresPurchase(id: HeroId): boolean { return Boolean(heroDef(id).purchaseOnly); }

export function heroStatMultiplier(level: number): number {
  const lv = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.floor(level)));
  return 1 + (lv - 1) * 0.0125 + Math.floor(lv / 10) * 0.02;
}

/**
 * Combat always uses the latest persisted XP when available. This prevents the
 * old in-match level display from getting stuck at Lv 5 while the real saved
 * hero progression continues toward Lv 100.
 */
export function heroEffectiveLevel(id: HeroId, fallbackLevel: number): number {
  try {
    const raw = localStorage.getItem('fruit-td-save-v1');
    if (!raw) return fallbackLevel;
    const parsed = JSON.parse(raw) as { xp?: Partial<Record<HeroId, number>> };
    const xp = Number(parsed.xp?.[id]);
    return Number.isFinite(xp) && xp >= 0 ? heroXpToLevel(xp) : fallbackLevel;
  } catch {
    return fallbackLevel;
  }
}

export function heroSlashDamage(id: HeroId, level: number, combo: number, charge: number, pointer: PointerKind): number {
  const hero = heroDef(id);
  const effectiveLevel = heroEffectiveLevel(id, level);
  let dmg = (hero.damage + Math.max(0, effectiveLevel - 1) * 0.55) * heroStatMultiplier(effectiveLevel);
  if (id === 'jiju') dmg *= 1 + Math.min(8, combo) * 0.07;
  if (id === 'topfu' && pointer === 'touch') dmg *= 0.92;
  if (id === 'ki') dmg *= 1 + Math.min(1.4, charge) * 0.85;
  return Math.max(1, Math.round(dmg));
}

export function heroHitRadius(id: HeroId, pointer: PointerKind): number {
  const hero = heroDef(id);
  let r = hero.radius;
  if (pointer === 'touch') r += id === 'topfu' ? 0.28 : 0.14;
  if (id === 'lagen') r += 0.06;
  return r;
}

export const HERO_MILESTONES = [
  { level:5, reward:'New blade effect slot' }, { level:10, reward:'Hero perk I + Topfu unlock' },
  { level:20, reward:'New hero cosmetic slot' }, { level:25, reward:'Lagen unlock' },
  { level:30, reward:'Hero perk II' }, { level:40, reward:'New hero cosmetic slot' },
  { level:50, reward:'Hero perk III' }, { level:60, reward:'New hero cosmetic slot' },
  { level:75, reward:'Hero perk IV' }, { level:90, reward:'Mastery cosmetic' }, { level:100, reward:'MAX MASTERY' },
] as const;
