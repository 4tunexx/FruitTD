import type { FruitKind } from './fruits';
import './enemyRuntime';
import { enemyRule, specialEnemyForWave, type EnemyKind } from './enemies';
import { modeRules } from './modes';
import type { GameMode } from './save';

export interface SpawnItem {
  kind: FruitKind;
  boss: boolean;
  enemy?: EnemyKind;
}

export interface WavePlan {
  items: SpawnItem[];
  gap: number;
  hpScale: number;
  boss: boolean;
  title: string;
  subtitle?: string;
  level: number; // Current level/stage
  waveInLevel: number; // Wave within current level (1-based)
  wavesInLevel: number; // Total waves in this level
}

function add(items: SpawnItem[], kind: FruitKind, n: number, boss = false, enemy?: EnemyKind): void {
  for (let i = 0; i < n; i++) items.push({ kind, boss, enemy });
}

function mix(wave: number, count: number): SpawnItem[] {
  const out: SpawnItem[] = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    let fruit: FruitKind;
    if (wave >= 3 && roll < 0.07 + wave * 0.012) fruit = 'bomb';
    else if (wave >= 2 && roll < 0.2) fruit = 'watermelon';
    else if (roll < 0.36) fruit = 'strawberry';
    else if (roll < 0.5) fruit = 'orange';
    else if (roll < 0.64) fruit = 'banana';
    else if (roll < 0.78) fruit = 'pineapple';
    else if (roll < 0.9) fruit = 'kiwi';
    else fruit = 'lemon';

    const enemy = specialEnemyForWave(wave, Math.random());
    if (enemy === 'explosive') fruit = 'bomb';
    else if (enemy === 'armored') fruit = 'watermelon';
    else if (enemy === 'swift') fruit = 'strawberry';
    else if (enemy === 'splitter') fruit = 'pineapple';

    out.push({ kind: fruit, boss: false, enemy });
  }
  return out;
}

function planTitle(level: number, waveInLevel: number, totalWavesInLevel: number, items: SpawnItem[]): { title: string; subtitle?: string } {
  const base = `LEVEL ${level}  ·  WAVE ${waveInLevel}/${totalWavesInLevel}`;
  const specials = new Set(items.map((i) => i.enemy).filter((e): e is EnemyKind => !!e && e !== 'normal'));
  if (specials.has('explosive')) {
    return { title: base, subtitle: 'Chem-Burst inbound — cut clean' };
  }
  if (specials.has('splitter')) {
    return { title: base, subtitle: 'Pod-Spawner nest spotted' };
  }
  if (specials.has('armored')) {
    return { title: base, subtitle: 'Rind-Plate advance' };
  }
  if (specials.has('swift')) {
    return { title: base, subtitle: 'Juice-Runners on the field' };
  }
  if (waveInLevel === 1) {
    return { title: base, subtitle: 'Rot-Walkers stir in the orchard' };
  }
  return { title: base };
}

export function wavesPerLevel(level: number): number {
  return Math.max(5, level);
}

export function planWave(wave: number, mode: GameMode, level: number, waveInLevel: number, totalWavesInLevel: number): WavePlan {
  const rules = modeRules(mode);
  const w = Math.max(1, wave + rules.waveOffset);
  const items: SpawnItem[] = [];

  if (w === 1) {
    add(items, 'lemon', 4);
    add(items, 'orange', 3);
  } else if (w === 2) {
    add(items, 'lemon', 3);
    add(items, 'banana', 3);
    add(items, 'strawberry', 3);
  } else if (w === 3) {
    add(items, 'orange', 3);
    add(items, 'kiwi', 3);
    add(items, 'bomb', 2, false, 'explosive');
    add(items, 'pineapple', 2);
  } else if (w === 4) {
    add(items, 'watermelon', 2);
    add(items, 'strawberry', 4);
    add(items, 'banana', 3);
    add(items, 'bomb', 1, false, 'explosive');
  } else {
    const count = Math.min(28, 8 + w * 2);
    items.push(...mix(w, count));
  }

  if (w >= 4 && !items.some((item) => item.enemy === 'explosive')) {
    const special = enemyRule('explosive');
    const index = Math.min(items.length - 1, Math.floor(w * 0.7));
    if (items[index]) {
      items[index].enemy = special.kind;
      items[index].kind = 'bomb';
    }
  }

  const { title, subtitle } = planTitle(level, waveInLevel, totalWavesInLevel, items);

  return {
    items,
    gap: Math.max(0.28, (0.82 - w * 0.035) * rules.spawnGapMul),
    hpScale: (1 + (w - 1) * 0.2) * rules.hpMul,
    boss: false,
    title,
    subtitle,
    level,
    waveInLevel,
    wavesInLevel: totalWavesInLevel,
  };
}

export function planBossWave(wave: number, mode: GameMode, level: number): WavePlan {
  const rules = modeRules(mode);
  const w = Math.max(1, wave + rules.waveOffset);
  const items: SpawnItem[] = [];
  const wavesInLevel = wavesPerLevel(level);

  add(items, 'watermelon', 1, true, level >= 2 ? 'armored' : 'normal');

  return {
    items,
    gap: 1.2,
    hpScale: (1 + (w - 1) * 0.2) * rules.hpMul * 1.5,
    boss: true,
    title: `LEVEL ${level}  ·  OVERLORD`,
    subtitle: level >= 2 ? 'Rind-Plate overlord breaches the wall' : 'Fruit-zombie overlord approaches',
    level,
    waveInLevel: wavesInLevel + 1,
    wavesInLevel,
  };
}
