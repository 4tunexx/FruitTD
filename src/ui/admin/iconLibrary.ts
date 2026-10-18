import { ICON_ASSETS, EXTRACTED_ICON_IDS, extractedIcon } from '../extractedIcons';
import { el } from '../components/dom';

const GROUPS: Record<string, string> = {
  rune: 'Runes', creative: 'Arcana', skill: 'Skills', hero: 'Heroes', quest: 'Quests',
  mode: 'Modes', misc: 'Status', stat: 'Statistics', emote: 'Emotes',
  lobby: 'Outpost', weapon: 'Weapons', core: 'Arena Cores',
};

const ROLE_NAMES: Record<string, string> = {
  Apple: 'Fruit', Backpack: 'Inventory', Bomb: 'Bomb', Castle: 'Home', ChartNoAxesCombined: 'Career chart',
  ChevronRight: 'Next', Coins: 'Coins', Crown: 'Profile', Diamond: 'Gems', Droplets: 'Juice',
  Flame: 'Fire', Gift: 'Gift', Gauge: 'Power meter', Gem: 'Gem', Hammer: 'Upgrade', Heart: 'Health',
  Landmark: 'Base', Leaf: 'Nature', LockKeyhole: 'Locked', Map: 'Campaign', Medal: 'Medal',
  ScrollText: 'Missions', Shield: 'Defence', ShieldCheck: 'Hero', ShoppingBag: 'Shop', ShoppingCart: 'Shop cart',
  Skull: 'Enemy', Slice: 'Slice', Scissors: 'Cut', Sparkles: 'Effects', Sword: 'Blade', Swords: 'Battle',
  Target: 'Target', Tornado: 'Storm', TowerControl: 'Tower', Trophy: 'Trophy', User: 'Player',
  UserRound: 'Player profile', Waves: 'Waves', Zap: 'Energy', ArrowUpCircle: 'Upgrade level',
  ChevronsUp: 'Rank up', CircleDot: 'Marker', ScanLine: 'Scan',
};

const ROLE_LABELS: Record<string, string> = Object.fromEntries(Object.keys(ICON_ASSETS)
  .map((id) => [id, ROLE_NAMES[id] || id.replace(/([a-z])([A-Z])/g, '$1 $2')]));

export type IconAssignment = (role: string, iconId: string | null) => Promise<{ ok: boolean; message: string }>;

/** Full, searchable asset library with shared semantic icon assignments. */
export function renderIconLibrary(host: HTMLElement, overrides: Record<string, string>, onAssign: IconAssignment): void {
  let selected = '';
  const activeOverrides = { ...overrides };
  const search = el('input', { class: 'admin-input admin-icon-library__search', type: 'search', placeholder: 'Find by icon ID…', 'aria-label': 'Search icon IDs' }) as HTMLInputElement;
  const group = el('select', { class: 'admin-input', 'aria-label': 'Filter icon collection' }, [
    el('option', { value: 'all', text: 'All collections' }),
    ...Object.entries(GROUPS).map(([id, label]) => el('option', { value: id, text: label })),
  ]) as HTMLSelectElement;
  const role = el('select', { class: 'admin-input', 'aria-label': 'Icon role to update' },
    Object.entries(ROLE_LABELS).map(([id, label]) => el('option', { value: id, text: `${label} · ${id}` }))) as HTMLSelectElement;
  const grid = el('div', { class: 'admin-icon-library__grid', role: 'list', 'aria-label': 'Extracted icon collection' });
  const preview = el('div', { class: 'admin-icon-library__preview' });
  const count = el('p', { class: 'admin-icon-library__count', role: 'status' });
  const status = el('p', { class: 'admin-icon-library__status', role: 'status', 'aria-live': 'polite' });
  const assign = el('button', { class: 'admin-btn-action', type: 'button', text: 'Apply selected icon' }) as HTMLButtonElement;
  const reset = el('button', { class: 'admin-btn-action admin-btn-action--warning', type: 'button', text: 'Restore default' }) as HTMLButtonElement;
  assign.disabled = true;

  function renderSelection(): void {
    preview.replaceChildren();
    if (!selected) {
      preview.append(el('p', { text: 'Select an icon to preview it and update a game icon role.' }));
      assign.disabled = true;
    } else {
      preview.append(extractedIcon(selected, 'admin-icon-library__large', 72));
      preview.append(el('strong', { text: selected }));
      assign.disabled = false;
    }
    const mapped = activeOverrides[role.value];
    reset.disabled = !mapped;
    if (mapped) preview.append(el('span', { class: 'admin-icon-library__mapped', text: `Current ${ROLE_LABELS[role.value] || role.value}: ${mapped}` }), extractedIcon(mapped, 'admin-icon-library__current', 30));
  }

  function renderGrid(): void {
    const term = search.value.trim().toLowerCase();
    const filtered = EXTRACTED_ICON_IDS.filter((id) =>
      (group.value === 'all' || id.startsWith(`${group.value}-`)) && (!term || id.includes(term)));
    count.textContent = `${filtered.length} of ${EXTRACTED_ICON_IDS.length} icons · ${Object.keys(ICON_ASSETS).length} game roles`;
    grid.replaceChildren(...filtered.map((id) => {
      const button = el('button', {
        class: `admin-icon-library__item${id === selected ? ' is-selected' : ''}`,
        type: 'button', 'aria-pressed': String(id === selected),
        'aria-label': `Preview icon ${id}`, title: id,
      }, [extractedIcon(id, '', 36), el('small', { text: id })]);
      button.addEventListener('click', () => {
        selected = id;
        grid.querySelectorAll<HTMLButtonElement>('.admin-icon-library__item').forEach((item) => {
          const active = item === button;
          item.classList.toggle('is-selected', active);
          item.setAttribute('aria-pressed', String(active));
        });
        renderSelection();
      });
      return button;
    }));
  }

  search.addEventListener('input', renderGrid);
  group.addEventListener('change', renderGrid);
  role.addEventListener('change', renderSelection);
  assign.addEventListener('click', async () => {
    if (!selected) return;
    assign.disabled = reset.disabled = true;
    try {
      const result = await onAssign(role.value, selected);
      status.textContent = result.message;
      if (result.ok) activeOverrides[role.value] = selected;
      renderSelection();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not save icon assignment.';
      renderSelection();
    }
  });
  reset.addEventListener('click', async () => {
    assign.disabled = reset.disabled = true;
    try {
      const result = await onAssign(role.value, null);
      status.textContent = result.message;
      if (result.ok) delete activeOverrides[role.value];
      renderSelection();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not restore the default icon.';
      renderSelection();
    }
  });

  const toolbar = el('div', { class: 'admin-icon-library__toolbar' }, [search, group, role, assign, reset]);
  host.replaceChildren(
    el('p', { class: 'admin-icon-library__intro', text: 'Every extracted icon is kept here. Filter the collection, preview a mark, and assign it to a shared game icon role. Changes publish to the live admin configuration.' }),
    toolbar, count, preview, grid, status,
  );
  renderSelection();
  renderGrid();
}
