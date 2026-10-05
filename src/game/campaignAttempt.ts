import { completeCampaignStage, type CampaignProgress } from './campaign';
import type { GameState } from './state';

/** A killed overlord ends this attempt immediately, even with adds still alive.
 * Starting another stage always requires the player's next map selection. */
export function finishCampaignAttempt(state: GameState, progress: CampaignProgress, bossKilled: boolean): ReturnType<typeof completeCampaignStage> | null {
  if (state.mode !== 'campaign' || !state.running || !bossKilled || state.lives <= 0) return null;
  const completion = completeCampaignStage(progress, state.level);
  state.running = false;
  state.waveSpawning = false;
  state.waveIsBoss = false;
  state.bossIntro = false;
  state.bossIntroTimer = 0;
  state.waveClearTimer = 0;
  return completion;
}
