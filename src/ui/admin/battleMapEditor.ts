import { defaultMapForMode, normalizeBattleMap, type BattleMap, type BattleMapMode, type MapEntityKind } from '../../game/battleMaps';
import { fetchAdminBattleMaps, saveAdminBattleMap } from '../../services/battleMaps';
import { refreshAdminTexture } from '../../game/adminTextureLoader';
import { importStudioImageSample } from '../adminMediaStudio';

const modes: BattleMapMode[] = ['casual', 'horde', 'campaign', 'coop', 'pvp'];
const imageLibrary = [
  { label: 'Ashen Road · Casual', path: '/assets/maps/samples/casual-fallen-orchard.webp', mode: 'casual' as BattleMapMode },
  { label: 'Scrapline · Horde', path: '/assets/maps/samples/horde-night-harvest.webp', mode: 'horde' as BattleMapMode },
  { label: 'Ruined Causeway · Campaign', path: '/assets/maps/samples/campaign-old-orchard.webp', mode: 'campaign' as BattleMapMode },
  { label: 'Broken Junction · Co-op', path: '/assets/maps/samples/coop-shared-grove.webp', mode: 'coop' as BattleMapMode },
  { label: 'Twin Wastes · PvP', path: '/assets/maps/samples/pvp-twin-pass.webp', mode: 'pvp' as BattleMapMode },
];
const samples = [
  { label: 'Keep tower', path: '/assets/maps/samples/tower-keep.webp', target: 'tower' },
  { label: 'Rotten apple', path: '/assets/maps/samples/enemy-apple-zombie.webp', target: 'enemy' },
  { label: 'Watermelon boss', path: '/assets/maps/samples/boss-watermelon.webp', target: 'boss' },
];
const towerSkins = [
  { name: 'Ashbrick Bastion', tag: 'Default', path: '/assets/towers/wall-ashbrick.webp' },
  { name: 'Scrapline Steel', tag: 'Shop · 200 coins', path: '/assets/towers/wall-scrapsteel.webp' },
  { name: 'Ashglass Concrete', tag: 'Shop · 280 coins', path: '/assets/towers/wall-ashglass.webp' },
];
type Tool = 'select' | 'route' | 'spawn' | 'tower' | 'opponent-tower' | MapEntityKind;
let editorMaps: BattleMap[] = [];
let selected = 0;
let tool: Tool = 'select';
let busy = false;
let selectedEntityId: string | null = null;
let draggingEntity = false;
let activeRouteId = 'main-route';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;
const current = () => editorMaps[selected];
const safeText = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function mapMarkup(): string {
  return `<div class="battle-map-toolbar">
    <label>Mode<select id="map-mode">${modes.map((mode) => `<option value="${mode}">${mode[0]!.toUpperCase()}${mode.slice(1)}</option>`).join('')}</select></label>
    <label>Map<select id="map-choice"></select></label>
    <label>Map name<input id="map-name" maxlength="80"></label>
    <button id="map-new" type="button">New map</button>
    <label class="map-upload">Upload PNG / WebP<input id="map-image-upload" type="file" accept="image/png,image/webp,image/jpeg"></label>
    <button id="map-save" type="button" class="is-primary">Save to MongoDB</button>
  </div>
  <div class="battle-map-library"><span>Map samples</span>${imageLibrary.map((item) => `<button type="button" data-map-sample="${item.path}" data-mode="${item.mode}">${item.label}</button>`).join('')}</div>
  <div class="battle-map-workspace">
    <div class="battle-map-tools"><label class="map-route-choice">Active route<select id="map-route-choice"></select></label>${(['select', 'route', 'spawn', 'tower', 'opponent-tower', 'solid', 'hazard', 'pit', 'light', 'prop', 'turret-slot'] as Tool[]).map((item) => `<button type="button" data-map-tool="${item}" class="${item === tool ? 'active' : ''}">${item.replace('-', ' ')}</button>`).join('')}<button type="button" id="map-add-route">+ Route</button><button type="button" id="map-remove-entity">Remove selected</button></div>
    <div class="battle-map-canvas-frame"><canvas id="battle-map-canvas" aria-label="Map preview. Tap to place the selected map tool."></canvas></div>
  </div>
  <p class="battle-map-help">Coordinates are normalized to the map image. Add route points from the enemy entrance toward the tower. Select an entity by tapping it; drag to reposition. PNG backgrounds scale to the authored map without cropping.</p>
  <div class="battle-map-assets"><strong>Sample assets · available in existing editors</strong>${samples.map((item) => `<article><img src="${item.path}" alt=""><span>${item.label}</span><button type="button" data-import-sample="${item.target}" data-path="${item.path}">Load in ${item.target === 'tower' ? 'Tower' : item.target === 'enemy' ? 'Enemy' : 'Boss'} Editor</button></article>`).join('')}<button type="button" id="map-publish-creator">Publish Creator asset to MongoDB</button></div>
  <div class="battle-map-assets battle-map-tower-skins"><strong>Bottom defense tower · hero remains on the center keep</strong>${towerSkins.map((skin) => `<article><img src="${skin.path}" alt="${skin.name} tower wall material"><span>${skin.name}</span><small>${skin.tag}</small></article>`).join('')}<p>These skins wrap the existing full-width bottom wall. The separate center keep and its hero anchor stay in place; side tower slots are unchanged. Shop cards preview the same textures.</p></div>
  <p id="battle-map-status" role="status" aria-live="polite"></p>`;
}

function status(message: string, error = false): void {
  const node = el<HTMLElement>('battle-map-status'); if (!node) return;
  node.textContent = message; node.dataset.error = String(error);
}

function draw(): void {
  const canvas = el<HTMLCanvasElement>('battle-map-canvas'); const map = current();
  if (!canvas || !map) return;
  const rect = canvas.getBoundingClientRect(); const scale = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * scale)); canvas.height = Math.max(1, Math.round(rect.height * scale));
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.scale(scale, scale); ctx.fillStyle = '#202226'; ctx.fillRect(0, 0, rect.width, rect.height);
  const paint = () => {
    if (map.background.startsWith('data:image')) {
      const image = new Image(); image.onload = () => { ctx.globalAlpha = .88; ctx.drawImage(image, 0, 0, rect.width, rect.height); ctx.globalAlpha = 1; overlay(); };
      image.src = map.background;
    } else {
      const image = new Image(); image.onload = () => { ctx.globalAlpha = .88; ctx.drawImage(image, 0, 0, rect.width, rect.height); ctx.globalAlpha = 1; overlay(); }; image.onerror = () => overlay(); image.src = map.background;
    }
  };
  const overlay = () => {
    ctx.strokeStyle = '#ffce38'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    for (const route of map.routes) {
      ctx.beginPath(); route.points.forEach((p, i) => i ? ctx.lineTo(p.x * rect.width, p.y * rect.height) : ctx.moveTo(p.x * rect.width, p.y * rect.height)); ctx.stroke();
      route.points.forEach((p) => { ctx.beginPath(); ctx.fillStyle = '#fff2bd'; ctx.arc(p.x * rect.width, p.y * rect.height, 5, 0, Math.PI * 2); ctx.fill(); });
    }
    const marker = (x: number, y: number, color: string, label: string) => { ctx.beginPath(); ctx.fillStyle = color; ctx.arc(x * rect.width, y * rect.height, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(label, x * rect.width + 12, y * rect.height + 4); };
    marker(map.tower.x, map.tower.y, '#f6d44e', 'TOWER'); if (map.opponentTower) marker(map.opponentTower.x, map.opponentTower.y, '#e88369', 'OPPONENT');
    map.spawns.forEach((spawn) => marker(spawn.x, spawn.y, '#76d7ff', 'SPAWN'));
    map.entities.forEach((entity) => {
      const x = entity.x * rect.width, y = entity.y * rect.height; ctx.fillStyle = entity.kind === 'pit' || entity.kind === 'hazard' ? '#f16849a8' : entity.kind === 'turret-slot' ? '#63b8e9cc' : '#25282dd9';
      ctx.strokeStyle = entity.id === selectedEntityId ? '#fff' : '#fff4'; ctx.lineWidth = entity.id === selectedEntityId ? 3 : 1; ctx.fillRect(x - entity.width * rect.width / 2, y - entity.height * rect.height / 2, entity.width * rect.width, entity.height * rect.height); ctx.strokeRect(x - entity.width * rect.width / 2, y - entity.height * rect.height / 2, entity.width * rect.width, entity.height * rect.height);
      ctx.fillStyle = '#fff'; ctx.font = '10px sans-serif'; ctx.fillText(entity.label, x + 7, y - 5);
    });
  };
  paint();
}

function renderMapSelect(): void {
  const select = el<HTMLSelectElement>('map-choice'); if (!select) return;
  select.innerHTML = editorMaps.map((map, index) => `<option value="${index}">${safeText(map.name)} · ${map.mode}</option>`).join('');
  select.value = String(selected);
  const mode = el<HTMLSelectElement>('map-mode'); if (mode) mode.value = current()?.mode || 'casual';
  const name = el<HTMLInputElement>('map-name'); if (name) name.value = current()?.name || '';
  const routeSelect = el<HTMLSelectElement>('map-route-choice');
  if (routeSelect) { routeSelect.innerHTML = (current()?.routes || []).map((route) => `<option value="${safeText(route.id)}">${safeText(route.name)}</option>`).join(''); if (current()?.routes.some((route) => route.id === activeRouteId)) routeSelect.value = activeRouteId; else activeRouteId = current()?.routes[0]?.id || ''; }
  draw();
}

function normalizedPointer(event: PointerEvent): { x: number; y: number } | null {
  const canvas = el<HTMLCanvasElement>('battle-map-canvas'); if (!canvas) return null;
  const rect = canvas.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
}

function pointEvent(event: PointerEvent): void {
  const map = current(); const point = normalizedPointer(event); if (!map || !point) return;
  if (tool === 'select') {
    const hit = [...map.entities].reverse().find((entity) => Math.abs(entity.x - point.x) <= entity.width / 2 + .02 && Math.abs(entity.y - point.y) <= entity.height / 2 + .02);
    selectedEntityId = hit?.id || null; draggingEntity = Boolean(hit); draw(); return;
  }
  if (tool === 'tower') { map.tower = point; }
  else if (tool === 'opponent-tower') { map.opponentTower = point; }
  else if (tool === 'route') { const route = map.routes.find((item) => item.id === activeRouteId) || map.routes[0]; if (route) route.points.push(point); }
  else if (tool === 'spawn') {
    const spawn = map.spawns[0]; if (spawn) Object.assign(spawn, point, { enabled: true });
    else map.spawns.push({ id: `spawn-${Date.now()}`, routeId: activeRouteId || map.routes[0]?.id || 'main-route', ...point, enabled: true, label: 'Top spawn' });
  } else {
    map.entities.push({ id: `${tool}-${Date.now()}`, kind: tool, ...point, width: .08, height: .06, rotation: 0, visible: true, asset: '', collision: ['solid', 'pit'].includes(tool) ? 'solid' : tool === 'hazard' ? 'trigger' : 'none', damage: ['pit', 'hazard'].includes(tool) ? 1 : 0, slow: 0, label: tool.replace('-', ' ') });
  }
  draw();
}

async function loadImageData(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a PNG, WebP, or JPEG image.');
  const bitmap = await createImageBitmap(file); const maxSide = 1600; const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * ratio); canvas.height = Math.round(bitmap.height * ratio);
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Could not read this image.'); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const data = canvas.toDataURL('image/webp', .82); if (data.length > 1_100_000) throw new Error('Image is still too large after optimization. Choose a simpler background under 1 MB.'); return data;
}

async function importAsset(target: string, path: string): Promise<void> {
  const response = await fetch(path); if (!response.ok) throw new Error('Could not load sample image.');
  const file = new File([await response.blob()], path.split('/').pop() || 'sample.webp', { type: 'image/webp' });
  const data = await loadImageData(file);
  if (target === 'tower') {
    localStorage.setItem('admin-sprite-tower-main', data); refreshAdminTexture('tower-main');
    importStudioImageSample('tower-main', 'Keep Tower', data);
    const preview = el<HTMLElement>('preview-tower-main'); if (preview) { const img = document.createElement('img'); img.src = data; img.alt = 'Keep tower sample'; preview.replaceChildren(img); }
    const clear = el<HTMLElement>('clear-tower-main'); if (clear) clear.style.display = 'block';
    document.getElementById('sprite-tower-main')?.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (target === 'enemy') {
    localStorage.setItem('admin-sprite-enemy-normal', data);
    refreshAdminTexture('enemy-normal');
    importStudioImageSample('enemy-normal', 'Rotten Apple Walker', data);
    const preview = el<HTMLElement>('preview-enemy-normal'); if (preview) { const img = document.createElement('img'); img.src = data; img.alt = 'Rotten apple enemy sample'; preview.replaceChildren(img); }
    const clear = el<HTMLElement>('clear-enemy-normal'); if (clear) clear.style.display = 'block';
  } else {
    importStudioImageSample('boss-watermelon', 'Watermelon Boss', data);
    document.getElementById('studio-publish')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  document.querySelector<HTMLButtonElement>('.admin-tab-btn[data-tab="sprites"]')?.click();
  if (target === 'tower') document.getElementById('sprite-tower-main')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (target === 'enemy') document.getElementById('sprite-enemy-normal')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (target === 'boss') document.getElementById('studio-entity-rail')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

export function installBattleMapEditor(): void {
  const host = el<HTMLElement>('admin-map-studio'); if (!host || host.dataset.mapEditorReady === '1') return;
  host.dataset.mapEditorReady = '1'; host.innerHTML = mapMarkup();
  const style = document.createElement('style'); style.textContent = `.battle-map-toolbar,.battle-map-library,.battle-map-tools{display:flex;gap:.55rem;align-items:end;flex-wrap:wrap;margin:.75rem 0}.battle-map-toolbar label{display:grid;gap:.25rem;color:#d6d2c8;font-size:.75rem}.battle-map-toolbar input,.battle-map-toolbar select{min-width:130px;background:#22252a;color:#fff;border:1px solid #655d4e;padding:.55rem;border-radius:5px}.battle-map-toolbar button,.battle-map-library button,.battle-map-tools button,.battle-map-assets button{background:#292b30;border:1px solid #665b47;color:#eee;padding:.55rem .7rem;border-radius:5px;min-height:40px}.battle-map-toolbar .is-primary{background:#efbd31;color:#171719;font-weight:800}.battle-map-workspace{display:grid;grid-template-columns:minmax(115px,180px) minmax(0,1fr);gap:.7rem}.battle-map-tools{align-content:start;display:grid;grid-template-columns:1fr}.battle-map-tools button{text-transform:capitalize}.battle-map-tools button.active{background:#edbd34;color:#171719}.battle-map-canvas-frame{width:100%;height:min(68vh,720px);min-height:360px;background:#202226;border:1px solid #786943;border-radius:6px;overflow:hidden}.battle-map-canvas-frame canvas{width:100%;height:100%;touch-action:none}.battle-map-help{color:#aaa;font-size:.78rem;line-height:1.5}.battle-map-library{align-items:center;color:#edc34a}.battle-map-assets{display:flex;flex-wrap:wrap;gap:.65rem;align-items:center;border-top:1px solid #55482f;padding-top:.8rem}.battle-map-assets>strong{flex-basis:100%;color:#edc34a}.battle-map-assets article{display:grid;gap:.35rem;width:min(180px,46%);background:#212328;border:1px solid #504a3e;padding:.5rem;border-radius:6px;color:#ddd;font-size:.78rem}.battle-map-assets img{width:100%;height:95px;object-fit:contain;background:#161719}.battle-map-assets button{font-size:.72rem}#battle-map-status{min-height:1.4em;color:#b9d899;font-size:.82rem}#battle-map-status[data-error="true"]{color:#ff927d}@media(max-width:650px){.battle-map-workspace{grid-template-columns:1fr}.battle-map-tools{grid-template-columns:repeat(3,minmax(0,1fr))}.battle-map-canvas-frame{height:60vh;min-height:340px}.battle-map-toolbar label{flex:1}.battle-map-toolbar input,.battle-map-toolbar select{min-width:0;width:100%}}`;
  host.append(style);
  host.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const toolButton = target.closest<HTMLElement>('[data-map-tool]'); if (toolButton) { tool = toolButton.dataset.mapTool as Tool; host.querySelectorAll('[data-map-tool]').forEach((button) => button.classList.toggle('active', button === toolButton)); return; }
    const sample = target.closest<HTMLElement>('[data-map-sample]'); if (sample) { const map = current(); if (map) { const template = defaultMapForMode(sample.dataset.mode as BattleMapMode); map.background = sample.dataset.mapSample!; map.mode = template.mode; map.routes = structuredClone(template.routes); map.spawns = structuredClone(template.spawns); map.entities = structuredClone(template.entities); map.tower = structuredClone(template.tower); map.opponentTower = template.opponentTower ? structuredClone(template.opponentTower) : undefined; activeRouteId = map.routes[0]?.id || ''; renderMapSelect(); } return; }
    const importButton = target.closest<HTMLElement>('[data-import-sample]'); if (importButton) { try { await importAsset(importButton.dataset.importSample!, importButton.dataset.path!); } catch (error) { status(error instanceof Error ? error.message : 'Sample import failed.', true); } return; }
    if (target.id === 'map-add-route' && current()) { const map = current()!; const route = { id: `route-${Date.now()}`, name: `Route ${map.routes.length + 1}`, width: 4, points: [] }; map.routes.push(route); activeRouteId = route.id; tool = 'route'; renderMapSelect(); }
    if (target.id === 'map-remove-entity' && current()) { const map = current()!; const found = map.entities.findIndex((entity) => entity.id === selectedEntityId); if (found >= 0) map.entities.splice(found, 1); selectedEntityId = null; draw(); }
    if (target.id === 'map-save') await saveCurrent();
    if (target.id === 'map-publish-creator') document.getElementById('studio-publish')?.click();
    if (target.id === 'map-new') { const mode = el<HTMLSelectElement>('map-mode')?.value as BattleMapMode || 'casual'; editorMaps.push({ ...defaultMapForMode(mode), id: `admin-${mode}-${Date.now()}`, name: `New ${mode} map`, published: true, revision: 1 }); selected = editorMaps.length - 1; renderMapSelect(); }
  });
  host.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.id === 'map-choice') { selected = Number(target.value) || 0; renderMapSelect(); }
    if (target.id === 'map-route-choice') { activeRouteId = target.value; }
    if (target.id === 'map-mode' && current()) { current()!.mode = target.value as BattleMapMode; draw(); }
    if (target.id === 'map-image-upload') { const file = (target as HTMLInputElement).files?.[0]; if (file && current()) try { current()!.background = await loadImageData(file); draw(); status('Optimized map image loaded. Save to publish it for this mode.'); } catch (error) { status(error instanceof Error ? error.message : 'Image upload failed.', true); } }
  });
  host.addEventListener('input', (event) => { const target = event.target as HTMLInputElement; if (target.id === 'map-name' && current()) current()!.name = target.value; });
  const canvas = el<HTMLCanvasElement>('battle-map-canvas')!;
  canvas.addEventListener('pointerdown', (event) => { canvas.setPointerCapture(event.pointerId); pointEvent(event); });
  canvas.addEventListener('pointermove', (event) => { if (!draggingEntity || !selectedEntityId || !current()) return; const point = normalizedPointer(event); const entity = current()!.entities.find((item) => item.id === selectedEntityId); if (point && entity) { entity.x = point.x; entity.y = point.y; draw(); } });
  canvas.addEventListener('pointerup', () => { draggingEntity = false; });
  window.addEventListener('resize', draw);
  const observer = new ResizeObserver(draw); observer.observe(host);
  void fetchAdminBattleMaps().then((maps) => { editorMaps = maps.map((map) => normalizeBattleMap(map)); selected = Math.max(0, editorMaps.findIndex((map) => map.mode === 'casual')); renderMapSelect(); status(`Loaded ${maps.length} mode maps from MongoDB.`); }).catch((error) => status(error.message || 'Could not load MongoDB maps.', true));
}

async function saveCurrent(): Promise<void> {
  const map = current(); if (!map || busy) return;
  const name = el<HTMLInputElement>('map-name'); if (name) map.name = name.value.trim() || map.name;
  busy = true; const button = el<HTMLButtonElement>('map-save'); if (button) button.disabled = true;
  try {
    const saved = await saveAdminBattleMap(normalizeBattleMap(map), map.revision);
    editorMaps[selected] = saved; status(`Saved “${saved.name}” to MongoDB · revision ${saved.revision}.`); renderMapSelect();
  } catch (error) { status(error instanceof Error ? error.message : 'Save failed.', true); }
  finally { busy = false; if (button) button.disabled = false; }
}
