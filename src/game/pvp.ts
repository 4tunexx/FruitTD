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
  towers: Record<string, { cost: number; damage: number; range: number; cooldownMs: number }>;
  attacks: Record<string, { cost: number; health: number; speed: number; wallDamage: number; rewardFruts: number }>;
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
  durationSeconds: 180, wallHealth: 1000, startingFruts: 180, incomePerSecond: 2, reconnectGraceSeconds: 45,
  towers: {
    guillotine: { cost: 80, damage: 28, range: 3, cooldownMs: 900 },
    vortex: { cost: 120, damage: 16, range: 4, cooldownMs: 600 },
    laser: { cost: 180, damage: 62, range: 6, cooldownMs: 1600 },
    railgun: { cost: 220, damage: 110, range: 8, cooldownMs: 2600 },
    sprinkler: { cost: 150, damage: 12, range: 3, cooldownMs: 350 },
    blender: { cost: 200, damage: 42, range: 2, cooldownMs: 700 },
  },
  attacks: {
    normal: { cost: 35, health: 100, speed: 1, wallDamage: 25, rewardFruts: 12 },
    swift: { cost: 55, health: 70, speed: 1.8, wallDamage: 20, rewardFruts: 10 },
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

export interface PvpPlayer { userId: string; name: string; side: 'blue' | 'red'; connected: boolean; disconnectedAt: number | null; lastSeenAt: number; fruts: number; wallHealth: number; score: number; maxCombo: number; currentCombo: number; lastSlashAt: number | null; comboMilestones: number[]; maxSingleSlashKills: number; ratingDelta?: number; sequence: number; towers: Array<{ id: string; type: string; cell: number; placedAt: number }>; attackers: Array<{ id: string; type: string; hp: number; progress: number }> }
export interface PvpMatch { id: string; queue: PvpQueue; status: 'draft' | 'active' | 'complete'; createdAt: number; endsAt: number; players: [PvpPlayer, PvpPlayer]; winnerId: string | null; resultReason: 'wall' | 'timeout' | 'disconnect' | null; revision: number; mapPool: PvpMap[]; vetoTurn: string; map: PvpMap | null; vetoHistory: Array<{ userId: string; mapId: string }>; }
export type PvpCommand = { type: 'build'; tower: string; cell: number } | { type: 'send'; enemy: string } | { type: 'slash'; attackerIds: string[] };

export function createPvpPlayer(userId: string, name: string, side: 'blue' | 'red', config: PvpConfig, now = Date.now()): PvpPlayer {
  return { userId, name: name.slice(0, 32), side, connected: true, disconnectedAt: null, lastSeenAt: now, fruts: config.startingFruts, wallHealth: config.wallHealth, score: 0, maxCombo: 0, currentCombo: 0, lastSlashAt: null, comboMilestones: [], maxSingleSlashKills: 0, sequence: 0, towers: [], attackers: [] };
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
    match.players.forEach((item) => { item.wallHealth = config.wallHealth; item.fruts = config.startingFruts; });
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
  if (command.type === 'build') {
    const tower = config.towers[command.tower];
    const map = match.map ?? config.map;
    const mapSize = map.width * map.height;
    if (!tower || !Number.isInteger(command.cell) || command.cell < 0 || command.cell >= mapSize || !map.buildCells.includes(command.cell)) throw new Error('Invalid tower or build cell');
    if (player.towers.length >= 24 || player.towers.some((item) => item.cell === command.cell)) throw new Error('Build cell is occupied');
    if (player.fruts < tower.cost) throw new Error('Not enough match Fruts');
    player.fruts -= tower.cost;
    player.towers.push({ id: `${player.userId}:${sequence}`, type: command.tower, cell: command.cell, placedAt: now });
  } else if (command.type === 'send') {
    const attack = config.attacks[command.enemy];
    if (!attack) throw new Error('Invalid fruit-zombie type');
    if (player.fruts < attack.cost) throw new Error('Not enough match Fruts');
    player.fruts -= attack.cost;
    const target = match.players.find((item) => item.userId !== userId)!;
    target.attackers.push({ id: `${userId}:${sequence}`, type: command.enemy, hp: attack.health, progress: 0 });
  } else if (command.type === 'slash') {
    if (!Array.isArray(command.attackerIds) || command.attackerIds.length > 8) throw new Error('Invalid slash command');
    const ids = new Set(command.attackerIds);
    const killed = player.attackers.filter((item) => ids.has(item.id) && item.progress >= 0.25 && item.progress <= 9.75);
    if (killed.length !== ids.size) throw new Error('Slash referenced missing or opponent fruit');
    player.attackers = player.attackers.filter((item) => !ids.has(item.id));
    player.score += killed.length * 10;
    player.fruts += killed.reduce((sum, item) => sum + config.attacks[item.type]!.rewardFruts, 0);
    player.currentCombo = player.lastSlashAt !== null && now - player.lastSlashAt <= 1500 ? player.currentCombo + 1 : 1;
    player.lastSlashAt = now;
    player.maxCombo = Math.max(player.maxCombo, player.currentCombo);
    player.maxSingleSlashKills = Math.max(player.maxSingleSlashKills, killed.length);
    for (const step of config.rating.combo) if (player.currentCombo >= step.at && !player.comboMilestones.includes(step.at)) player.comboMilestones.push(step.at);
  }
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
  for (const player of match.players) {
    player.fruts += config.incomePerSecond * dt;
    for (const attacker of [...player.attackers]) {
      attacker.progress += config.attacks[attacker.type]!.speed * dt;
      for (const tower of player.towers) {
        const stats = config.towers[tower.type]!;
        const pathCell = path[Math.min(path.length - 1, Math.floor(attacker.progress))]!;
        const x = pathCell % map.width; const y = Math.floor(pathCell / map.width);
        const towerX = tower.cell % map.width; const towerY = Math.floor(tower.cell / map.width);
        if (Math.abs(x - towerX) + Math.abs(y - towerY) <= stats.range) attacker.hp -= stats.damage * 1000 / stats.cooldownMs * dt;
      }
      if (attacker.hp <= 0) {
        player.attackers = player.attackers.filter((item) => item.id !== attacker.id);
        player.score += 10;
        player.fruts += config.attacks[attacker.type]!.rewardFruts;
      } else if (attacker.progress >= path.length - 1) {
        // These attackers are on this player's incoming lane, so they strike
        // this player's wall. The send command already placed them here.
        player.wallHealth = Math.max(0, player.wallHealth - config.attacks[attacker.type]!.wallDamage);
        player.attackers = player.attackers.filter((item) => item.id !== attacker.id);
      }
    }
  }
  const dead = match.players.find((player) => player.wallHealth <= 0);
  if (dead) { match.status = 'complete'; match.winnerId = match.players.find((player) => player !== dead)!.userId; match.resultReason = 'wall'; }
  else if (match.players.some((player) => player.connected && now - player.lastSeenAt >= config.reconnectGraceSeconds * 1000)) {
    for (const player of match.players) if (player.connected && now - player.lastSeenAt >= config.reconnectGraceSeconds * 1000) { player.connected = false; player.disconnectedAt = player.lastSeenAt; }
    const forfeiter = match.players.find((player) => !player.connected);
    match.status = 'complete'; match.winnerId = match.players.find((player) => player !== forfeiter)?.userId ?? null; match.resultReason = 'disconnect';
  } else if (match.players.some((player) => player.disconnectedAt !== null && now - player.disconnectedAt >= config.reconnectGraceSeconds * 1000)) {
    match.status = 'complete'; match.winnerId = match.players.find((player) => player.connected)?.userId ?? null; match.resultReason = 'disconnect';
  } else if (now >= match.endsAt) {
    match.status = 'complete'; match.resultReason = 'timeout';
    const [a, b] = match.players;
    match.winnerId = a.wallHealth === b.wallHealth ? (a.score === b.score ? null : a.score > b.score ? a.userId : b.userId) : a.wallHealth > b.wallHealth ? a.userId : b.userId;
  }
  match.revision++;
  return match;
}
