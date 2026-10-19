import type { GameMode } from '../game/save';

/** One identity for each game mode, shared by every menu and record. */
export const MODE_ICONS: Record<GameMode, string> = {
  casual: 'ModeCasual', horde: 'ModeHorde', campaign: 'ModeCampaign', coop: 'ModeCoop', arena: 'ModeArena', ranked: 'ModeRanked',
};
