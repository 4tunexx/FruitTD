import type { FruitKind } from './fruits';
import { modeRules } from './modes';
import type { GameMode } from './save';

export interface SpawnItem {
  kind: FruitKind;
  boss: boolean;
}

export interface WavePlan {
  items: SpawnItem[];
  gap: number;
  hpScale: number;
  boss: boolean;
  title: string;
}

function add(items: SpawnItem[], kind: FruitKind, n: number, boss = false): void {
  for (let i = 0; i < n; i++) items.push({ kind, boss });
}

function mix(wave: number, count: number): FruitKind[] {
  const out: FruitKind[] = [];
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    if (wave >= 3 && roll < 0.07 + wave * 0.012) out.push('bomb');
    else if (wave >= 2 && roll < 0.2) out.push('watermelon');
    else if (roll < 0.36) out.push('strawberry');
    else if (roll < 0.5) out.push('orange');
    else if (roll < 0.64) out.push('banana');
    else if (roll < 0.78) out.push('pineapple');
    else if (roll < 0.9) out.push('kiwi');
    else out.push('lemon');
  }
  return out;
}

export function planWave(wave: number, mode: GameMode): WavePlan {
  const rules = modeRules(mode);
  const w = Math.max(1, wave + rules.waveOffset);
  const items: SpawnItem[] = [];
  let title = `WAVE ${wave}`;

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
    add(items, 'bomb', 2);
    add(items, 'pineapple', 2);
  } else if (w === 4) {
    add(items, 'watermelon', 2);
    add(items, 'strawberry', 4);
    add(items, 'banana', 3);
    add(items, 'bomb', 1);
  } else {
    const count = Math.min(28, 8 + w * 2);
    for (const kind of mix(w, count)) add(items, kind, 1);
  }

  const bossWave = w > 0 && w % 5 === 0;
  if (bossWave) {
    add(items, 'watermelon', 1, true);
    title = `WAVE ${wave}  ·  BOSS`;
  }

  return {
    items,
    gap: Math.max(0.28, (0.82 - w * 0.035) * rules.spawnGapMul),
    hpScale: (1 + (w - 1) * 0.2) * rules.hpMul,
    boss: bossWave,
    title,
  };
}
