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
import { planWave, planBossWave, wavesPerLevel } from './game/waves';
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
import { heroPerkMultiplier } from './game/heroProgression';
import { installHudToggles } from './ui/hudToggle';

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
