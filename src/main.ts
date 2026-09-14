import { Vector3 } from 'three';
import './style.css';
import { Sfx } from './audio/sfx';
import { GameLoop } from './engine/loop';
import { GameRenderer } from './engine/renderer';
import { fruitAtlas } from './game/atlas';
import { Field } from './game/field';
import { FRUIT_DEFS, FruitField, fruitFamily, type Fruit } from './game/fruits';
import { HEROES, heroDef, heroHitRadius, heroSlashDamage, heroXpToLevel, type HeroId } from './game/heroes';
import { JuiceBank, JuiceSystem, juiceHueFromKind } from './game/juice';
import { WALL_SKINS, defaultAvatar, loadSave, writeSave, mergeSaves, type GameMode, type SaveData } from './game/save';
import { findSlicer, hexToNumber } from './game/slicers';
import { SKILLS, type SkillId } from './game/skills';
import { SlashFx } from './game/slashfx';
import { segmentHitsFruit, segmentHitsHalf, SliceDebris } from './game/slicer';
import { modeRules } from './game/modes';
import { addScore, chargeSuper, createState, leakCost, resetState, toast } from './game/state';
import { getEnabledSlicers, getLiveConfig, getSlicers, loadLiveConfig } from './services/liveConfig';
import { planWave } from './game/waves';
import { BladeTrail } from './game/trail';
import { canPlaceTurret, turretDef, type TurretKind } from './game/turrets';
import { WallBase } from './game/wall';
import { MAIN_INDEX, PADS, slotIndexAt, upgradeCost } from './game/world';
import { BladeInput, type Slash } from './input/blade';
import { ComboFx } from './ui/combos';
import { Hud } from './ui/hud';
import { submitScore, syncCloudSave, fetchCloudSave } from './services/api';
import { initAchievementsCache } from './services/achievements';
import { reportGameEvent } from './services/progress';
import { getCachedSteamState } from './services/steam';
import type { GameEvent } from './game/requirements';
import { enemyRule } from './game/enemies';
import { getTowerXpState } from './game/towerProgression';
import { navigation } from './game/navigation';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
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

const save: SaveData = loadSave();
const renderer = new GameRenderer(canvas);
const state = createState();
state.running = false;
state.hero = save.hero;
state.heroXp = save.xp[save.hero] ?? 0;
state.heroLevel = heroXpToLevel(state.heroXp);
const sfx = new Sfx();
const hud = new Hud();
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

renderer.scene.add(field.group, juice.mesh, wall.group, trail.line, trail.glowLine, trail.sparks, slashFx.group);

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

function resetCombo(reason?: string): void {
  state.combo = 0;
  state.comboTimer = 0;
}

function getTowerProgressionBonuses(): { damageBonus: number; hpBonus: number } {
  const tower = getTowerXpState();
  const level = tower.level;
  const damageBonus = Math.floor(level / 2);
  const hpBonus = level >= 5 ? Math.floor((level - 4) * 0.5) : 0;
  return { damageBonus, hpBonus };
}

initAchievementsCache();
void loadLiveConfig().then(() => {
  applyEquippedBlade();
  hud.mountShop(save);
});

fruits.onSpawn = () => undefined;
hud.mountMeta(save);
hud.onHero = (id) => selectHero(id);
hud.onMode = (id) => setMode(id);
hud.onBuySkin = (id) => buySkin(id);
hud.onEquipItem = (id) => equipItem(id);
hud.onSellItem = (id) => sellItem(id);
hud.onDeleteItem = (id) => deleteItem(id);
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
  save.xp[state.hero] = state.heroXp;
  save.highScore = Math.max(save.highScore, state.score);
  if (state.mode === 'ranked') save.rankedScore = Math.max(save.rankedScore, state.score);
  save.bestWave = Math.max(save.bestWave, state.wave);
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
  }

  if (slicer) {
    save.bladeSkin = id;
  } else if (wall) {
    save.wallSkin = id;
  }
  applyEquippedBlade();
  wallSkinApply();
  persist();
  sfx.place();
}

function equipItem(id: string): void {
  if (!save.ownedSkins.includes(id)) return;
  const slicer = findSlicer(getSlicers(), id) || findSlicer(getLiveConfig().slicers, id);
  const wall = WALL_SKINS.find((w) => w.id === id);
  if (slicer) save.bladeSkin = id;
  else if (wall) save.wallSkin = id;
  else return;
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
  if (save.bladeSkin === id) save.bladeSkin = 'blade-default';
  if (save.wallSkin === id) save.wallSkin = 'wall-brick';
  if (!save.ownedSkins.includes('blade-default')) save.ownedSkins.push('blade-default');
  if (!save.ownedSkins.includes('wall-brick')) save.ownedSkins.push('wall-brick');
  applyEquippedBlade();
  wallSkinApply();
  persist();
  sfx.place();
}

function deleteItem(id: string): void {
  if (id === 'blade-default' || id === 'wall-brick') {
    sfx.denied();
    return;
  }
  if (!save.ownedSkins.includes(id)) return;
  save.ownedSkins = save.ownedSkins.filter((x) => x !== id);
  if (save.bladeSkin === id) save.bladeSkin = 'blade-default';
  if (save.wallSkin === id) save.wallSkin = 'wall-brick';
  if (!save.ownedSkins.includes('blade-default')) save.ownedSkins.push('blade-default');
  if (!save.ownedSkins.includes('wall-brick')) save.ownedSkins.push('wall-brick');
  applyEquippedBlade();
  wallSkinApply();
  persist();
  sfx.select();
}

function wallSkinApply(): void {
  wall.applyWallSkin(WALL_SKINS.find((s) => s.id === save.wallSkin)?.color ?? 0x9a4034);
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
  persist();
  state.hero = id;
  state.heroXp = save.xp[id] ?? 0;
  state.heroLevel = heroXpToLevel(state.heroXp);
  save.hero = id;
  applyEquippedBlade();
  writeSave(save);
  hud.refreshHeroPick(id, save);
  sfx.select();
}

function grantHeroXp(n: number): void {
  state.heroXp += n;
  const next = heroXpToLevel(state.heroXp);
  if (next > state.heroLevel) {
    const gained = next - state.heroLevel;
    state.heroLevel = next;
    save.skillPoints += gained;
    toast(state, `${heroDef(state.hero).name} Lv ${next}  +${gained} skill point${gained > 1 ? 's' : ''}`, 1.8);
    emit({ type: 'hero_level' });
    sfx.unlockItem();
  }
  persist();
}

function killFruit(fruit: Fruit, swipe: Vector3, burstMul = 1): void {
  debris.spawnPair(fruit, swipe, new Vector3(0, 0, 1));
  const mul = burstMul * (fruit.brittle > 0 ? 2 : 1);
  const juiceMul = equippedSlicer()?.juiceMul ?? 1;
  juice.burst(fruit.group.position.x, fruit.group.position.y, fruit.group.position.z, fruit.kind, swipe, mul);
  const juiceAmt = Math.max(1, Math.round((fruit.brittle > 0 ? 3 : 2) * juiceMul));
  bank.add(juiceHueFromKind(fruit.kind), juiceAmt);
  
  const enemy = enemyRule(fruit.enemyKind);
  const baseScore = FRUIT_DEFS[fruit.kind].score * (fruit.boss ? 4 : 1);
  const scoreReward = Math.round(baseScore * enemy.scoreMultiplier);
  const baseXp = fruit.boss ? 4 : 1;
  const xpReward = Math.round(baseXp * enemy.xpMultiplier);
  
  addScore(state, scoreReward);
  grantHeroXp(xpReward);
  const rules = modeRules(state.mode);
  chargeSuper(state, (6 + save.skills.flow * 2) * rules.superMul);
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

function maybeOver(): void {
  if (state.lives > 0) return;
  state.running = false;
  navigation.setState('GAME_OVER');
  save.games += 1;
  save.coins += Math.max(2, Math.floor(state.score / 18));
  persist();
  sfx.gameOver();

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
    toast(state, 'Already Lv 5');
    return;
  }
  if (state.currency < cost) {
    toast(state, 'Need more money');
    sfx.denied();
    return;
  }
  state.currency -= cost;
  wall.upgradeSelected();
  toast(state, `${slot.main ? 'Main' : slot.kind} is now Lv ${slot.level}/5`);
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
  sfx.stopAllLoops();
  state.running = true;
  const rules = modeRules(state.mode);
  bank.add('yellow', rules.yellow);
  bank.add('pink', rules.pink);
  bank.add('orange', rules.orange);
  combos.reset();
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
        from: slash.from.clone().add(new Vector3(px * s * side, 0, pz * s * side)),
        to: slash.to.clone().add(new Vector3(px * s * side, 0, pz * s * side)),
        speed: slash.speed,
        charge: slash.charge,
        pointer: slash.pointer,
      });
    }
  }
  return lines;
}

function resolveSlash(slash: Slash): void {
  const hero = heroDef(state.hero);
  const pointer = slash.pointer;
  const radius = heroHitRadius(state.hero, pointer) + save.skills.reach * 0.08;
  const slicerFx = equippedSlicer();
  const dmg =
    (heroSlashDamage(state.hero, state.heroLevel, state.combo, slash.charge, pointer) + save.skills.edge * 4) *
    (slicerFx?.damageMul ?? 1);
  const brittleBonus = slicerFx?.brittleBonus ?? 0;
  let hits = 0;
  const swipe = new Vector3().subVectors(slash.to, slash.from);
  if (swipe.lengthSq() < 0.0001) swipe.set(1, 0, 0);
  else swipe.normalize();

  const cutBits = new Set<typeof debris.halves[number]>();
  for (const line of slashLines(slash)) {
    fruits.dodgeSlash(line);
    for (const fruit of fruits.fruits) {
      if (!fruit.alive) continue;
      if (!segmentHitsFruit(line.from, line.to, fruit, radius).hit) continue;
      hits += 1;
      slashFx.spawn(fruit.group.position.x, fruit.group.position.z, hexToNumber(slicerFx?.color || '', hero.trail));
      if (fruit.kind === 'bomb') {
        if (line.speed > 8 || state.hero === 'ki') {
          sfx.bombParry();
          addScore(state, FRUIT_DEFS.bomb.score);
          grantHeroXp(1);
          emit({ type: 'bomb_parry' });
        } else {
          sfx.bombExplode();
          state.lives -= 2;
          toast(state, 'Bomb!');
          maybeOver();
        }
        fruits.kill(fruit);
        continue;
      }
      if (state.hero === 'topfu' || brittleBonus > 0) {
        const base = state.hero === 'topfu' ? (pointer === 'touch' ? 2.8 : 2.1) : 0;
        fruit.brittle = Math.max(fruit.brittle, base + brittleBonus);
        if (state.hero === 'topfu') {
          fruit.impulseX += swipe.x * 2.2;
          fruit.impulseZ += swipe.z * 2.2;
        }
      }
      const towerBonus = getTowerProgressionBonuses().damageBonus;
      if (fruits.hurt(fruit, dmg + wall.slots[MAIN_INDEX].level + towerBonus)) killFruit(fruit, swipe);
    }
    for (const bit of debris.halves) {
      if (segmentHitsHalf(line.from, line.to, bit, radius * 0.35)) cutBits.add(bit);
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
    juice.burst(px, py, pz, kind, swipe, 0.55);
    addScore(state, 4 * gen);
    chargeSuper(state, 2 + save.skills.flow);
    slashFx.spawn(px, pz, FRUIT_DEFS[kind].splash);
    const screen = worldPct(px, py + 0.35, pz);
    combos.onReslice(gen, screen.nx, screen.ny);
    sfx.slice(kind, 2, false);
    emit({ type: 'reslice', amount: gen, fruitKind: kind, fruitFamily: fruitFamily(kind) });
  }

  if (hits > 0) {
    state.combo = state.hero === 'jiju' ? state.combo + hits : Math.max(1, state.combo) + hits;
    state.comboTimer = 1.35;
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
  navigation.setState(on ? 'PAUSED' : 'PLAYING');
  hud.showPause(on);
  if (on) sfx.pause();
  else sfx.unpause();
}

function quitToMenu(): void {
  persist();
  navigation.setState('DASHBOARD');
  state.running = false;
  wall.cancelMove();
  document.getElementById('app')?.classList.remove('sidebar-open');
  hud.showPause(false);
  hud.showMenu(true);
  hud.mountMeta(save);
  sfx.pause();
  sfx.stopAllLoops();
}

function restartMatch(): void {
  hud.showPause(false);
  navigation.setState('PLAYING');
  document.getElementById('app')?.classList.remove('sidebar-open');
  hud.showMenu(false);
  restart();
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
    from: new Vector3(x - 0.95, 0, z),
    to: new Vector3(x + 0.95, 0, z),
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

  if (!state.waveSpawning) {
    state.waveClearTimer -= dt;
    if (state.waveClearTimer <= 0) {
      state.waveSpawning = true;
      const plan = planWave(state.wave, state.mode);
      state.waveTotal = plan.items.length;
      state.waveKilled = 0;
      fruits.beginWave(plan.items, plan.gap, plan.hpScale);
      toast(state, plan.title, 1.4);
      sfx.wave();
    }
  } else if (!fruits.waveBusy) {
    state.waveSpawning = false;
    state.wave += 1;
    state.waveClearTimer = 2.2;
    const rules = modeRules(state.mode);
    state.currency += Math.round((22 + state.wave * 6) * rules.currencyMul);
    persist();
    toast(state, 'Wave clear', 1.3);
    emit({ type: 'wave_clear', wave: state.wave, lives: state.lives, maxLives: state.maxLives });
  }

  fruits.update(dt, state, (fruit) => {
    const enemy = enemyRule(fruit.enemyKind);
    const baseCost = leakCost(state, fruit.kind, fruit.boss);
    const leakDamage = Math.round(baseCost * enemy.towerDamageOnLeak);
    state.lives -= leakDamage;
    resetCombo('leak');
    sessionLeaks += 1;
    sfx.leak();
    toast(state, fruit.boss ? 'Boss hit the wall' : 'They hit the wall');
    emit({ type: 'leak', amount: 1, leaks: sessionLeaks, fruitKind: fruit.kind });
    maybeOver();
  });

  tickGuest(dt);

  const didShoot = wall.update(dt, fruits.fruits, juice, bank, (hit) => {
    if (hit.impulseX) hit.fruit.impulseX += hit.impulseX;
    if (hit.impulseZ) hit.fruit.impulseZ += hit.impulseZ;
    if (hit.brittle) hit.fruit.brittle = Math.max(hit.fruit.brittle, 2.4);
    const swipe = new Vector3(0, 0.2, 1);
    const towerBonus = getTowerProgressionBonuses().damageBonus;
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
  hud.sync(state, wall, bank, loop.fps, () => undefined, save.skillPoints, navigation.isPlaying());
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
    if (navigation.state === 'DASHBOARD') {
      navigation.setState('TITLE');
      hud.returnToTitle();
      return;
    }
    if (navigation.state === 'TITLE') {
      navigation.setState('DASHBOARD');
      hud.showPage('play');
      hud.showMenu(true);
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
    if (n >= 1 && n <= 5 && navigation.state === 'DASHBOARD' && !hud.isTitleOpen()) selectHero(HEROES[n - 1].id);
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

startBtn.addEventListener('click', async () => {
  startBtn.textContent = 'Slicing…';
  persist();
  await Promise.all([sfx.unlock(), fruitAtlas.load()]);
  wall.applySkins();
  wallSkinApply();
  applyEquippedBlade();
  restartMatch();
  startBtn.textContent = 'Play';
});

loop.start();

function hideBootLoader(): void {
  const boot = document.getElementById('boot-loader');
  if (!boot || boot.classList.contains('is-done')) return;
  boot.classList.add('is-done');
  window.setTimeout(() => boot.remove(), 500);
}

requestAnimationFrame(() => hideBootLoader());
