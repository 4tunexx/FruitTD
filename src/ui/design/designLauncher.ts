/** Load the internal preview editor only when someone opens it. */
export function installDesignModeLauncher(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('keydown', (event) => {
    if (!event.ctrlKey || !event.shiftKey || event.key.toLowerCase() !== 'd') return;
    event.preventDefault();
    void import('./designMode').then(({ isDesignModeOpen, closeDesignMode, openDesignMode }) => {
      if (isDesignModeOpen()) closeDesignMode();
      else openDesignMode();
    });
  });

  try {
    if (new URLSearchParams(window.location.search).get('design') === '1') {
      void import('./designMode').then(({ openDesignMode }) => openDesignMode());
    }
  } catch {
    // Invalid location: the game can still start normally.
  }
}
