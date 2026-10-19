import { lucideIcon } from '../lucideIcon';
import { ICON_ASSETS, ICON_ROLE_IDS, ICON_ROLE_ALIASES, EXTRACTED_ICON_IDS, extractedIcon } from '../extractedIcons';
import { el } from '../components/dom';

const GROUPS: Record<string, string> = {
  rune: 'Runes', creative: 'Arcana', skill: 'Skills', hero: 'Heroes', quest: 'Quests',
  mode: 'Modes', misc: 'Status', stat: 'Statistics', emote: 'Emotes',
  lobby: 'Outpost', weapon: 'Weapons', core: 'Arena Cores',
};

const ROLE_NAMES: Record<string, string> = {
  ModeCasual: 'Mode: Casual', ModeHorde: 'Mode: Horde', ModeCampaign: 'Mode: Campaign',
  ModeCoop: 'Mode: Co-op', ModeArena: 'Mode: Arena', ModeRanked: 'Mode: Ranked',
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

const ROLE_LABELS: Record<string, string> = Object.fromEntries(ICON_ROLE_IDS
  .map((id) => [id, ROLE_NAMES[id] || id.replace(/([a-z])([A-Z])/g, '$1 $2')]));

export type IconAssignment = (role: string, iconId: string | null) => Promise<{ ok: boolean; message: string }>;

/** Full, searchable asset library with shared semantic icon assignments. */
export function renderIconLibrary(host: HTMLElement, overrides: Record<string, string>, onAssign: IconAssignment): void {
  let selected = '';
  let busy = false;
  let visibleCount = 60;
  const activeOverrides = { ...overrides };
  const search = el('input', { class: 'admin-input admin-icon-library__search', type: 'search', placeholder: 'Search Horde, shield, weapons or icon ID…', 'aria-label': 'Search icons' }) as HTMLInputElement;
  const group = el('select', { class: 'admin-input', 'aria-label': 'Filter icon collection' }, [
    el('option', { value: 'all', text: 'All collections' }),
    ...Object.entries(GROUPS).map(([id, label]) => el('option', { value: id, text: label })),
  ]) as HTMLSelectElement;
  const role = el('select', { class: 'admin-input', 'aria-label': 'Icon role to update', 'data-testid': 'admin-icon-role' },
    Object.entries(ROLE_LABELS).map(([id, label]) => el('option', { value: id, text: `${label} · ${id}` }))) as HTMLSelectElement;
  group.value = 'all';
  role.value = ICON_ROLE_IDS[0];
  const grid = el('div', { class: 'admin-icon-library__grid', role: 'group', 'aria-label': 'Extracted icon collection' });
  const preview = el('div', { class: 'admin-icon-library__preview' });
  const count = el('p', { class: 'admin-icon-library__count', role: 'status' });
  const status = el('p', { class: 'admin-icon-library__status', role: 'status', 'aria-live': 'polite' });
  const assign = el('button', { class: 'admin-btn-action', type: 'button', text: 'Apply selected icon' }) as HTMLButtonElement;
  const reset = el('button', { class: 'admin-btn-action admin-btn-action--warning', type: 'button', text: 'Restore default' }) as HTMLButtonElement;
  const more = el('button', { class: 'admin-btn-action', type: 'button', text: 'Load more icons' }) as HTMLButtonElement;
  assign.disabled = true;

  function setBusy(value: boolean): void {
    busy = value;
    role.disabled = group.disabled = search.disabled = more.disabled = value;
    grid.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = value; });
    renderSelection();
  }

  function renderSelection(): void {
    preview.replaceChildren();
    if (!selected) {
      preview.append(el('p', { text: 'Select an icon to preview it and update a game icon role.' }));
      assign.disabled = true;
    } else {
      preview.append(extractedIcon(selected, 'admin-icon-library__large', 72));
      preview.append(el('strong', { text: selected }));
      assign.disabled = busy;
    }
    const mapped = activeOverrides[role.value];
    const fallback = ICON_ROLE_ALIASES[role.value] || role.value;
    const current = mapped || ICON_ASSETS[fallback];
    reset.disabled = busy || !mapped;
    preview.append(el('span', { class: 'admin-icon-library__mapped', text: `Current ${ROLE_LABELS[role.value] || role.value}: ${current || 'default'}` }),
      current ? extractedIcon(current, 'admin-icon-library__current', 40) : lucideIcon(fallback, 'admin-icon-library__current', 40));
  }

  function renderGrid(): void {
    const term = search.value.trim().toLowerCase();
    const filtered = EXTRACTED_ICON_IDS.filter((id) =>
      (group.value === 'all' || id.startsWith(`${group.value}-`)) && (!term || `${id} ${GROUPS[id.split('-')[0]] || ''} ${Object.entries(ICON_ASSETS).filter(([, asset]) => asset === id).map(([key]) => ROLE_NAMES[key] || key).join(' ')} ${Object.entries(ICON_ROLE_ALIASES).filter(([, key]) => ICON_ASSETS[key] === id).map(([key]) => ROLE_NAMES[key]).join(' ')}`.toLowerCase().includes(term)));
    count.textContent = `${filtered.length} of ${EXTRACTED_ICON_IDS.length} icons · ${ICON_ROLE_IDS.length} game roles`;
    more.hidden = filtered.length <= visibleCount;
    more.textContent = `Load more icons (${Math.max(0, filtered.length - visibleCount)} remaining)`;
    grid.replaceChildren(...filtered.slice(0, visibleCount).map((id) => {
      const button = el('button', {
        class: `admin-icon-library__item${id === selected ? ' is-selected' : ''}`,
        type: 'button', disabled: busy, 'aria-pressed': String(id === selected),
        'aria-label': `Preview icon ${id}`, title: id,
      }, [extractedIcon(id, '', 44), el('small', { text: id })]);
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

  const filterIcons = () => { visibleCount = 60; renderGrid(); };
  search.addEventListener('input', filterIcons);
  group.addEventListener('change', filterIcons);
  more.addEventListener('click', () => { if (!busy) { visibleCount += 60; renderGrid(); } });
  role.addEventListener('change', renderSelection);
  assign.addEventListener('click', async () => {
    if (!selected || busy) return;
    const roleId = role.value, iconId = selected;
    setBusy(true);
    try {
      const result = await onAssign(roleId, iconId);
      status.textContent = result.message;
      if (result.ok) activeOverrides[roleId] = iconId;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not save icon assignment.';
    } finally {
      setBusy(false);
    }
  });
  reset.addEventListener('click', async () => {
    if (busy) return;
    const roleId = role.value;
    setBusy(true);
    try {
      const result = await onAssign(roleId, null);
      status.textContent = result.message;
      if (result.ok) delete activeOverrides[roleId];
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Could not restore the default icon.';
    } finally {
      setBusy(false);
    }
  });

  const toolbar = el('div', { class: 'admin-icon-library__toolbar' }, [search, group, role, assign, reset]);
  host.replaceChildren(
    el('p', { class: 'admin-icon-library__intro', text: 'Every extracted icon is kept here. Filter the collection, preview a mark, and assign it to a named mode or a shared game icon role. Mode assignments update every occurrence of that mode. Changes publish to the live admin configuration.' }),
    toolbar, count, preview, grid, more, status,
  );
  renderSelection();
  renderGrid();
}
