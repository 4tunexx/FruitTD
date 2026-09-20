import { Vector3 } from 'three';
import './style.css';
import { Sfx } from './audio/sfx';
import { GameLoop } from './engine/loop';
import { GameRenderer } from './engine/renderer';
import { fruitAtlas } from './game/atlas';
import { Field } from './game/field';
import { FRUIT_DEFS, FruitField, fruitFamily, type Fruit } from './game/fruits';
import { HEROES, MAX_HERO_LEVEL, heroDef, heroHitRadius, heroSlashDamage, heroXpToLevel, type HeroId } from './game/heroes';
import { JuiceBank, JuiceSystem, juiceHueFromKind } from './game/juice';
import { WALL_SKINS, defaultAvatar, loadSave, writeSave, mergeSaves, type GameMode, type SaveData } from './game/save';
import { findSlicer, hexToNumber } from './game/slicers';
import { SKILLS, type SkillId } from './game/skills';
import { SlashFx } from './game/slashfx';
import { strokeHitsFruit, strokeHitsHalf, SliceDebris } from './game/slicer';
import { modeRules } from './game/modes';
import { chargeSuper, createState, damageTower, isPerfectWave, leakCost, resetState, toast } from './game/state';
import {
  applyRewards,
  calculateReward,
  comboTiersBetween,
  type ProgressionResult,
  type RewardEvent,
} from './game/progression';
import { currentRewardModifiers } from './game/progression/modifiers';
import type { ComboResetReason } from './game/progression/combo';
import { getEnabledSlicers, getLiveConfig, getSlicers, loadLiveConfig } from './services/liveConfig';
import { planWave, planBossWave, wavesPerLevel } from './game/waves';
import { BladeTrail } from './game/trail';
import { canPlaceTurret, turretDef, type TurretKind } from './game/turrets';
import { WallBase } from './game/wall';
import { MAIN_INDEX, MAX_TOWER_LEVEL, PADS, slotIndexAt, upgradeCost } from './game/world';
import { BladeInput, MIN_SLICE_SPEED, type Slash } from './input/blade';
import { ComboFx, setComboFocusHandler } from './ui/combos';
import { floatingScore } from './ui/floatingScore';
import { Hud } from './ui/hud';
import { submitScore, syncCloudSave, fetchCloudSave } from './services/api';
import { initAchievementsCache } from './services/achievements';
import { reportGameEvent } from './services/progress';
import { getCachedSteamState } from './services/steam';
import type { GameEvent } from './game/requirements';
import { enemyRule } from './game/enemies';
import { getTowerXpState } from './game/towerProgression';
import { getTowerMilestoneBonuses } from './game/towerMilestones';
import { navigation } from './game/navigation';
import { canEquipHero, purchaseHeroAtomic } from './game/progression/heroStatus';
import { heroCombatPerkMultiplier } from './game/heroPerkSave';
import { vipTierPrice, vipTierPurchaseCoins } from './game/vipBonuses';
import { installHudToggles } from './ui/hudToggle';
import { updateTowerChip } from './ui/towerChip';
import { installGameScreens, refreshCurrentScreen } from './ui/screens';
import { canSellItem } from './game/catalog';
import { initThemeSystem } from './ui/theme';
import { installDesignMode } from './ui/design/designMode';
import {
  BOSS_OVERLORD_STUDIO_KEY,
  bossStudioKey,
  fireStudioEvent,
  setStudioFxCallbacks,
} from './game/studioRuntime';
import { fireCreatorSlicerVfx, setCreatorVfxCallbacks } from './game/creatorVfx';

// Theme + layout must be applied before any UI renders.
initThemeSystem();

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

function hideBootLoader(): void {
  const boot = document.getElementById('boot-loader');
  if (!boot || boot.classList.contains('is-done')) return;
  boot.classList.add('is-done');
  window.setTimeout(() => boot.remove(), 500);
}
requestAnimationFrame(() => hideBootLoader());
window.addEventListener('error', () => hideBootLoader());
window.addEventListener('unhandledrejection', () => hideBootLoader());

const startBtn = document.getElementById('btn-start')!;
const upgradeBtn = document.getElementById('btn-upgrade') as HTMLButtonElement;
const sellBtn = document.getElementById('btn-sell') as HTMLButtonElement;
const moveBtn = document.getElementById('btn-move') as HTMLButtonElement;
const toggleBtn = document.getElementById('btn-toggle') as HTMLButtonElement;
const resumeBtn = document.getElementById('btn-resume') as HTMLButtonElement;
const restartBtn = document.getElementById('btn-restart') as HTMLButtonElement;
const quitMenuBtn = document.getElementById('btn-quit-menu') as HTMLButtonElement;
const retryBtn = document.getElementById('btn-retry') as HTMLButtonElement;
const overMenuBtn = document.getElementById('btn-over-menu') as HTMLButtonElement;
const muteBtn = document.getElementById('btn-mute') as HTMLButtonElement;
const bossIntroEl = document.getElementById('boss-intro')!;

const save: SaveData = loadSave();
const renderer = new GameRenderer(canvas);
const state = createState();
state.running = false;
state.hero = save.hero;
state.heroXp = save.xp[save.hero] ?? 0;
state.heroLevel = heroXpToLevel(state.heroXp);
const sfx = new Sfx();
const hud = new Hud(sfx);
const field = new Field();
const fruits = new FruitField((g) => renderer.scene.add(g));
const debris = new SliceDebris((g) => renderer.scene.add(g));
const juice = new JuiceSystem();
const bank = new JuiceBank();
const wall = new WallBase();
const blade = new BladeInput(canvas, renderer.camera, renderer);
const trail = new BladeTrail();
const slashFx = new SlashFx();
const combos = new ComboFx();
applyEquippedBlade();
state.mode = save.mode;
combos.setPlayer(save.nickname, save.avatar);

setComboFocusHandler(({ intensity }) => {
  renderer.impulseShake(0.55 + intensity * 1.25);
});

renderer.scene.add(field.group, juice.mesh, wall.group, trail.line, trail.glowLine, trail.sparks, slashFx.group);

setStudioFxCallbacks({
  shake: (amount) => renderer.impulseShake(amount),
  playSfxSlot: (slotId) => sfx.playStudioSlot(slotId, { volume: 0.38 }),
  juiceBurst: (x, y, z, preset) => {
    const swipe = new Vector3(0.2, 0.6, -0.15);
    const mul = preset === 'dark-pulse' ? 0.45 : preset === 'spark' ? 0.55 : 0.85;
    juice.burst(x, y, z, 'lemon', swipe, mul);
  },
});

setCreatorVfxCallbacks({
  shake: (amount) => renderer.impulseShake(amount),
  juiceBurst: (x, y, z, _colorHex, intensity) => {
    const swipe = new Vector3(0.25, 0.55, -0.1);
    juice.burst(x, y, z, 'lemon', swipe, Math.max(0.35, intensity));
  },
  slashArc: (x, z, colorHex) => {
    slashFx.spawn(x, z, colorHex);
  },
});

let guestCd = 1.6;
let totalFruitsSliced = 0;
let sessionMaxCombo = 0;
let sessionLeaks = 0;

function emit(event: GameEvent): void {
  void reportGameEvent({
    mode: state.mode,
    hero: state.hero,
    wave: state.wave,
    combo: state.combo,
    score: state.score,
    ...event,
  });
}

function resetCombo(_reason: ComboResetReason): void {
  if (state.combo === 0 && state.comboTimer === 0) return;
  state.combo = 0;
  state.comboTimer = 0;
}

/**
 * Account Main Tower level → combat damage bonus.
 *
 * Survivability milestones (Lv 4 / Lv 8) are applied as +max lives in
 * `resetState`, so there is deliberately no second HP system here.
 */
function towerDamageBonus(): number {
  return Math.floor(getTowerXpState().level / 2);
}

initAchievementsCache();
installHudToggles();
installDesignMode();
void loadLiveConfig().then(() => {
  applyEquippedBlade();
  hud.mountShop(save);
});

fruits.onSpawn = (fruit) => {
  const enemy = enemyRule(fruit.enemyKind);
  if (enemy.kind === 'normal' || !enemy.warning) return;
  // Explosives are a tower-defense decision, not a random bomb: give them a
  // longer, louder callout so the player can plan the slice (§7).
  if (enemy.kind === 'explosive') {
    toast(state, `⚠ ${enemy.warning}`, 2.4);
    sfx.enemyWarning();
    renderer.impulseShake(0.25);
  } else {
    toast(state, enemy.warning, 1.35);
  }
};
hud.mountMeta(save);
hud.onHero = (id) => selectHero(id);
hud.onToastRequest = (message) => toast(state, message, 2);
hud.onHeroPurchase = (id) => {
  const result = purchaseHeroAtomic(save, id);
  if (!result.ok) {
    toast(state, result.message ?? 'Purchase failed', 2.2);
    sfx.denied();
    return;
  }
  writeSave(save);
  persist();
  toast(state, `${heroDef(id).name} unlocked! -${(result.coinsSpent ?? 0).toLocaleString()} coins`, 2.6);
  sfx.unlockItem();
  hud.mountHeroes(save);
  selectHero(id);
};
hud.onMode = (id) => setMode(id);
hud.onBuySkin = (id) => buySkin(id);
hud.onEquipItem = (id) => equipItem(id);
hud.onUnequipItem = (id) => unequipItem(id);
hud.onSellItem = (id) => sellItem(id);
hud.onDeleteItem = (id) => deleteItem(id);
hud.onBuyVIP = (tier) => buyVIP(tier); // P1-2
hud.onBuySkill = (id) => buySkill(id);
hud.onSaveUpdate = (newSave) => {
  Object.assign(save, newSave);
  persist();
};
hud.onRename = (name) => {
  save.nickname = name.slice(0, 16);
  save.avatar = defaultAvatar(save.nickname);
  combos.setPlayer(save.nickname, save.avatar);
  persist();
};
hud.onSuper = () => trySuper();

void fetchCloudSave().then((remote) => {
  if (!remote) return;
  const merged = mergeSaves(save, remote as Partial<SaveData>);
  Object.assign(save, merged);
  writeSave(save);
  state.hero = save.hero;
  state.heroXp = save.xp[save.hero] ?? 0;
  state.heroLevel = heroXpToLevel(state.heroXp);
  hud.mountMeta(save);
  applyEquippedBlade();
  refreshCurrentScreen();
});
function equippedSlicer() {
  return findSlicer(getSlicers(), save.bladeSkin) || findSlicer(getEnabledSlicers(), save.bladeSkin);
}

function applyEquippedBlade(): void {
  const slicer = equippedSlicer();
  trail.applySlicer(slicer, hexToNumber(slicer?.color || '', heroDef(state.hero).trail));
}

function persist(): void {
  save.hero = state.hero;
  // Hero XP is owned by the reward pipeline (applyRewards writes save.xp).
  // persist() must never copy match state back over it, or a stale
  // state.heroXp could silently roll saved progression backwards.
  state.heroXp = save.xp[state.hero] ?? 0;
  save.highScore = Math.max(save.highScore, state.score);
  if (state.mode === 'ranked') save.rankedScore = Math.max(save.rankedScore, state.score);
  save.bestWave = Math.max(save.bestWave, state.wave);
  save.bestCombo = Math.max(save.bestCombo ?? 0, state.bestCombo ?? state.combo ?? 0);
  save.mode = state.mode;
  writeSave(save);
  syncCloudSave(save);
  hud.refreshHeroPick(state.hero, save);
  hud.mountShop(save);
  hud.mountSkills(save);
}

function setMode(id: GameMode): void {
  state.mode = id;
  save.mode = id;
  persist();
  hud.mountModes(id);
  sfx.select();
}

function buySkin(id: string): void {
  const slicer = findSlicer(getSlicers(), id) || findSlicer(getLiveConfig().slicers, id);
  const wall = WALL_SKINS.find((w) => w.id === id);
  if (!slicer && !wall) return;

  if (!save.ownedSkins.includes(id)) {
    const cost = slicer?.cost ?? wall!.cost;
    if (save.coins < cost) {
      sfx.denied();
      return;
    }
    save.coins -= cost;
    save.ownedSkins.push(id);
    emit({ type: 'skin_buy' });
    // P0-3: Don't auto-equip on purchase - let user explicitly equip
    persist();
    sfx.place();
  } else {
    sfx.denied();
  }
}

function isUnequippedSkin(id: string): boolean {
  return !id || id === 'none';
}

function equipItem(id: string): void {
  if (!save.ownedSkins.includes(id)) return;
  const slicer = findSlicer(getSlicers(), id) || findSlicer(getLiveConfig().slicers, id);
  const wall = WALL_SKINS.find((w) => w.id === id);
  if (slicer) {
    save.bladeSkin = id;
  } else if (wall) {
    save.wallSkin = id;
  } else return;
  applyEquippedBlade();
  wallSkinApply();
  persist();
  sfx.select();
}

/** Clear a loadout slot (Blade or Wall). Starters stay owned but are not forced-equipped. */
function unequipItem(id: string): void {
  if (!id) return;
  let changed = false;
  if (save.bladeSkin === id) {
    save.bladeSkin = '';
    changed = true;
  }
  if (save.wallSkin === id) {
    save.wallSkin = '';
    changed = true;
  }
  // Also allow clearing by slot kind aliases from loadout UI
  if (id === 'blade' || id === 'bladeSkin') {
    save.bladeSkin = '';
    changed = true;
  }
  if (id === 'wall' || id === 'wallSkin') {
    save.wallSkin = '';
    changed = true;
  }
  if (!changed) return;
  applyEquippedBlade();
  wallSkinApply();
  persist();
  sfx.select();
}

function sellItem(id: string): void {
  if (id === 'blade-default' || id === 'wall-brick') {
    sfx.denied();
    return;
  }
  if (!save.ownedSkins.includes(id)) return;
  const slicer = findSlicer(getSlicers(), id) || findSlicer(getLiveConfig().slicers, id);
  const wall = WALL_SKINS.find((w) => w.id === id);
  const sell = slicer?.sellValue ?? wall?.sellValue ?? 0;
  if (sell <= 0) {
    sfx.denied();
    return;
  }
  save.ownedSkins = save.ownedSkins.filter((x) => x !== id);
  save.coins += sell;
  if (save.bladeSkin === id) save.bladeSkin = '';
  if (save.wallSkin === id) save.wallSkin = '';
  if (!save.ownedSkins.includes('blade-default')) save.ownedSkins.push('blade-default');
  if (!save.ownedSkins.includes('wall-brick')) save.ownedSkins.push('wall-brick');
  applyEquippedBlade();
  wallSkinApply();
  persist();
  sfx.place();
}

// P1-2: VIP Purchase System
function buyVIP(tier: 'bronze' | 'silver' | 'gold'): void {
  const cost = vipTierPrice(tier);
  const currentStatus = save.vipStatus || 'none';

  // Check if already have this tier or higher
  const tiers = ['none', 'bronze', 'silver', 'gold'];
  const currentTier = tiers.indexOf(currentStatus);
  const targetTier = tiers.indexOf(tier);
  if (currentTier >= targetTier) {
    toast(state, 'You already have this VIP tier!', 2);
    sfx.denied();
    return;
  }

  // Check gems (live admin VIP price when available)
  if ((save.gems || 0) < cost) {
    toast(state, `Not enough gems! Need ${cost} 💎`, 2);
    sfx.denied();
    return;
  }

  // Purchase!
  save.gems! -= cost;
  save.vipStatus = tier;

  // Flat coin grant on purchase (schema has % bonuses, not purchase coins)
  const coins = vipTierPurchaseCoins(tier);
  save.coins += coins;

  toast(state, `${tier.toUpperCase()} VIP Unlocked! +${coins} coins`, 3);
  sfx.place();
  persist();
  hud.mountShop(save);
}

function deleteItem(id: string): void {
  if (id === 'blade-default' || id === 'wall-brick') {
    sfx.denied();
    return;
  }
  if (!save.ownedSkins.includes(id)) return;
  save.ownedSkins = save.ownedSkins.filter((x) => x !== id);
  if (save.bladeSkin === id) save.bladeSkin = '';
  if (save.wallSkin === id) save.wallSkin = '';
  if (!save.ownedSkins.includes('blade-default')) save.ownedSkins.push('blade-default');
  if (!save.ownedSkins.includes('wall-brick')) save.ownedSkins.push('wall-brick');
  applyEquippedBlade();
  wallSkinApply();
  persist();
  sfx.select();
}

function wallSkinApply(): void {
  const skinId = isUnequippedSkin(save.wallSkin) ? '' : save.wallSkin;
  wall.applyWallSkin(WALL_SKINS.find((s) => s.id === skinId)?.color ?? 0x9a4034);
}

function buySkill(id: SkillId): void {
  const def = SKILLS.find((s) => s.id === id);
  if (!def || save.skillPoints <= 0 || (save.skills[id] ?? 0) >= def.max) {
    sfx.denied();
    return;
  }
  save.skillPoints -= 1;
  save.skills[id] += 1;
  persist();
  emit({ type: 'skill_buy' });
  sfx.unlockItem();
}

function selectHero(id: HeroId): void {
  // A player must never equip an unavailable hero (§4).
  if (!canEquipHero(save, id)) {
    toast(state, `${heroDef(id).name} is locked`, 2);
    sfx.denied();
    return;
  }
  persist();
  state.hero = id;
  state.heroXp = save.xp[id] ?? 0;
  state.heroLevel = heroXpToLevel(state.heroXp);
  save.hero = id;
  applyEquippedBlade();
  writeSave(save);
  wall.setHero(id);
  hud.refreshHeroPick(id, save);
  sfx.select();
}

/**
 * THE single entry point for gameplay rewards.
 *
 *   GAME EVENT → REWARD CALCULATION → PLAYER PROGRESSION → SAVE → UI FEEDBACK
 *
 * No other code path may grant hero XP, tower XP, coins or score.
 */
function award(event: RewardEvent): ProgressionResult {
  const reward = calculateReward(event, currentRewardModifiers(state, save));

  // Score and in-match currency live on the match state, not the save.
  state.score += reward.score;
  state.currency += Math.max(0, Math.round(reward.score * 0.6));

  const result = applyRewards(save, reward, { heroId: state.hero });
  state.heroXp = save.xp[state.hero] ?? 0;
  state.towerXp = save.towerXp;
  const towerState = getTowerXpState();
  state.towerXpToNext = towerState.nextLevelXp;
  state.towerXpProgress = towerState.progress;

  announceProgression(result);
  persist();
  return result;
}

/** UI FEEDBACK step: level-ups, milestones and hero unlocks. */
function announceProgression(result: ProgressionResult): void {
  if (result.heroLeveledUp) {
    const heroName = heroDef(result.heroId).name;
    const parts = [`${heroName} Lv ${result.heroLevelAfter}`];
    if (result.perkPointsGained > 0) {
      parts.push(`+${result.perkPointsGained} perk point${result.perkPointsGained > 1 ? 's' : ''}`);
    }
    toast(state, parts.join('  '), 2.2);
    emit({ type: 'hero_level' });
    sfx.unlockItem();

    for (const milestone of result.heroMilestones) {
      toast(state, `${milestone.name.toUpperCase()} — ${milestone.reward}`, 2.6);
    }
    if (result.heroMaxed) {
      toast(state, `${heroName} MAX MASTERY — Lv ${MAX_HERO_LEVEL}`, 3.2);
    }
  }

  for (const heroId of result.heroesUnlocked) {
    toast(state, `NEW HERO UNLOCKED — ${heroDef(heroId).name}`, 3);
    sfx.unlockItem();
    hud.mountHeroes(save);
  }

  if (result.towerLeveledUp) {
    for (const name of result.towerMilestoneNames) toast(state, `MAIN TOWER ${name}`, 2.6);
    if (result.towerMaxed) toast(state, 'MAIN TOWER — MASTER FORTRESS (Lv 10)', 3.2);
    sfx.unlockItem();
  }
}

function killFruit(fruit: Fruit, swipe: Vector3, burstMul = 1): void {
  debris.spawnPair(fruit, swipe, new Vector3(0, 0, 1));
  const mul = burstMul * (fruit.brittle > 0 ? 2 : 1);
  const juiceMul = equippedSlicer()?.juiceMul ?? 1;
  juice.burst(fruit.group.position.x, fruit.group.position.y, fruit.group.position.z, fruit.kind, swipe, mul);
  try {
    fireCreatorSlicerVfx(equippedSlicer()?.id, 'onKill', {
      x: fruit.group.position.x,
      y: fruit.group.position.y,
      z: fruit.group.position.z,
    });
  } catch {
    /* Creator VFX must never break combat */
  }
  const juiceHunterMul = heroCombatPerkMultiplier(state.hero, 'juice');
  const towerJuiceMul = getTowerMilestoneBonuses(getTowerXpState().level).juiceGainMultiplier;
  const juiceAmt = Math.max(1, Math.round((fruit.brittle > 0 ? 3 : 2) * juiceMul * juiceHunterMul * towerJuiceMul));
  bank.add(juiceHueFromKind(fruit.kind), juiceAmt);
  
  // Central reward pipeline — special-enemy score/XP multipliers are applied
  // inside calculateReward, so they always reach the economy.
  const result = award({
    type: fruit.boss ? 'boss_defeated' : fruit.enemyKind === 'normal' ? 'fruit_sliced' : 'special_enemy_killed',
    baseScore: FRUIT_DEFS[fruit.kind].score,
    enemyKind: fruit.enemyKind,
    boss: !!fruit.boss,
    combo: state.combo,
  });
  const scoreReward = result.scoreGained;
  const scr = worldPct(fruit.group.position.x, fruit.group.position.y + 0.35, fruit.group.position.z);
  if (fruit.boss) {
    floatingScore.spawn(`+${scoreReward} OVERLORD`, scr.nx, scr.ny, 'boss');
    renderer.impulseShake(1.4);
  } else if (fruit.enemyKind !== 'normal') {
    const enemyData = enemyRule(fruit.enemyKind);
    floatingScore.spawn(`+${scoreReward} ${enemyData.label.toUpperCase()}`, scr.nx, scr.ny, 'special');
  } else {
    floatingScore.spawn(`+${scoreReward}`, scr.nx, scr.ny, 'normal');
  }

  const rules = modeRules(state.mode);
  chargeSuper(state, (3.5 + save.skills.flow * 1.2) * rules.superMul);
  sfx.slice(fruit.kind, Math.max(2, state.combo), false);
  if (state.combo >= 2) sfx.combo(state.combo);
  combos.onKills(1);
  state.waveKilled += 1;
  totalFruitsSliced += 1;
  if (fruitFamily(fruit.kind) === 'melon') renderer.impulseShake(1.15);

  const family = fruitFamily(fruit.kind);
  emit({
    type: 'fruit_slice',
    fruitKind: fruit.kind,
    fruitFamily: family,
    boss: !!fruit.boss,
  });
  if (fruit.boss) {
    emit({ type: 'boss_kill', fruitKind: fruit.kind, fruitFamily: family, boss: true });
  }
  emit({ type: 'slash_damage', damage: Math.max(1, FRUIT_DEFS[fruit.kind].hp), score: scoreReward });
  emit({ type: 'juice', amount: juiceAmt });
}

function showGameOverOverlay(): void {
  const el = document.getElementById('hud-gameover');
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('flex');
  const finalScore = document.getElementById('hud-final-score');
  const finalWave = document.getElementById('hud-final-wave');
  if (finalScore) finalScore.textContent = `${state.score.toLocaleString()}`;
  if (finalWave) finalWave.textContent = `Wave ${state.wave}`;
}

function maybeOver(): void {
  if (state.lives > 0) return;
  // Already ended — keep overlay visible (hud.sync must not fight this)
  if (navigation.state === 'GAME_OVER') {
    showGameOverOverlay();
    return;
  }
  // Only end an active / paused match (never from dashboard/title)
  if (!navigation.isInGame() && !state.running) return;
  state.running = false;
  navigation.setState('GAME_OVER');
  save.games += 1;
  resetCombo('match_end');
  award({ type: 'game_over', score: state.score });
  sfx.gameOver();
  sfx.stopAllLoops();

  showGameOverOverlay();

  // Submit score to MongoDB Atlas
  const steamState = getCachedSteamState();
  const feedbackEl = document.getElementById('lb-submit-feedback');
  if (feedbackEl) feedbackEl.innerHTML = '<span>Syncing score to MongoDB Atlas...</span>';

  submitScore({
    nickname: save.nickname,
    avatar: save.avatar,
    hero: state.hero,
    mode: state.mode,
    score: state.score,
    wave: state.wave,
    fruitsSliced: totalFruitsSliced,
    maxCombo: sessionMaxCombo,
    steamId: steamState.steamId,
    steamPersona: steamState.personaName,
    steamAvatar: steamState.avatar,
  }).then((res) => {
    if (res && feedbackEl) {
      const monthly = res.monthlyRank ? ` · Monthly ${res.monthlyRank.title}` : '';
      feedbackEl.innerHTML = `<span class="font-bold text-lime-400">🏆 Global Rank: #${res.rank} ${
        res.isNewHigh ? '· NEW BEST SCORE!' : ''
      }${monthly}</span>`;
    } else if (feedbackEl) {
      feedbackEl.innerHTML = '<span class="text-slate-400">Score saved locally</span>';
    }
    void hud.refreshMonthlyRank();
  });

  emit({
    type: 'game_over',
    score: state.score,
    wave: state.wave,
    combo: sessionMaxCombo,
    amount: totalFruitsSliced,
    leaks: sessionLeaks,
    lives: state.lives,
    maxLives: state.maxLives,
  });

  syncCloudSave(save);
}

function tryPlace(kind: TurretKind): void {
  if (!navigation.canInteract() || !state.running) return;
  const slot = wall.selectedSlot();
  const pad = PADS[slot.index];
  if (slot.main || slot.filled) return;
  if (!canPlaceTurret(kind, pad)) {
    toast(state, 'That turret needs a front floor pad');
    sfx.denied();
    return;
  }
  const def = turretDef(kind);
  if (state.currency < def.cost) {
    toast(state, 'Need more money');
    sfx.denied();
    return;
  }
  if (wall.placeSlicer(slot.index, kind)) {
    state.currency -= def.cost;
    sfx.place();
    toast(state, `${def.name} built`);
    emit({ type: 'turret_place', turretKind: kind });
  }
}

function tryUpgrade(): void {
  if (!navigation.canInteract() || !state.running) return;
  const slot = wall.selectedSlot();
  if (!slot.filled) return;
  const cost = upgradeCost(slot.level);
  if (cost == null) {
    toast(state, `Already Lv ${MAX_TOWER_LEVEL}`);
    return;
  }
  if (state.currency < cost) {
    toast(state, 'Need more money');
    sfx.denied();
    return;
  }
  state.currency -= cost;
  wall.upgradeSelected();
  toast(state, `${slot.main ? 'Main' : slot.kind} is now Lv ${slot.level}/${MAX_TOWER_LEVEL}`);
  emit({ type: 'turret_upgrade' });
  sfx.unlockItem();
}

function restart(): void {
  resetState(state);
  state.hero = save.hero;
  state.heroXp = save.xp[save.hero] ?? 0;
  state.heroLevel = heroXpToLevel(state.heroXp);
  fruits.reset();
  debris.reset();
  juice.reset();
  bank.reset();
  wall.reset();
  wall.setHero(save.hero);
  sfx.stopAllLoops();
  state.running = true;
  const rules = modeRules(state.mode);
  bank.add('yellow', rules.yellow);
  bank.add('pink', rules.pink);
  bank.add('orange', rules.orange);
  combos.reset();
  floatingScore.reset();
  wall.cancelMove();
  guestCd = 1.6;
  totalFruitsSliced = 0;
  sessionMaxCombo = 0;
  sessionLeaks = 0;
  emit({ type: 'game_start' });
  const line = rules.guest
    ? `${heroDef(state.hero).name} + guest`
    : `${heroDef(state.hero).name} — ${rules.name}`;
  toast(state, line, 2.2);
  sfx.gameStart();
  if (rules.hints && save.games < 1) {
    window.setTimeout(() => {
      if (navigation.isPlaying() && state.running) toast(state, 'Slash fruit. Click a pad to build.', 2.4);
    }, 2600);
  }
}

function slashLines(slash: Slash): Slash[] {
  const hero = state.hero;
  const touch = slash.pointer === 'touch';
  const lines: Slash[] = [slash];
  if (hero === 'lagen') {
    const dx = slash.to.x - slash.from.x;
    const dz = slash.to.z - slash.from.z;
    const len = Math.hypot(dx, dz) || 1;
    const extra = (touch ? 1.05 : 1.55) + Math.min(1.2, slash.speed * 0.04);
    slash.to.x += (dx / len) * extra;
    slash.to.z += (dz / len) * extra;
  }
  if (hero === 'tripos') {
    const dx = slash.to.x - slash.from.x;
    const dz = slash.to.z - slash.from.z;
    const len = Math.hypot(dx, dz) || 1;
    const px = -dz / len;
    const pz = dx / len;
    const s = touch ? 0.62 : 0.4;
    for (const side of [-1, 1]) {
      lines.push({
        id: slash.id,
        from: slash.from.clone().add(new Vector3(px * s * side, 0, pz * s * side)),
        to: slash.to.clone().add(new Vector3(px * s * side, 0, pz * s * side)),
        segments: slash.segments,
        speed: slash.speed,
        charge: slash.charge,
        pointer: slash.pointer,
      });
    }
  }
  return lines;
}

function resolveSlash(slash: Slash): void {
  // Filter accidental slow drags — fast swipes feel powerful and deliberate
  if (slash.speed < MIN_SLICE_SPEED) {
    return;
  }

  const hero = heroDef(state.hero);
  const pointer = slash.pointer;
  const radius = heroHitRadius(state.hero, pointer) + save.skills.reach * 0.08;
  const slicerFx = equippedSlicer();
  const critChance = (heroCombatPerkMultiplier(state.hero, 'critical') - 1) * 0.15;
  const isCrit = Math.random() < critChance;

  // Ki spiritual charge cleave bonus
  if (state.hero === 'ki' && slash.charge > 0.4) {
    renderer.impulseShake(0.85);
    sfx.boost();
  }

  // Equipped blade juice on EVERY slash (not only fruit hits)
  const slashMid = {
    x: (slash.from.x + slash.to.x) * 0.5,
    y: (slash.from.y + slash.to.y) * 0.5,
    z: (slash.from.z + slash.to.z) * 0.5,
  };
  const bladeColor = hexToNumber(slicerFx?.color || '', hero.trail);
  slashFx.spawn(slashMid.x, slashMid.z, bladeColor);
  try {
    fireCreatorSlicerVfx(slicerFx?.id, 'onSlash', slashMid);
    if (isCrit) fireCreatorSlicerVfx(slicerFx?.id, 'onCrit', slashMid);
  } catch {
    /* Creator VFX must never break combat */
  }
  // Keep trail synced immediately so glint follows empty swings
  trail.sync(blade.trail);
  trail.applySlicer(slicerFx, bladeColor);
  const lastStandMul = state.lives <= Math.ceil(state.maxLives * 0.25) ? heroCombatPerkMultiplier(state.hero, 'survival') : 1;
  const dmg =
    (heroSlashDamage(state.hero, state.heroLevel, state.combo, slash.charge, pointer) + save.skills.edge * 4) *
    (slicerFx?.damageMul ?? 1) *
    (isCrit ? 1.8 : 1) *
    lastStandMul;
  const brittleBonus = slicerFx?.brittleBonus ?? 0;
  let hits = 0;
  const swipe = new Vector3().subVectors(slash.to, slash.from);
  if (swipe.lengthSq() < 0.0001) swipe.set(1, 0, 0);
  else swipe.normalize();

  // Stable hit tracking per stroke: a fruit or half cannot be hit multiple times by one swipe
  const hitFruits = new Set<Fruit>();
  const cutBits = new Set<typeof debris.halves[number]>();

  for (const line of slashLines(slash)) {
    fruits.dodgeSlash(line);
    for (const fruit of fruits.fruits) {
      if (!fruit.alive || hitFruits.has(fruit)) continue;
      const res = strokeHitsFruit(line, fruit, radius);
      if (!res.hit) continue;

      hitFruits.add(fruit);
      hits += 1;
      const hitPos = {
        x: fruit.group.position.x,
        y: fruit.group.position.y,
        z: fruit.group.position.z,
      };
      slashFx.spawn(hitPos.x, hitPos.z, hexToNumber(slicerFx?.color || '', hero.trail));
      try {
        fireCreatorSlicerVfx(slicerFx?.id, 'onSlash', hitPos);
        if (isCrit) fireCreatorSlicerVfx(slicerFx?.id, 'onCrit', hitPos);
      } catch {
        /* Creator VFX must never break combat */
      }
      if (fruit.kind === 'bomb') {
        if (line.speed > 7.5 || state.hero === 'ki') {
          sfx.bombParry();
          award({ type: 'bomb_parry', baseScore: FRUIT_DEFS.bomb.score, combo: state.combo });
          const scr = worldPct(hitPos.x, hitPos.y + 0.35, hitPos.z);
          floatingScore.spawn('PARRY! +55', scr.nx, scr.ny, 'critical');
          emit({ type: 'bomb_parry' });
        } else {
          sfx.bombExplode();
          damageTower(state, 2);
          toast(state, 'Bomb!');
          maybeOver();
        }
        fruits.kill(fruit);
        continue;
      }
      if (fruit.enemyKind === 'armored') {
        sfx.armorHit();
      }
      if (state.hero === 'topfu' || brittleBonus > 0) {
        const base = state.hero === 'topfu' ? (pointer === 'touch' ? 2.8 : 2.1) : 0;
        fruit.brittle = Math.max(fruit.brittle, base + brittleBonus);
        if (state.hero === 'topfu') {
          fruit.impulseX += swipe.x * 2.4;
          fruit.impulseZ += swipe.z * 2.4;
          // Topfu splash: apply brittle to nearby fruits
          const fx = fruit.group.position.x;
          const fz = fruit.group.position.z;
          for (const other of fruits.fruits) {
            if (!other.alive || other === fruit) continue;
            if (Math.hypot(other.group.position.x - fx, other.group.position.z - fz) < 1.8) {
              other.brittle = Math.max(other.brittle, 2.2);
              other.impulseX += swipe.x * 1.5;
              other.impulseZ += swipe.z * 1.5;
            }
          }
        }
      }
      const towerBonus = towerDamageBonus();
      const killed = fruits.hurt(fruit, dmg + wall.slots[MAIN_INDEX].level + towerBonus);
      
      // Explosive tower damage is applied once, inside FruitField.hurt().
      if (fruit.enemyKind === 'explosive' && fruit.volatileTriggered && !killed) {
        resetCombo('explosive_mistake');
        renderer.impulseShake(0.85);
        sfx.bombExplode();
        maybeOver();
      }

      if (killed) killFruit(fruit, swipe);
    }
    for (const bit of debris.halves) {
      if (cutBits.has(bit)) continue;
      if (strokeHitsHalf(line, bit, radius * 0.35)) cutBits.add(bit);
    }
  }

  for (const bit of cutBits) {
    const px = bit.group.position.x;
    const py = bit.group.position.y;
    const pz = bit.group.position.z;
    const kind = bit.kind;
    const gen = debris.reslice(bit, swipe, swipe);
    if (!gen) continue;
    hits += 1;
    const isSecondCut = gen >= 2;
    const juiceGain = isSecondCut ? 3 : 1;
    bank.add(juiceHueFromKind(kind), juiceGain);
    juice.burst(px, py, pz, kind, swipe, isSecondCut ? 1.3 : 0.65);
    const resliceAward = award({ type: 'reslice', generation: gen, combo: state.combo });
    chargeSuper(state, (1.2 + save.skills.flow * 0.6) * (isSecondCut ? 1.6 : 1));
    slashFx.spawn(px, pz, FRUIT_DEFS[kind].splash);
    const screen = worldPct(px, py + 0.35, pz);
    combos.onReslice(gen, screen.nx, screen.ny);
    if (isSecondCut) {
      state.comboTimer = Math.max(state.comboTimer + 0.4, 1.45);
      floatingScore.spawn(`RESLICE II +${resliceAward.scoreGained}`, screen.nx, screen.ny, 'reslice');
      sfx.slice(kind, Math.max(3, state.combo), false);
    } else {
      floatingScore.spawn(`RESLICE +${resliceAward.scoreGained}`, screen.nx, screen.ny, 'reslice');
      sfx.slice(kind, 2, false);
    }
    emit({ type: 'reslice', amount: gen, fruitKind: kind, fruitFamily: fruitFamily(kind) });
  }

  if (hits === 0) {
    // A swing that connects with nothing breaks the chain (§8 "player misses").
    resetCombo('miss');
  }

  if (hits > 0) {
    const comboBefore = state.combo;
    state.combo = state.hero === 'jiju' ? state.combo + hits : Math.max(1, state.combo) + hits;
    // One-off bonus for each newly crossed combo tier (data-driven thresholds).
    for (const tier of comboTiersBetween(comboBefore, state.combo)) {
      award({ type: 'combo_milestone', combo: tier.combo });
      toast(state, `${tier.label.toUpperCase()} x${tier.combo}`, 1.1);
      floatingScore.spawn(`+${tier.combo * 10} COMBO!`, 50, 36, 'combo');
    }
    const comboEngineMul = heroCombatPerkMultiplier(state.hero, 'combo');
    state.comboTimer = (state.hero === 'jiju' ? 1.65 : 1.35) * comboEngineMul;
    sessionMaxCombo = Math.max(sessionMaxCombo, state.combo);
    combos.onHits(hits, state.combo);
    renderer.impulseShake(hero.shake * (1 + Math.min(0.8, slash.charge)));
    emit({ type: 'combo', combo: state.combo });
  }
}

function trySuper(): void {
  if (!navigation.canInteract() || !state.running || state.superJuice < 100) return;
  state.superJuice = 0;
  const swipe = new Vector3(0, 0.4, 1);
  const dmg = 30 + save.skills.storm * 12 + state.heroLevel * 4;
  renderer.impulseShake(1.6);
  sfx.blitzStart();
  toast(state, 'SUPER BLOW', 1.2);
  emit({ type: 'super' });
  for (const fruit of fruits.fruits) {
    if (!fruit.alive) continue;
    slashFx.spawn(fruit.group.position.x, fruit.group.position.z, 0xfbbf24);
    if (fruits.hurt(fruit, dmg)) killFruit(fruit, swipe, 2);
  }
}

const _scr = new Vector3();

function worldPct(x: number, y: number, z: number): { nx: number; ny: number } {
  _scr.set(x, y, z).project(renderer.camera);
  return {
    nx: (_scr.x * 0.5 + 0.5) * 100,
    ny: (-_scr.y * 0.5 + 0.5) * 100,
  };
}

function setPaused(on: boolean): void {
  if (!navigation.isInGame() || !state.running) return;
  navigation.setState(on ? 'PAUSED' : 'PLAY');
  hud.showPause(on);
  if (on) sfx.pause();
  else sfx.unpause();
}

function quitToMenu(): void {
  // P0-2: Confirm before leaving mid-match
  if (navigation.isInGame() && state.running) {
    const confirmed = confirm('Leave this match?\n\nYour progress will be lost.');
    if (!confirmed) return;
  }
  
  persist();
  navigation.setState('MAIN_MENU');
  state.running = false;
  wall.cancelMove();
  blade.consumeClick();
  blade.consumeSlash();
  document.getElementById('app')?.classList.remove('sidebar-open');
  document.getElementById('hud-gameover')?.classList.add('hidden');
  hud.showPause(false);
  hud.showMenu(true);
  hud.mountMeta(save);
  floatingScore.reset();
  sfx.pause();
  sfx.stopAllLoops();
}

if (typeof window !== 'undefined') {
  (window as any).__fruitTdQuitToMenu = quitToMenu;
}

function restartMatch(): void {
  hud.showPause(false);
  navigation.setState('PLAY');
  document.getElementById('app')?.classList.remove('sidebar-open');
  hud.showMenu(false);
  restart();
}

function showBossIntro(level: number): void {
  const letterbox = document.getElementById('boss-letterbox');
  const title = document.getElementById('boss-intro-title');
  const subtitle = document.getElementById('boss-intro-subtitle');
  
  if (!letterbox || !title || !subtitle) return;

  // Creator Hub: fire boss onSpawn hooks at intro (best-effort; fruit spawn also fires).
  if (!fireStudioEvent(bossStudioKey('watermelon'), 'onSpawn')) {
    fireStudioEvent(BOSS_OVERLORD_STUDIO_KEY, 'onSpawn');
  }
  
  // Fruit-zombie overlord names scale with LEVEL (not wave)
  const bossNames = [
    ['ROTTEN KING', 'ORCHARD WARDEN', 'RIPE WATCHER'],           // Level 1-3
    ['THE JUICE CRUSHER', 'MASH BERSERKER', 'PULP RAVAGER'],     // Level 4-6
    ['TITAN RIND', 'COLOSSUS CORE', 'JUGGERNAUT POD'],           // Level 7-9
    ['APEX BLIGHT', 'DOMINATOR PEEL', 'ANNIHILATOR GROVE'],      // Level 10-12
    ['THE BEHEMOTH MELON', 'LEVIATHAN CITRUS', 'TITAN ORCHARD'], // Level 13-15
    ['FRUIT OVERLORD', 'SUPREME ROT', 'EMPEROR OF RIND'],        // Level 16-18
    ['ULTIMATE BLIGHT', 'GOD OF JUICE', 'OMEGA ORCHARD'],        // Level 19+
  ];
  const tierIndex = Math.min(bossNames.length - 1, Math.floor((level - 1) / 3));
  const tier = bossNames[tierIndex];
  const nameIndex = (level - 1) % tier.length;
  const bossName = tier[nameIndex] || tier[0];
  
  title.textContent = bossName;
  subtitle.textContent = `LEVEL ${level} OVERLORD`;
  
  letterbox.classList.remove('hidden');
  setTimeout(() => {
    letterbox.classList.add('hidden');
    toast(state, `${bossName}  ·  LEVEL ${level}`, 1.8);
  }, 3000);
}

function tickGuest(dt: number): void {
  if (!modeRules(state.mode).guest) return;
  guestCd -= dt;
  if (guestCd > 0) return;
  guestCd = 2.05;
  let best: Fruit | null = null;
  let bestZ = Infinity;
  for (const fruit of fruits.fruits) {
    if (!fruit.alive) continue;
    if (fruit.group.position.z < bestZ) {
      bestZ = fruit.group.position.z;
      best = fruit;
    }
  }
  if (!best) return;
  const x = best.group.position.x;
  const z = best.group.position.z;
  slashFx.spawn(x, z, 0x93c5fd);
  resolveSlash({
    id: 0,
    from: new Vector3(x - 0.95, 0, z),
    to: new Vector3(x + 0.95, 0, z),
    segments: [],
    speed: 11,
    charge: 0.28,
    pointer: 'mouse',
  });
}

function tryMove(): void {
  if (!navigation.canInteract() || !state.running) return;
  if (wall.moving) {
    wall.cancelMove();
    toast(state, 'Move cancelled');
    return;
  }
  if (wall.startMove()) toast(state, 'Click a blue pad');
  else sfx.denied();
}

function trySell(): void {
  if (!navigation.canInteract() || !state.running) return;
  const slot = wall.selectedSlot();
  if (slot.main || !slot.filled) return;
  const refund = wall.sellSelected();
  if (refund <= 0) {
    sfx.denied();
    return;
  }
  state.currency += refund;
  toast(state, `Sold  +$${refund}`);
  emit({ type: 'turret_sell' });
  sfx.place();
}

function kiPulse(x: number, z: number): void {
  const hero = heroDef('ki');
  const r = blade.lastPointer === 'touch' ? 1.4 : 1.05;
  const dmg = heroSlashDamage('ki', state.heroLevel, 0, Math.max(0.35, blade.lastCharge), blade.lastPointer);
  slashFx.spawn(x, z, hero.trail);
  renderer.impulseShake(0.8);
  sfx.swipe(false);
  const swipe = new Vector3(0, 0.3, 1);
  for (const fruit of fruits.fruits) {
    if (!fruit.alive) continue;
    if (Math.hypot(fruit.group.position.x - x, fruit.group.position.z - z) > r) continue;
    if (fruit.kind === 'bomb') {
      fruits.kill(fruit);
      continue;
    }
    if (fruits.hurt(fruit, dmg)) killFruit(fruit, swipe);
  }
}

function simulate(dt: number): void {
  if (!navigation.isPlaying() || !state.running) {
    blade.consumeClick();
    blade.consumeSlash();
    if (navigation.isPaused()) {
      renderer.update(dt);
      blade.fadeTrail();
      trail.sync(blade.trail);
    }
    return;
  }
  if (state.toast === '__restart__') {
    restart();
    return;
  }

  state.elapsed += dt;
  if (state.toastTimer > 0) state.toastTimer -= dt;
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) resetCombo('timeout');
  }

  const tap = blade.consumeClick();
  if (tap) {
    const idx = slotIndexAt(tap.x, tap.z);
    if (wall.moving) {
      if (idx === wall.selected) {
        wall.cancelMove();
      } else if (idx >= 0 && wall.moveTo(idx)) {
        toast(state, 'Turret moved');
        emit({ type: 'turret_move' });
        sfx.place();
      } else {
        sfx.denied();
        toast(state, 'Need an empty pad that fits');
      }
    } else if (idx >= 0) {
      wall.select(idx);
      sfx.select();
    } else if (state.hero === 'ki') {
      kiPulse(tap.x, tap.z);
    }
  }

  const slash = blade.consumeSlash();
  if (slash) {
    sfx.swipe(false);
    resolveSlash(slash);
  }

  if (state.bossIntro) {
    if (state.bossIntroTimer === 2.5) {
      bossIntroEl.classList.remove('hidden');
      showBossIntro(state.level);
    }
    state.bossIntroTimer -= dt;
    if (state.bossIntroTimer <= 0) {
      state.bossIntro = false;
      bossIntroEl.classList.add('hidden');
      state.waveSpawning = true;
      const plan = planBossWave(state.wave, state.mode, state.level);
      state.waveTotal = plan.items.length;
      state.waveKilled = 0;
      fruits.beginWave(plan.items, plan.gap, plan.hpScale);
      toast(state, plan.subtitle ? `${plan.title} — ${plan.subtitle}` : plan.title, 1.8);
      sfx.wave();
    }
  } else if (!state.waveSpawning) {
    state.waveClearTimer -= dt;
    if (state.waveClearTimer <= 0) {
      state.waveSpawning = true;
      const totalWavesInLevel = wavesPerLevel(state.level);
      const currentWaveInLevel = ((state.wave - 1) % totalWavesInLevel) + 1;
      const plan = planWave(state.wave, state.mode, state.level, currentWaveInLevel, totalWavesInLevel);
      state.waveTotal = plan.items.length;
      state.waveKilled = 0;
      state.wavesInLevel = totalWavesInLevel;
      fruits.beginWave(plan.items, plan.gap, plan.hpScale);
      
      // Boss intro letterbox if this is a boss wave
      if (plan.boss) {
        showBossIntro(plan.level);
      } else {
        toast(state, plan.subtitle ? `${plan.title} — ${plan.subtitle}` : plan.title, 1.4);
      }
      sfx.wave();
    }
  } else if (!fruits.waveBusy) {
    state.waveSpawning = false;
    const totalWavesInLevel = wavesPerLevel(state.level);
    const completedWavesInLevel = ((state.wave - 1) % totalWavesInLevel) + 1;
    const wasBoss = fruits.fruits.some(f => !f.alive && f.boss);

    // Perfect wave: every fruit killed (no leaks that wave)
    const perfect = isPerfectWave(state);
    award({ type: 'wave_cleared', wave: state.wave });
    if (perfect) {
      const perfectResult = award({ type: 'perfect_wave', wave: state.wave });
      toast(state, `Perfect wave! +${perfectResult.scoreGained}`, 1.4);
    }

    state.wave += 1;
    
    if (wasBoss) {
      toast(state, `Level ${state.level} complete!`, 2);
      state.level += 1;
      state.waveClearTimer = 2.2;
    } else {
      toast(state, 'Wave clear', 1.3);
      if (completedWavesInLevel >= totalWavesInLevel) {
        state.bossIntro = true;
        state.bossIntroTimer = 2.5;
      } else {
        state.waveClearTimer = 2.2;
      }
    }
    
    emit({ type: 'wave_clear', wave: state.wave, lives: state.lives, maxLives: state.maxLives });
  }

  fruits.update(dt, state, (fruit) => {
    const enemy = enemyRule(fruit.enemyKind);
    const baseCost = leakCost(state, fruit.kind, fruit.boss);
    const towerGuardianMul = heroCombatPerkMultiplier(state.hero, 'tower');
    const leakDamage = Math.round(baseCost * enemy.towerDamageOnLeak * towerGuardianMul);
    damageTower(state, leakDamage);
    sessionLeaks += 1;
    sfx.leak();
    if (fruit.boss) {
      toast(state, 'Overlord hit the wall');
    } else if (enemy.kind !== 'normal' && enemy.label) {
      toast(state, `${enemy.label} hit the wall`);
    } else {
      toast(state, 'They hit the wall');
    }
    emit({ type: 'leak', amount: 1, leaks: sessionLeaks, fruitKind: fruit.kind });
    maybeOver();
  });

  tickGuest(dt);

  const didShoot = wall.update(dt, fruits.fruits, juice, bank, (hit) => {
    if (hit.impulseX) hit.fruit.impulseX += hit.impulseX;
    if (hit.impulseZ) hit.fruit.impulseZ += hit.impulseZ;
    if (hit.brittle) hit.fruit.brittle = Math.max(hit.fruit.brittle, 2.4);
    const swipe = new Vector3(0, 0.2, 1);
    const towerBonus = towerDamageBonus();
    const dmg = Math.round(hit.damage * (1 + save.skills.steel * 0.12) + towerBonus);
    if (fruits.hurt(hit.fruit, dmg)) {
      killFruit(hit.fruit, swipe, hit.split || hit.puddle ? 1.8 : 1);
    }
  });
  if (didShoot) sfx.fire();

  juice.update(dt);
  debris.update(dt);
  slashFx.update(dt);
  combos.update(dt);
  floatingScore.update(dt);
  renderer.update(dt);
  blade.fadeTrail();
  trail.sync(blade.trail);
  trail.update(dt);
}

function draw(): void {
  juice.commit();
  renderer.render();
}

const loop = new GameLoop(simulate, draw, () => {
  hud.sync(state, wall, bank, loop.fps, () => undefined, save.skillPoints, navigation.isInGame());
  updateTowerChip();
});
hud.onPlace = (kind) => {
  if (navigation.canInteract() && state.running) tryPlace(kind);
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (hud.isTitleOpen()) {
      document.getElementById('title-settings')?.classList.add('hidden');
      document.getElementById('title-quit')?.classList.add('hidden');
      return;
    }
    // Menu screens: the screen registry's ESC handler owns BACK, so this
    // branch only covers the title and in-match cases (§1).
    if (!navigation.isInGame()) {
      if (navigation.state === 'MAIN_MENU') {
        navigation.setState('TITLE');
        hud.returnToTitle();
      }
      return;
    }
    if (!state.running) {
      quitToMenu();
      return;
    }
    if (wall.moving) {
      wall.cancelMove();
      return;
    }
    setPaused(!navigation.isPaused());
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    trySuper();
  }
  if (e.code === 'KeyU') tryUpgrade();
  if (e.code === 'KeyX') trySell();
  if (e.code === 'KeyM') tryMove();
  if (e.code === 'KeyB' && navigation.canInteract() && state.running) {
    if (wall.toggleSelected()) toast(state, wall.selectedSlot().turret?.open ? 'Blender open' : 'Blender closed');
  }
  if (e.code === 'KeyP' && navigation.isInGame() && state.running) setPaused(!navigation.isPaused());
  if (e.code === 'KeyR' && navigation.isInGame() && !state.running) restartMatch();
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= 5 && navigation.state === 'MAIN_MENU' && !hud.isTitleOpen()) selectHero(HEROES[n - 1].id);
  }
});

upgradeBtn.addEventListener('click', () => {
  if (navigation.canInteract() && state.running) tryUpgrade();
});
sellBtn.addEventListener('click', () => trySell());
moveBtn.addEventListener('click', () => tryMove());
toggleBtn.addEventListener('click', () => {
  if (navigation.canInteract() && state.running && wall.toggleSelected()) {
    toast(state, wall.selectedSlot().turret?.open ? 'Blender open' : 'Blender closed');
  }
});
resumeBtn.addEventListener('click', () => setPaused(false));
restartBtn.addEventListener('click', () => restartMatch());
quitMenuBtn.addEventListener('click', () => quitToMenu());
retryBtn.addEventListener('click', () => restartMatch());
overMenuBtn.addEventListener('click', () => quitToMenu());
if (muteBtn) {
  muteBtn.addEventListener('click', () => {
    const muted = sfx.toggleMute();
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.title = muted ? 'Unmute' : 'Mute';
  });
}

/** Shared launch path for every PLAY entry point (menu button, screens). */
async function launchMatch(): Promise<void> {
  persist();
  await Promise.all([sfx.unlock(), fruitAtlas.load()]);
  wall.applySkins();
  wall.setHero(save.hero);
  wallSkinApply();
  applyEquippedBlade();
  restartMatch();
}

startBtn.addEventListener('click', async () => {
  startBtn.textContent = 'Slicing…';
  await launchMatch();
  startBtn.textContent = 'Play';
});

/* ═══════════════ PHASE 2 GAME SCREENS ═══════════════
   Screens read the live save and route every mutation back through the
   existing gameplay functions, so there is no second economy path. */
installGameScreens({
  getSave: () => save,
  onPlay: () => void launchMatch(),
  onQuit: () => document.getElementById('title-quit')?.classList.remove('hidden'),
  onToggleSound: () => document.getElementById('btn-mute')?.click(),
  onLogout: () => void hud.logoutToTitle(),
  onOpenDaily: () => document.getElementById('btn-daily-chip')?.click(),
  onAdmin: () => hud.openAdmin(),
  onBuyItem: (id) => {
    buySkin(id);
    refreshCurrentScreen();
  },
  onEquipItem: (id) => {
    equipItem(id);
    refreshCurrentScreen();
  },
  onSellItem: (id) => {
    // Re-check here too: the screen disables the button, but the guard is the
    // rule, and the UI must never be the only thing enforcing it (§7).
    const check = canSellItem(save, id);
    if (!check.ok) {
      toast(state, check.message ?? 'Cannot sell that.', 2.4);
      sfx.denied();
      return;
    }
    sellItem(id);
    refreshCurrentScreen();
  },
  onEquipHero: (id) => {
    selectHero(id);
    refreshCurrentScreen();
  },
  onBuyHero: (id) => {
    hud.onHeroPurchase?.(id);
    refreshCurrentScreen();
  },
  getProfileStats: () => ({
    bestCombo: save.bestCombo ?? 0,
    season: 'Season 1',
  }),
  showLobbyPage: (page) => hud.showPage(page),
});

/**
 * Leaving a live match must always be deliberate (§10). The guard runs for
 * every navigation, so PLAY → anywhere is covered once, not per button.
 */
navigation.addGuard((change) => {
  const leavingMatch =
    (change.from === 'PLAY' || change.from === 'PAUSED') && change.to !== 'PAUSED' && change.to !== 'PLAY';
  if (!leavingMatch || !state.running) return true;
  return confirm('Leave this match?\n\nYour progress in this run will be lost.');
});

/** Keep the legacy lobby and the new main menu mutually exclusive. */
navigation.onChange((change) => {
  const gate = document.getElementById('hud-start');
  const menu = document.getElementById('screen-main-menu');
  if (change.to === 'MAIN_MENU') {
    gate?.classList.add('hidden');
    menu?.classList.remove('hidden');
  } else if (menu && change.from === 'MAIN_MENU') {
    // Overlays keep the menu mounted underneath; full screens replace it.
    if (!navigation.isOverlay(change.to)) menu.classList.add('hidden');
  }
});

loop.start();

