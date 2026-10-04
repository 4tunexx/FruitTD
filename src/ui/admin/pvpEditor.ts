import type { PvpConfig, PvpMap } from '../../game/pvp';
import { PvpBattlefield } from '../screens/pvpBattlefield';
import { renderConfigForm } from './configForm';
import { el } from '../components/dom';

const disposers = new WeakMap<HTMLElement, () => void>();
/** Actual game scene plus connected-route painter for the seven veto maps. */
export function renderPvpEditor(host: HTMLElement, config: PvpConfig): void {
  disposers.get(host)?.(); host.replaceChildren();
  const header = el('header', { class: 'admin-preview-heading' }, [el('h3', { text: 'Arena / Ranked workshop' }), el('p', { text: 'Changes preview immediately. Save publishes validated settings for new matches.' })]);
  const layout = el('div', { class: 'admin-pvp-workshop' });
  const controls = el('div'); const preview = el('aside', { class: 'admin-pvp-preview' });
  layout.append(controls, preview); host.append(header, layout);
  let selected = 0; let painting = false; let draft: number[] | null = null;
  const select = el('select', { class: 'admin-input', 'aria-label': 'Preview map' });
  config.maps.forEach((map, index) => select.append(new Option(map.name, String(index))));
  const name = el('input', { class: 'admin-input', 'aria-label': 'Map name' });
  const grid = el('div', { class: 'admin-route-grid', role: 'group', 'aria-label': 'Paint a connected route from the top edge to the bottom edge' });
  const notice = el('p', { role: 'status' });
  const map = () => config.maps[selected]!;
  const snapshot = () => ({ id: 'admin-preview', map: map(), yourSide: 'blue', players: ['blue', 'red'].map((side) => ({ userId: side, side, name: side, wallHealth: config.wallHealth, towers: [], attackers: [] })) });
  let scene: PvpBattlefield | null = null;
  try { scene = new PvpBattlefield(snapshot(), config, () => {}); preview.append(scene.element); }
  catch { preview.append(el('p', { role: 'alert', text: '3D preview is unavailable on this device. Route editing is still available.' })); }
  const refreshPreview = () => scene?.update(snapshot(), config);
  const paint = () => {
    const current = map(); name.value = current.name;
    grid.style.gridTemplateColumns = `repeat(${current.width}, 1fr)`; grid.replaceChildren();
    const path = draft ?? current.pathCells;
    for (let cell = 0; cell < current.width * current.height; cell++) {
      const button = el('button', { type: 'button', class: path.includes(cell) ? 'is-path' : '', 'aria-label': `Column ${cell % current.width + 1}, row ${Math.floor(cell / current.width) + 1}`, 'aria-pressed': String(path.includes(cell)) });
      if (cell === path[0]) button.textContent = 'IN';
      if (cell === path.at(-1)) button.textContent = 'END';
      button.addEventListener('click', () => {
        if (!painting || !draft) return;
        if (!draft.length && cell >= current.width) { notice.textContent = 'Start on the top row.'; return; }
        const last = draft.at(-1);
        if (last !== undefined && (draft.includes(cell) || Math.abs(last % current.width - cell % current.width) + Math.abs(Math.floor(last / current.width) - Math.floor(cell / current.width)) !== 1)) {
          notice.textContent = 'Choose a neighboring tile. Routes cannot cross themselves.'; return;
        }
        draft.push(cell); notice.textContent = `${draft.length} tiles. Finish on the bottom row, then apply the route.`; paint();
      });
      grid.append(button);
    }
  };
  const button = (text: string, fn: () => void) => { const node = el('button', { type: 'button', class: 'studio-btn', text }); node.addEventListener('click', fn); return node; };
  controls.append(el('h4', { text: 'Map and paths' }), select, name, el('p', { text: 'Start a route on the top row and click adjoining tiles down to the bottom. Other tiles become build zones automatically.' }), grid,
    el('div', { class: 'admin-route-actions' }, [
      button('Draw new route', () => { painting = true; draft = []; notice.textContent = 'Choose the entry tile on the top row.'; paint(); }),
      button('Undo tile', () => { draft?.pop(); paint(); }),
      button('Cancel route', () => { painting = false; draft = null; notice.textContent = 'Existing route kept.'; paint(); }),
      button('Apply route', () => {
        const current = map();
        if (!draft || draft.length < 12 || Math.floor(draft.at(-1)! / current.width) !== current.height - 1) { notice.textContent = 'Route needs at least 12 tiles and must reach the bottom row.'; return; }
        current.pathCells = [...draft]; current.buildCells = Array.from({ length: current.width * current.height }, (_, i) => i).filter((i) => !current.pathCells.includes(i));
        if (config.map.id === current.id) config.map = structuredClone(current) as PvpMap;
        painting = false; draft = null; notice.textContent = 'Route applied to the draft. Save to publish.'; paint(); refreshPreview();
      }),
    ]), notice);
  select.addEventListener('change', () => { selected = Number(select.value); painting = false; draft = null; paint(); refreshPreview(); });
  name.addEventListener('input', () => { map().name = name.value; select.options[selected]!.textContent = name.value; if (config.map.id === map().id) config.map.name = name.value; });
  const fields = el('div'); controls.append(fields);
  const { map: _map, maps: _maps, ...balance } = config;
  // Nested records share draft references; scalar updates are copied back explicitly.
  renderConfigForm(fields, balance, () => { Object.assign(config, balance); refreshPreview(); });
  paint(); disposers.set(host, () => scene?.dispose());
}
export function disposePvpEditor(host: HTMLElement): void { disposers.get(host)?.(); disposers.delete(host); }
