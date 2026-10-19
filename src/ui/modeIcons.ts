import type { GameMode } from '../game/save';

/** One identity for each game mode, shared by every menu and record. */
export const MODE_ICONS: Record<GameMode, string> = {
  casual: 'Shield', horde: 'Skull', campaign: 'Map', coop: 'Users', arena: 'Swords', ranked: 'Swords',
};
