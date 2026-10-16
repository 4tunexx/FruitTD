import { el } from './components/dom';
import { openSurface } from './components/surface';
import { EXTRACTED_ICON_IDS, extractedIcon } from './extractedIcons';

const KEY = 'fruitTD.playerInsignia';
const FALLBACK = 'rune-01-01';
const GROUPS: Record<string, string> = {
  rune: 'Runes', creative: 'Arcana', skill: 'Skills', hero: 'Heroes', quest: 'Quests',
  mode: 'Modes', misc: 'Status', stat: 'Statistics', emote: 'Emotes',
  lobby: 'Outpost', weapon: 'Weapons', core: 'Arena Cores',
};

export function selectedInsignia(): string {
  try {
    const id = localStorage.getItem(KEY) || FALLBACK;
    return EXTRACTED_ICON_IDS.includes(id) ? id : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function insigniaBadge(className: string, size = 24): HTMLElement {
  return el('span', { class: className, 'data-ftd-insignia': '', 'aria-hidden': 'true' }, [
    extractedIcon(selectedInsignia(), '', size),
  ]);
}

function saveInsignia(id: string): void {
  if (!EXTRACTED_ICON_IDS.includes(id)) return;
  try { localStorage.setItem(KEY, id); } catch { /* session-only preview */ }
  document.querySelectorAll<HTMLElement>('[data-ftd-insignia]').forEach((host) => {
    host.replaceChildren(extractedIcon(id, '', host.classList.contains('ftd-profile-banner__insignia') ? 42 : 24));
  });
}

/** Every extracted icon is selectable and previewed in the player's profile. */
export function openInsigniaVault(): void {
  const body = el('div', { class: 'ftd-insignia-vault' });
  let activeGroup = 'rune';
  const tabs = el('div', { class: 'ftd-insignia-vault__tabs', role: 'tablist', 'aria-label': 'Insignia collections' });
  const grid = el('div', { class: 'ftd-insignia-vault__grid', role: 'group', 'aria-label': 'Choose an insignia' });
  const count = el('p', { class: 'ftd-insignia-vault__count' });
  const preview = el('div', { class: 'ftd-insignia-vault__preview' }, [
    insigniaBadge('ftd-insignia-vault__selected', 50),
    el('span', { text: 'Your chosen insignia appears beside your profile.' }),
  ]);

  function render(): void {
    tabs.replaceChildren();
    grid.replaceChildren();
    for (const [group, label] of Object.entries(GROUPS)) {
      const tab = el('button', {
        type: 'button', class: `ftd-insignia-vault__tab${group === activeGroup ? ' is-active' : ''}`,
        role: 'tab', 'aria-selected': String(group === activeGroup), text: label,
      });
      tab.addEventListener('click', () => { activeGroup = group; render(); });
      tabs.appendChild(tab);
    }
    const ids = EXTRACTED_ICON_IDS.filter((id) => id.startsWith(`${activeGroup}-`));
    count.textContent = `${GROUPS[activeGroup]} · ${ids.length} insignias · ${EXTRACTED_ICON_IDS.length} total`;
    for (const id of ids) {
      const button = el('button', {
        type: 'button', class: `ftd-insignia-vault__item${id === selectedInsignia() ? ' is-selected' : ''}`,
        'aria-label': `Select ${GROUPS[activeGroup]} insignia ${id.slice(-5).replace('-', ' ')}`,
        'aria-pressed': String(id === selectedInsignia()), title: id,
      }, [extractedIcon(id, '', 44)]);
      button.addEventListener('click', () => {
        saveInsignia(id);
        preview.querySelector<HTMLElement>('[data-ftd-insignia]')?.replaceChildren(extractedIcon(id, '', 50));
        render();
      });
      grid.appendChild(button);
    }
  }
  body.append(preview, count, tabs, grid);
  render();
  openSurface({ title: 'INSIGNIA VAULT', subtitle: 'Choose a mark from every icon collection.', size: 'lg', content: body });
}
