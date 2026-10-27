import type { PvpCommand, PvpConfig, PvpMap, PvpMatch, PvpPlayer } from './pvp';
import { pvpTowerLevel, pvpTowerStats, pvpUpgradeCost, pvpSellRefund, pvpMainUpgradeCost, PVP_MAX_TOWER_LEVEL, PVP_RALLY } from './pvp';
import { turretAllowed } from './turretLoadout';
import { equippedPower, powerTargets, appendPowerCast, mapPowerEnvelope } from './powerCombat';
import { applyPowerStatus, applyWeaponStatus, tickBurn } from './combatStatus';
import { arenaNavigation } from './arenaMotion';
import { turretVictims } from './turretTargets';

export type ArenaHazard = { cell: number; kind: 'slow' | 'damage' };
export type ArenaUnit = PvpPlayer['attackers'][number] & { x: number; y: number; boss?: boolean; fruitKind?: string; ownerId?: string; hazardAt?: number; specialAt?: number };
export type ArenaMatch = PvpMatch & { rulesVersion: 2; phase: 'capture' | 'siege' | 'overtime'; phaseEndsAt: number; captureStartAt: number; captureSeed: number; overtimeWaveAt?:number; catchables: Array<{ id: string; type: string; fruitKind: string; x: number; y: number; bornAt: number; expiresAt: number; claimedBy: string[] }> };

const TYPES = ['normal', 'swift', 'chainburst', 'spitter', 'explosive', 'healer', 'armored', 'splitter'] as const;
const FRUIT_KINDS = ['orange', 'strawberry', 'kiwi', 'lemon', 'bomb', 'pineapple', 'watermelon', 'apple'] as const;
export const ARENA_BOSSES: Record<string, { type: string; fruitKind: string; cost: number }> = {
  'rot-king': { type: 'normal', fruitKind: 'watermelon', cost: 240 },
  'runner-overlord': { type: 'swift', fruitKind: 'strawberry', cost: 260 },
  'rind-titan': { type: 'armored', fruitKind: 'pineapple', cost: 340 },
  'brood-overlord': { type: 'splitter', fruitKind: 'apple', cost: 380 },
};

const presets: Record<string, { solids: number[]; slows?: number[]; damage?: number[] }> = {
  'orchard-crossing': { solids: [63, 66, 143, 146] },
  windfall: { solids: [42, 43, 66, 67, 142, 143], slows: [84, 85, 154, 155] },
  'old-grove': { solids: [41, 44, 47, 81, 84, 87, 121, 124, 127, 161, 164, 167] },
  riverbend: { solids: [52, 62, 72, 83, 93, 103, 114, 124], slows: [54, 55, 64, 65, 74, 75] },
  'twin-rows': { solids: [51, 52, 53, 56, 57, 58, 111, 112, 115, 116, 117, 118] },
  'stone-arch': { solids: [83, 84, 85, 86, 93, 96], damage: [73, 76, 103, 106] },
  'long-harvest': { solids: [31, 38, 51, 58, 71, 78, 91, 98, 111, 118, 131, 138], damage: [153, 156] },
};

export function arenaMap(map: PvpMap): PvpMap {
  if (map.version === 2 && map.solidCells && map.hazards) return map;
  const layout = presets[map.id] ?? presets['orchard-crossing']!;
  const blocked = new Set(layout.solids);
  const hazards = [...(layout.slows ?? []).map(cell => ({ cell, kind: 'slow' as const })), ...(layout.damage ?? []).map(cell => ({ cell, kind: 'damage' as const }))];
  const buildCells = Array.from({ length: map.width * map.height }, (_, cell) => cell).filter(cell => Math.floor(cell / map.width) >= Math.ceil(map.height / 2) && !blocked.has(cell) && !hazards.some(h => h.cell === cell) && Math.floor(cell / map.width) < map.height - 2);
  return { ...map, version: 2, solidCells: layout.solids.filter(cell => cell < map.width * map.height), hazards: hazards.filter(h => h.cell < map.width * map.height), buildCells };
}

export function rebuiltPvpConfig(config: PvpConfig): PvpConfig {
  const defaults = {
    normal: { cost: 20, health: 100, speed: 1.2, wallDamage: 6, rewardFruts: 4 },
    swift: { cost: 32, health: 70, speed: 1.8, wallDamage: 4, rewardFruts: 6 },
    chainburst: { cost: 42, health: 85, speed: 1.3, wallDamage: 5, rewardFruts: 8 },
    spitter: { cost: 50, health: 110, speed: 1.05, wallDamage: 5, rewardFruts: 10 },
    explosive: { cost: 55, health: 150, speed: .85, wallDamage: 18, rewardFruts: 11 },
    healer: { cost: 70, health: 145, speed: .8, wallDamage: 5, rewardFruts: 14 },
    armored: { cost: 85, health: 260, speed: .55, wallDamage: 16, rewardFruts: 17 },
    splitter: { cost: 95, health: 170, speed: .95, wallDamage: 10, rewardFruts: 19 },
  };
  const attacks = Object.fromEntries(Object.entries(config.version === 2 ? { ...defaults, ...config.attacks } : defaults).map(([type, stats]) => [type, { ...stats, speed: Math.min(stats.speed, defaults[type as keyof typeof defaults]?.speed ?? stats.speed) }]));
  const towers = { ...config.towers }; delete towers.catcher;
  const maps = config.maps.map(arenaMap);
  return { ...config, version: 2, map: maps.find(map => map.id === config.map.id) ?? maps[0]!, maps, attacks, towers, durationSeconds: config.version === 2 ? config.durationSeconds : 180, startingFruts: config.version === 2 ? config.startingFruts : 100, incomePerSecond: config.version === 2 ? config.incomePerSecond : 6, arenaRules: config.version === 2 && config.arenaRules ? config.arenaRules : { captureSeconds: 20, overtimeSeconds: 30, doubleIncomeSeconds: 30 }, bossCosts: config.version === 2 && config.bossCosts ? config.bossCosts : Object.fromEntries(Object.entries(ARENA_BOSSES).map(([id, boss]) => [id, boss.cost])) };
}

const gridY = (y: number) => Math.max(0, Math.min(47, Math.floor(y + 24)));
const gridColumn = (x:number,row:number,width:number) => Math.max(0,Math.min(width-1,Math.floor(x-(row%2?.5:0))));
const localCell = (x: number, y: number, map: PvpMap) => {const row=gridY(y);return Math.floor(Math.abs(y))*map.width+gridColumn(x,row,map.width);};
const blockedCells = (match: ArenaMatch, extra?: { side: string; cell: number }): Set<number> => {
  const map = match.map!; const blocked = new Set<number>();
  for (const cell of map.solidCells ?? []) { blocked.add((24 + Math.floor(cell / map.width)) * map.width + cell % map.width); blocked.add((23 - Math.floor(cell / map.width)) * map.width + cell % map.width); }
  for (const player of match.players) for (const tower of player.towers) blocked.add((player.side === 'blue' ? 24 + Math.floor(tower.cell / map.width) : 23 - Math.floor(tower.cell / map.width)) * map.width + tower.cell % map.width);
  if (extra) blocked.add((extra.side === 'blue' ? 24 + Math.floor(extra.cell / map.width) : 23 - Math.floor(extra.cell / map.width)) * map.width + extra.cell % map.width);
  return blocked;
};
const navigationCache = new WeakMap<ArenaMatch, { key: string; blue: ReturnType<typeof arenaNavigation>; red: ReturnType<typeof arenaNavigation> }>();
function navigation(match: ArenaMatch, direction: -1 | 1, extra?: { side: string; cell: number }) {
  const map = match.map!;
  const obstacles = [...blockedCells(match, extra)].map(cell => {
    const row = Math.floor(cell / map.width);
    return { x: cell % map.width + .5 + (row % 2 ? .5 : 0), y: row + .5 - 24 };
  });
  return arenaNavigation(map.width, obstacles, direction);
}
export function arenaLayoutValid(map: PvpMap): boolean {
  if (map.width !== 10 || map.height !== 24) return false;
  const fake = { map, players: [{ side: 'blue', towers: [] }, { side: 'red', towers: [] }] } as unknown as ArenaMatch;
  return navigation(fake, -1).reachable({ x: 5, y: 22.5 }) && navigation(fake, 1).reachable({ x: 5, y: -22.5 });
}
export function arenaBuildAllowed(match: ArenaMatch, side: string, cell: number): boolean {
  const map = match.map!;
  if (!Number.isInteger(cell) || !(map.buildCells ?? []).includes(cell) || match.players.some(p => p.side === side && p.towers.some(t => t.cell === cell))) return false;
  const row = side === 'blue' ? 24+Math.floor(cell/map.width) : 23-Math.floor(cell/map.width);
  const point = {x:cell%map.width+.5+(row%2?.5:0),y:row+.5-24};
  if (match.players.some(p=>p.attackers.some(u=>u.hp>0&&u.x!==undefined&&u.y!==undefined&&Math.hypot(u.x-point.x,u.y-point.y)<.9))) return false;
  return navigation(match, -1, { side, cell }).reachable({x: 5, y: 22.5}) && navigation(match, 1, { side, cell }).reachable({x: 5, y: -22.5});
}

function newUnit(match: ArenaMatch, sender: PvpPlayer, type: string, id: string, config: PvpConfig, boss = false, fruitKind?: string): ArenaUnit {
  const stats = config.attacks[type]; if (!stats) throw new Error('Invalid fruit-zombie');
  const offset = (sender.sequence * 17 % 7 - 3) * .42;
  return { id, type, hp: stats.health * (boss ? 3.6 : 1), maxHp: stats.health * (boss ? 3.6 : 1), progress: -24, x: Math.max(.5, Math.min(match.map!.width - .5, match.map!.width / 2 + offset)), y: sender.side === 'blue' ? 22.5 : -22.5, boss, fruitKind: fruitKind ?? (FRUIT_KINDS[TYPES.indexOf(type as typeof TYPES[number])] ?? 'orange'), ownerId: sender.userId };
}

export function beginArena(match: ArenaMatch, now: number, config: PvpConfig): void {
  const captureMs = (config.arenaRules?.captureSeconds ?? 20) * 1000;
  match.phase = 'capture'; match.captureStartAt = now; match.phaseEndsAt = now + captureMs; match.endsAt = now + config.durationSeconds * 1000;
  match.captureSeed = Array.from(match.id).reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 7);
  match.catchables = Array.from({ length: 11 }, (_, index) => {
    const type = TYPES[[0,1,0,2,3,0,4,5,1,6,7][index]!]!;
    return { id: `catch:${index}`, type, fruitKind: FRUIT_KINDS[TYPES.indexOf(type)]!, x: 1.1 + ((match.captureSeed + index * 37) % 68) / 10, y: 7.5 + ((match.captureSeed * 3 + index * 53) % 105) / 10, bornAt: now + index * 1600, expiresAt: now + Math.min(captureMs, index * 1600 + 5100), claimedBy: [] };
  });
  for (const player of match.players) { player.fruts = 0; player.captured = []; player.wallHealth = config.wallHealth; player.rallyReadyAt = now + captureMs + PVP_RALLY.openingMs; }
}

function catchPosition(item: ArenaMatch['catchables'][number], now: number) {
  const t = Math.max(0, (now - item.bornAt) / 1000);
  return { x: Math.max(.7, Math.min(9.3, item.x + Math.sin(t * .9 + item.y) * 1.1 + Math.sin(t * .43 + item.x) * .35)), y: Math.max(6.8, Math.min(19.5, item.y + Math.cos(t * .72 + item.x) * .85 + Math.sin(t * .37 + item.y) * .4)) };
}
export function arenaCatchables(match: ArenaMatch, now: number, userId: string) {
  return match.catchables.filter(item => item.bornAt <= now && item.expiresAt > now && !item.claimedBy.includes(userId)).map(item => ({ ...item, ...catchPosition(item, now) }));
}

export function applyArenaCommand(match: ArenaMatch, userId: string, command: PvpCommand, sequence: number, now: number, config: PvpConfig): ArenaMatch {
  if (match.status !== 'active') throw new Error('Match is not active');
  const player = match.players.find(p => p.userId === userId); if (!player || !player.connected) throw new Error('Player is unavailable');
  if (sequence !== player.sequence + 1) throw new Error('Invalid or replayed command sequence');
  if (command.type === 'surrender') { match.status = 'complete'; match.resultReason = 'surrender'; match.winnerId = match.players.find(p => p !== player)!.userId; }
  else if (match.phase === 'capture') {
    if (now >= match.phaseEndsAt) throw new Error('Capture phase has ended');
    if (command.type !== 'catch') throw new Error('Catch fruit until siege begins');
    const item = match.catchables.find(c => c.id === command.catchableId);
    if (!item || item.bornAt > now || item.expiresAt < now || item.claimedBy.includes(userId)) throw new Error('That fruit has escaped');
    const at = catchPosition(item, now);
    if (Math.hypot(command.from.x - at.x, command.from.y - at.y) > 1.25 || command.to.x < 8.1 || command.to.y < 20.5) throw new Error('Drag the fruit into the collection box');
    item.claimedBy.push(userId); player.captured ??= []; player.captured.push({ id: `${item.id}:${userId}`, type: item.type, fruitKind: item.fruitKind });
  } else {
    if (now >= match.endsAt) throw new Error('Match timer has expired');
    if (command.type === 'send' || command.type === 'release') {
      const captured = command.type === 'release' ? player.captured?.find(c => c.id === command.capturedId) : undefined;
      const boss = command.type === 'send' ? ARENA_BOSSES[command.enemy] : undefined;
      const type = captured?.type ?? boss?.type ?? (command.type === 'send' ? command.enemy : '');
      const stats = config.attacks[type]; if (!stats) throw new Error('Invalid fruit-zombie type');
      const cost = captured ? 0 : boss ? (config.bossCosts?.[command.type === 'send' ? command.enemy : ''] ?? boss.cost) : stats.cost;
      if (player.fruts < cost) throw new Error('Not enough match Fruts');
      if (boss && match.players.some(p => p.attackers.some(a => a.ownerId === userId && a.boss))) throw new Error('Only one active boss');
      const target = match.players.find(p => p !== player)!; if (target.attackers.length >= 128) throw new Error('The battlefield is full');
      player.fruts -= cost; if (captured) player.captured = player.captured!.filter(c => c !== captured);
      target.attackers.push(newUnit(match, player, type, `${userId}:${sequence}`, config, Boolean(boss), captured?.fruitKind ?? boss?.fruitKind));
    } else if (command.type === 'build') {
      const tower = config.towers[command.tower]; if (!tower || !turretAllowed(command.tower, player.turretLoadout) || !arenaBuildAllowed(match, player.side, command.cell)) throw new Error('Choose a clear hex in your build zone');
      if (player.towers.length >= 24 || player.fruts < tower.cost) throw new Error('Not enough room or Fruts');
      player.fruts -= tower.cost; player.towers.push({ id: `${userId}:${sequence}`, type: command.tower, cell: command.cell, level: 1, placedAt: now });
    } else if (command.type === 'upgrade' || command.type === 'sell') {
      const tower = player.towers.find(t => t.id === command.towerId); const base = tower && config.towers[tower.type]; if (!tower || !base) throw new Error('Choose one of your towers');
      if (command.type === 'upgrade') { const level = pvpTowerLevel(tower.level); if (level >= PVP_MAX_TOWER_LEVEL) throw new Error('Tower is fully upgraded'); const cost = pvpUpgradeCost(base.cost, level); if (player.fruts < cost) throw new Error('Not enough Fruts'); player.fruts -= cost; tower.level = level + 1; }
      else { player.fruts += pvpSellRefund(base.cost, tower.level); player.towers = player.towers.filter(t => t !== tower); }
    } else if (command.type === 'upgrade-main') {
      const level = pvpTowerLevel(player.mainLevel); if (level >= PVP_MAX_TOWER_LEVEL) throw new Error('Main tower is fully upgraded');
      const cost = pvpMainUpgradeCost(level); if (player.fruts < cost) throw new Error('Not enough Fruts');
      player.fruts -= cost; player.mainLevel = level + 1; const health = config.wallHealth * .25; player.wallMaxHealth = (player.wallMaxHealth ?? config.wallHealth) + health; player.wallHealth = Math.min(player.wallMaxHealth, player.wallHealth + health);
    } else if (command.type === 'rally') {
      if (now < (player.rallyReadyAt ?? 0)) throw new Error('Rally is cooling down'); player.rallyUntil = now + PVP_RALLY.durationMs; player.rallyReadyAt = now + PVP_RALLY.cooldownMs;
    } else if (command.type === 'ability') {
      const ranks = match.queue === 'ranked' ? Object.fromEntries((player.abilityLoadout ?? []).map(id => [id, 1])) : player.abilityRanks;
      const { ability, stats } = equippedPower(command.abilityId, player.hero ?? '', player.abilityLoadout, ranks);
      if (now < (player.abilityReadyAt?.[ability.id] ?? 0) || player.fruts < stats.cost) throw new Error('Power unavailable');
      const targets = powerTargets(player.attackers.filter(u => u.hp > 0 && u.type !== 'explosive' && u.x !== undefined && u.y !== undefined), ability, u => ({ x: u.x!, y: u.y! }), mapPowerEnvelope({x:5,y:player.side === 'blue'?23:-23},{minX:0,maxX:match.map!.width,minY:-24,maxY:24}));
      if (!targets.length && (!stats.healFraction || player.wallHealth >= (player.wallMaxHealth ?? config.wallHealth))) throw new Error('No vulnerable targets');
      player.fruts -= stats.cost; player.abilityReadyAt ??= {}; player.abilityReadyAt[ability.id] = now + stats.cooldownMs;
      player.wallHealth = Math.min(player.wallMaxHealth ?? config.wallHealth, player.wallHealth + (player.wallMaxHealth ?? config.wallHealth) * stats.healFraction);
      player.powerCasts = appendPowerCast(player.powerCasts, { id: `${userId}:${sequence}`, abilityId: ability.id, at: now, rank: stats.rank, targets: targets.map(u => ({ x: u.x!, y: u.y! })) });
      for (const unit of targets) { applyPowerStatus(unit, ability, now, stats.slowMs, stats.damage); unit.hp -= stats.damage; if (stats.slowMs) { unit.slowUntil = now + stats.slowMs; unit.slowMultiplier = stats.slowMultiplier; } }
    } else throw new Error('Action unavailable');
  }
  player.sequence = sequence; player.lastSeenAt = now; match.revision++; return match;
}

export function advanceArena(match: ArenaMatch, elapsed: number, now: number, config: PvpConfig): ArenaMatch {
  if (match.status !== 'active') return match;
  const disconnected=match.players.find(player=>!player.connected&&player.disconnectedAt!==null&&now-player.disconnectedAt>=config.reconnectGraceSeconds*1000);
  if(disconnected){match.status='complete';match.resultReason='disconnect';match.winnerId=match.players.find(player=>player!==disconnected)?.userId??null;match.revision++;return match;}
  if (match.phase === 'capture') {
    if (now >= match.phaseEndsAt) { match.phase = 'siege'; match.endsAt = match.phaseEndsAt + config.durationSeconds * 1000; for (const player of match.players) player.fruts = config.startingFruts; }
    match.revision++; return match;
  }
  const dt = Math.max(0, Math.min(1, elapsed)); const map = match.map!;
  if(match.phase==='overtime'&&now>=(match.overtimeWaveAt??Infinity)){
    for(const player of match.players){const rival=match.players.find(p=>p!==player)!;rival.attackers.push(newUnit(match,player,'normal',`overtime:${player.userId}:${now}`,config));}
    match.overtimeWaveAt=now+5000;
  }
  const layoutKey = JSON.stringify([map.width,map.solidCells,match.players.map(p=>[p.side,p.towers.map(t=>t.cell)])]);
  let routes = navigationCache.get(match);
  if (!routes || routes.key !== layoutKey) { routes = {key:layoutKey,blue:navigation(match,-1),red:navigation(match,1)}; navigationCache.set(match,routes); }
  const blueNavigation = routes.blue, redNavigation = routes.red;
  for (const player of match.players) player.fruts += config.incomePerSecond * (match.phase === 'overtime' || match.endsAt - now <= (config.arenaRules?.doubleIncomeSeconds ?? 30) * 1000 ? 2 : 1) * dt;
  const all = match.players.flatMap(p => p.attackers as ArenaUnit[]);
  for (const unit of all) {
    unit.hp -= tickBurn(unit, now);
    if(unit.hp <= 0) continue;
    if(unit.boss&&!unit.enraged&&unit.hp<=(unit.maxHp??unit.hp)*.5){unit.enraged=true;if(unit.type==='splitter'){const sender=match.players.find(p=>p.userId===unit.ownerId);const defender=match.players.find(p=>p!==sender);if(sender&&defender)for(let i=0;i<2;i++)defender.attackers.push({...newUnit(match,sender,'swift',`${unit.id}:brood:${i}`,config),x:unit.x,y:unit.y,hp:45,maxHp:45});}}
  }
  // Small simultaneous steps prevent fast swarms crossing between server updates.
  const steps = Math.max(1, Math.ceil(dt / .05)), stepDt = dt / steps;
  for (let stepIndex = 0; stepIndex < steps; stepIndex++) {
    const live = all.filter(u => u.hp > 0);
    const positions = new Map(live.map(u => [u.id, {x:u.x, y:u.y}]));
    const damage = new Map<string, number>();
    for (const unit of live) {
      unit.fighting = false; unit.attackingTower = false; delete unit.fightTargetId;
      const sender = match.players.find(p => p.userId === unit.ownerId);
      if (!sender) continue;
      const nav = sender.side === 'blue' ? blueNavigation : redNavigation;
      const from = positions.get(unit.id)!;
      const opponents = live.filter(other => other.ownerId !== unit.ownerId && Math.hypot(positions.get(other.id)!.x-from.x,positions.get(other.id)!.y-from.y) < 3.5 && nav.clear(from, positions.get(other.id)!));
      const opponent = opponents.sort((a,b) => Math.hypot(positions.get(a.id)!.x-from.x,positions.get(a.id)!.y-from.y)-Math.hypot(positions.get(b.id)!.x-from.x,positions.get(b.id)!.y-from.y) || a.id.localeCompare(b.id))[0];
      const target = opponent && positions.get(opponent.id)!;
      const reach = unit.boss || opponent?.boss ? 1.45 : .9;
      if (target && Math.hypot(target.x-from.x,target.y-from.y) <= reach + 1e-6) {
        unit.fighting = true; unit.fightTargetId = opponent!.id; unit.lastClashAt = Math.floor(now / 300) * 300;
        damage.set(opponent!.id, (damage.get(opponent!.id) ?? 0) + config.attacks[unit.type]!.wallDamage * 1.8 * stepDt);
        continue;
      }
      // Seek nearby rivals anywhere on the field; otherwise advance freely.
      const goal = target && Math.hypot(target.x-from.x,target.y-from.y) < 3.5 ? target : nav.goal(from);
      const dx = goal.x-from.x, dy = goal.y-from.y, length = Math.hypot(dx,dy) || 1;
      const stats = config.attacks[unit.type]!;
      const hazard = (map.hazards ?? []).find(h => h.cell === localCell(from.x, from.y, map));
      const speed = stats.speed * (unit.boss ? unit.enraged ? .8 : .58 : 1) * (now < (unit.slowUntil ?? 0) ? unit.slowMultiplier ?? .55 : 1) * (hazard?.kind === 'slow' ? .7 : 1);
      const step = Math.min(length, speed * stepDt, target && goal === target ? Math.max(0,length-reach) : Infinity);
      const next = {x:Math.max(.35,Math.min(map.width-.35,from.x+dx/length*step)),y:Math.max(-23.5,Math.min(23.5,from.y+dy/length*step))};
      if (nav.clear(from, next)) { unit.x = next.x; unit.y = next.y; }
      if (hazard?.kind === 'damage' && now-(unit.hazardAt ?? 0) >= 1000) { damage.set(unit.id,(damage.get(unit.id) ?? 0)+2); unit.hazardAt=now; }
      unit.progress = sender.side === 'blue' ? 22.5-unit.y : unit.y+22.5;
    }
    for (const unit of live) unit.hp -= damage.get(unit.id) ?? 0;
  }
  for(const unit of all.filter(u=>u.hp>0&&u.type==='healer'&&now-(u.specialAt??0)>=1200)){
    unit.specialAt=now;for(const ally of all.filter(other=>other.ownerId===unit.ownerId&&other.hp>0&&Math.hypot(other.x-unit.x,other.y-unit.y)<3).slice(0,5))ally.hp=Math.min(ally.maxHp??ally.hp,ally.hp+12);
  }
  for(const unit of all.filter(u=>u.hp>0&&u.type==='spitter'&&now-(u.specialAt??0)>=3800)){
    const rival=match.players.find(p=>p.userId!==unit.ownerId);if(!rival)continue;
    const target=rival.towers.find(t=>{const row=rival.side==='blue'?24+Math.floor(t.cell/map.width):23-Math.floor(t.cell/map.width);return Math.hypot(t.cell%map.width+.5+(row%2?.5:0)-unit.x,(rival.side==='blue'?1:-1)*(Math.floor(t.cell/map.width)+.5)-unit.y)<3.5;});
    if(target){target.jammedUntil=now+1800;unit.specialAt=now;}
  }
  for (const player of match.players) {
    const enemy = player.attackers as ArenaUnit[];
    const fire = (x: number, y: number, stats: { damage: number; range: number; cooldownMs: number }, last: number, type: string, level: number) => {
      if (now - last < stats.cooldownMs) return false;
      const target = enemy.filter(u => u.hp > 0 && Math.hypot(u.x-x,u.y-y) <= stats.range).sort((a,b) => b.progress - a.progress)[0]; if (!target) return false;
      const victims = turretVictims(type, {x,y}, target, enemy.filter(u => u.hp > 0), u => ({x:u.x,y:u.y}), stats.range, level);
      for (const victim of victims) { applyWeaponStatus(victim,type,now,stats.damage); victim.hp -= Math.round(stats.damage * (victim.type === 'armored' && type !== 'laser' && type !== 'railgun' ? .55 : 1) * (now < (player.rallyUntil ?? 0) ? PVP_RALLY.damageMultiplier : 1)); if (type === 'sprinkler') { victim.slowUntil = now + 1200; victim.slowMultiplier = .55; } }
      return true;
    };
    for (const tower of player.towers) { const base = config.towers[tower.type]; if (!base||now<(tower.jammedUntil??0)) continue; const localRow=Math.floor(tower.cell/map.width),globalRow=player.side==='blue'?24+localRow:23-localRow; const y = (player.side === 'blue' ? 1 : -1) * (localRow + .5); const stats = pvpTowerStats(base, tower.level); if (fire(tower.cell % map.width + .5+(globalRow%2?.5:0), y, stats, tower.lastFiredAt ?? tower.placedAt, base.chassis ?? tower.type, pvpTowerLevel(tower.level))) tower.lastFiredAt = now; }
    if (fire(map.width/2, player.side === 'blue' ? 23 : -23, pvpTowerStats({...config.mainTower,cost:0},player.mainLevel), player.mainLastFiredAt ?? 0, 'main', pvpTowerLevel(player.mainLevel))) player.mainLastFiredAt = now;
    for (const unit of [...enemy]) {
      if (unit.hp <= 0) {
        enemy.splice(enemy.indexOf(unit),1); player.score += unit.boss ? 300 : 10; player.fruts += unit.boss ? Math.ceil((Object.values(ARENA_BOSSES).find(b => b.type === unit.type)?.cost ?? 240) * .2) : config.attacks[unit.type]!.rewardFruts;
        if (unit.type === 'chainburst') for (const other of all.filter(u => u.ownerId !== unit.ownerId && Math.hypot(u.x-unit.x,u.y-unit.y) < 2)) other.hp -= 30;
        if (unit.type === 'splitter' && !unit.boss) { const sender = match.players.find(p => p.userId === unit.ownerId)!; const defender = match.players.find(p => p !== sender)!; if (defender.attackers.length < 127) defender.attackers.push({...newUnit(match,sender,'normal',`${unit.id}:child`,config),x:unit.x,y:unit.y,hp:35,maxHp:35}); }
      } else if (Math.abs(unit.y) >= 23.4 && (player.side === 'blue' ? unit.y > 0 : unit.y < 0)) {
        unit.attackingTower = true;
        if (now - (unit.lastTowerHitAt ?? 0) >= 1000) { player.wallHealth = Math.max(0,player.wallHealth-config.attacks[unit.type]!.wallDamage*(unit.boss?2:1)); unit.lastTowerHitAt = now; }
      }
    }
  }
  const dead = match.players.filter(p => p.wallHealth <= 0);
  if (dead.length) { match.status = 'complete'; match.winnerId = dead.length === 2 ? null : match.players.find(p => p !== dead[0])!.userId; match.resultReason = 'wall'; }
  else if (now >= match.endsAt) {
    const [a,b] = match.players; const left = a.wallHealth/(a.wallMaxHealth ?? config.wallHealth), right = b.wallHealth/(b.wallMaxHealth ?? config.wallHealth);
    if (Math.abs(left-right) < 1e-6 && match.phase !== 'overtime') { match.phase = 'overtime'; match.phaseEndsAt = now + (config.arenaRules?.overtimeSeconds ?? 30) * 1000; match.endsAt = match.phaseEndsAt; match.overtimeWaveAt=now+5000; }
    else { match.status = 'complete'; match.resultReason = 'timeout'; match.winnerId = Math.abs(left-right) < 1e-6 ? null : left > right ? a.userId : b.userId; }
  }
  match.revision++; return match;
}
