/** Keep legacy HUD markup honest while older menu rendering is still being migrated. */
function fixHeroLevelLabels(root: ParentNode = document): void {
  const hudHero = root.querySelector<HTMLElement>('#hud-hero');
  if (hudHero) {
    const next = hudHero.textContent.replace(/Lv (\d+)\/5\b/g, 'Lv $1/100');
    if (next !== hudHero.textContent) hudHero.textContent = next;
  }

  const heroPick = root.querySelector<HTMLElement>('#hero-pick');
  if (heroPick) {
    heroPick.querySelectorAll<HTMLElement>('button').forEach((button) => {
      const next = button.innerHTML.replace(/Lv (\d+)\/5\b/g, 'Lv $1/100');
      if (next !== button.innerHTML) button.innerHTML = next;
    });
  }
}

function mountProgressionUiFixes(): void {
  if (typeof document === 'undefined' || !document.body) return;
  const scan = () => fixHeroLevelLabels(document);
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, characterData: true });
}

mountProgressionUiFixes();
