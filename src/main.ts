import { finishCampaignAttempt } from './game/campaignAttempt';
import { recordRun } from './game/runStats';
import { Vector3 } from 'three';
import './style.css';
import { Sfx } from './audio/sfx';
import { GameLoop } from './engine/loop';
import { startMatchWithOptionalMedia } from './game/matchStartup';
import { GameRenderer } from './engine/renderer';
import { fruitAtlas } from './game/atlas';
import { Field } from './game/field';
import { FRUIT_DEFS, FruitField, fruitFamily, type Fruit } from './game/fruits';
import { HEROES, MAX_HERO_LEVEL, heroDef, heroHitRadius, heroSlashDamage, heroXpToLevel, type HeroId } from './game/heroes';
import { JuiceBank, JuiceSystem, juiceHueFromKind } from './game/juice';
import { WALL_SKINS, defaultAvatar, loadSave, writeSave, mergeSaves, type GameMode, type SaveData } from './game/save';
import { findSlicer, hexToNumber } from './game/slicers';
import { SKILLS, type SkillId } from './game/skills';
import { heroAbility } from './game/heroAbilities';
import { SlashFx } from './game/slashfx';
import { strokeHitsFruit, strokeHitsHalf, SliceDebris } from './game/slicer';
import { modeRules } from './game/modes';
import { dangerousLeakMultiplier } from './game/enemies';
import { campaignBossDefeated, chargeSuper, consumeBossWaveCompletion, createState, damageTower, isPerfectWave, leakCost, recordWaveKill, resetState, toast } from './game/state';
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
import { fruitLoot, frutsForEvent } from './game/matchEconomy';
import { detonatePulpPopper } from './game/chainBurst';
import { campaignBoss, campaignWaves, sanitizeCampaignProgress } from './game/campaign';
import { BladeTrail } from './game/trail';
import { StrokeContacts } from './game/strokeContacts';
import { installCombatDiagnostics } from './game/combatDiagnostics';
import { canPlaceTurret, turretDef, type TurretKind } from './game/turrets';
import { WallBase } from './game/wall';
import { MAIN_INDEX, MAX_TOWER_LEVEL, PADS, slotIndexAt, upgradeCost } from './game/world';
import { advanceLocalCoop, type LocalCoopState } from './game/localCoop';
import { CoopActors } from './game/coopActors';
import { BladeInput, MIN_SLICE_SPEED, type Slash } from './input/blade';
import { ComboFx, setComboFocusHandler } from './ui/combos';
import { floatingScore } from './ui/floatingScore';
import { Hud } from './ui/hud';
import { CombatImpact } from './ui/combatImpact';
import { submitScore, syncCloudSave, fetchCloudSave, startLeaderboardRun, performCatalogueAction, adoptAuthoritativeSave, type CatalogueAction } from './services/api';
import { getAuthToken } from './services/auth';
import { initAchievementsCache } from './services/achievements';
import { confirmModal } from './ui/components/surface';
import { getCachedSteamState } from './services/steam';
import { currentSeasonLabel, type GameEvent } from './game/requirements';
import { enemyRule } from './game/enemies';
import { getTowerXpState } from './game/towerProgression';
import { syncTowerProgression } from './game/towerProgression';
import { getTowerMilestoneBonuses } from './game/towerMilestones';
import { navigation } from './game/navigation';
import { canEquipHero, purchaseHeroAtomic } from './game/progression/heroStatus';
import { heroCombatPerkMultiplier } from './game/heroPerkSave';
import { vipTierPrice, vipTierPurchaseCoins } from './game/vipBonuses';
import { installHudToggles } from './ui/hudToggle';
import { updateTowerChip } from './ui/towerChip';
import { installGameScreens, openScreen, refreshCurrentScreen } from './ui/screens';
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
import { mountLucideIcon, mountLucidePlaceholders } from './ui/lucideIcon';
import { installMenuInput } from './ui/menuInput';
import { installNumberMotion } from './ui/numberMotion';
import './ui/numberMotion.css';

// Theme + layout must be applied before any UI renders.
initThemeSystem();
mountLucidePlaceholders();
installMenuInput();
installNumberMotion();

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
const bossIntroEl = document.getElementById('boss-letterbox')!;
const BOSS_INTRO_DURATION = 5.5;

const save: SaveData = loadSave();
const renderer = new GameRenderer(canvas);
const combatImpact = new CombatImpact(document.getElementById('combat-impact'));
const profileChip = document.getElementById('player-chip');
const profileToggle = document.getElementById('btn-profile-toggle') as HTMLButtonElement | null;
if (profileChip && profileToggle) {
  const setCollapsed = (collapsed: boolean) => {
    profileChip.classList.toggle('is-collapsed', collapsed);
    profileToggle.setAttribute('aria-expanded', String(!collapsed));
    profileToggle.setAttribute('aria-label', collapsed ? 'Expand profile' : 'Collapse profile');
    profileToggle.title = collapsed ? 'Expand profile' : 'Collapse profile';
    mountLucideIcon(profileToggle, collapsed ? 'ChevronsRight' : 'ChevronsLeft', 18);
  };
  try { setCollapsed(localStorage.getItem('fruit-td-profile-collapsed') === 'true'); } catch { setCollapsed(false); }
  profileToggle.addEventListener('click', () => {
    const collapsed = !profileChip.classList.contains('is-collapsed');
    setCollapsed(collapsed);
    try { localStorage.setItem('fruit-td-profile-collapsed', String(collapsed)); } catch { /* private browsing */ }
  });
  document.addEventListener('pointerdown', (event: PointerEvent) => {
    if (profileChip.classList.contains('is-collapsed')) return;
    if (event.target instanceof Node && profileChip.contains(event.target)) return;
    setCollapsed(true);
    try { localStorage.setItem('fruit-td-profile-collapsed', 'true'); } catch { /* private browsing */ }
  }, true);
}
const state = createState();
state.running = false;
state.hero = save.hero;
state.heroXp = save.xp[save.hero] ?? 0;
state.heroLevel = heroXpToLevel(state.heroXp);
const heroAbilityReadyAt: Record<string, number> = {};
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
const guestTrail = new BladeTrail();
guestTrail.setColor(0x93c5fd);
const coopActors = new CoopActors();
const slashFx = new SlashFx();
const combos = new ComboFx();
const playerContacts = new StrokeContacts();
const guestContacts = new StrokeContacts();
let guestStrokeId = 0;
applyEquippedBlade();
if (save.mode === 'ranked' || save.mode === 'arena') {
  // Keep the old solo score fields untouched, but never resume the retired solo substitutes.
  save.mode = 'casual';
  writeSave(save);
}
state.mode = save.mode;
combos.setPlayer(save.nickname, save.avatar);

setComboFocusHandler(({ intensity }) => {
  renderer.impulseShake(intensity * 0.6);
});

renderer.scene.add(field.group, juice.mesh, wall.group, trail.line, trail.glowLine, trail.sparks,
  guestTrail.line, guestTrail.glowLine, guestTrail.sparks, coopActors.group, slashFx.group);

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

const guestKeys = new Set<string>();
let guestControl: LocalCoopState = { x: 3, z: -5.5, cooldown: 0 };
let guestTrailLife = 0;
let guestAttackHeld = false;
const guestCursor = document.getElementById('coop-guest-cursor');
const guestHelp = document.getElementById('coop-guest-help');
let totalFruitsSliced = 0;
let statsRunId = `${Date.now()}`;
let statsStrokes = 0;
let statsHits = 0;
let lootEligibleKills = 0;
let sessionMaxCombo = 0;
let sessionLeaks = 0;
let lastBossStep = -1;
let lastBossFruit: Fruit | null = null;
let lastBossHitAt = 0;
let rewardSavePending = false;
let matchRewards = { coins: 0, gems: 0, heroXp: 0, towerXp: 0, skillPoints: 0 };
let runSettlementPending: Promise<void> | null = null;
let restartPending = false;
let campaignStartStage = 1;
let campaignStoryActive = false;
let campaignStoryFinal = false;
let campaignRunSettled = false;
let campaignStageSaving = false;
let campaignSession = 0;
let bossRevealRemaining = 0;

function emit(event: GameEvent): void {
  void import('./services/progress').then(({ reportGameEvent }) => reportGameEvent({
    mode: state.mode,
    hero: state.hero,
    wave: state.wave,
    combo: state.combo,
    score: state.score,
    ...event,
  }));
}

function resetCombo(_reason: ComboResetReason): void {
  if (state.combo === 0 && state.comboTimer === 0) return;
  state.combo = 0;
  state.comboTimer = 0;
  combos.reset();
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
fruits.onBossPhase = (fruit) => {
  const name = state.mode === 'campaign' ? campaignBoss(state.level, getLiveConfig().campaignBosses).name : 'OVERLORD';
  toast(state, `${name} ENRAGED${fruit.enemyKind === 'splitter' ? ' · RUNNERS RELEASED' : ''}`, 2.2);
  renderer.impulseShake(0.6);
  combatImpact.trigger('boss');
  sfx.enemyWarning();
};
hud.mountMeta(save);
hud.onHero = (id) => selectHero(id);
hud.onToastRequest = (message) => toast(state, message, 2);
hud.onHeroPurchase = (id) => {
  if (getAuthToken()) {
    void performSignedInCatalogueAction('buy', `hero:${id}`).then((ok) => {
      if (!ok) return;
      toast(state, `${heroDef(id).name} unlocked!`, 2.6);
      sfx.unlockItem();
      selectHero(id);
    });
    return;
  }
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
hud.onBuyVIP = (tier) => buyVIP(tier); // P1-2
hud.onBuySkill = (id) => buySkill(id);
hud.onSaveUpdate = (newSave) => {
  Object.assign(save, newSave);
  persist();
  const authToken = getAuthToken();
  if (authToken && authToken !== cloudHydrationToken) {
    cloudHydrationToken = authToken;
    void fetchCloudSave().then(applyCloudSave);
  }
};
hud.onRename = (name) => {
  save.nickname = name.slice(0, 16);
  save.avatar = defaultAvatar(save.nickname);
  combos.setPlayer(save.nickname, save.avatar);
  persist();
};
hud.onSuper = () => trySuper();
hud.mountAbilityBar(save, (id) => tryHeroAbility(id), () => heroAbilityReadyAt);

let cloudHydrationToken: string | null = getAuthToken();

function applyCloudSave(remote: Record<string, any> | null): void {
  if (!remote) return;
  const cloud = remote as Partial<SaveData>;
  const merged = mergeSaves(save, cloud);
  // The cloud wallet and progression are authoritative for signed-in players;
  // the legacy merge helper is retained for offline/guest save migration only.
  Object.assign(save, getAuthToken() ? {
    ...merged,
    xp: cloud.xp ?? merged.xp,
    ownedHeroes: cloud.ownedHeroes ?? merged.ownedHeroes,
    towerXp: cloud.towerXp ?? merged.towerXp,
    towerLifetimeXp: cloud.towerLifetimeXp ?? merged.towerLifetimeXp,
    highScore: cloud.highScore ?? merged.highScore,
    rankedScore: cloud.rankedScore ?? merged.rankedScore,
    bestWave: cloud.bestWave ?? merged.bestWave,
    bestCombo: cloud.bestCombo ?? merged.bestCombo,
    games: cloud.games ?? merged.games,
    coins: cloud.coins ?? merged.coins,
    gems: cloud.gems ?? merged.gems,
    skillPoints: cloud.skillPoints ?? merged.skillPoints,
    skills: cloud.skills ?? merged.skills,
    ownedSkins: cloud.ownedSkins ?? merged.ownedSkins,
    hero: cloud.hero ?? merged.hero,
    bladeSkin: cloud.bladeSkin ?? merged.bladeSkin,
    wallSkin: cloud.wallSkin ?? merged.wallSkin,
    heroPerkRanks: cloud.heroPerkRanks ?? merged.heroPerkRanks,
    heroAbilityRanks: cloud.heroAbilityRanks ?? merged.heroAbilityRanks,
    heroAbilityLoadouts: cloud.heroAbilityLoadouts ?? merged.heroAbilityLoadouts,
    vipStatus: cloud.vipStatus ?? merged.vipStatus,
  } : merged);
  syncTowerProgression(save.towerXp, save.towerLifetimeXp);
  writeSave(save);
  state.hero = save.hero;
  state.heroXp = save.xp[save.hero] ?? 0;
  state.heroLevel = heroXpToLevel(state.heroXp);
  hud.mountMeta(save);
  applyEquippedBlade();
  refreshCurrentScreen();
}

void fetchCloudSave().then(applyCloudSave);
function equippedSlicer() {
  return findSlicer(getSlicers(), save.bladeSkin) || findSlicer(getEnabledSlicers(), save.bladeSkin);
}

function applyEquippedBlade(): void {
  const slicer = equippedSlicer();
  trail.applySlicer(slicer, hexToNumber(slicer?.color || '', heroDef(state.hero).trail));
}

function persist(): void {
  rewardSavePending = false;
  save.hero = state.hero;
  hud.refreshAbilityBar(save);
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
  if (!navigation.isInGame()) {
    hud.refreshHeroPick(state.hero, save);
    hud.mountShop(save);
    hud.mountSkills(save);
  }
}

function setMode(id: GameMode): void {
  if (id === 'ranked' || id === 'arena') {
    if (!navigation.isInGame()) openScreen(id === 'ranked' ? 'RANKED' : 'ARENA');
    else { toast(state, 'Arena and Ranked are online modes. Finish this run to open the PvP lobby.', 2.8); sfx.denied(); }
    return;
  }
  state.mode = id;
  save.mode = id;
  persist();
  hud.mountModes(id);
  sfx.select();
}

async function performSignedInCatalogueAction(action: CatalogueAction, id: string): Promise<boolean> {
  if (!getAuthToken()) return false;
  const result = await performCatalogueAction(action, id);
  if (!result) {
    toast(state, 'Could not update gear. Please try again.', 2.4);
    sfx.denied();
    refreshCurrentScreen();
    void fetchCloudSave().then(applyCloudSave);
    return false;
  }
  Object.assign(save, result.saveData);
  state.hero = save.hero;
  state.heroXp = save.xp[save.hero] ?? 0;
  state.heroLevel = heroXpToLevel(state.heroXp);
  applyEquippedBlade();
  wallSkinApply();
  wall.setHero(save.hero);
  writeSave(save);
  hud.refreshHeroPick(state.hero, save);
  hud.mountShop(save);
  hud.mountSkills(save);
  refreshCurrentScreen();
  if (action === 'buy' || action === 'sell') sfx.place();
  else sfx.select();
  return true;
}

function buySkin(id: string): void {
  if (getAuthToken()) {
    void performSignedInCatalogueAction('buy', id);
    return;
  }
  if (id.startsWith('hero:')) {
    hud.onHeroPurchase?.(id.slice(5) as HeroId);
    return;
  }
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
  if (getAuthToken()) {
    void performSignedInCatalogueAction('equip', id);
    return;
  }
  if (id.startsWith('hero:')) {
    const heroId = id.slice(5) as HeroId;
    if (canEquipHero(save, heroId)) selectHero(heroId);
    return;
  }
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
  if (getAuthToken()) {
    void performSignedInCatalogueAction('unequip', id);
    return;
  }
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
  if (getAuthToken()) {
    void performSignedInCatalogueAction('sell', id);
    return;
  }
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
  save.coins = Math.min(1_000_000, save.coins + sell);
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
  if (getAuthToken()) {
    void performSignedInCatalogueAction('buy-vip', tier).then((ok) => {
      if (ok) toast(state, `${tier.toUpperCase()} VIP unlocked`, 2.5);
    });
    return;
  }
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
    toast(state, `Not enough gems! Need ${cost}`, 2);
    sfx.denied();
    return;
  }

  // Purchase!
  save.gems! -= cost;
  save.vipStatus = tier;

  // Flat coin grant on purchase (schema has % bonuses, not purchase coins)
  const coins = vipTierPurchaseCoins(tier);
  save.coins = Math.min(1_000_000, save.coins + coins);

  toast(state, `${tier.toUpperCase()} VIP Unlocked! +${coins} coins`, 3);
  sfx.place();
  persist();
  hud.mountShop(save);
}

function wallSkinApply(): void {
  const skinId = isUnequippedSkin(save.wallSkin) ? '' : save.wallSkin;
  wall.applyWallSkin(WALL_SKINS.find((s) => s.id === skinId)?.color ?? 0x9a4034);
}

function buySkill(id: SkillId): void {
  if (getAuthToken()) {
    void performSignedInCatalogueAction('buy-skill', id);
    return;
  }
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
  if (getAuthToken()) {
    void performSignedInCatalogueAction('equip', `hero:${id}`);
    return;
  }
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
  state.currency += frutsForEvent(event, modeRules(state.mode).currencyMul);

  const result = applyRewards(save, reward, { heroId: state.hero });
  matchRewards.coins = Math.min(100_000, matchRewards.coins + result.coinsGained);
  matchRewards.gems = Math.min(100, matchRewards.gems + result.gemsGained);
  matchRewards.heroXp = Math.min(10_000, matchRewards.heroXp + result.heroXpGained);
  matchRewards.towerXp = Math.min(10_000, matchRewards.towerXp + result.towerXpGained);
  matchRewards.skillPoints = Math.min(100, matchRewards.skillPoints + result.perkPointsGained);
  state.heroXp = save.xp[state.hero] ?? 0;
  state.towerXp = save.towerXp;
  const towerState = getTowerXpState();
  state.towerXpToNext = towerState.nextLevelXp;
  state.towerXpProgress = towerState.progress;

  announceProgression(result, event.type);
  // Multiple contacts in a frame share one persistence/UI boundary.
  rewardSavePending = true;
  return result;
}

/** UI FEEDBACK step: level-ups, milestones and hero unlocks. */
function announceProgression(result: ProgressionResult, reason: RewardEvent['type']): void {
  if (result.gemsGained > 0) toast(state, `+${result.gemsGained} GEM${result.gemsGained > 1 ? 'S' : ''} · ${reason === 'loot_drop' ? 'RARE FRUIT' : 'BOSS BOUNTY'}`, 2.2);
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

function killFruit(fruit: Fruit, swipe: Vector3, burstMul = 1, chainDepth = 0): void {
  if (state.mode === 'campaign' && campaignRunSettled) return;
  const cutNormal = new Vector3(-swipe.z, 0, swipe.x).normalize();
  debris.spawnPair(fruit, swipe, cutNormal);
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
    wave: state.wave,
    combo: state.combo,
    ...(fruit.boss && state.mode === 'campaign' ? (() => { const bounty = campaignBoss(state.level, getLiveConfig().campaignBosses); return { coinsOverride: bounty.rewardCoins, gemsOverride: bounty.rewardGems }; })() : {}),
  });
  const scoreReward = result.scoreGained;
  const scr = worldPct(fruit.group.position.x, fruit.group.position.y + 0.35, fruit.group.position.z);
  if (fruit.boss) {
    floatingScore.spawn(`+${scoreReward}`, scr.nx, scr.ny, 'boss');
    const position = fruit.group.position;
    juice.burst(position.x, position.y, position.z, fruit.kind, swipe, 4);
    for (let burst = 0; burst < 8; burst++) {
      const angle = burst * Math.PI / 4;
      slashFx.spawn(position.x + Math.cos(angle), position.z + Math.sin(angle), FRUIT_DEFS[fruit.kind].splash, Math.cos(angle), Math.sin(angle), 1.5);
    }
    renderer.impulseShake(1.4);
    combatImpact.trigger('boss');
  } else if (fruit.enemyKind !== 'normal') {
    floatingScore.spawn(`+${scoreReward}`, scr.nx, scr.ny, 'special');
  } else {
    floatingScore.spawn(`+${scoreReward}`, scr.nx, scr.ny, 'normal');
  }

  const rules = modeRules(state.mode);
  chargeSuper(state, (3.5 + save.skills.flow * 1.2) * rules.superMul);
  sfx.slice(fruit.kind, Math.max(2, state.combo), false);
  if (state.combo >= 2) sfx.combo(state.combo);
  combos.onKills(1);
  recordWaveKill(state, fruit.splitChild);
  totalFruitsSliced += 1;
  if (!fruit.splitChild && !fruit.boss) {
    const loot = fruitLoot(++lootEligibleKills);
    if (loot.fruts || loot.coins || loot.gems) {
      award({ type: 'loot_drop', lootFruts: loot.fruts, lootCoins: loot.coins, lootGems: loot.gems });
      const drops = [loot.fruts && `+${loot.fruts} FRUTS`, loot.coins && `+${loot.coins} COINS`, loot.gems && `+${loot.gems} GEM`].filter(Boolean).join(' · ');
      floatingScore.spawn(drops, scr.nx, scr.ny - 3, 'special');
    }
  }
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
  if (fruit.boss && state.mode === 'campaign') {
    finishCampaignStage();
    return;
  }
  if (fruit.enemyKind === 'chainburst' && chainDepth < 3) {
    const x = fruit.group.position.x;
    const z = fruit.group.position.z;
    slashFx.spawn(x, z, 0xb4ff3a);
    renderer.impulseShake(0.35);
    renderer.impulseBlast(0.65);
    combatImpact.trigger('blast');
    sfx.bombExplode();
    detonatePulpPopper(fruits, fruit, (other) => killFruit(other, swipe, 1.1, chainDepth + 1));
  }
}

function finishCampaignStage(): void {
  const cleared = state.level;
  if (campaignRunSettled) return;
  const completion = finishCampaignAttempt(state, save.campaignProgress, true);
  if (!completion) return;
  save.campaignProgress = completion.progress;
  campaignStartStage = completion.nextStage;
  campaignRunSettled = true;
  award({ type: 'wave_cleared', wave: state.wave });
  writeSave(save);
  void syncCloudSave(save);
  // Snapshot rewards before menu cleanup; never start a new run here.
  const settlement = submitCurrentRun(true);
  quitToMenu(true);
  fruits.reset();
  document.getElementById('boss-health')?.classList.add('hidden');
  navigation.open('CAMPAIGN');
  if (completion.chapter) showCampaignChapter(cleared);
  const session = campaignSession;
  void settlement.finally(() => {
    if (session === campaignSession && navigation.state === 'CAMPAIGN') refreshCurrentScreen();
  });
}

function showGameOverOverlay(): void {
  const el = document.getElementById('hud-gameover');
  if (!el) return;
  el.classList.remove('hidden');
  el.classList.add('flex');
  const card = el.querySelector<HTMLElement>('.modal-card--over');
  const title = el.querySelector<HTMLElement>('.modal-title--over');
  const subtitle = el.querySelector<HTMLElement>('.modal-sub');
  const overMenu = document.getElementById('btn-over-menu');
  const campaignDefeat = state.mode === 'campaign';
  card?.classList.toggle('is-campaign-defeat', campaignDefeat);
  if (title) title.textContent = campaignDefeat ? 'WALL BREACHED' : 'Game Over';
  if (subtitle) subtitle.textContent = campaignDefeat ? `STAGE ${String(state.level).padStart(2, '0')} · ${campaignBoss(state.level, getLiveConfig().campaignBosses).name}` : 'Final score';
  if (overMenu) overMenu.textContent = campaignDefeat ? 'Campaign map' : 'Main menu';
  const oldFaceoff = card?.querySelector('.campaign-defeat-faceoff');
  if (oldFaceoff && !campaignDefeat) oldFaceoff.remove();
  if (campaignDefeat && card && !oldFaceoff) {
    const boss = campaignBoss(state.level, getLiveConfig().campaignBosses);
    const steam = getCachedSteamState();
    const faceoff = document.createElement('div');
    faceoff.className = 'campaign-defeat-faceoff';
    faceoff.setAttribute('aria-label', `Your defence versus ${boss.name}`);
    const side = (name: string, image: string, fallback: string, rival: boolean) => {
      const panel = document.createElement('div');
      panel.className = `campaign-defeat-fighter${rival ? ' is-rival' : ' is-player'}`;
      const portrait = document.createElement('span'); portrait.className = 'campaign-defeat-fighter__portrait';
      if (image) { const img = document.createElement('img'); img.src = image; img.alt = `${name} portrait`; img.referrerPolicy = 'no-referrer'; portrait.appendChild(img); }
      else { const initial = document.createElement('b'); initial.textContent = fallback; portrait.appendChild(initial); }
      const label = document.createElement('strong'); label.textContent = name;
      const kind = document.createElement('small'); kind.textContent = rival ? `STAGE ${String(state.level).padStart(2, '0')} OVERLORD` : 'YOUR DEFENCE';
      panel.append(portrait, label, kind);
      return panel;
    };
    const playerName = steam.personaName || save.nickname || 'Your hero';
    faceoff.append(side(playerName, steam.avatar || save.avatar, playerName.slice(0, 1).toUpperCase(), false));
    const clash = document.createElement('b'); clash.className = 'campaign-defeat-versus'; clash.textContent = 'VS'; faceoff.appendChild(clash);
    faceoff.append(side(boss.name, boss.revealImage || '', '☠', true));
    const score = document.getElementById('hud-final-score');
    score?.before(faceoff);
  }
  const finalScore = document.getElementById('hud-final-score');
  const finalWave = document.getElementById('hud-final-wave');
  if (finalScore) finalScore.textContent = `${state.score.toLocaleString()}`;
  if (finalWave) finalWave.textContent = campaignDefeat ? `DEFENCE FAILED · WAVE ${state.wave}` : `Wave ${state.wave}`;
}

function submitCurrentRun(completed: boolean): Promise<void> {
  if (runSettlementPending) return runSettlementPending;
  recordRun({ id: statsRunId, mode: state.mode, score: state.score, wave: state.wave, combo: sessionMaxCombo, kills: totalFruitsSliced, strokes: statsStrokes, hits: statsHits, completed, date: Date.now() });
  const steamState = getCachedSteamState();
  const feedbackEl = document.getElementById('lb-submit-feedback');
  if (completed && feedbackEl) feedbackEl.innerHTML = '<span>Syncing score and rewards…</span>';
  const submission = submitScore({
    nickname: save.nickname,
    avatar: save.avatar,
    hero: state.hero,
    mode: state.mode,
    score: state.score,
    wave: state.wave,
    fruitsSliced: totalFruitsSliced,
    maxCombo: sessionMaxCombo,
    rewards: { ...matchRewards },
    completed,
    steamId: steamState.steamId,
    steamPersona: steamState.personaName,
    steamAvatar: steamState.avatar,
  }).then((res) => {
    if (res?.wallet) {
      const localCampaign = save.campaignProgress;
      Object.assign(save, res.wallet.saveData);
      // Wallet settlement can arrive before the separate progress save. Keep
      // stages already cleared in this session when adopting the newer wallet.
      save.campaignProgress = sanitizeCampaignProgress({
        unlocked: Math.max(localCampaign.unlocked, save.campaignProgress?.unlocked ?? 1),
        cleared: [...localCampaign.cleared, ...(save.campaignProgress?.cleared ?? [])],
      });
      syncTowerProgression(save.towerXp, save.towerLifetimeXp);
      adoptAuthoritativeSave(res.wallet.revision);
      writeSave(save);
      hud.mountMeta(save);
      hud.mountShop(save);
      hud.mountSkills(save);
      hud.refreshHeroPick(state.hero, save);
    } else if (!res && getAuthToken()) {
      void fetchCloudSave().then(applyCloudSave);
    }
    if (res && feedbackEl && completed) {
      const monthly = res.monthlyRank ? ` · Monthly ${res.monthlyRank.title}` : '';
      feedbackEl.innerHTML = `<span class="font-bold text-lime-400">Global Rank: #${res.rank} ${res.isNewHigh ? '· NEW BEST SCORE!' : ''}${monthly}</span>`;
    } else if (!res && feedbackEl && completed) {
      feedbackEl.innerHTML = '<span class="text-slate-400">Score saved locally</span>';
    }
    if (completed) void hud.refreshMonthlyRank();
  });
  runSettlementPending = submission.finally(() => {
    if (runSettlementPending === settled) runSettlementPending = null;
  });
  const settled = runSettlementPending;
  return settled;
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
  persist();
  sfx.gameOver();
  sfx.stopAllLoops();

  showGameOverOverlay();

  void submitCurrentRun(state.mode !== 'campaign');

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
    toast(state, 'Need more Fruts');
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
    toast(state, 'Need more Fruts');
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
  campaignSession += 1;
  campaignStageSaving = false;
  bossRevealRemaining = 0;
  bossIntroEl.classList.add('hidden');
  resetState(state);
  combatImpact.clear();
  lastBossFruit = null;
  lastBossStep = -1;
  campaignRunSettled = false;
  if (state.mode === 'campaign') {
    state.level = campaignStartStage;
    state.wave = 1;
    state.waveInLevel = 1;
  }
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
  startLeaderboardRun(state.mode);
  const rules = modeRules(state.mode);
  wall.setHeroOnKeep(!rules.guest);
  bank.add('yellow', rules.yellow);
  bank.add('pink', rules.pink);
  bank.add('orange', rules.orange);
  combos.reset();
  floatingScore.reset();
  slashFx.reset();
  trail.reset();
  guestTrail.reset();
  blade.reset();
  playerContacts.reset();
  guestContacts.reset();
  wall.cancelMove();
  guestKeys.clear();
  guestStrokeId = 0;
  guestControl = { x: 3, z: -5.5, cooldown: 0 };
  guestTrailLife = 0;
  guestAttackHeld = false;
  coopActors.reset();
  coopActors.setPlayerOneColor(heroDef(state.hero).color);
  coopActors.setVisible(rules.guest);
  guestCursor?.classList.toggle('hidden', !rules.guest);
  guestHelp?.classList.toggle('hidden', !rules.guest);
  totalFruitsSliced = 0;
  statsRunId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  statsStrokes = statsHits = 0;
  lootEligibleKills = 0;
  matchRewards = { coins: 0, gems: 0, heroXp: 0, towerXp: 0, skillPoints: 0 };
  sessionMaxCombo = 0;
  sessionLeaks = 0;
  emit({ type: 'game_start' });
  const line = rules.guest
    ? `${heroDef(state.hero).name} + Player 2`
    : `${heroDef(state.hero).name} — ${rules.name}`;
  toast(state, line, 2.2);
  sfx.gameStart();
  if (rules.hints && save.games < 1) {
    window.setTimeout(() => {
      if (navigation.isPlaying() && state.running) toast(state, 'Slash fruit. Click a pad to build.', 2.4);
    }, 2600);
    window.setTimeout(() => {
      if (navigation.isPlaying() && state.running) toast(state, 'Fruts build artillery. Coins and gems buy shop gear.', 3);
    }, 5400);
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

  const contacts = slash.id < 0 ? guestContacts : playerContacts;
  contacts.begin(slash.id, debris.halves);
  const livesBefore = state.lives;

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

  // The trail follows the gesture; directional flashes mark actual contacts only.
  const slashMid = {
    x: (slash.from.x + slash.to.x) * 0.5,
    y: (slash.from.y + slash.to.y) * 0.5,
    z: (slash.from.z + slash.to.z) * 0.5,
  };
  const bladeColor = hexToNumber(slicerFx?.color || '', hero.trail);
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
  const cutBits = new Set<typeof debris.halves[number]>();

  for (const line of slashLines(slash)) {
    if (!state.running) break;
    fruits.dodgeSlash(line);
    for (const fruit of fruits.fruits) {
      if (!state.running) break;
      if (!fruit.alive || contacts.has(fruit)) continue;
      const res = strokeHitsFruit(line, fruit, radius);
      if (!res.hit) continue;

      contacts.add(fruit);
      const hitPos = {
        x: fruit.group.position.x,
        y: fruit.group.position.y,
        z: fruit.group.position.z,
      };
      const segment = res.hitSegment ?? line;
      const hitDx = segment.to.x - segment.from.x;
      const hitDz = segment.to.z - segment.from.z;
      slashFx.spawn(hitPos.x, hitPos.z, bladeColor, hitDx, hitDz, fruit.radius * 1.6);
      try {
        fireCreatorSlicerVfx(slicerFx?.id, 'onSlash', hitPos);
        if (isCrit) fireCreatorSlicerVfx(slicerFx?.id, 'onCrit', hitPos);
      } catch {
        /* Creator VFX must never break combat */
      }
      if (fruit.enemyKind === 'explosive') {
        // A blade cannot kill a Chem-Burst. It remains on the lane until a
        // turret destroys it, and each separate swipe is a costly mistake.
        fruits.hurt(fruit, 0, 'blade');
        resetCombo('explosive_mistake');
        renderer.impulseBlast(0.85);
        combatImpact.trigger('blast');
        sfx.bombExplode();
        maybeOver();
        continue;
      }
      if (fruit.kind === 'bomb') {
        if (line.speed > 7.5 || state.hero === 'ki') {
          sfx.bombParry();
          const parry = award({ type: 'bomb_parry', baseScore: FRUIT_DEFS.bomb.score, combo: state.combo });
          const scr = worldPct(hitPos.x, hitPos.y + 0.35, hitPos.z);
          floatingScore.spawn(`+${parry.scoreGained}`, scr.nx, scr.ny, 'critical');
          hits += 1;
          recordWaveKill(state, fruit.splitChild);
          emit({ type: 'bomb_parry' });
        } else {
          sfx.bombExplode();
          renderer.impulseBlast(1.1);
          combatImpact.trigger('blast');
          const damage = damageTower(state, Math.round(2 * dangerousLeakMultiplier(state.wave) * modeRules(state.mode).leakMul));
          state.waveLeaks += 1;
          toast(state, damage > 0 ? `Bomb blast · Tower −${damage} HP` : 'Bomb blast');
          maybeOver();
        }
        fruits.kill(fruit);
        continue;
      }
      hits += 1;
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
      const killed = fruits.hurt(fruit, dmg + wall.slots[MAIN_INDEX].level + towerBonus, 'blade');
      if (killed) killFruit(fruit, swipe);

    }
    for (const bit of debris.halves) {
      if (cutBits.has(bit) || !contacts.canReslice(bit) || contacts.has(bit)) continue;
      if (strokeHitsHalf(line, bit, radius * 0.35)) {
        cutBits.add(bit);
        contacts.add(bit);
      }
    }
  }

  for (const bit of cutBits) {
    if (!state.running) break;
    const px = bit.group.position.x;
    const py = bit.group.position.y;
    const pz = bit.group.position.z;
    const kind = bit.kind;
    const gen = debris.reslice(bit, swipe, new Vector3(-swipe.z, 0, swipe.x));
    if (!gen) continue;
    hits += 1;
    const isSecondCut = gen >= 2;
    const juiceGain = isSecondCut ? 3 : 1;
    bank.add(juiceHueFromKind(kind), juiceGain);
    juice.burst(px, py, pz, kind, swipe, isSecondCut ? 1.3 : 0.65);
    const resliceAward = award({ type: 'reslice', generation: gen, combo: state.combo });
    chargeSuper(state, (1.2 + save.skills.flow * 0.6) * (isSecondCut ? 1.6 : 1));
    slashFx.spawn(px, pz, FRUIT_DEFS[kind].splash, swipe.x, swipe.z, 0.6);
    const screen = worldPct(px, py + 0.35, pz);
    combos.onReslice(gen, screen.nx, screen.ny);
    if (isSecondCut) {
      state.comboTimer = Math.max(state.comboTimer + 0.4, 1.45);
      floatingScore.spawn(`+${resliceAward.scoreGained}`, screen.nx, screen.ny, 'reslice');
      sfx.slice(kind, Math.max(3, state.combo), false);
    } else {
      floatingScore.spawn(`+${resliceAward.scoreGained}`, screen.nx, screen.ny, 'reslice');
      sfx.slice(kind, 2, false);
    }
    emit({ type: 'reslice', amount: gen, fruitKind: kind, fruitFamily: fruitFamily(kind) });
  }

  if (hits > 0 && state.lives === livesBefore && state.running) {
    const comboBefore = state.combo;
    state.combo += hits;
    // One-off bonus for each newly crossed combo tier (data-driven thresholds).
    for (const tier of comboTiersBetween(comboBefore, state.combo)) {
      const bonus = award({ type: 'combo_milestone', combo: tier.combo });
      combos.onMilestone(bonus.scoreGained);
    }
    const comboEngineMul = heroCombatPerkMultiplier(state.hero, 'combo');
    state.comboTimer = (state.hero === 'jiju' ? 1.65 : 1.35) * comboEngineMul;
    sessionMaxCombo = Math.max(sessionMaxCombo, state.combo);
    combos.onHits(hits, state.combo);
    renderer.impulseShake(hero.shake * 0.35);
    emit({ type: 'combo', combo: state.combo });
  }
}

function tryHeroAbility(id: string): void {
  const ability = heroAbility(id);
  const loadout = save.heroAbilityLoadouts?.[state.hero] ?? [];
  if (!ability || !loadout.includes(id) || !navigation.canInteract() || !state.running) return;
  if ((heroAbilityReadyAt[id] ?? 0) > Date.now()) { sfx.denied(); return; }
  if (state.superJuice < ability.juiceCost) { toast(state, 'Need more juice', 1.4); sfx.denied(); return; }
  state.superJuice -= ability.juiceCost;
  heroAbilityReadyAt[id] = Date.now() + ability.cooldownMs;
  const swipe = new Vector3(0, 0.4, 1);
  const living = fruits.fruits.filter((fruit) => fruit.alive);
  const rank = save.heroAbilityRanks?.[id] ?? (id === 'jiju-1' ? 1 : 0);
  const damage = ability.damage + Math.max(0, rank - 1) * 8 + state.heroLevel * 1.5;
  let targets = living;
  if (ability.effect === 'pierce') targets = [...living].sort((a, b) => a.group.position.z - b.group.position.z).slice(0, Math.max(1, Math.ceil(living.length * 0.4)));
  else if (ability.effect === 'burst') targets = living.filter((fruit) => Math.abs(fruit.group.position.x) < 3.2);
  else if (ability.effect === 'bloom') targets = living.filter((fruit) => Math.abs(fruit.group.position.x) < 2.4 || Math.abs(fruit.group.position.z) < 3);
  renderer.impulseShake(ability.effect === 'shock' ? 1.4 : 0.8);
  toast(state, ability.name.toUpperCase(), 1.3);
  sfx.blitzStart();
  emit({ type: 'super' });
  for (const fruit of targets) {
    const tint = ability.effect === 'frost' ? 0x7dd3fc : ability.hero === 'tripos' ? 0xf472b6 : heroDef(state.hero).color;
    slashFx.spawn(fruit.group.position.x, fruit.group.position.z, tint);
    if (ability.effect === 'frost') fruit.brittle = Math.max(fruit.brittle, 2);
    if (fruits.hurt(fruit, damage, 'super')) killFruit(fruit, swipe, ability.effect === 'burst' ? 1.6 : 1.2);
  }
  hud.refreshAbilityBar(save);
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
    if (fruits.hurt(fruit, dmg, 'super')) killFruit(fruit, swipe, 2);
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
  if (on) {
    blade.reset();
    trail.reset();
    slashFx.reset();
    playerContacts.reset();
  }
  if (on) sfx.pause();
  else sfx.unpause();
}

function quitToMenu(explicitMenuAction = false): void {
  // The navigation guard owns the single confirmation; respect cancellation.
  if (explicitMenuAction) leaveMatchApproved = true;
  if (navigation.state !== 'MAIN_MENU' && !navigation.setState('MAIN_MENU')) {
    if (explicitMenuAction) leaveMatchApproved = false;
    return;
  }
  leaveMatchApproved = false;
  campaignSession += 1;
  campaignStageSaving = false;
  bossRevealRemaining = 0;
  bossIntroEl.classList.add('hidden');
  combatImpact.clear();
  persist();
  if (!campaignRunSettled && (totalFruitsSliced > 0 || state.score > 0)) void submitCurrentRun(false);
  document.getElementById('campaign-victory')?.classList.add('hidden');
  campaignStoryActive = false;
  document.getElementById('campaign-story')?.classList.add('hidden');
  state.running = false;
  guestKeys.clear();
  guestAttackHeld = false;
  coopActors.setVisible(false);
  guestCursor?.classList.add('hidden');
  guestHelp?.classList.add('hidden');
  wall.cancelMove();
  blade.consumeClick();
  blade.consumeSlash();
  document.getElementById('app')?.classList.remove('sidebar-open');
  document.getElementById('hud-gameover')?.classList.add('hidden');
  document.querySelector('.campaign-defeat-faceoff')?.remove();
  document.querySelector('.modal-card--over')?.classList.remove('is-campaign-defeat');
  hud.showPause(false);
  hud.showMenu(true);
  hud.mountMeta(save);
  if (navigation.state === 'MAIN_MENU') {
    document.getElementById('screen-hub')?.classList.remove('hidden');
    refreshCurrentScreen();
  }
  floatingScore.reset();
  combos.reset();
  slashFx.reset();
  trail.reset();
  guestTrail.reset();
  blade.reset();
  sfx.pause();
  sfx.stopAllLoops();
}

document.getElementById('campaign-victory-map')?.addEventListener('click', () => {
  quitToMenu(true);
  navigation.open('CAMPAIGN');
});

async function restartMatch(): Promise<void> {
  if (restartPending) return;
  restartPending = true;
  const screenBeforeRestart = navigation.state;
  try {
    // A manual restart ends the current run. Settle its earned rewards before
    // restart() clears matchRewards and replaces the one-use run token.
    if (state.running && (totalFruitsSliced > 0 || state.score > 0)) {
      persist();
      const settlement = submitCurrentRun(false);
      state.running = false;
      await settlement;
    } else if (runSettlementPending) {
      await runSettlementPending;
    }
  } catch (error) {
    console.warn('Run settlement failed during restart; local progress remains saved.', error);
  } finally {
    restartPending = false;
  }
  if (screenBeforeRestart !== 'MAIN_MENU' && navigation.state !== screenBeforeRestart) return;
  campaignStoryActive = false;
  document.getElementById('campaign-story')?.classList.add('hidden');
  hud.showPause(false);
  navigation.setState('PLAY');
  document.getElementById('app')?.classList.remove('sidebar-open');
  hud.showMenu(false);
  restart();
}

function showCampaignChapter(clearedStage: number): void {
  if (clearedStage < 5 || clearedStage > 100 || clearedStage % 5 !== 0) return;
  campaignStoryActive = true;
  campaignStoryFinal = clearedStage === 100;
  blade.reset();
  trail.reset();
  const title = document.getElementById('campaign-story-title');
  const text = document.getElementById('campaign-story-text');
  if (title) title.textContent = '';
  if (text) text.textContent = 'Uncovering the next chapter…';
  const continueButton = document.getElementById('campaign-story-continue');
  if (continueButton) continueButton.textContent = campaignStoryFinal ? 'VIEW VICTORY' : 'RETURN TO CAMPAIGN';
  document.getElementById('campaign-story')?.classList.remove('hidden');
  continueButton?.focus();
  void import('./ui/campaignStoryOverlay').then(({ renderCampaignChapter }) => {
    if (campaignStoryActive && state.mode === 'campaign') renderCampaignChapter(clearedStage);
  }).catch(() => {
    if (campaignStoryActive && text) text.textContent = 'The wall holds. Beyond it, another path opens through the orchard.';
  });
}

document.getElementById('campaign-story-continue')?.addEventListener('click', () => {
  if (!campaignStoryActive) return;
  campaignStoryActive = false;
  document.getElementById('campaign-story')?.classList.add('hidden');
  if (campaignStoryFinal) {
    state.running = false;
    document.getElementById('campaign-victory')?.classList.remove('hidden');
  }
});

function showBossIntro(level: number): void {
  const letterbox = document.getElementById('boss-letterbox');
  const title = document.getElementById('boss-intro-title');
  const subtitle = document.getElementById('boss-intro-subtitle');
  
  if (!letterbox || !title || !subtitle) return;

  // Creator Hub: fire boss onSpawn hooks at intro (best-effort; fruit spawn also fires).
  const stageBossKey = `boss-stage-${String(level).padStart(2, '0')}`;
  if (!fireStudioEvent(state.mode === 'campaign' ? stageBossKey : bossStudioKey('watermelon'), 'onSpawn')) {
    if (!fireStudioEvent(bossStudioKey('watermelon'), 'onSpawn')) fireStudioEvent(BOSS_OVERLORD_STUDIO_KEY, 'onSpawn');
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
  const campaign = state.mode === 'campaign' ? campaignBoss(level, getLiveConfig().campaignBosses) : null;
  const bossName = campaign?.name || tier[nameIndex] || tier[0];
  const art = document.getElementById('boss-intro-art') as HTMLImageElement | null;
  if (art) { art.src = campaign?.revealImage || ''; art.classList.toggle('hidden', !campaign?.revealImage); }
  
  title.textContent = bossName;
  subtitle.textContent = campaign ? `${campaign.title} · ${campaignWaves(level)} WAVES · ${campaign.rewardCoins.toLocaleString()} COINS${campaign.rewardGems ? ` · ${campaign.rewardGems} GEMS` : ''}` : `LEVEL ${level} OVERLORD`;
  letterbox.classList.remove('is-releasing');
  letterbox.classList.remove('hidden');
  bossRevealRemaining = BOSS_INTRO_DURATION;
}

function tickGuest(dt: number): void {
  if (!modeRules(state.mode).guest) return;
  const before = { x: guestControl.x, z: guestControl.z };
  const next = advanceLocalCoop(guestControl, guestKeys, guestAttackHeld, dt);
  guestControl = next.state;
  coopActors.movePlayerTwo(guestControl.x, guestControl.z);
  if (blade.pointerWorld) coopActors.movePlayerOne(blade.pointerWorld.x, blade.pointerWorld.z);
  const screen = worldPct(guestControl.x, 0.7, guestControl.z);
  if (guestCursor) {
    guestCursor.style.left = `${screen.nx}%`;
    guestCursor.style.top = `${screen.ny}%`;
  }
  if (guestTrailLife > 0) {
    guestTrailLife = Math.max(0, guestTrailLife - dt);
    if (guestTrailLife === 0) guestTrail.reset();
  }
  if (!next.slash) return;
  const moved = Math.hypot(guestControl.x - before.x, guestControl.z - before.z) > 0.12;
  const from = new Vector3(moved ? before.x : guestControl.x - 1.15, 0, before.z);
  const to = new Vector3(moved ? guestControl.x : guestControl.x + 1.15, 0, guestControl.z);
  guestTrail.sync([from, to]);
  guestTrailLife = 0.23;
  slashFx.spawn(guestControl.x, guestControl.z, 0x93c5fd);
  resolveSlash({
    id: --guestStrokeId,
    from,
    to,
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
    if (fruit.enemyKind === 'explosive') continue;
    if (fruit.kind === 'bomb') {
      recordWaveKill(state, fruit.splitChild);
      fruits.kill(fruit);
      continue;
    }
    if (fruits.hurt(fruit, dmg, 'super')) killFruit(fruit, swipe);
  }
}

function simulate(dt: number): void {
  if (campaignStoryActive || campaignStageSaving) {
    blade.consumeClick();
    blade.consumeSlash();
    blade.consumeStrokeEnd();
    return;
  }
  if (!navigation.isPlaying() || !state.running) {
    blade.consumeClick();
    blade.consumeSlash();
    blade.consumeStrokeEnd();
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

  if (bossRevealRemaining > 0) {
    bossRevealRemaining = Math.max(0, bossRevealRemaining - dt);
    bossIntroEl.classList.toggle('is-releasing', bossRevealRemaining <= 0.7);
    if (bossRevealRemaining === 0) bossIntroEl.classList.add('hidden');
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
  if (!state.running) return;
  const finishedStroke = blade.consumeStrokeEnd();
  if (finishedStroke != null) {
    statsStrokes++;
    if (playerContacts.missed(finishedStroke)) resetCombo('miss'); else statsHits++;
  }

  if (state.bossIntro) {
    if (state.bossIntroTimer === BOSS_INTRO_DURATION) {
      bossIntroEl.classList.remove('hidden');
      showBossIntro(state.level);
    }
    state.bossIntroTimer -= dt;
    if (state.bossIntroTimer <= 0) {
      state.bossIntro = false;
      bossIntroEl.classList.add('hidden');
      state.waveSpawning = true;
      const customBoss = state.mode === 'campaign' ? campaignBoss(state.level, getLiveConfig().campaignBosses) : null;
      const plan = planBossWave(state.wave, state.mode, state.level, customBoss?.difficulty);
      state.waveTotal = plan.items.length;
      state.waveKilled = 0;
      state.waveLeaks = 0;
      state.waveIsBoss = true;
      fruits.beginWave(plan.items, plan.gap, plan.hpScale);
      toast(state, plan.subtitle ? `${plan.title} — ${plan.subtitle}` : plan.title, 1.8);
      sfx.wave();
    }
  } else if (!state.waveSpawning) {
    state.waveClearTimer -= dt;
    if (state.waveClearTimer <= 0) {
      state.waveSpawning = true;
      const totalWavesInLevel = wavesPerLevel(state.level, state.mode);
      const currentWaveInLevel = state.waveInLevel;
      const plan = planWave(state.wave, state.mode, state.level, currentWaveInLevel, totalWavesInLevel);
      state.waveTotal = plan.items.length;
      state.waveKilled = 0;
      state.waveLeaks = 0;
      state.waveIsBoss = plan.boss;
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
    const totalWavesInLevel = wavesPerLevel(state.level, state.mode);
    const completedWavesInLevel = state.waveInLevel;
    // Pool objects retain their last kind after death, so inspecting all dead
    // pooled fruits can accidentally classify many later waves as boss waves.
    const wasBoss = consumeBossWaveCompletion(state);

    if (wasBoss && state.mode === 'campaign') {
      if (campaignBossDefeated(state, wasBoss)) finishCampaignStage();
      else { state.lives = 0; maybeOver(); }
      return;
    }

    // Perfect wave: every fruit killed (no leaks that wave)
    const perfect = isPerfectWave(state);
    award({ type: 'wave_cleared', wave: state.wave });
    if (perfect) {
      const perfectResult = award({ type: 'perfect_wave', wave: state.wave });
      toast(state, `Perfect wave! +${perfectResult.scoreGained}`, 1.4);
    }

    const clearedWave = state.wave;
    state.wave += 1;
    
    if (wasBoss) {
      toast(state, `Level ${state.level} complete!`, 2);
      state.level += 1;
      state.waveInLevel = 1;
      state.waveClearTimer = 2.2;
    } else {
      toast(state, 'Wave clear', 1.3);
        if (completedWavesInLevel >= totalWavesInLevel) {
        if (state.mode === 'horde') {
          state.level += 1;
          state.waveInLevel = 1;
          state.waveClearTimer = 1.2;
        } else {
          state.bossIntro = true;
          state.bossIntroTimer = BOSS_INTRO_DURATION;
        }
      } else {
        state.waveInLevel += 1;
        state.waveClearTimer = 2.2;
      }
    }
    
    emit({ type: 'wave_clear', wave: clearedWave, lives: state.lives, maxLives: state.maxLives });
  }

  fruits.update(dt, state, (fruit) => {
    const enemy = enemyRule(fruit.enemyKind);
    const baseCost = leakCost(state, fruit.kind, fruit.boss);
    const towerGuardianMul = heroCombatPerkMultiplier(state.hero, 'tower');
    const dangerScale = fruit.boss || fruit.kind === 'bomb' || fruit.enemyKind === 'explosive'
      ? dangerousLeakMultiplier(state.wave)
      : 1;
    const leakDamage = Math.round(baseCost * enemy.towerDamageOnLeak * towerGuardianMul * dangerScale);
    damageTower(state, state.mode === 'campaign' && fruit.boss ? state.lives : leakDamage);
    sessionLeaks += 1;
    state.waveLeaks += 1;
    sfx.leak();
    renderer.impulseShake(fruit.boss ? 1.8 : 0.9);
    combatImpact.trigger(fruit.boss ? 'boss' : 'leak');
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
  const bossHealth = document.getElementById('boss-health');
  const activeBoss = fruits.fruits.find((fruit) => fruit.alive && fruit.boss);
  if (activeBoss !== lastBossFruit) { lastBossFruit = activeBoss ?? null; lastBossStep = -1; }
  if (activeBoss) {
    const step = Math.floor(activeBoss.bob / (Math.PI * 2));
    if (lastBossStep >= 0 && step > lastBossStep) {
      renderer.impulseShake(activeBoss.enemyKind === 'armored' ? 0.55 : 0.28);
      combatImpact.trigger('stomp');
      sfx.bossStep(activeBoss.enemyKind);
    }
    lastBossStep = step;
  }
  if (bossHealth) {
    bossHealth.classList.toggle('hidden', !activeBoss || !navigation.isInGame());
    if (activeBoss) {
      const percent = Math.max(0, Math.min(100, Math.ceil(activeBoss.hp / activeBoss.maxHp * 100)));
      const name = state.mode === 'campaign' ? campaignBoss(state.level, getLiveConfig().campaignBosses).name : 'OVERLORD';
      const label = document.getElementById('boss-health-name');
      const value = document.getElementById('boss-health-value');
      const fill = document.getElementById('boss-health-fill') as HTMLElement | null;
      if (label && label.textContent !== name) label.textContent = name;
      if (value) value.textContent = `${percent}%`;
      if (fill) fill.style.width = `${percent}%`;
      bossHealth.setAttribute('aria-valuenow', String(percent));
    }
  }

  tickGuest(dt);

  const didShoot = wall.update(dt, fruits.fruits, juice, bank, (hit) => {
    if (hit.impulseX) hit.fruit.impulseX += hit.impulseX;
    if (hit.impulseZ) hit.fruit.impulseZ += hit.impulseZ;
    if (hit.brittle) hit.fruit.brittle = Math.max(hit.fruit.brittle, 2.4);
    const swipe = new Vector3(0, 0.2, 1);
    const towerBonus = towerDamageBonus();
    const dmg = Math.round(hit.damage * (1 + save.skills.steel * 0.12) + towerBonus);
    if (hit.fruit.boss && performance.now() - lastBossHitAt > 420) {
      lastBossHitAt = performance.now();
      sfx.bossHit();
      renderer.impulseShake(0.22);
    }
    if (fruits.hurt(hit.fruit, dmg)) {
      killFruit(hit.fruit, swipe, hit.split || hit.puddle ? 1.8 : 1);
    }
  });
  if (!state.running) return;
  if (didShoot) sfx.fire();

  juice.update(dt);
  debris.update(dt);
  slashFx.update(dt);
  combos.update(dt, state.combo, state.comboTimer);
  floatingScore.update(dt);
  renderer.update(dt);
  blade.fadeTrail();
  trail.sync(blade.trail);
  trail.update(dt);
  guestTrail.update(dt);
  if (rewardSavePending) persist();
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
  if (state.mode === 'coop' && navigation.canInteract() && state.running &&
      !(e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable="true"]')) &&
      (e.code.startsWith('Arrow') || e.code === 'Enter' || e.code === 'NumpadEnter')) {
    e.preventDefault();
    if (e.code === 'Enter' || e.code === 'NumpadEnter') guestAttackHeld = true;
    else guestKeys.add(e.code);
    return;
  }
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
window.addEventListener('keyup', (e) => {
  if (e.code === 'Enter' || e.code === 'NumpadEnter') guestAttackHeld = false;
  else guestKeys.delete(e.code);
});
window.addEventListener('blur', () => { guestKeys.clear(); guestAttackHeld = false; });

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
document.getElementById('btn-game-settings')?.addEventListener('click', () => setPaused(!navigation.isPaused()));
document.getElementById('btn-game-menu-quick')?.addEventListener('click', () => {
  if (state.running) setPaused(true);
  else quitToMenu();
});
document.getElementById('btn-pause-mute')?.addEventListener('click', () => {
  muteBtn.click();
  const pauseMute = document.getElementById('btn-pause-mute');
  if (pauseMute) pauseMute.textContent = muteBtn.dataset.muted === 'true' ? 'Unmute sound' : 'Mute sound';
});
restartBtn.addEventListener('click', () => restartMatch());
quitMenuBtn.addEventListener('click', () => quitToMenu(true));
retryBtn.addEventListener('click', () => restartMatch());
overMenuBtn.addEventListener('click', () => {
  if (state.mode === 'campaign') { quitToMenu(true); navigation.open('CAMPAIGN'); }
  else quitToMenu(true);
});
if (muteBtn) {
  mountLucideIcon(muteBtn, 'Volume2', 20);
  muteBtn.dataset.muted = 'false';
  muteBtn.addEventListener('click', () => {
    const muted = sfx.toggleMute();
    muteBtn.dataset.muted = String(muted);
    muteBtn.setAttribute('aria-pressed', String(muted));
    mountLucideIcon(muteBtn, muted ? 'VolumeX' : 'Volume2', 20);
    muteBtn.title = muted ? 'Unmute' : 'Mute';
  });
}

/** Shared launch path for every PLAY entry point (menu button, screens). */
function launchMatch(): void {
  if (state.mode === 'arena' || state.mode === 'ranked') {
    navigation.open(state.mode === 'ranked' ? 'RANKED' : 'ARENA');
    return;
  }
  persist();
  startMatchWithOptionalMedia(
    () => sfx.unlock(),
    () => fruitAtlas.load(),
    () => {
      wall.applySkins();
      wall.setHero(save.hero);
      wallSkinApply();
      applyEquippedBlade();
      restartMatch();
    },
    (asset, error) => console.warn(`Optional ${asset} could not load; gameplay continues.`, error),
  );
}

function launchCampaign(stage: number): void {
  campaignStartStage = Math.max(1, Math.min(save.campaignProgress.unlocked, Math.min(100, Math.floor(stage))));
  state.mode = 'campaign';
  save.mode = 'campaign';
  persist();
  launchMatch();
}

/* ═══════════════ PHASE 2 GAME SCREENS ═══════════════
   Screens read the live save and route every mutation back through the
   existing gameplay functions, so there is no second economy path. */
installGameScreens({
  getSave: () => save,
  onPlay: () => {
    if (state.mode === 'campaign') navigation.open('CAMPAIGN');
    else launchMatch();
  },
  onStartCampaign: (stage) => launchCampaign(stage),
  onSelectMode: (mode) => { setMode(mode); refreshCurrentScreen(); },
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
  onUnequipItem: (id) => {
    unequipItem(id);
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
  onToggleAbility: (id) => {
    if (getAuthToken()) { void performSignedInCatalogueAction('equip-ability', id); return; }
    const ability = heroAbility(id); if (!ability || !save.ownedHeroes.includes(ability.hero) || heroXpToLevel(save.xp[ability.hero] ?? 0) < ability.unlockLevel) return;
    const equipped = save.heroAbilityLoadouts?.[ability.hero] ?? [];
    if (!equipped.includes(id) && equipped.length >= 3) { toast(state, 'Choose up to three powers', 1.8); sfx.denied(); return; }
    save.heroAbilityLoadouts ??= { jiju: ['jiju-1'], topfu: [], lagen: [], tripos: [], ki: [] };
    if ((save.heroAbilityRanks?.[id] ?? 0) < 1 && id !== 'jiju-1') { sfx.denied(); return; }
    save.heroAbilityLoadouts[ability.hero] = equipped.includes(id) ? equipped.filter((item) => item !== id) : [...equipped, id];
    persist(); refreshCurrentScreen();
  },
  onUpgradeAbility: (id) => {
    if (getAuthToken()) { void performSignedInCatalogueAction('buy-ability', id); return; }
    const ability = heroAbility(id); if (!ability || !save.ownedHeroes.includes(ability.hero) || heroXpToLevel(save.xp[ability.hero] ?? 0) < ability.unlockLevel || save.skillPoints < 1 || (save.heroAbilityRanks?.[id] ?? 0) >= 3) { sfx.denied(); return; }
    const level = heroXpToLevel(save.xp[ability.hero] ?? 0); if (level < ability.unlockLevel) { sfx.denied(); return; }
    save.skillPoints -= 1; save.heroAbilityRanks ??= {}; save.heroAbilityRanks[id] = (save.heroAbilityRanks[id] ?? 0) + 1;
    if (save.heroAbilityRanks[id] === 1 && (save.heroAbilityLoadouts?.[ability.hero] ?? []).length < 3) { save.heroAbilityLoadouts ??= { jiju: ['jiju-1'], topfu: [], lagen: [], tripos: [], ki: [] }; save.heroAbilityLoadouts[ability.hero] = [...(save.heroAbilityLoadouts[ability.hero] ?? []), id]; }
    persist(); refreshCurrentScreen(); sfx.unlockItem();
  },
  onBuyHero: (id) => {
    hud.onHeroPurchase?.(id);
    refreshCurrentScreen();
  },
  getProfileStats: () => ({
    bestCombo: save.bestCombo ?? 0,
    season: currentSeasonLabel(),
  }),
  showLobbyPage: (page) => hud.showPage(page),
});

/**
 * Leaving a live match must always be deliberate (§10). The guard runs for
 * every navigation, so PLAY → anywhere is covered once, not per button.
 */
let leavePromptOpen = false;
let leaveMatchApproved = false;
navigation.addGuard((change) => {
  const leavingMatch =
    (change.from === 'PLAY' || change.from === 'PAUSED') && change.to !== 'PAUSED' && change.to !== 'PLAY';
  if (!leavingMatch || !state.running) return true;
  if (leaveMatchApproved) {
    leaveMatchApproved = false;
    return true;
  }
  if (!leavePromptOpen) {
    leavePromptOpen = true;
    void confirmModal({
      title: 'Leave this match?',
      message: 'Your earned XP and coins are saved, but the current wave will end.',
      confirmLabel: 'Leave match',
      cancelLabel: 'Keep playing',
      tone: 'danger',
    }).then((confirmed) => {
      leavePromptOpen = false;
      if (confirmed) {
        leaveMatchApproved = true;
        quitToMenu();
      }
    });
  }
  return false;
});

/**
 * Keep the legacy lobby and the hub mutually exclusive. The screen registry
 * already shows/hides `screen-hub` for every hub-tab nav state (MAIN_MENU,
 * HEROES, INVENTORY, SHOP, PROFILE, CO_OP — see screens/index.ts), so this
 * only needs to gate the *legacy* `hud-start` dashboard, which the registry
 * doesn't know about.
 */
navigation.onChange((change) => {
  const gate = document.getElementById('hud-start');
  if (change.to === 'MAIN_MENU') gate?.classList.add('hidden');
});

installCombatDiagnostics(() => {
  const targets = fruits.fruits.filter((fruit) => fruit.alive).map((fruit) => {
    const pos = worldPct(fruit.group.position.x, fruit.group.position.y, fruit.group.position.z);
    return { id: fruit.spawnSerial, kind: fruit.kind, enemyKind: fruit.enemyKind, hp: fruit.hp,
      splitChild: fruit.splitChild, x: pos.nx * window.innerWidth / 100, y: pos.ny * window.innerHeight / 100 };
  });
  const firstTarget = targets[0];
  const canvasRect = canvas.getBoundingClientRect();
  const stack = firstTarget && document.elementsFromPoint
    ? document.elementsFromPoint(firstTarget.x, firstTarget.y).map((element) => ({
      tag: element.tagName.toLowerCase(), id: element.id, className: String(element.className || ''),
    }))
    : [];
  const topElement = firstTarget ? document.elementFromPoint(firstTarget.x, firstTarget.y) : null;
  return {
    phase: navigation.state,
    elapsed: state.elapsed,
    lastSlash: blade.lastSlash ? { id: blade.lastSlash.id, speed: blade.lastSlash.speed, pointer: blade.lastSlash.pointer } : null,
    pointer: blade.diagnostics(),
    canvasRect: { left: canvasRect.left, top: canvasRect.top, width: canvasRect.width, height: canvasRect.height },
    devicePixelRatio: window.devicePixelRatio,
    camera: {
      position: renderer.camera.position.toArray(),
      projectionMatrix: renderer.camera.projectionMatrix.toArray(),
      frustum: { left: renderer.camera.left, right: renderer.camera.right, top: renderer.camera.top, bottom: renderer.camera.bottom },
    },
    projectedTargetHitTest: firstTarget ? {
      x: firstTarget.x,
      y: firstTarget.y,
      elementFromPoint: topElement ? { tag: topElement.tagName.toLowerCase(), id: topElement.id, className: String(topElement.className || '') } : null,
      elementsFromPoint: stack,
    } : null,
    score: state.score,
    combo: state.combo,
    comboTimer: state.comboTimer,
    wave: state.wave,
    waveTotal: state.waveTotal,
    waveKilled: state.waveKilled,
    waveLeaks: state.waveLeaks,
    lives: state.lives,
    heroXp: state.heroXp,
    heroLevel: state.heroLevel,
    coins: save.coins,
    towerXp: save.towerXp,
    activeSlashes: slashFx.group.children.filter((mesh) => mesh.visible).length,
    trailDrawCount: trail.line.geometry.drawRange.count,
    trailVertices: Array.from(trail.line.geometry.getAttribute('position').array),
    targets,
  };
});

loop.start();
