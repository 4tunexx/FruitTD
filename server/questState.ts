import type { CatalogMission } from '../src/game/requirements';
import type { MissionDoc } from './db';

/** Main missions keep history from before daily/weekly missions became permanent. */
export function missionState(def: CatalogMission, docs: readonly MissionDoc[], receipts: readonly string[], key: string) {
  const history = docs.filter(doc => doc.missionId === def.id && (def.type === 'main' || doc.dayKey === key));
  const claimed = history.some(doc => doc.claimed) || receipts.some(receipt =>
    def.type === 'main'
      ? receipt.startsWith('mission:') && receipt.endsWith(`:${def.id}`)
      : receipt === `mission:${key}:${def.id}`);
  const goal = def.requirement?.goal || 1;
  const progress = Math.min(goal, Math.max(0, ...history.map(doc => doc.progress || 0)));
  const completed = claimed || history.some(doc => doc.completed) || progress >= goal;
  return { progress: completed ? goal : progress, completed, claimed };
}
