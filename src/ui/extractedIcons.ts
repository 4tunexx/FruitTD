/** Individual transparent crops from the three icon sheets supplied for FruitTD. */
const groups: Record<string, number[]> = {
  rune: Array(11).fill(6),
  creative: Array(10).fill(10),
  skill: [10, 10, 10],
  hero: [10],
  quest: [9],
  mode: [5],
  misc: [5, 12],
  stat: [9, 9],
  emote: [10, 10, 5],
  lobby: [12],
  weapon: [13],
  core: [8],
};

export const EXTRACTED_ICON_IDS = Object.entries(groups).flatMap(([sheet, rows]) =>
  rows.flatMap((count, row) => Array.from({ length: count }, (_, col) =>
    `${sheet}-${String(row + 1).padStart(2, '0')}-${String(col + 1).padStart(2, '0')}`)));
const knownIds = new Set(EXTRACTED_ICON_IDS);

export const ICON_ASSETS: Record<string, string> = {
  Shield: 'skill-01-10', ShieldCheck: 'hero-01-02', Castle: 'lobby-01-07',
  TowerControl: 'rune-08-01', Landmark: 'lobby-01-07',
  Swords: 'lobby-01-11', Sword: 'weapon-01-02', Scissors: 'weapon-01-02', Slice: 'weapon-01-02',
  Target: 'rune-03-03', ScanLine: 'creative-10-01', CircleDot: 'rune-03-03',
  Apple: 'creative-09-07',
  Zap: 'misc-02-12', Sparkles: 'creative-02-09', Leaf: 'creative-03-10', Flame: 'creative-04-04',
  Droplets: 'creative-10-09', Tornado: 'creative-04-03', Waves: 'rune-11-01',
  Coins: 'lobby-01-09', Gem: 'creative-07-01', Diamond: 'creative-07-01', Crown: 'lobby-01-04',
  Backpack: 'lobby-01-10', ShoppingBag: 'lobby-01-10', ShoppingCart: 'lobby-01-10',
  Map: 'quest-01-03', ScrollText: 'lobby-01-08',
  Trophy: 'stat-01-01', Medal: 'creative-05-09', Hammer: 'creative-05-07', Bomb: 'creative-02-04',
  Gift: 'creative-09-08', Skull: 'creative-03-07', LockKeyhole: 'creative-06-01',
  Heart: 'creative-06-10', ChevronRight: 'misc-02-09', ChevronsUp: 'misc-02-06',
  ArrowUpCircle: 'misc-02-06', ChartNoAxesCombined: 'stat-02-01', Gauge: 'stat-02-01',
  UserRound: 'lobby-01-03', User: 'lobby-01-03',
};

export function extractedIcon(id: string, className = '', size = 20): HTMLElement {
  const safeId = knownIds.has(id) ? id : 'rune-01-01';
  const path = `/assets/icons/extracted/${safeId}.png`;
  const frame = document.createElement('span');
  frame.className = `ftd-extracted-icon ftd-game-glyph ${className}`.trim();
  frame.style.width = `${size}px`;
  frame.style.height = `${size}px`;
  frame.setAttribute('aria-hidden', 'true');
  if (safeId.startsWith('core-')) {
    const img = document.createElement('img');
    img.className = 'ftd-asset-glyph ftd-asset-glyph--core';
    img.src = path;
    img.alt = '';
    frame.appendChild(img);
    return frame;
  }
  const icon = document.createElement('span');
  icon.className = 'ftd-asset-glyph';
  icon.style.maskImage = `url("${path}")`;
  icon.style.setProperty('-webkit-mask-image', `url("${path}")`);
  frame.appendChild(icon);
  return frame;
}
