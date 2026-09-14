import type { JuiceBank } from '../game/juice';
import { HEROES, heroDef, xpForNext, type HeroId } from '../game/heroes';
import { HERO_PERKS } from '../game/heroProgression';
import { getAvailableHeroPerkPoints, upgradeHeroPerk } from '../game/heroPerkSave';
import { MODE_INFO, modeRules } from '../game/modes';
import { WALL_SKINS, heroLevelFromSave, loadSave, writeSave, type GameMode, type SaveData } from '../game/save';
import { findSlicer } from '../game/slicers';
import { SKILLS, type SkillId } from '../game/skills';
import type { GameState } from '../game/state';
import { TURRETS, canPlaceTurret, sellRefund, turretDef, type TurretKind } from '../game/turrets';
import type { WallBase } from '../game/wall';
import { MAX_TOWER_LEVEL, PADS, upgradeCost } from '../game/world';
import {
  fetchLeaderboard,
  fetchMissions,
  claimMission,
  fetchAchievements,
  claimAchievement,
  fetchDailyBonusStatus,
  claimDailyBonus,
  fetchMonthlyRank,
  type LeaderboardEntry,
  type MissionItem,
  type AchievementItem,
  type DailyStatus,
} from '../services/api';
import {
  getCachedSteamState,
  syncSteamState,
  isSessionAuthed,
  setSessionAuthed,
  consumeAuthCallbackParams,
  applySteamBonusIfNeeded,
} from '../services/steam';
import {
  loginWithEmail,
  registerWithEmail,
  verifyEmailCode,
  setEmailForConfirm,
  resendVerifyCode,
  completeProfile,
  logoutAuth,
  fetchMe,
  getCachedAuthUser,
  startSteamLogin,
  applyAuthUserToLocalIds,
  getAuthToken,
  type AuthUser,
} from '../services/auth';
import { showAchievementToast } from '../services/achievements';
import { fetchBadges, type BadgeItem } from '../services/badges';
import { loadLiveConfig, getLiveConfig, getEnabledSlicers, getSlicers } from '../services/liveConfig';
import { reportGameEvent } from '../services/progress';
import { rankFromScore } from '../game/requirements';
import { getRewardSvg } from './icons';
import { AdminController } from './admin';

export class Hud {
