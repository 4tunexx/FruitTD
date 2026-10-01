import type { FruitKind } from './fruits';
import { enemyRule, specialEnemyForWave, type EnemyKind } from './enemies';
import { modeRules } from './modes';
import { campaignWaves } from './campaign';
import type { GameMode } from './save';
import {
  authoredWavesPerLevel,
  getLiveWavesConfig,
  loadCreatorWavesStore,
  tryAuthoredPlanBossWave,
  tryAuthoredPlanWave,
  type WaveOverrideSources,
} from './creatorWaves';

export interface SpawnItem {
  kind: FruitKind;
  boss: boolean;
  enemy?: EnemyKind;
  bossStage?: number;
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
    // A linear, unbounded chance made every ordinary roll a bomb after wave
    // 78. Special Chem-Bursts are added separately, so keep base hazards rare
    // even in endless Horde and preserve a readable mix of slice targets.
    if (wave >= 3 && roll < Math.min(0.18, 0.07 + wave * 0.012)) fruit = 'bomb';
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

/** Later waves continue to harden, but no longer gain 20% base HP forever. */
function pressureHpScale(wave: number): number {
  const completed = Math.max(0, wave - 1);
  return 1 + Math.min(completed, 20) * 0.2 + Math.max(0, completed - 20) * 0.035;
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

function overrideSources(): WaveOverrideSources {
  let creator: WaveOverrideSources['creator'] = null;
  try {
    creator = loadCreatorWavesStore();
  } catch {
    creator = null;
  }
  return { creator, live: getLiveWavesConfig() };
}

export function wavesPerLevel(level: number, mode?: GameMode): number {
  if (mode === 'campaign') return campaignWaves(level);
  if (mode === 'horde') return 5;
  return authoredWavesPerLevel(level, overrideSources(), (lvl) => Math.max(5, lvl));
}

export function planWave(wave: number, mode: GameMode, level: number, waveInLevel: number, totalWavesInLevel: number): WavePlan {
  const authored = tryAuthoredPlanWave(wave, mode, level, waveInLevel, totalWavesInLevel, overrideSources());
  if (authored) return mode === 'horde'
    ? { ...authored, boss: false, items: authored.items.map((item) => ({ ...item, boss: false, bossStage: undefined })) }
    : authored;

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
    gap: Math.max(0.22, (0.82 - w * 0.035) * rules.spawnGapMul * (mode === 'campaign' ? Math.max(0.72, 1 - (level - 1) * 0.002) : 1)),
    hpScale: pressureHpScale(w) * rules.hpMul * (mode === 'campaign' ? Math.min(2.5, 1 + (level - 1) * 0.015) : 1),
    boss: false,
    title,
    subtitle,
    level,
    waveInLevel,
    wavesInLevel: totalWavesInLevel,
  };
}

export function planBossWave(wave: number, mode: GameMode, level: number, configuredDifficulty?: number): WavePlan {
  const authored = tryAuthoredPlanBossWave(wave, mode, level, overrideSources());
  if (authored) return authored;

  const rules = modeRules(mode);
  const w = Math.max(1, wave + rules.waveOffset);
  const items: SpawnItem[] = [];
  const wavesInLevel = wavesPerLevel(level, mode);

  add(items, 'watermelon', 1, true, level >= 2 ? 'armored' : 'normal');
  items[0].bossStage = mode === 'campaign' ? level : undefined;

  return {
    items,
    gap: 1.2,
    hpScale: mode === 'campaign'
      ? rules.hpMul * 1.5 * Math.min(8, Math.max(1, configuredDifficulty ?? 1 + (level - 1) * 0.075))
      : pressureHpScale(w) * rules.hpMul * 1.5,
    boss: true,
    title: `LEVEL ${level}  ·  OVERLORD`,
    subtitle: level >= 2 ? 'Rind-Plate overlord breaches the wall' : 'Fruit-zombie overlord approaches',
    level,
    waveInLevel: wavesInLevel + 1,
    wavesInLevel,
  };
}
