import { getTowerXpState } from '../game/towerProgression';
import { towerMilestone } from '../game/towerMilestones';
import { MAX_TOWER_LEVEL } from '../game/world';

/**
 * Main Tower progression chip in the sidebar header.
 *
 * Reads the single tower progression source of truth. It renders real state —
 * it does NOT rewrite other components' text (the old regex-patching
 * `progressionUi` hack has been removed).
 */
function ensureChip(): HTMLElement | null {
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

export function updateTowerChip(): void {
  const chip = ensureChip();
  if (!chip) return;
  const tower = getTowerXpState();
  const milestone = towerMilestone(tower.level + 1);
  const pct = Math.round(tower.progress * 100);
  const next = tower.maxed
    ? 'MAX MASTERY · Master Fortress'
    : `Next: Lv ${tower.level + 1} · ${milestone?.reward ?? 'new tower reward'}`;
  const html = `
    <div class="tower-progress-chip__top">
      <span>MAIN TOWER</span>
      <span class="tower-progress-chip__level">LV ${tower.level}/${MAX_TOWER_LEVEL}</span>
    </div>
    <div class="tower-progress-chip__track"><div class="tower-progress-chip__fill" style="width:${pct}%"></div></div>
    <div class="tower-progress-chip__reward">${next} · ${tower.xp.toLocaleString()} XP</div>
  `;
  if (chip.innerHTML !== html) chip.innerHTML = html;
}

export function installTowerChip(): void {
  if (typeof document === 'undefined') return;
  updateTowerChip();
}
