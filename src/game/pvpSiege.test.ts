import { it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PVP_CONFIG as config, createPvpPlayer, newPvpMatch, applyPvpCommand, advancePvpMatch, pvpHexDistance, pvpMainUpgradeCost, pvpReleaseCost, pvpTowerStats } from './pvp';
function active(map = config.map) {
  const game = newPvpMatch('siege', 'arena', [createPvpPlayer('a', 'A', 'blue', config, 0), createPvpPlayer('b', 'B', 'red', config, 0)], 0, config);
  game.status = 'active'; game.map = map; game.endsAt = 180000;
  return game;
}
const act = (game: ReturnType<typeof active>, userId: string, command: Parameters<typeof applyPvpCommand>[2], now = 2000) => applyPvpCommand(game, userId, command, game.players.find(p => p.userId === userId)!.sequence + 1, now, config);
it('main upgrades spend match Fruts, improve damage/health, and cannot exceed level three or replay', () => {
  const game = active(); const player = game.players[0];
  assert.throws(() => act(game, 'a', { type: 'upgrade-main' }), /Not enough/);
  player.fruts = 1000; player.wallHealth = 700;
  act(game, 'a', { type: 'upgrade-main' });
  assert.equal(player.fruts, 1000 - pvpMainUpgradeCost(1)); assert.equal(player.mainLevel, 2);
  assert.equal(player.wallHealth, 950); assert.equal(player.wallMaxHealth, 1250);
  assert.throws(() => applyPvpCommand(game, 'a', { type: 'upgrade-main' }, 1, 2100, config), /replayed/);
  act(game, 'a', { type: 'upgrade-main' }); assert.equal(player.mainLevel, 3); assert.equal(player.wallMaxHealth, 1500);
  const remaining = player.fruts; assert.throws(() => act(game, 'a', { type: 'upgrade-main' }), /fully upgraded/); assert.equal(player.fruts, remaining);
  player.attackers.push({ id: 'base', type: 'normal', hp: 100, progress: config.map.pathCells.length - 2 });
  advancePvpMatch(game, 0, 5000, config);
  assert.equal(player.attackers[0]!.hp, 100 - pvpTowerStats({ cost: 0, ...config.mainTower }, 3).damage);
});
it('Catcher stores weakened zombies without bounties; paid release sends one unit and cannot be replayed or recaptured', () => {
  const game = active(); const player = game.players[0]; const pathCell = config.map.pathCells[0]!;
  const cell = config.map.buildCells.find(cell => pvpHexDistance(cell, pathCell, config.map.width) <= 1)!;
  act(game, 'a', { type: 'build', tower: 'catcher', cell });
  player.attackers.push({ id: 'wounded', type: 'normal', hp: 25, progress: 0 });
  const before = player.fruts; advancePvpMatch(game, 0, 4000, config);
  assert.equal(player.attackers.length, 0); assert.equal(player.captured!.length, 1); assert.equal(player.fruts, before); assert.equal(player.score, 0);
  const captive = player.captured![0]!; act(game, 'a', { type: 'release', capturedId: captive.id }, 4100);
  assert.equal(player.fruts, before - pvpReleaseCost(config.attacks.normal!.cost)); assert.equal(player.captured!.length, 0);
  assert.equal(game.players[1].attackers.length, 1); assert.equal(game.players[1].attackers[0]!.released, true);
  assert.throws(() => act(game, 'a', { type: 'release', capturedId: captive.id }, 4200), /captured/);
  assert.throws(() => act(game, 'b', { type: 'release', capturedId: captive.id }, 4200), /captured/);
  const rival = game.players[1]; rival.towers.push({ id: 'cage', type: 'catcher', cell, level: 3, placedAt: 0 }); rival.attackers[0]!.hp = 25;
  advancePvpMatch(game, 0, 6000, config); assert.equal(rival.captured!.length, 0); assert.equal(rival.attackers[0]!.hp, 25 - pvpTowerStats(config.towers.catcher!, 3).damage);
});
it('capture capacity, full attack lanes, insufficient funds, and stronger capture upgrades are enforced', () => {
  const game = active(); const player = game.players[0]; const pathCell = config.map.pathCells[0]!;
  const cell = config.map.buildCells.find(cell => pvpHexDistance(cell, pathCell, config.map.width) <= 1)!;
  player.towers.push({ id: 'cage', type: 'catcher', cell, placedAt: 0, level: 3 });
  player.captured = Array.from({ length: 3 }, (_, i) => ({ id: `stored:${i}`, type: 'armored' }));
  player.attackers.push({ id: 'weak', type: 'normal', hp: 45, progress: 0 });
  advancePvpMatch(game, 0, 4000, config); assert.equal(player.captured.length, 3); assert.equal(player.attackers.length, 1);
  player.fruts = 0; assert.throws(() => act(game, 'a', { type: 'release', capturedId: 'stored:0' }, 4100), /Not enough/);
  player.fruts = 100; game.players[1].attackers = Array.from({ length: 128 }, (_, i) => ({ id: String(i), type: 'normal', hp: 100, progress: 0 }));
  assert.throws(() => act(game, 'a', { type: 'release', capturedId: 'stored:0' }, 4100), /lane is full/); assert.equal(player.fruts, 100); assert.equal(player.captured.length, 3);
  game.players[1].attackers = []; act(game, 'a', { type: 'release', capturedId: 'stored:0' }, 4100);
  player.attackers[0]!.hp = 45; advancePvpMatch(game, 0, 6000, config);
  assert.equal(player.captured.length, 3); assert.equal(player.attackers.length, 0, 'LV3 can capture a zombie below 50% health');
  player.captured = []; player.attackers.push({ id: 'grown-wave', type: 'normal', hp: 90, maxHp: 200, progress: 0 });
  advancePvpMatch(game, 0, 9000, config); assert.equal(player.captured.length, 1, 'capture thresholds use actual maximum health for growing waves');
});
it('building a larger full-health main tower alone cannot win a percentage-health timeout', () => {
  const game = active(); game.players[0].fruts = 1000; act(game, 'a', { type: 'upgrade-main' });
  game.endsAt = 3000; advancePvpMatch(game, 0, 3000, config); assert.equal(game.winnerId, null);
});
it('mirrored strategies are symmetric on all maps; sending fruit can defeat an undefended opponent', () => {
  for (const map of config.maps) for (const mirrored of [true, false]) {
    const game = active(map); game.nextWaveAt = 15000;
    for (let time = 500; time <= 180000 && game.status === 'active'; time += 500) {
      game.players.forEach(player => { player.lastSeenAt = time; });
      for (const player of mirrored ? game.players : [game.players[0]]) {
        if (time % 1000 === 0 && player.fruts >= config.attacks.normal!.cost) act(game, player.userId, { type: 'send', enemy: 'normal' }, time);
      }
      advancePvpMatch(game, .5, time, config);
    }
    assert.equal(game.status, 'complete', map.id);
    assert.equal(game.winnerId, mirrored ? null : 'a', `${map.id}: copied actions must not favor either side`);
    assert.ok(game.players.every(player => player.fruts >= 0));
  }
});
