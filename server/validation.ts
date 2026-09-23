/** Only client input is inspected. Server-created Mongo operators remain allowed. */
export function safeInput(value: unknown, depth = 0): boolean {
  if (depth > 24) return false;
  if (value === null || typeof value !== 'object') return true;
  return Object.entries(value).every(([key, child]) =>
    !key.startsWith('$') && !key.includes('.') &&
    !['__proto__', 'prototype', 'constructor'].includes(key) && safeInput(child, depth + 1));
}

export function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
}

export function boundedInteger(value: unknown, max: number, min = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

const HEROES = ['jiju', 'topfu', 'lagen', 'tripos', 'ki'];
const SAVE_KEYS = new Set(['hero', 'xp', 'ownedHeroes', 'towerXp', 'towerLifetimeXp', 'highScore', 'rankedScore', 'bestWave', 'bestCombo', 'games', 'coins', 'gems', 'nickname', 'avatar', 'skillPoints', 'skills', 'ownedSkins', 'bladeSkin', 'wallSkin', 'mode', 'heroPerkRanks', 'vipStatus', 'saveRevision', 'savedAt']);

/** Schema validation is not proof of legitimate rewards/ownership. */
export function saveValidationError(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !safeInput(value)) return 'Invalid save object';
  const save = value as Record<string, unknown>;
  if (Object.keys(save).some((key) => !SAVE_KEYS.has(key))) return 'Unknown save field';
  const limits: Record<string, number> = { coins: 1_000_000, gems: 1_000_000, skillPoints: 10_000, towerXp: 100_000_000, towerLifetimeXp: 100_000_000, highScore: 100_000_000, rankedScore: 100_000_000, bestWave: 9999, bestCombo: 100_000, games: 1_000_000, saveRevision: Number.MAX_SAFE_INTEGER, savedAt: Number.MAX_SAFE_INTEGER };
  for (const [key, max] of Object.entries(limits)) {
    if (save[key] !== undefined && !boundedInteger(save[key], max)) return `Invalid ${key}: expected a nonnegative integer within maximum`;
  }
  for (const key of ['xp', 'skills', 'heroPerkRanks']) {
    const field = save[key];
    if (field !== undefined && (!field || typeof field !== 'object' || Array.isArray(field))) return `Invalid ${key}`;
  }
  if (save.xp && Object.entries(save.xp).some(([hero, xp]) => !HEROES.includes(hero) || !boundedInteger(xp, 1_000_000))) return 'Invalid hero XP';
  if (save.skills && Object.entries(save.skills).some(([id, rank]) => !validId(id) || !boundedInteger(rank, 100))) return 'Invalid skill ranks';
  if (save.heroPerkRanks && Object.entries(save.heroPerkRanks).some(([hero, ranks]) => !HEROES.includes(hero) || !ranks || typeof ranks !== 'object' || Array.isArray(ranks) || Object.entries(ranks).some(([id, rank]) => !validId(id) || !boundedInteger(rank, 100)))) return 'Invalid hero perk ranks';
  for (const key of ['ownedSkins', 'ownedHeroes']) {
    const list = save[key];
    if (list !== undefined && (!Array.isArray(list) || list.length > 500 || !list.every(validId))) return `Invalid ${key}`;
  }
  if (Array.isArray(save.ownedHeroes) && save.ownedHeroes.some((id) => !HEROES.includes(id))) return 'Unknown hero';
  if (save.hero !== undefined && (typeof save.hero !== 'string' || !HEROES.includes(save.hero))) return 'Invalid hero';
  if (save.mode !== undefined && (typeof save.mode !== 'string' || !['casual', 'ranked', 'coop', 'arena'].includes(save.mode))) return 'Invalid mode';
  if (save.vipStatus !== undefined && (typeof save.vipStatus !== 'string' || !['none', 'bronze', 'silver', 'gold'].includes(save.vipStatus))) return 'Invalid VIP status';
  for (const [key, max] of [['nickname', 64], ['avatar', 900_000], ['bladeSkin', 120], ['wallSkin', 120]] as const) {
    if (save[key] !== undefined && (typeof save[key] !== 'string' || (save[key] as string).length > max)) return `Invalid ${key}`;
  }
  return null;
}

export function validProgressUpdates(value: unknown, idKey: string): value is Record<string, any>[] {
  return Array.isArray(value) && value.length <= 100 && value.every((row) =>
    row && typeof row === 'object' && validId(row[idKey]) &&
    ((row.setProgress !== undefined && row.progressDelta === undefined && boundedInteger(row.setProgress, 100_000_000)) ||
     (row.progressDelta !== undefined && row.setProgress === undefined && boundedInteger(row.progressDelta, 100_000_000))));
}