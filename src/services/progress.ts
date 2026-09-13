import {
  matchRequirement,
  requirementById,
  type CatalogAchievement,
  type CatalogBadge,
  type CatalogMission,
  type GameEvent,
  type RankTier,
} from '../game/requirements';
import { getLiveConfig } from './liveConfig';
import { updateMissionProgress } from './api';
import { reportBadgeProgress } from './badges';

function enabledMissions(): CatalogMission[] {
  return (getLiveConfig().missions || []).filter((m) => m.enabled !== false && m.requirement?.type);
}

function enabledAchievements(): CatalogAchievement[] {
  return (getLiveConfig().achievements || []).filter((a) => a.enabled !== false && a.requirement?.type);
}

function enabledBadges(): CatalogBadge[] {
  return (getLiveConfig().badges || []).filter((b) => b.enabled !== false && b.requirement?.type);
}

function tiers(): RankTier[] {
  return getLiveConfig().ranks?.length ? getLiveConfig().ranks : [];
}

export async function reportGameEvent(event: GameEvent): Promise<void> {
  const rankTiers = tiers();
  const missionUpdates: Array<{ missionId: string; progressDelta?: number; setProgress?: number }> = [];
  const achievementUpdates: Array<{ achievementId: string; progressDelta?: number; setProgress?: number }> = [];
  const badgeUpdates: Array<{ badgeId: string; progressDelta?: number; setProgress?: number }> = [];

  for (const mission of enabledMissions()) {
    const result = matchRequirement(mission.requirement, event, rankTiers);
    if (!result.hit) continue;
    const mode = requirementById(mission.requirement.type)?.progress ?? 'increment';
    missionUpdates.push(
      mode === 'max'
        ? { missionId: mission.id, setProgress: result.value }
        : { missionId: mission.id, progressDelta: result.value }
    );
  }

  for (const ach of enabledAchievements()) {
    const result = matchRequirement(ach.requirement, event, rankTiers);
    if (!result.hit) continue;
    const mode = requirementById(ach.requirement.type)?.progress ?? 'increment';
    achievementUpdates.push(
      mode === 'max'
        ? { achievementId: ach.id, setProgress: result.value }
        : { achievementId: ach.id, progressDelta: result.value }
    );
  }

  for (const badge of enabledBadges()) {
    if (!badge.requirement) continue;
    const result = matchRequirement(badge.requirement, event, rankTiers);
    if (!result.hit) continue;
    const mode = requirementById(badge.requirement.type)?.progress ?? 'increment';
    badgeUpdates.push(
      mode === 'max'
        ? { badgeId: badge.id, setProgress: result.value }
        : { badgeId: badge.id, progressDelta: result.value }
    );
  }

  const tasks: Promise<unknown>[] = [];
  if (missionUpdates.length) tasks.push(updateMissionProgress(missionUpdates));
  if (achievementUpdates.length) {
    tasks.push(
      import('./achievements').then(({ applyAchievementUpdates }) => applyAchievementUpdates(achievementUpdates))
    );
  }
  if (badgeUpdates.length) tasks.push(reportBadgeProgress(badgeUpdates));
  if (tasks.length) await Promise.all(tasks);
}
