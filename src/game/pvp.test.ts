import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PVP_CONFIG as cfg, advancePvpMatch, applyPvpCommand, calculatePvpRating, createPvpPlayer, newPvpMatch, normalizePvpMaps, pvpTier, resetSeasonRating, vetoPvpMap } from './pvp';

describe('Arena and Ranked PvP rules', () => {
  const match = () => newPvpMatch('test', 'ranked', [createPvpPlayer('a', 'A', 'blue', cfg), createPvpPlayer('b', 'B', 'red', cfg)], 1_000, cfg);

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

  it('charges attack costs, kills attackers with towers, and damages the wall when one gets through', () => {
    const defended = match(); defended.status = 'active'; defended.map = cfg.maps[0]!; defended.endsAt = 100_000;
    const defender = defended.players[0]!;
    const nearPath = cfg.maps[0]!.pathCells[0]! + 1;
    defender.towers.push({ id: 'tower', type: 'railgun', cell: nearPath, placedAt: 1_000 });
    applyPvpCommand(defended, defended.players[1]!.userId, { type: 'send', enemy: 'normal' }, 1, 1_001, cfg);
    assert.equal(defended.players[1]!.fruts, cfg.startingFruts - cfg.attacks.normal!.cost);
    for (let t = 1; t <= 3; t++) advancePvpMatch(defended, 1, 1_001 + t * 1000, cfg);
    assert.equal(defender.attackers.length, 0);

    const open = match(); open.status = 'active'; open.map = cfg.maps[0]!; open.endsAt = 100_000;
    applyPvpCommand(open, open.players[1]!.userId, { type: 'send', enemy: 'normal' }, 1, 1_001, cfg);
    for (let t = 1; t <= cfg.maps[0]!.pathCells.length; t++) advancePvpMatch(open, 1, 1_001 + t * 1000, cfg);
    assert.equal(open.players[0]!.wallHealth, cfg.wallHealth - cfg.attacks.normal!.wallDamage);
  });

  it('only slices fruit crossed by a real battlefield stroke', () => {
    const game = match(); game.status = 'active'; game.map = cfg.maps[0]!; game.endsAt = 100_000;
    const defender = game.players[0]!;
    defender.attackers.push({ id: 'incoming', type: 'normal', hp: 100, progress: 4 });
    assert.throws(() => applyPvpCommand(game, 'a', { type: 'slash', from: { x: 0, y: 4.5 }, to: { x: 2, y: 4.5 } }, 1, 2_000, cfg), /missed/);
    assert.equal(defender.attackers.length, 1);
    assert.throws(() => applyPvpCommand(game, 'a', { type: 'slash', from: { x: -10, y: 4.5 }, to: { x: 6, y: 4.5 } }, 1, 2_001, cfg), /Invalid blade/);
    applyPvpCommand(game, 'a', { type: 'slash', from: { x: 3.2, y: 4.5 }, to: { x: 5.8, y: 4.5 } }, 1, 2_002, cfg);
    assert.equal(defender.attackers.length, 0);
    assert.equal(defender.score, 10);
    assert.throws(() => applyPvpCommand(game, 'a', { type: 'slash', from: { x: 3.2, y: 4.5 }, to: { x: 5.8, y: 4.5 } }, 1, 2_003, cfg), /replayed/);
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
