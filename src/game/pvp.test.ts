import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PVP_CONFIG as cfg, advancePvpMatch, applyPvpCommand, calculatePvpRating, createPvpPlayer, newPvpMatch, normalizePvpMaps, pvpTier, resetSeasonRating, vetoPvpMap, pvpUpgradeCost, pvpSellRefund, pvpTowerStats } from './pvp';

describe('Arena and Ranked PvP rules', () => {
  const match = () => newPvpMatch('test', 'ranked', [createPvpPlayer('a', 'A', 'blue', cfg), createPvpPlayer('b', 'B', 'red', cfg)], 1_000, cfg);

  it('spawns only player-sent squads, including matches carrying legacy wave timers', () => {
    const game = match(); game.status = 'active'; game.map = cfg.map; game.endsAt = 100_000;
    game.nextWaveAt = 2_000;
    advancePvpMatch(game, 1, 30_000, cfg);
    assert.equal(game.players[0].attackers.length, 0);
    assert.equal(game.players[1].attackers.length, 0);
    assert.equal(game.players[0].wallHealth, cfg.wallHealth);
    applyPvpCommand(game, 'a', { type: 'send', enemy: 'normal' }, 1, 30_001, cfg);
    assert.equal(game.players[0].attackers.length, 0);
    assert.equal(game.players[1].attackers.length, cfg.attacks.normal!.packSize);
  });

  it('provides seven long editable routes with top-to-bottom adjacent path cells', () => {
    const maps = normalizePvpMaps(cfg.maps);
    assert.equal(maps.length, 7);
    for (const map of maps) {
      assert.ok(map.pathCells.length >= 12);
      assert.equal(Math.floor(map.pathCells[0]! / map.width), 0);
      assert.equal(Math.floor(map.pathCells.at(-1)! / map.width), map.height - 1);
      assert.equal(new Set(map.pathCells).size, map.pathCells.length);
    }
  });

  it('alternates path vetoes and server-randomly starts the match at two remaining', () => {
    const game = match();
    const first = game.vetoTurn;
    const next = game.players.find((player) => player.userId !== first)!;
    assert.throws(() => vetoPvpMap(game, next.userId, game.mapPool[0]!.id, 1, 1_001, cfg), /other player/);
    for (let veto = 0; veto < 5; veto++) {
      const player = game.players.find((entry) => entry.userId === game.vetoTurn)!;
      vetoPvpMap(game, player.userId, game.mapPool[0]!.id, player.sequence + 1, 1_100 + veto, cfg);
    }
    assert.equal(game.mapPool.length, 2);
    assert.equal(game.status, 'active');
    assert.ok(game.map && game.mapPool.some((map) => map.id === game.map!.id));
    assert.equal(game.endsAt, 1_100 + 4 + cfg.durationSeconds * 1000);
  });

  it('charges tower build costs and rejects invalid or replayed commands', () => {
    const game = match();
    game.status = 'active'; game.map = cfg.maps[0]!; game.endsAt = 100_000;
    const user = game.players[0]!; const before = user.fruts;
    const buildCell = cfg.maps[0]!.buildCells[0]!;
    applyPvpCommand(game, user.userId, { type: 'build', tower: 'guillotine', cell: buildCell }, 1, 2_000, cfg);
    assert.equal(user.fruts, before - cfg.towers.guillotine!.cost);
    assert.throws(() => applyPvpCommand(game, user.userId, { type: 'send', enemy: 'normal' }, 1, 2_001, cfg), /replayed/);
    assert.throws(() => applyPvpCommand(game, user.userId, { type: 'build', tower: 'laser', cell: cfg.maps[0]!.pathCells[0]! }, 2, 2_002, cfg), /Invalid tower/);
  });

  it('upgrades only owned towers, charges each level, caps upgrades and frees a sold hex', () => {
    const game = match(); game.status = 'active'; game.map = cfg.map; game.endsAt = 100_000;
    const owner = game.players[0]; owner.fruts = 1000;
    const cell = cfg.map.buildCells[0]!; const base = cfg.towers.guillotine!;
    applyPvpCommand(game, 'a', { type: 'build', tower: 'guillotine', cell }, 1, 2_000, cfg);
    const tower = owner.towers[0]!;
    assert.throws(() => applyPvpCommand(game, 'b', { type: 'upgrade', towerId: tower.id }, 1, 2_100, cfg), /your towers/);
    applyPvpCommand(game, 'a', { type: 'upgrade', towerId: tower.id }, 2, 2_100, cfg);
    assert.equal(tower.level, 2);
    assert.equal(owner.fruts, 1000 - base.cost - pvpUpgradeCost(base.cost, 1));
    assert.ok(pvpTowerStats(base, 2).damage > base.damage);
    assert.ok(pvpTowerStats(base, 2).cooldownMs < base.cooldownMs);
    applyPvpCommand(game, 'a', { type: 'upgrade', towerId: tower.id }, 3, 2_200, cfg);
    const balance = owner.fruts;
    assert.throws(() => applyPvpCommand(game, 'a', { type: 'upgrade', towerId: tower.id }, 4, 2_300, cfg), /fully upgraded/);
    assert.equal(owner.fruts, balance);
    applyPvpCommand(game, 'a', { type: 'sell', towerId: tower.id }, 4, 2_400, cfg);
    assert.equal(owner.towers.length, 0);
    assert.equal(owner.fruts, balance + pvpSellRefund(base.cost, 3));
    assert.throws(() => applyPvpCommand(game, 'a', { type: 'sell', towerId: tower.id }, 5, 2_500, cfg), /your towers/);
    applyPvpCommand(game, 'a', { type: 'build', tower: 'guillotine', cell }, 5, 2_600, cfg);
    owner.fruts = 0;
    assert.throws(() => applyPvpCommand(game, 'a', { type: 'upgrade', towerId: owner.towers[0]!.id }, 6, 2_700, cfg), /Not enough/);
    assert.equal(owner.towers[0]!.level, 1);
  });

  it('uses upgraded damage in the authority simulation and ends a surrendered match', () => {
    for (const queue of ['ranked', 'arena'] as const) {
      const game = match(); game.queue = queue; game.status = 'active'; game.map = cfg.map; game.endsAt = 100_000;
      const defender = game.players[0]; const cell = cfg.map.pathCells[0]! + 1;
      defender.towers.push({ id: 'upgraded', type: 'guillotine', cell, placedAt: 1_000, level: 3 });
      defender.attackers.push({ id: 'brute', type: 'armored', hp: 260, progress: 0 });
      advancePvpMatch(game, 0, 2_000, cfg);
      assert.equal(defender.attackers[0]!.hp, 260 - Math.round(pvpTowerStats(cfg.towers.guillotine!, 3).damage * .55));
      applyPvpCommand(game, 'a', { type: 'surrender' }, 1, 2_100, cfg);
      assert.equal(game.status, 'complete'); assert.equal(game.winnerId, 'b');
      assert.throws(() => applyPvpCommand(game, 'a', { type: 'send', enemy: 'normal' }, 2, 2_200, cfg), /not active/);
    }
  });

  it('charges attack costs, kills attackers with towers, and damages the wall when one gets through', () => {
    const singleConfig = structuredClone(cfg); singleConfig.attacks.normal!.packSize = 1;
    const defended = match(); defended.status = 'active'; defended.map = cfg.maps[0]!; defended.endsAt = 100_000;
    const defender = defended.players[0]!;
    const nearPath = cfg.maps[0]!.pathCells[0]! + 1;
    defender.towers.push({ id: 'tower', type: 'railgun', cell: nearPath, placedAt: 1_000 });
    applyPvpCommand(defended, defended.players[1]!.userId, { type: 'send', enemy: 'normal' }, 1, 1_001, singleConfig);
    assert.equal(defended.players[1]!.fruts, cfg.startingFruts - cfg.attacks.normal!.cost);
    for (let t = 1; t <= 3; t++) advancePvpMatch(defended, 1, 1_001 + t * 1000, cfg);
    assert.equal(defender.attackers.length, 0);

    const open = match(); open.status = 'active'; open.map = cfg.maps[0]!; open.endsAt = 100_000;
    applyPvpCommand(open, open.players[1]!.userId, { type: 'send', enemy: 'normal' }, 1, 1_001, singleConfig);
    for (let t = 1; t <= cfg.maps[0]!.pathCells.length; t++) advancePvpMatch(open, 1, 1_001 + t * 1000, cfg);
    assert.equal(open.players[0]!.wallHealth, cfg.wallHealth - cfg.attacks.normal!.wallDamage);
  });

  it('sends configured staggered packs and rejects a full lane without spending', () => {
    const game = match(); game.status = 'active'; game.map = cfg.maps[0]!; game.endsAt = 100_000;
    applyPvpCommand(game, 'a', { type: 'send', enemy: 'normal' }, 1, 2_000, cfg);
    assert.equal(game.players[1].attackers.length, cfg.attacks.normal!.packSize);
    assert.ok(game.players[1].attackers[1]!.progress < game.players[1].attackers[0]!.progress);
    game.players[1].attackers = Array.from({ length: 128 }, (_, i) => ({ id: String(i), type: 'normal', hp: 100, progress: 0 }));
    const balance = game.players[0].fruts;
    assert.throws(() => applyPvpCommand(game, 'a', { type: 'send', enemy: 'normal' }, 2, 2_001, cfg), /lane is full/);
    assert.equal(game.players[0].fruts, balance);
  });

  it('starting towers defend and built towers only fire when their cooldown expires', () => {
    const game = match(); game.status = 'active'; game.map = cfg.maps[0]!; game.endsAt = 100_000;
    const defender = game.players[0];
    defender.attackers.push({ id: 'at-base', type: 'armored', hp: 260, progress: 11 });
    advancePvpMatch(game, 0, 2_000, cfg);
    assert.equal(defender.attackers[0]!.hp, 260 - Math.round(cfg.mainTower.damage * .55));
    advancePvpMatch(game, 0, 2_050, cfg);
    assert.equal(defender.attackers[0]!.hp, 260 - Math.round(cfg.mainTower.damage * .55));
    advancePvpMatch(game, 0, 3_000, cfg);
    assert.equal(defender.attackers[0]!.hp, 260 - Math.round(cfg.mainTower.damage * .55) * 2);
  });

  it('rejects slicing in both queues without changing resources, sequence, or fruit', () => {
    for (const queue of ['arena', 'ranked'] as const) {
      const game = match(); game.queue = queue; game.status = 'active'; game.map = cfg.maps[0]!; game.endsAt = 100_000;
      game.players[0].attackers.push({ id: 'incoming', type: 'normal', hp: 100, progress: 4 });
      const before = JSON.stringify(game);
      assert.throws(() => applyPvpCommand(game, 'a', { type: 'slash', from: { x: 0, y: 4 }, to: { x: 8, y: 4 } }, 1, 2_000, cfg), /Slicing is disabled/);
      assert.equal(JSON.stringify(game), before);
    }
  });

  it('gives every hero identical Rally timing and damage with server cooldown validation', () => {
    const game = match(); game.status = 'active'; game.map = cfg.map; game.endsAt = 100_000;
    game.players[0].hero = 'ki'; game.players[1].hero = 'jiju';
    assert.throws(() => applyPvpCommand(game, 'a', { type: 'rally' }, 1, 2_000, cfg), /cooling down/);
    for (const player of game.players) {
      applyPvpCommand(game, player.userId, { type: 'rally' }, 1, 20_000, cfg);
      assert.equal(player.rallyUntil, 28_000); assert.equal(player.rallyReadyAt, 55_000);
      assert.throws(() => applyPvpCommand(game, player.userId, { type: 'rally' }, 2, 20_001, cfg), /cooling down/);
      player.towers.push({ id: player.userId, type: 'guillotine', cell: cfg.map.pathCells[0]! + 1, placedAt: 1_000 });
      player.attackers.push({ id: player.userId, type: 'normal', hp: 100, progress: 0 });
    }
    advancePvpMatch(game, 0, 20_100, cfg);
    assert.equal(game.players[0].attackers[0]!.hp, 100 - Math.round(cfg.towers.guillotine!.damage * 1.25));
    assert.equal(game.players[0].attackers[0]!.hp, game.players[1].attackers[0]!.hp);
  });

  it('preserves the spacing of an intentionally sent squad', () => {
    const game = match(); game.status = 'active'; game.map = cfg.map; game.endsAt = 100_000;
    applyPvpCommand(game, 'a', { type: 'send', enemy: 'normal' }, 1, 16_000, cfg);
    const attackers = game.players[1].attackers;
    assert.equal(attackers.length, cfg.attacks.normal!.packSize);
    advancePvpMatch(game, .1, 16_100, cfg);
    assert.ok(attackers[0]!.progress > attackers[1]!.progress);
    assert.ok(attackers[1]!.progress > attackers[2]!.progress);
    assert.equal(game.players[0].attackers.length, 0);
  });

  it('awards correct FR deltas, caps performance, keeps a loss net negative, and uses configured tiers', () => {
    assert.equal(calculatePvpRating(1000, 'win', [], 0).delta, 50);
    assert.equal(calculatePvpRating(1000, 'tie', [], 0).delta, 20);
    assert.equal(calculatePvpRating(1000, 'loss', [], 0).delta, -50);
    const highBonus = calculatePvpRating(1000, 'win', [5, 10, 20, 35, 50], 5);
    assert.equal(highBonus.performance, 18);
    assert.equal(calculatePvpRating(1000, 'loss', [5, 10, 20, 35, 50], 5).delta, -32);
    assert.equal(pvpTier(499), 'Amateur'); assert.equal(pvpTier(500), 'Bronze');
    assert.equal(pvpTier(1500), 'Silver'); assert.equal(pvpTier(3000), 'Sapphire');
  });

  it('resets a monthly rating 25% toward 1000 and ends a match on its timeout tiebreak', () => {
    assert.equal(resetSeasonRating(2000), 1750);
    assert.equal(resetSeasonRating(0), 250);
    const game = match(); game.status = 'active'; game.map = cfg.maps[0]!; game.endsAt = 5_000;
    game.players[0]!.wallHealth = 400; game.players[1]!.wallHealth = 500;
    advancePvpMatch(game, 0, 5_000, cfg);
    assert.equal(game.status, 'complete'); assert.equal(game.winnerId, 'b'); assert.equal(game.resultReason, 'timeout');
  });

  it('forfeits after 45 seconds without a reconnect heartbeat', () => {
    const game = match(); game.status = 'active'; game.map = cfg.maps[0]!; game.endsAt = 100_000;
    game.players[0]!.lastSeenAt = 1_000;
    advancePvpMatch(game, 0, 46_000, cfg);
    assert.equal(game.status, 'complete'); assert.equal(game.winnerId, 'b'); assert.equal(game.resultReason, 'disconnect');
  });
});
