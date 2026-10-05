import { it } from 'node:test';
import assert from 'node:assert/strict';
import { pvpCanMatch, pvpSearchRange } from './pvpMatchmaking';
import { calculateArenaRating } from './pvp';
const player = (userId: string, points: number, createdAt = 0) => ({ userId, points, createdAt, queue: 'ranked' as const });
it('only pairs nearby ratings, same queues, and bounded tiers even after long waits', () => {
  assert.equal(pvpCanMatch(player('a', 1000), player('b', 1080), 1000), true);
  assert.equal(pvpCanMatch(player('a', 1000), player('b', 1200), 1000), false);
  assert.equal(pvpCanMatch(player('a', 1000), player('b', 1200), 30000), true);
  assert.equal(pvpCanMatch(player('a', 1480), player('b', 1520), 1000), false);
  assert.equal(pvpCanMatch(player('a', 1480), player('b', 1520), 30000), true);
  assert.equal(pvpCanMatch(player('a', 1000), player('b', 2500), 900000), false);
  assert.equal(pvpCanMatch(player('a', 1000), player('a', 1000), 1000), false);
  assert.equal(pvpCanMatch(player('a', 1000), { ...player('b', 1000), queue: 'arena' }, 1000), false);
  assert.equal(pvpCanMatch(player('a', 1000), player('b', NaN), 1000), false);
  assert.equal(pvpSearchRange(player('a', 1000), 900000), 300);
});
it('uses opponent strength for ranked gains and losses, with no slice bonuses', () => {
  assert.equal(calculateArenaRating(1000, 1000, 'win').delta, 50);
  assert.equal(calculateArenaRating(1000, 1000, 'loss').delta, -50);
  assert.equal(calculateArenaRating(1000, 1000, 'tie').delta, 0);
  assert.ok(calculateArenaRating(1000, 1200, 'win').delta > 50);
  assert.ok(calculateArenaRating(1000, 1200, 'loss').delta > -50);
  assert.ok(calculateArenaRating(1000, 800, 'win').delta < 50);
});

it('equal walls draw even when kill counts differ, and simultaneous wall defeats draw', async () => {
  const { DEFAULT_PVP_CONFIG: config, newPvpMatch, createPvpPlayer, advancePvpMatch } = await import('./pvp');
  for (const health of [1000, 0]) {
    const game = newPvpMatch('draw', 'ranked', [createPvpPlayer('a', 'A', 'blue', config, 0), createPvpPlayer('b', 'B', 'red', config, 0)], 0, config);
    game.status = 'active'; game.map = config.map; game.endsAt = 2000;
    game.players.forEach(player => { player.wallHealth = health; }); game.players[0].score = 1000;
    advancePvpMatch(game, 0, 2000, config);
    assert.equal(game.status, 'complete'); assert.equal(game.winnerId, null);
  }
});

it('turret counters distinguish armor piercing, splash, and slow instead of raw damage only', async () => {
  const { DEFAULT_PVP_CONFIG: config, newPvpMatch, createPvpPlayer, advancePvpMatch } = await import('./pvp');
  const simulate = (type: string, elapsed = 0) => {
    const game = newPvpMatch(type, 'arena', [createPvpPlayer('a', 'A', 'blue', config, 0), createPvpPlayer('b', 'B', 'red', config, 0)], 0, config);
    game.status = 'active'; game.map = config.map; game.endsAt = 100000;
    const player = game.players[0]; const cell = config.map.pathCells[0]! + 1;
    player.towers.push({ id: type, type, cell, placedAt: 0 });
    player.attackers.push({ id: 'armor', type: 'armored', hp: 260, progress: 0 }, { id: 'normal', type: 'normal', hp: 100, progress: 0 });
    advancePvpMatch(game, elapsed, 3000, config); return player.attackers;
  };
  assert.equal(simulate('guillotine')[0]!.hp, 260 - Math.round(config.towers.guillotine!.damage * .55));
  assert.equal(simulate('laser')[0]!.hp, 260 - config.towers.laser!.damage);
  assert.ok(simulate('sprinkler')[1]!.hp < 100);
  assert.ok(simulate('vortex', 1)[0]!.progress < simulate('guillotine', 1)[0]!.progress);
});
