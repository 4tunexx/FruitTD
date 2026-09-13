/** Keep legacy HUD markup honest while older menu rendering is still being migrated. */
function fixHeroLevelLabels(root: ParentNode = document): void {
  const hudHero = root.querySelector<HTMLElement>('#hud-hero');
  if (hudHero) hudHero.textContent = hudHero.textContent.replace(/Lv (\d+)\/5\b/g, 'Lv $1/100');

  const heroPick = root.querySelector<HTMLElement>('#hero-pick');
  if (heroPick) {
    heroPick.querySelectorAll<HTMLElement>('button').forEach((button) => {
      button.innerHTML = button.innerHTML.replace(/Lv (\d+)\/5\b/g, 'Lv $1/100');
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
