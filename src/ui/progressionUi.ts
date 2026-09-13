import { getTowerXpState } from '../game/towerProgression';
import { towerMilestone } from '../game/towerMilestones';

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

  const toast = root.querySelector<HTMLElement>('#hud-toast');
  if (toast && /^Main is now Lv \d+\/5\b/.test(toast.textContent)) {
    toast.textContent = toast.textContent.replace(/Lv (\d+)\/5\b/, 'Lv $1/10');
  }

  const pick = root.querySelector<HTMLElement>('#hud-pick');
  const upgrade = root.querySelector<HTMLElement>('#btn-upgrade');
  if (pick?.textContent.startsWith('Main tower') && upgrade?.textContent.includes('maxed')) {
    upgrade.textContent = upgrade.textContent.replace(/Lv 5\b/, 'Lv 10');
  }
}

function ensureTowerChip(): HTMLElement | null {
  const header = document.getElementById('sidebar-header');
  if (!header) return null;
  let chip = document.getElementById('tower-progress-chip');
  if (chip) return chip;
  chip = document.createElement('div');
  chip.id = 'tower-progress-chip';
  chip.className = 'tower-progress-chip';
  header.appendChild(chip);
  return chip;
}

function updateTowerChip(): void {
  const chip = ensureTowerChip();
  if (!chip) return;
  const tower = getTowerXpState();
  const milestone = towerMilestone(tower.level + (tower.maxed ? 0 : 1));
  const pct = Math.round(tower.progress * 100);
  const next = tower.maxed
    ? 'MAX MASTERY · Master Tower'
    : `Next: Lv ${tower.level + 1} · ${milestone?.reward ?? 'new tower reward'}`;
  const html = `
    <div class="tower-progress-chip__top">
      <span>MAIN TOWER</span>
      <span class="tower-progress-chip__level">LV ${tower.level}/10</span>
    </div>
    <div class="tower-progress-chip__track"><div class="tower-progress-chip__fill" style="width:${pct}%"></div></div>
    <div class="tower-progress-chip__reward">${next} · ${tower.xp.toLocaleString()} XP</div>
  `;
  if (chip.innerHTML !== html) chip.innerHTML = html;
}

function mountProgressionUiFixes(): void {
  if (typeof document === 'undefined' || !document.body) return;
  const scan = () => {
    fixHeroLevelLabels(document);
    updateTowerChip();
  };
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true, characterData: true });
  window.setInterval(updateTowerChip, 750);
}

mountProgressionUiFixes();
