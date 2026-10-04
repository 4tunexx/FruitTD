import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PVP_CONFIG as config, createPvpPlayer, newPvpMatch } from './pvp';
import { choosePvpBotCommand, playPvpBotTurn } from './pvpBot';

describe('admin PvP bot', () => {
  const match = () => {
    const game = newPvpMatch('bot-test', 'arena', [createPvpPlayer('human', 'Human', 'blue', config, 1_000), createPvpPlayer('bot', 'Bot', 'red', config, 1_000)], 1_000, config);
    game.status = 'active'; game.map = config.maps[0]!; game.endsAt = 200_000;
    return game;
  };

  it('builds, sends real fruit, and uses validated command sequences', () => {
    const game = match();
    assert.equal(choosePvpBotCommand(game, 'bot', config)?.type, 'build');
    assert.equal(playPvpBotTurn(game, 'bot', 2_000, config), true);
    assert.equal(game.players[1]!.sequence, 1);
    assert.equal(game.players[1]!.towers.length, 1);
    assert.ok(game.map!.buildCells.includes(game.players[1]!.towers[0]!.cell));
    const command = choosePvpBotCommand(game, 'bot', config);
    assert.equal(command?.type, 'send');
    playPvpBotTurn(game, 'bot', 3_000, config);
    assert.equal(game.players[0]!.attackers.length, config.attacks.normal!.packSize);
    assert.equal(game.players[1]!.sequence, 2);
  });

  it('slices only incoming fruit on its own lane', () => {
    const game = match();
    game.players[1]!.attackers.push({ id: 'fruit', type: 'normal', hp: 100, progress: 3 });
    assert.equal(choosePvpBotCommand(game, 'bot', config)?.type, 'slash');
    playPvpBotTurn(game, 'bot', 2_000, config);
    assert.equal(game.players[1]!.attackers.length, 0);
    assert.equal(game.players[1]!.score, 10);
  });

  it('stops when the match ends', () => {
    const game = match(); game.status = 'complete';
    assert.equal(playPvpBotTurn(game, 'bot', 2_000, config), false);
  });
});
