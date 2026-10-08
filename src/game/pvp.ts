import { equippedPower, powerTargets, appendPowerCast, type PowerCast } from './powerCombat';
/** Shared Arena/Ranked PvP contracts and deterministic server rules. */
export type PvpQueue = 'arena' | 'ranked';
export type PvpTier = 'Amateur' | 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Emerald' | 'Sapphire';
export interface PvpMap { id: string; name: string; width: number; height: number; pathCells: number[]; buildCells: number[] }

function route(waypoints: Array<[number, number]>): number[] {
  const cells: number[] = [];
  for (let i = 0; i < waypoints.length; i++) {
    const [x, y] = waypoints[i]!; const [nextX, nextY] = waypoints[i + 1] ?? [x, y];
    if (!cells.length) cells.push(y * 10 + x);
    if (nextY !== y) { const step = Math.sign(nextY - y); for (let row = y + step; row !== nextY + step; row += step) cells.push(row * 10 + x); }
    else if (nextX !== x) { const step = Math.sign(nextX - x); for (let column = x + step; column !== nextX + step; column += step) cells.push(y * 10 + column); }
  }
  return cells;
}

function makeMap(id: string, name: string, waypoints: Array<[number, number]>): PvpMap {
  const width = 10; const height = 14; const pathCells = route(waypoints);
  return { id, name, width, height, pathCells, buildCells: Array.from({ length: width * height }, (_, i) => i).filter((cell) => !pathCells.includes(cell)) };
}

export interface PvpConfig {
  version: 1;
  map: PvpMap;
  maps: PvpMap[];
  durationSeconds: number;
  wallHealth: number;
  startingFruts: number;
  incomePerSecond: number;
  reconnectGraceSeconds: number;
  mainTower: { damage: number; range: number; cooldownMs: number };
  towers: Record<string, { cost: number; damage: number; range: number; cooldownMs: number }>;
  attacks: Record<string, { cost: number; health: number; speed: number; wallDamage: number; rewardFruts: number; packSize?: number }>;
  rating: { start: number; win: number; tie: number; loss: number; bonusCap: number; combo: Array<{ at: number; points: number }>; multiKill3: number; multiKill5: number; seasonResetPercent: number; tiers: Array<{ name: PvpTier; min: number }> };
  seasonRewards: Array<{ tier: PvpTier; coins: number; gems: number; badgeId: string }>;
}

export const DEFAULT_PVP_CONFIG: PvpConfig = {
  version: 1,
  map: makeMap('orchard-crossing', 'Orchard Crossing', [[4, 0], [4, 13]]),
  maps: [
    makeMap('orchard-crossing', 'Orchard Crossing', [[4, 0], [4, 13]]),
    makeMap('windfall', 'Windfall Run', [[1, 0], [1, 3], [8, 3], [8, 6], [2, 6], [2, 9], [7, 9], [7, 13]]),
    makeMap('old-grove', 'Old Grove', [[8, 0], [8, 2], [2, 2], [2, 5], [7, 5], [7, 8], [1, 8], [1, 11], [6, 11], [6, 13]]),
    makeMap('riverbend', 'Riverbend', [[5, 0], [5, 4], [1, 4], [1, 7], [8, 7], [8, 10], [3, 10], [3, 13]]),
    makeMap('twin-rows', 'Twin Rows', [[0, 0], [0, 3], [6, 3], [6, 5], [2, 5], [2, 8], [9, 8], [9, 11], [4, 11], [4, 13]]),
    makeMap('stone-arch', 'Stone Arch', [[9, 0], [9, 2], [3, 2], [3, 5], [7, 5], [7, 8], [1, 8], [1, 11], [8, 11], [8, 13]]),
    makeMap('long-harvest', 'Long Harvest', [[2, 0], [2, 3], [8, 3], [8, 5], [4, 5], [4, 8], [0, 8], [0, 11], [6, 11], [6, 13]]),
  ],
  durationSeconds: 180, wallHealth: 1000, startingFruts: 180, incomePerSecond: 6, reconnectGraceSeconds: 45,
  mainTower: { damage: 18, range: 2, cooldownMs: 1000 },
  towers: {
    guillotine: { cost: 80, damage: 28, range: 3, cooldownMs: 900 },
    vortex: { cost: 120, damage: 16, range: 4, cooldownMs: 600 },
    laser: { cost: 180, damage: 62, range: 6, cooldownMs: 1600 },
    railgun: { cost: 220, damage: 110, range: 8, cooldownMs: 2600 },
    sprinkler: { cost: 150, damage: 12, range: 3, cooldownMs: 350 },
    blender: { cost: 200, damage: 42, range: 2, cooldownMs: 700 },
    catcher: { cost: 150, damage: 8, range: 3, cooldownMs: 1800 },
  },
  attacks: {
    normal: { cost: 35, health: 100, speed: 2, wallDamage: 25, rewardFruts: 4, packSize: 3 },
    swift: { cost: 55, health: 70, speed: 3, wallDamage: 20, rewardFruts: 5, packSize: 2 },
    armored: { cost: 90, health: 260, speed: 0.65, wallDamage: 60, rewardFruts: 24 },
    explosive: { cost: 100, health: 150, speed: 0.9, wallDamage: 110, rewardFruts: 22 },
  },
  rating: {
    start: 1000, win: 50, tie: 20, loss: -50, bonusCap: 20,
    combo: [{ at: 5, points: 1 }, { at: 10, points: 2 }, { at: 20, points: 3 }, { at: 35, points: 4 }, { at: 50, points: 5 }],
    multiKill3: 2, multiKill5: 3, seasonResetPercent: 25,
    tiers: [{ name: 'Amateur', min: 0 }, { name: 'Bronze', min: 500 }, { name: 'Silver', min: 1500 }, { name: 'Gold', min: 2000 }, { name: 'Diamond', min: 2500 }, { name: 'Emerald', min: 2750 }, { name: 'Sapphire', min: 3000 }],
  },
  seasonRewards: [
    { tier: 'Bronze', coins: 100, gems: 0, badgeId: 'pvp-bronze' },
    { tier: 'Silver', coins: 250, gems: 5, badgeId: 'pvp-silver' },
    { tier: 'Gold', coins: 500, gems: 10, badgeId: 'pvp-gold' },
    { tier: 'Diamond', coins: 900, gems: 20, badgeId: 'pvp-diamond' },
    { tier: 'Emerald', coins: 1400, gems: 35, badgeId: 'pvp-emerald' },
    { tier: 'Sapphire', coins: 2200, gems: 60, badgeId: 'pvp-sapphire' },
  ],
};

export function normalizePvpMaps(input: unknown): PvpMap[] {
  if (!Array.isArray(input) || input.length !== 7) return structuredClone(DEFAULT_PVP_CONFIG.maps);
  return input.map((raw: unknown, index: number) => {
    const fallback = DEFAULT_PVP_CONFIG.maps[index]!;
    if (!raw || typeof raw !== 'object') return structuredClone(fallback);
    const row = raw as Partial<PvpMap>;
    const width = Math.max(3, Math.min(12, Math.floor(Number(row.width) || fallback.width)));
    const height = Math.max(3, Math.min(24, Math.floor(Number(row.height) || fallback.height)));
    const path = Array.isArray(row.pathCells) ? row.pathCells.map(Number) : fallback.pathCells;
    const valid = path.length >= 12 && path.length <= width * height && new Set(path).size === path.length && path.every((cell, i) => Number.isInteger(cell) && cell >= 0 && cell < width * height && (!i || Math.abs((cell % width) - (path[i - 1]! % width)) + Math.abs(Math.floor(cell / width) - Math.floor(path[i - 1]! / width)) === 1)) && Math.floor(path[0]! / width) === 0 && Math.floor(path.at(-1)! / width) === height - 1;
    if (!valid) return structuredClone(fallback);
    return { id: String(row.id || fallback.id).slice(0, 48), name: String(row.name || fallback.name).slice(0, 64), width, height, pathCells: path, buildCells: Array.from({ length: width * height }, (_, cell) => cell).filter((cell) => !path.includes(cell)) };
  });
}

export function pvpTier(points: number, config: PvpConfig = DEFAULT_PVP_CONFIG): PvpTier {
  return [...config.rating.tiers].sort((a, b) => a.min - b.min).filter((tier) => points >= tier.min).at(-1)?.name ?? 'Amateur';
}

export function resetSeasonRating(points: number, config: PvpConfig = DEFAULT_PVP_CONFIG): number {
  const retain = 1 - config.rating.seasonResetPercent / 100;
  return Math.max(0, Math.round(config.rating.start + (points - config.rating.start) * retain));
}

export interface PvpRatingResult { outcome: 'win' | 'tie' | 'loss'; base: number; performance: number; delta: number; rating: number; tier: PvpTier }
export function calculatePvpRating(points: number, outcome: 'win' | 'tie' | 'loss', comboMilestones: number[], maxSingleSlashKills: number, config: PvpConfig = DEFAULT_PVP_CONFIG): PvpRatingResult {
  const base = config.rating[outcome];
  const comboBonus = comboMilestones.reduce((sum, milestone) => sum + (config.rating.combo.find((tier) => tier.at === milestone)?.points ?? 0), 0);
  const multiBonus = maxSingleSlashKills >= 5 ? config.rating.multiKill5 : maxSingleSlashKills >= 3 ? config.rating.multiKill3 : 0;
  let performance = Math.min(config.rating.bonusCap, Math.max(0, comboBonus + multiBonus));
  if (outcome === 'loss') performance = Math.min(performance, Math.max(0, Math.abs(base) - 1));
  const delta = base + performance;
  const rating = Math.max(0, points + delta);
  return { outcome, base, performance, delta: rating - points, rating, tier: pvpTier(rating, config) };
}

export const PVP_RALLY = { durationMs: 8_000, cooldownMs: 35_000, openingMs: 15_000, damageMultiplier: 1.25 };
export const PVP_CAPTURE_CAPACITY = 3;
export function pvpMainUpgradeCost(level = 1): number { return pvpTowerLevel(level) === 1 ? 220 : 340; }
export function pvpReleaseCost(attackCost: number, packSize = 1): number { return Math.max(1, Math.ceil(attackCost / Math.max(1, Math.floor(packSize || 1)) * .5)); }
export interface PvpPlayer { powerCasts?: PowerCast[]; abilityLoadout?: string[]; abilityRanks?: Record<string, number>; abilityReadyAt?: Record<string, number>; mainLevel?: number; wallMaxHealth?: number; captured?: Array<{ id: string; type: string }>; hero?: string; wallSkin?: string; rallyUntil?: number; rallyReadyAt?: number; userId: string; name: string; side: 'blue' | 'red'; connected: boolean; disconnectedAt: number | null; lastSeenAt: number; avatar?: string; fruts: number; wallHealth: number; score: number; maxCombo: number; currentCombo: number; lastSlashAt: number | null; lastStroke?: { from: { x: number; y: number }; to: { x: number; y: number }; at: number } | null; mainLastFiredAt?: number; comboMilestones: number[]; maxSingleSlashKills: number; ratingDelta?: number; sequence: number; towers: Array<{ id: string; type: string; cell: number; placedAt: number; level?: number; spent?: number; lastFiredAt?: number }>; attackers: Array<{ id: string; type: string; hp: number; maxHp?: number; progress: number; attackingTower?:boolean; lastTowerHitAt?:number; fighting?:boolean; fightTargetId?:string; lastClashAt?:number; slowUntil?: number; slowMultiplier?: number; released?: boolean }> }
export interface PvpMatch { nextWaveAt?: number; neutralWave?: number; id: string; queue: PvpQueue; status: 'draft' | 'active' | 'complete'; createdAt: number; endsAt: number; players: [PvpPlayer, PvpPlayer]; winnerId: string | null; resultReason: 'wall' | 'timeout' | 'disconnect' | 'test-ended' | 'surrender' | 'draft-cancelled' | null; revision: number; mapPool: PvpMap[]; vetoTurn: string; map: PvpMap | null; vetoHistory: Array<{ userId: string; mapId: string }>; }
export type PvpCommand = { type: 'ability'; abilityId: string } | { type: 'upgrade-main' } | { type: 'release'; capturedId: string } | { type: 'rally' } | { type: 'upgrade'; towerId: string } | { type: 'sell'; towerId: string } | { type: 'surrender' } | { type: 'build'; tower: string; cell: number } | { type: 'send'; enemy: string } | { type: 'slash'; from: { x: number; y: number }; to: { x: number; y: number } };

export const PVP_MAX_TOWER_LEVEL = 3;
export function pvpTowerLevel(level?: number): number { return Math.max(1, Math.min(PVP_MAX_TOWER_LEVEL, Math.floor(level || 1))); }
export function pvpUpgradeCost(baseCost: number, level = 1): number { return Math.ceil(baseCost * (.6 + .3 * pvpTowerLevel(level))); }
export function pvpTowerStats(base: PvpConfig['towers'][string], level = 1) {
  const upgrades = pvpTowerLevel(level) - 1;
  return { ...base, damage: Math.round(base.damage * (1 + upgrades * .65)), range: base.range + upgrades * .5, cooldownMs: Math.round(base.cooldownMs / (1 + upgrades * .15)) };
}
export function pvpSellRefund(baseCost: number, level = 1): number {
  let spent = baseCost;
  for (let i = 1; i < pvpTowerLevel(level); i++) spent += pvpUpgradeCost(baseCost, i);
  return Math.floor(spent * .6);
}

export function pvpTowerRole(type: string): string {
  return ({ guillotine: 'Rapid', vortex: 'Slow', laser: 'Pierce', railgun: 'Heavy pierce', sprinkler: 'Splash', blender: 'Close splash', catcher: 'Capture' } as Record<string, string>)[type] || 'Defence';
}
export function pvpHexDistance(a: number, b: number, width: number): number {
  const axial = (cell: number) => { const r = Math.floor(cell / width); return { r, q: cell % width - (r - (r & 1)) / 2 }; };
  const x = axial(a); const y = axial(b); const dq = x.q - y.q; const dr = x.r - y.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
export function calculateArenaRating(points: number, opponent: number, outcome: 'win' | 'tie' | 'loss', config: PvpConfig = DEFAULT_PVP_CONFIG): PvpRatingResult {
  const expected = 1 / (1 + 10 ** ((opponent - points) / 400));
  const actual = outcome === 'win' ? 1 : outcome === 'tie' ? .5 : 0;
  const change = actual - expected;
  const delta = Math.round(change * (change >= 0 ? config.rating.win : Math.abs(config.rating.loss)) * 2);
  const rating = Math.max(0, points + delta);
  return { outcome, base: delta, performance: 0, delta: rating - points, rating, tier: pvpTier(rating, config) };
}

export function fruitOnSlash(pathCell: number, width: number, from: { x: number; y: number }, to: { x: number; y: number }): boolean {
  const x = pathCell % width + 0.5;
  const y = Math.floor(pathCell / width) + 0.5;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const t = Math.max(0, Math.min(1, ((x - from.x) * dx + (y - from.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (from.x + dx * t), y - (from.y + dy * t)) <= 0.46;
}

export function createPvpPlayer(userId: string, name: string, side: 'blue' | 'red', config: PvpConfig, now = Date.now()): PvpPlayer {
  return { userId, name: name.slice(0, 32), side, mainLevel: 1, wallMaxHealth: config.wallHealth, captured: [], connected: true, disconnectedAt: null, lastSeenAt: now, fruts: config.startingFruts, wallHealth: config.wallHealth, score: 0, maxCombo: 0, currentCombo: 0, lastSlashAt: null, comboMilestones: [], maxSingleSlashKills: 0, sequence: 0, towers: [], attackers: [] };
}

export function newPvpMatch(id: string, queue: PvpQueue, players: [PvpPlayer, PvpPlayer], now = Date.now(), config: PvpConfig = DEFAULT_PVP_CONFIG): PvpMatch {
  const mapPool = structuredClone(config.maps);
  players.forEach((player) => { player.lastSeenAt = now; });
  return { id, queue, status: 'draft', createdAt: now, endsAt: 0, players, winnerId: null, resultReason: null, revision: 0, mapPool, vetoTurn: players[Math.floor(Math.random() * 2)]!.userId, map: null, vetoHistory: [] };
}

export function vetoPvpMap(match: PvpMatch, userId: string, mapId: string, sequence: number, now = Date.now(), config: PvpConfig = DEFAULT_PVP_CONFIG): PvpMatch {
  if (match.status !== 'draft') throw new Error('Map veto is already complete');
  const player = match.players.find((item) => item.userId === userId);
  if (!player) throw new Error('Player is not in this match');
  if (match.vetoTurn !== userId) throw new Error('Wait for the other player to veto a path');
  if (sequence !== player.sequence + 1) throw new Error('Invalid or replayed veto');
  if (match.mapPool.length <= 2) throw new Error('Only the final two paths remain');
  if (!match.mapPool.some((item) => item.id === mapId)) throw new Error('That path is no longer available');
  match.mapPool = match.mapPool.filter((item) => item.id !== mapId);
  match.vetoHistory.push({ userId, mapId }); player.sequence = sequence; player.lastSeenAt = now;
  match.revision++;
  if (match.mapPool.length === 2) {
    match.map = structuredClone(match.mapPool[Math.floor(Math.random() * match.mapPool.length)]!);
    match.status = 'active'; match.endsAt = now + config.durationSeconds * 1000;
    match.players.forEach((item) => { item.wallHealth = config.wallHealth; item.fruts = config.startingFruts; item.rallyReadyAt = now + PVP_RALLY.openingMs; });
  } else match.vetoTurn = match.players.find((item) => item.userId !== userId)!.userId;
  return match;
}

export function applyPvpCommand(match: PvpMatch, userId: string, command: PvpCommand, sequence: number, now = Date.now(), config: PvpConfig = DEFAULT_PVP_CONFIG): PvpMatch {
  if (match.status !== 'active') throw new Error('Match is not active');
  if (now >= match.endsAt) throw new Error('Match timer has expired');
  const player = match.players.find((item) => item.userId === userId);
  if (!player) throw new Error('Player is not in this match');
  if (sequence !== player.sequence + 1) throw new Error('Invalid or replayed command sequence');
  if (!player.connected) throw new Error('Player is disconnected');
  if (command.type === 'upgrade-main') {
    const level = pvpTowerLevel(player.mainLevel);
    if (level >= PVP_MAX_TOWER_LEVEL) throw new Error('Main tower is fully upgraded');
    const cost = pvpMainUpgradeCost(level); if (player.fruts < cost) throw new Error('Not enough match Fruts');
    player.fruts -= cost; player.mainLevel = level + 1;
    const extraHealth = config.wallHealth * .25;
    player.wallMaxHealth = (player.wallMaxHealth ?? config.wallHealth) + extraHealth;
    player.wallHealth = Math.min(player.wallMaxHealth, player.wallHealth + extraHealth);
  } else if (command.type === 'release') {
    const captured = player.captured?.find(item => item.id === command.capturedId);
    const attack = captured ? config.attacks[captured.type] : null;
    if (!captured || !attack) throw new Error('Choose one of your captured fruit-zombies');
    const cost = pvpReleaseCost(attack.cost, attack.packSize); if (player.fruts < cost) throw new Error('Not enough match Fruts');
    const target = match.players.find(item => item !== player)!;
    if (target.attackers.length >= 128) throw new Error('The opponent lane is full. Wait for the attack wave.');
    player.fruts -= cost; player.captured = player.captured!.filter(item => item !== captured);
    target.attackers.push({ id: `${userId}:${sequence}:released`, type: captured.type, hp: attack.health, maxHp: attack.health, progress: -(match.map??config.map).pathCells.length, released: true });
  } else if (command.type === 'ability') {
    const {ability,stats}=equippedPower(command.abilityId,player.hero??'',player.abilityLoadout,player.abilityRanks);
    if(now<(player.abilityReadyAt?.[ability.id]??0))throw new Error('That power is cooling down');
    if(player.fruts<stats.cost)throw new Error('Not enough match Fruts');
    const map=match.map??config.map;
    const point=(attacker:PvpPlayer['attackers'][number])=>{const cell=map.pathCells[Math.min(map.pathCells.length-1,Math.max(0,Math.round(attacker.progress)))]??0;return {x:cell%map.width+.5,y:Math.floor(cell/map.width)+.5,progress:attacker.progress};};
    const targets=powerTargets(player.attackers.filter(a=>a.hp>0),ability,point);
    player.fruts-=stats.cost;player.abilityReadyAt??={};player.abilityReadyAt[ability.id]=now+ability.cooldownMs;
    player.wallHealth=Math.min(player.wallMaxHealth??config.wallHealth,player.wallHealth+(player.wallMaxHealth??config.wallHealth)*stats.healFraction);
    player.powerCasts=appendPowerCast(player.powerCasts,{id:`${userId}:${sequence}`,abilityId:ability.id,at:now,rank:stats.rank,targets:targets.map(point)});
    for(const attacker of targets){attacker.hp-=stats.damage;if(stats.slowMs){attacker.slowUntil=Math.max(attacker.slowUntil??0,now+stats.slowMs);attacker.slowMultiplier=stats.slowMultiplier;}}
    const killed=player.attackers.filter(a=>a.hp<=0);player.score+=killed.length*10;
    player.fruts+=killed.reduce((sum,a)=>sum+(config.attacks[a.type]?.rewardFruts??0),0);player.attackers=player.attackers.filter(a=>a.hp>0);
  } else if (command.type === 'rally') {
    if (now < (player.rallyReadyAt ?? match.createdAt + PVP_RALLY.openingMs)) throw new Error('Rally is cooling down');
    player.rallyUntil = now + PVP_RALLY.durationMs; player.rallyReadyAt = now + PVP_RALLY.cooldownMs;
  } else if (command.type === 'build') {
    const tower = config.towers[command.tower];
    const map = match.map ?? config.map;
    const mapSize = map.width * map.height;
    if (!tower || !Number.isInteger(command.cell) || command.cell < 0 || command.cell >= mapSize || !map.buildCells.includes(command.cell)) throw new Error('Invalid tower or build cell');
    if (player.towers.length >= 24 || player.towers.some((item) => item.cell === command.cell)) throw new Error('Build cell is occupied');
    if (player.fruts < tower.cost) throw new Error('Not enough match Fruts');
    player.fruts -= tower.cost;
    player.towers.push({ id: `${player.userId}:${sequence}`, type: command.tower, cell: command.cell, placedAt: now, level: 1 });
  } else if (command.type === 'upgrade' || command.type === 'sell') {
    const tower = player.towers.find(item => item.id === command.towerId);
    if (!tower || !config.towers[tower.type]) throw new Error('Select one of your towers');
    const base = config.towers[tower.type]!;
    const level = pvpTowerLevel(tower.level);
    if (command.type === 'upgrade') {
      if (level >= PVP_MAX_TOWER_LEVEL) throw new Error('Tower is fully upgraded');
      const cost = pvpUpgradeCost(base.cost, level);
      if (player.fruts < cost) throw new Error('Not enough match Fruts');
      player.fruts -= cost; tower.level = level + 1;
    } else {
      player.fruts += pvpSellRefund(base.cost, level);
      player.towers = player.towers.filter(item => item !== tower);
    }
  } else if (command.type === 'surrender') {
    match.status = 'complete'; match.resultReason = 'surrender';
    match.winnerId = match.players.find(item => item !== player)!.userId;
  } else if (command.type === 'send') {
    const attack = config.attacks[command.enemy];
    if (!attack) throw new Error('Invalid fruit-zombie type');
    if (player.fruts < attack.cost) throw new Error('Not enough match Fruts');
    const target = match.players.find((item) => item.userId !== userId)!;
    const count = Math.max(1, Math.min(8, Math.floor(attack.packSize || 1)));
    if (target.attackers.length + count > 128) throw new Error('The opponent lane is full. Wait for the attack wave.');
    player.fruts -= attack.cost;
    for (let i = 0; i < count; i++) target.attackers.push({ id: `${userId}:${sequence}:${i}`, type: command.enemy, hp: attack.health, maxHp: attack.health, progress: -(match.map??config.map).pathCells.length-i*.8 });
  } else if (command.type === 'slash') {
    throw new Error('Slicing is disabled in Arena. Build towers to defend.');
  } else throw new Error('Unknown match action');
  player.sequence = sequence;
  player.lastSeenAt = now;
  match.revision++;
  return match;
}

export function advancePvpMatch(match: PvpMatch, elapsedSeconds: number, now = Date.now(), config: PvpConfig = DEFAULT_PVP_CONFIG): PvpMatch {
  if (match.status !== 'active') return match;
  const dt = Math.max(0, Math.min(1, elapsedSeconds));
  const map = match.map ?? config.map;
  const path = map.pathCells;
  // Stored under the defending player, squads travel from the sender's keep
  // through the shared centre and into the enemy half. Both teams move before
  // combat, and melee damage is applied simultaneously to avoid side advantage.
  const before=new Map<string,number>();
  for(const player of match.players){
    player.fruts+=config.incomePerSecond*dt;
    for(const unit of player.attackers){
      before.set(unit.id,unit.progress);unit.fighting=false;delete unit.fightTargetId;
      if(unit.hp<=0)continue;
      const cell=path[Math.max(0,Math.min(path.length-1,Math.floor(unit.progress)))]!;
      const slowed=unit.progress>=0&&player.towers.some(tower=>tower.type==='vortex'&&pvpHexDistance(tower.cell,cell,map.width)<=pvpTowerStats(config.towers.vortex!,tower.level).range);
      unit.progress+=config.attacks[unit.type]!.speed*dt*Math.max(1,(path.length-1)/13)*Math.min(slowed?.6:1,now<(unit.slowUntil??0)?unit.slowMultiplier??.45:1);
    }
  }
  const [a,b]=match.players;const reach=.8;
  const pairs=a.attackers.filter(u=>u.hp>0&&u.progress>=-path.length).flatMap(left=>b.attackers.filter(u=>u.hp>0&&u.progress>=-path.length).map(right=>({left,right,distance:Math.abs(left.progress+right.progress+1)}))).sort((x,y)=>x.distance-y.distance);
  for(const {left,right} of pairs){
    const oldLeft=before.get(left.id)!,oldRight=before.get(right.id)!;
    const oldSum=oldLeft+oldRight+1,newSum=left.progress+right.progress+1;
    if(oldSum<=-reach&&newSum>=-reach){
      const movement=(left.progress-oldLeft)+(right.progress-oldRight);
      const fraction=movement>0?Math.max(0,Math.min(1,(-reach-oldSum)/movement)):0;
      left.progress=oldLeft+(left.progress-oldLeft)*fraction;right.progress=oldRight+(right.progress-oldRight)*fraction;
    }else if(Math.abs(oldSum)<=reach&&Math.abs(newSum)<=reach+10){left.progress=oldLeft;right.progress=oldRight;}
  }
  const damage=new Map<string,number>();
  for(const [team,enemy] of [[a,b],[b,a]] as const)for(const unit of team.attackers.filter(u=>u.hp>0&&u.progress>=-path.length)){
    const target=enemy.attackers.filter(u=>u.hp>0&&u.progress>=-path.length&&Math.abs(unit.progress+u.progress+1)<=reach+.0001).sort((x,y)=>Math.abs(unit.progress+x.progress+1)-Math.abs(unit.progress+y.progress+1)||x.id.localeCompare(y.id))[0];
    if(!target)continue;unit.fighting=true;unit.fightTargetId=target.id;unit.lastClashAt=Math.floor(now/300)*300;
    const hit=config.attacks[unit.type]!.wallDamage*.45*dt*(now<(enemy.rallyUntil??0)?PVP_RALLY.damageMultiplier:1);
    damage.set(target.id,(damage.get(target.id)??0)+hit);
  }
  for(const player of match.players)for(const unit of player.attackers)unit.hp-=damage.get(unit.id)??0;
  for (const player of match.players) {
    const shoot = (cell: number, stats: { damage: number; range: number; cooldownMs: number }, lastFiredAt: number, type = 'main', level = 1) => {
      if (now - lastFiredAt < stats.cooldownMs) return false;
      const target = [...player.attackers].filter((attacker) => {
        const pathCell = path[Math.max(0, Math.min(path.length - 1, Math.floor(attacker.progress)))]!;
        return attacker.progress >= 0 && attacker.hp > 0 && pvpHexDistance(pathCell, cell, map.width) <= stats.range;
      }).sort((a, b) => b.progress - a.progress)[0];
      if (!target) return false;
      if (type === 'catcher' && !target.released && target.hp <= (target.maxHp ?? config.attacks[target.type]!.health) * (.3 + (pvpTowerLevel(level) - 1) * .1) && (player.captured?.length ?? 0) < PVP_CAPTURE_CAPACITY) {
        player.captured ??= []; player.captured.push({ id: `captured:${target.id}`, type: target.type });
        player.attackers = player.attackers.filter(item => item !== target);
        return true;
      }
      const hit = (attacker: typeof target, mul = 1) => { attacker.hp -= Math.round(stats.damage * mul * (now < (player.rallyUntil ?? 0) ? PVP_RALLY.damageMultiplier : 1) * (attacker.type === 'armored' && type !== 'laser' && type !== 'railgun' ? .55 : 1)); };
      hit(target);
      if (type === 'sprinkler' || type === 'blender') {
        const targetCell = path[Math.floor(Math.max(0, Math.min(path.length - 1, target.progress)))]!;
        const nearby = player.attackers.filter(item => item !== target && item.hp > 0 && item.progress >= 0 && pvpHexDistance(path[Math.floor(Math.min(path.length - 1, item.progress))]!, targetCell, map.width) <= 1).slice(0, type === 'blender' ? 3 : 2);
        for (const item of nearby) hit(item, type === 'blender' ? 1 : .65);
      }
      return true;
    };
    for (const tower of player.towers) {
      const stats = config.towers[tower.type];
      if (stats && shoot(tower.cell, pvpTowerStats(stats, tower.level), tower.lastFiredAt ?? tower.placedAt, tower.type, pvpTowerLevel(tower.level))) tower.lastFiredAt = now;
    }
    if (shoot(path.at(-1)!, pvpTowerStats({ cost: 0, ...config.mainTower }, player.mainLevel), player.mainLastFiredAt ?? 0)) player.mainLastFiredAt = now;
    for (const attacker of [...player.attackers]) {
      if (attacker.hp <= 0) {
        player.attackers = player.attackers.filter((item) => item.id !== attacker.id);
        player.score += 10;
        player.fruts += config.attacks[attacker.type]!.rewardFruts;
      } else if (attacker.progress >= path.length - 1) {
        // These attackers are on this player's incoming lane, so they strike
        // this player's wall. The send command already placed them here.
        attacker.progress=path.length-1;attacker.attackingTower=true;
        if(now-(attacker.lastTowerHitAt??0)>=1000){player.wallHealth=Math.max(0,player.wallHealth-config.attacks[attacker.type]!.wallDamage);attacker.lastTowerHitAt=now;}
      }
    }
  }
  const dead = match.players.find((player) => player.wallHealth <= 0);
  if (dead) { match.status = 'complete'; match.winnerId = match.players.every(player => player.wallHealth <= 0) ? null : match.players.find((player) => player !== dead)!.userId; match.resultReason = 'wall'; }
  else if (match.players.some((player) => player.connected && now - player.lastSeenAt >= config.reconnectGraceSeconds * 1000)) {
    for (const player of match.players) if (player.connected && now - player.lastSeenAt >= config.reconnectGraceSeconds * 1000) { player.connected = false; player.disconnectedAt = player.lastSeenAt; }
    const forfeiter = match.players.find((player) => !player.connected);
    match.status = 'complete'; match.winnerId = match.players.find((player) => player !== forfeiter)?.userId ?? null; match.resultReason = 'disconnect';
  } else if (match.players.some((player) => player.disconnectedAt !== null && now - player.disconnectedAt >= config.reconnectGraceSeconds * 1000)) {
    match.status = 'complete'; match.winnerId = match.players.find((player) => player.connected)?.userId ?? null; match.resultReason = 'disconnect';
  } else if (now >= match.endsAt) {
    match.status = 'complete'; match.resultReason = 'timeout';
    const [a, b] = match.players;
    const aHealth = a.wallHealth / (a.wallMaxHealth ?? config.wallHealth); const bHealth = b.wallHealth / (b.wallMaxHealth ?? config.wallHealth);
    match.winnerId = Math.abs(aHealth - bHealth) < .000001 ? null : aHealth > bHealth ? a.userId : b.userId;
  }
  match.revision++;
  return match;
}
