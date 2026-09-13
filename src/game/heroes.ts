export type HeroId = 'jiju' | 'topfu' | 'lagen' | 'tripos' | 'ki';
export type PointerKind = 'mouse' | 'touch';

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  color: number;
  trail: number;
  blurb: string;
  mouse: string;
  touch: string;
  damage: number;
  radius: number;
  shake: number;
}

export const HEROES: HeroDef[] = [
  {
    id: 'jiju',
    name: 'Master Jiju',
    title: 'Clean blade',
    color: 0x2f6fed,
    trail: 0x1d4ed8,
    blurb: 'Classic wide cuts. Combos stack if you keep slicing.',
    mouse: 'Precise flicks. Combo builds fast.',
    touch: 'Wider finger slash. Easier to clip packs.',
    damage: 18,
    radius: 0.16,
    shake: 0.55,
  },
  {
    id: 'topfu',
    name: 'Topfu',
    title: 'Soft pressure',
    color: 0xf4c36a,
    trail: 0xe8b84a,
    blurb: 'Shorter reach, but fruit go brittle and slow.',
    mouse: 'Short snap cuts. Stacks brittle.',
    touch: 'Fat squash pad. Bigger slow zone.',
    damage: 13,
    radius: 0.1,
    shake: 0.35,
  },
  {
    id: 'lagen',
    name: 'Lagen',
    title: 'Long reach',
    color: 0x3aa35a,
    trail: 0x22c55e,
    blurb: 'Lance slash. The swipe keeps going past your cursor.',
    mouse: 'Fast flick = extra spear length.',
    touch: 'Stable long line, a bit less extra reach.',
    damage: 16,
    radius: 0.12,
    shake: 0.45,
  },
  {
    id: 'tripos',
    name: 'Tripos',
    title: 'Triple path',
    color: 0xc43b8a,
    trail: 0xe879c0,
    blurb: 'One swipe becomes three parallel cuts.',
    mouse: 'Tight triple lines.',
    touch: 'Wider triple spread.',
    damage: 11,
    radius: 0.1,
    shake: 0.4,
  },
  {
    id: 'ki',
    name: 'Master Ki',
    title: 'Charged spirit',
    color: 0x7c3aed,
    trail: 0xa78bfa,
    blurb: 'Hold to charge. Tap empty grass for a Ki pulse.',
    mouse: 'Hold, then flick for a heavy cut.',
    touch: 'Tap to pulse. Swipe to slash.',
    damage: 15,
    radius: 0.14,
    shake: 0.7,
  },
];

export const MAX_HERO_LEVEL = 5;

export function heroDef(id: HeroId): HeroDef {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}

export function heroXpToLevel(xp: number): number {
  if (xp >= 86) return 5;
  if (xp >= 56) return 4;
  if (xp >= 32) return 3;
  if (xp >= 14) return 2;
  return 1;
}

export function xpForNext(level: number): number {
  return [0, 14, 32, 56, 86, 86][Math.min(MAX_HERO_LEVEL, level)] ?? 86;
}

export function heroSlashDamage(id: HeroId, level: number, combo: number, charge: number, pointer: PointerKind): number {
  const hero = heroDef(id);
  let dmg = hero.damage + (level - 1) * 4;
  if (id === 'jiju') dmg *= 1 + Math.min(8, combo) * 0.07;
  if (id === 'topfu' && pointer === 'touch') dmg *= 0.92;
  if (id === 'ki') dmg *= 1 + Math.min(1.4, charge) * 0.85;
  return Math.round(dmg);
}

export function heroHitRadius(id: HeroId, pointer: PointerKind): number {
  const hero = heroDef(id);
  let r = hero.radius;
  if (pointer === 'touch') r += id === 'topfu' ? 0.28 : 0.14;
  if (id === 'lagen') r += 0.06;
  return r;
}
