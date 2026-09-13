import type { FruitKind } from './fruits';
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
    // Bombs keep their classic danger. Volatile is a separate enemy modifier
    // and can appear on normal fruit, making the decision to slice meaningful.
    out.push({ kind: fruit, boss: false, enemy });
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
    items.push(...mix(w, count));
  }

  // Special enemies are introduced gradually so early gameplay teaches the
  // normal loop before adding tower-risk targets.
  if (w >= 4) {
    const special = enemyRule('explosive');
    if (!items.some((item) => item.enemy === 'explosive')) {
      const index = Math.min(items.length - 1, Math.floor(w * 0.7));
      if (items[index]) items[index].enemy = special.kind;
    }
  }

  const bossWave = w > 0 && w % 5 === 0;
  if (bossWave) {
    add(items, 'watermelon', 1, true, w >= 10 ? 'armored' : 'normal');
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
