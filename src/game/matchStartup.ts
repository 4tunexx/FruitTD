/** Optional media must not block the transition into a playable match. */
export function startMatchWithOptionalMedia(
  loadAudio: () => Promise<void>,
  loadAtlas: () => Promise<void>,
  enterPlay: () => void,
  reportFailure: (asset: 'audio' | 'atlas', error: unknown) => void,
): void {
  for (const [asset, load] of [['audio', loadAudio], ['atlas', loadAtlas]] as const) {
    try {
      void load().catch((error: unknown) => reportFailure(asset, error));
    } catch (error) {
      reportFailure(asset, error);
    }
  }
  enterPlay();
}
