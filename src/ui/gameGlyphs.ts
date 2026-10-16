import type { IconNode } from 'lucide';

// Original, solid game glyphs drawn on a 24px grid. The supplied sheets guide
// their bold silhouette, while these vectors stay sharp in every HUD size.
const solid = (d: string): IconNode => [['path', { d, fill: 'currentColor', stroke: 'none' }]];
const marks = (d: string, detail: string): IconNode => [
  ['path', { d, fill: 'currentColor', stroke: 'none' }],
  ['path', { d: detail, fill: 'none', stroke: 'var(--glyph-cut, #16181b)', 'stroke-width': '1.6', 'stroke-linecap': 'square' }],
];

const shield = marks('M12 1 21 5v6c0 5.2-3.3 9.3-9 12-5.7-2.7-9-6.8-9-12V5z', 'M12 4v15M6 8h12');
const sword = solid('m3 21 3-5 3 3-5 3zm4-6 9-11 4-1-1 4-11 9zm10-1 2-2 4 4-2 2z');
const target = marks('M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', 'M12 1v6m0 10v6M1 12h6m10 0h6');
const tower = marks('M4 22V9h3V4h3v5h4V4h3v5h3v13zm6-8h4v8h-4z', 'M4 12h16');
const citrus = marks('M12 3c5.8 0 10 4 10 9s-4.2 9-10 9S2 17 2 12s4.2-9 10-9z', 'M12 4v16M4 12h16M6 6l12 12M18 6 6 18');
const bolt = solid('M13 1 3 14h7l-1 9 12-14h-8l3-8z');
const spark = solid('m12 1 2.1 7.9L22 11l-7.9 2.1L12 21l-2.1-7.9L2 11l7.9-2.1zm8 17 .7 2.3L23 21l-2.3.7L20 24l-.7-2.3L17 21l2.3-.7z');
const leaf = solid('M21 2C9 3 2 8 2 16c0 3.6 2.6 6 6 6 8 0 13-7 13-20zM5 19c3-5 7-8 12-11-3 4-6 7-12 11z');
const coin = marks('M12 1 21 5v14l-9 4-9-4V5zm0 4-5 2v10l5 2 5-2V7z', 'M12 7v10m-3-8h5m-5 6h5');
const gem = marks('m7 2 10 0 6 7-11 13L1 9z', 'M1 9h22M7 2l5 20L17 2');
const crown = solid('M2 7 7 11l5-8 5 8 5-4-2 13H4z');
const bag = marks('M4 8h16l2 14H2zm4 0V5a4 4 0 0 1 8 0v3z', 'M8 12v3m8-3v3');
const map = marks('m2 5 7-3 6 3 7-3v17l-7 3-6-3-7 3z', 'M9 2v17m6-14v17');
const people = solid('M8 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm8 1a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM1 20v-3a7 7 0 0 1 14 0v3zm15 0v-3a9 9 0 0 0-2-5 6 6 0 0 1 9 5v3z');
const trophy = marks('M6 2h12v4h4v4c0 3-2 5-6 5-.7 2-1.5 3-3 3v2h5v3H6v-3h5v-2c-1.5 0-2.3-1-3-3-4 0-6-2-6-5V6h4z', 'M6 9H4m14 0h2');
const fruit = marks('M11 7c-4-3-9 0-9 6 0 5 3 9 7 9 2 0 2-1 3-1s1 1 3 1c4 0 7-4 7-9 0-6-5-9-9-6zM12 8c0-3 2-5 5-6', 'M12 8c-1 1-2 1-4 0');
const hammer = solid('M3 3h12l5 5-5 5-3-3-7 11-3-3 7-11-3-1z');
const flame = solid('M12 1c1 5-3 6-2 10 2-1 3-3 4-5 5 5 7 9 7 12a9 9 0 0 1-18 0c0-5 4-8 9-17zm0 12c-2 3-4 5-4 7a4 4 0 0 0 8 0c0-2-1-4-4-7z');
const pause = solid('M4 3h6v18H4zm10 0h6v18h-6z');
const play = solid('m5 2 17 10L5 22z');
const plus = solid('M9 2h6v7h7v6h-7v7H9v-7H2V9h7z');
const gift = marks('M3 9h18v13H3zM1 5h22v5H1z', 'M12 5v17');
const skull = marks('M12 2C6 2 3 6 3 12c0 3 2 5 4 6v4h10v-4c2-1 4-3 4-6 0-6-3-10-9-10z', 'M7 12h3m4 0h3m-5 3v2');
const lock = marks('M4 10h16v12H4zM7 10V7a5 5 0 0 1 10 0v3', 'M12 14v4');
const book = marks('M3 3h8l2 3 2-3h6v18h-8l-1 2-2-2H3z', 'M12 6v15');
const droplets = solid('M7 2c2 4 5 7 5 11a5 5 0 0 1-10 0C2 9 5 6 7 2zm10 7c2 3 5 6 5 9a4 4 0 0 1-8 0c0-3 1-6 3-9z');
const vortex = solid('M12 2c7 0 11 5 10 10-1 6-7 10-13 8-4-1-7-5-6-9 1-4 5-6 9-5 3 1 4 3 3 5-1 2-3 3-5 2 1 2 4 3 6 1 4-3 2-8-4-8-5 0-8 3-9 7C1 7 5 2 12 2z');
const wave = solid('M2 5c3-3 6-3 9 0s6 3 11 0v4c-5 3-8 3-11 0S5 6 2 9zm0 7c3-3 6-3 9 0s6 3 11 0v4c-5 3-8 3-11 0s-6-3-9 0zm0 7c3-3 6-3 9 0s6 3 11 0v4c-5 3-8 3-11 0s-6-3-9 0z');
const heart = solid('M12 22 2 12C-2 7 3 1 8 4l4 3 4-3c5-3 10 3 6 8z');
const arrow = solid('M2 10h13l-4-5 3-3 8 10-8 10-3-3 4-5H2z');
const arrowLeft = solid('M22 10H9l4-5-3-3-8 10 8 10 3-3-4-5h13z');
const chevrons = solid('m12 2 9 9-3 3-6-6-6 6-3-3zm0 8 9 9-3 3-6-6-6 6-3-3z');
const gear = marks('M10 1h4l1 3 3 1 3-1 2 4-2 2v4l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-4L1 8l2-4 3 1 3-1z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z');
const bell = marks('M12 2c-4 0-7 3-7 8v5l-3 4h20l-3-4v-5c0-5-3-8-7-8zM9 20h6c0 4-6 4-6 0z', 'M5 16h14');
const mail = marks('M2 4h20v16H2z', 'm3 6 9 8 9-8');
const chart = marks('M3 21V3h18v18z', 'M6 17l4-5 3 2 5-7');
const clock = marks('M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22z', 'M12 5v7l4 3');
const check = solid('m2 12 4-4 4 4L19 3l4 4-13 14z');
const cross = solid('m5 2 7 7 7-7 3 3-7 7 7 7-3 3-7-7-7 7-3-3 7-7-7-7z');
const ellipsis = solid('M2 9h5v6H2zm7 0h6v6H9zm8 0h5v6h-5z');

export const GAME_GLYPHS: Record<string, IconNode> = {
  Shield: shield, ShieldCheck: shield, Castle: tower, TowerControl: tower, Landmark: tower,
  Swords: [ ...sword, ['path', { d: 'M21 21 3 3', stroke: 'currentColor', 'stroke-width': '3' }] ],
  Sword: sword, Scissors: sword, Slice: sword,
  Target: target, ScanLine: target, CircleDot: target,
  Citrus: citrus, Apple: fruit, Cherry: fruit, Banana: fruit,
  Zap: bolt, Sparkles: spark, Leaf: leaf, Flame: flame, Droplets: droplets, Tornado: vortex, Waves: wave,
  Coins: coin, Gem: gem, Diamond: gem, Crown: crown, Backpack: bag, ShoppingBag: bag, ShoppingCart: bag,
  Map: map, ScrollText: book, Users: people, UsersRound: people, UserRound: people, User: people,
  Trophy: trophy, Medal: trophy, Hammer: hammer, Bomb: flame,
  Pause: pause, Play: play, Plus: plus, Gift: gift, Skull: skull, LockKeyhole: lock,
  Heart: heart, ChevronRight: arrow, ArrowLeft: arrowLeft, ChevronsUp: chevrons, ArrowUpCircle: chevrons,
  Settings: gear, Bell: bell, Mail: mail, MessageCircle: mail, Ellipsis: ellipsis, ChartNoAxesCombined: chart, Gauge: clock,
  BadgeCheck: check, CalendarCheck: check, X: cross,
};
