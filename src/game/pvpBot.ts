import { applyPvpCommand, pvpUpgradeCost, pvpTowerLevel, pvpReleaseCost, pvpMainUpgradeCost, type PvpCommand, type PvpConfig, type PvpMatch } from './pvp';

/** Runs the test opponent through the same validated commands as a human player. */
export function choosePvpBotCommand(match: PvpMatch, botUserId: string, config: PvpConfig, now = match.createdAt): PvpCommand | null {
  if (match.status !== 'active' || !match.map) return null;
  const bot = match.players.find((player) => player.userId === botUserId);
  if (!bot || match.players.length !== 2) return null;
  const map = match.map;
  if (bot.attackers.length >= 3 && now >= (bot.rallyReadyAt ?? match.createdAt + 15000)) return { type: 'rally' };
  const captured = bot.captured?.find(item => bot.fruts >= pvpReleaseCost(config.attacks[item.type]!.cost));
  if (captured) return { type: 'release', capturedId: captured.id };
  if (bot.towers.length && pvpTowerLevel(bot.mainLevel) < 3 && bot.wallHealth / (bot.wallMaxHealth ?? config.wallHealth) < .75 && bot.fruts >= pvpMainUpgradeCost(bot.mainLevel)) return { type: 'upgrade-main' };
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
  const upgrade = bot.towers.find(tower => pvpTowerLevel(tower.level) < 3 && bot.fruts >= pvpUpgradeCost(config.towers[tower.type]!.cost, pvpTowerLevel(tower.level)));
  if (upgrade && bot.attackers.length >= 2) return { type: 'upgrade', towerId: upgrade.id };
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
  const command = choosePvpBotCommand(match, botUserId, config, now);
  if (!command) return false;
  applyPvpCommand(match, botUserId, command, bot.sequence + 1, now, config);
  return true;
}
