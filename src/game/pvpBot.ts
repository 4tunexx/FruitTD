import { applyPvpCommand, fruitOnSlash, type PvpCommand, type PvpConfig, type PvpMatch } from './pvp';

/** Runs the test opponent through the same validated commands as a human player. */
export function choosePvpBotCommand(match: PvpMatch, botUserId: string, config: PvpConfig): PvpCommand | null {
  if (match.status !== 'active' || !match.map) return null;
  const bot = match.players.find((player) => player.userId === botUserId);
  if (!bot || match.players.length !== 2) return null;
  const map = match.map;
  const fruit = bot.attackers.find((item) => item.progress >= 0.25 && item.progress < map.pathCells.length - 1);
  if (fruit) {
    const cell = map.pathCells[Math.floor(fruit.progress)]!;
    const x = cell % map.width + 0.5;
    const y = Math.floor(cell / map.width) + 0.5;
    const from = { x: Math.max(0, x - 0.85), y };
    const to = { x: Math.min(map.width, x + 0.85), y };
    if (fruitOnSlash(cell, map.width, from, to)) return { type: 'slash', from, to };
  }
  const availableTowers = Object.entries(config.towers).filter(([, stats]) => bot.fruts >= stats.cost);
  if (bot.towers.length < 5 && availableTowers.length && (bot.towers.length === 0 || bot.attackers.length > bot.towers.length)) {
    const [type] = availableTowers[Math.min(bot.towers.length, availableTowers.length - 1)]!;
    const cells = map.buildCells.filter((cell) => !bot.towers.some((tower) => tower.cell === cell));
    const middle = map.pathCells.slice(Math.floor(map.pathCells.length * 0.25), Math.ceil(map.pathCells.length * 0.8));
    cells.sort((a, b) => {
      const distance = (cell: number) => Math.min(...middle.map((pathCell) => Math.abs(cell % map.width - pathCell % map.width) + Math.abs(Math.floor(cell / map.width) - Math.floor(pathCell / map.width))));
      return distance(a) - distance(b) || Math.abs(Math.floor(a / map.width) - map.height * 0.55) - Math.abs(Math.floor(b / map.width) - map.height * 0.55);
    });
    if (cells.length) return { type: 'build', tower: type, cell: cells[0]! };
  }
  const attacks = Object.entries(config.attacks).filter(([, stats]) => bot.fruts >= stats.cost);
  if (attacks.length) {
    const index = Math.min(Math.floor(bot.sequence / 3) % attacks.length, attacks.length - 1);
    return { type: 'send', enemy: attacks[index]![0] };
  }
  return null;
}

export function playPvpBotTurn(match: PvpMatch, botUserId: string, now: number, config: PvpConfig): boolean {
  const bot = match.players.find((player) => player.userId === botUserId);
  if (!bot || match.status !== 'active') return false;
  bot.connected = true;
  bot.disconnectedAt = null;
  bot.lastSeenAt = now;
  const command = choosePvpBotCommand(match, botUserId, config);
  if (!command) return false;
  applyPvpCommand(match, botUserId, command, bot.sequence + 1, now, config);
  return true;
}
