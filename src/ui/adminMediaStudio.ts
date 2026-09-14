/**
 * Admin Media Studio — sprite sheet editor + sound bank (localStorage v1).
 * Live clip playback for enemies is handled by src/game/studioRuntime.ts.
 */

export const MEDIA_STUDIO_STORAGE_KEY = 'admin-media-studio-v1';
export const SOUND_BANK_STORAGE_KEY = 'admin-media-studio-sfx-v1';

export type StudioDirection = 'down' | 'left' | 'right' | 'up';
export type StudioState = 'idle' | 'walk' | 'run' | 'hit' | 'death';

export interface ClipDef {
  startFrame: number;
  frameCount: number;
}

export interface EntityStudioData {
  sheetDataUrl: string | null;
  cols: number;
  rows: number;
  frameW: number;
  frameH: number;
  clips: Record<string, ClipDef>;
}

export interface MediaStudioStore {
  version: 1;
  entities: Record<string, EntityStudioData>;
  selectedEntity: string;
}

export interface SoundBankStore {
  version: 1;
  replacements: Record<string, string>; // slotId -> dataURL
}

export const STUDIO_ENTITY_OPTIONS: { key: string; label: string }[] = [
  { key: 'enemy-normal', label: 'Rot-Walker (enemy-normal)' },
  { key: 'enemy-explosive', label: 'Chem-Burst (enemy-explosive)' },
  { key: 'enemy-armored', label: 'Rind-Plate (enemy-armored)' },
  { key: 'enemy-splitter', label: 'Pod-Spawner (enemy-splitter)' },
  { key: 'enemy-swift', label: 'Juice-Runner (enemy-swift)' },
  { key: 'tower-main', label: 'Main Tower (tower-main)' },
  { key: 'hero-jiju', label: 'Master Jiju (hero-jiju)' },
  { key: 'hero-topfu', label: 'Topfu (hero-topfu)' },
  { key: 'hero-lagen', label: 'Lagen (hero-lagen)' },
  { key: 'hero-tripos', label: 'Tripos (hero-tripos)' },
  { key: 'hero-ki', label: 'Master Ki (hero-ki)' },
];

export const STUDIO_STATES: StudioState[] = ['idle', 'walk', 'run', 'hit', 'death'];
export const STUDIO_DIRECTIONS: StudioDirection[] = ['down', 'left', 'right', 'up'];

/** Key SFX slots from src/audio/sfx.ts BANKS (+ a few one-shots). */
export const SOUND_BANK_SLOTS: { id: string; label: string; file: string }[] = [
  { id: 'swipe', label: 'Swipe', file: 'Sword-swipe-1.wav' },
  { id: 'swipeBlitz', label: 'Swipe Blitz', file: 'blade-rainbow-1.wav' },
  { id: 'cleanSlice', label: 'Clean Slice', file: 'Clean-Slice-1.wav' },
  { id: 'lemonImpact', label: 'Lemon/Citrus Impact', file: 'Impact-Orange.wav' },
  { id: 'berryImpact', label: 'Berry Impact', file: 'Impact-Strawberry.wav' },
  { id: 'melonImpact', label: 'Melon Impact', file: 'Impact-Watermelon.wav' },
  { id: 'bombExplode', label: 'Bomb Explode', file: 'Bomb-explode.wav' },
  { id: 'combo', label: 'Combo', file: 'Combo.wav' },
  { id: 'comboBlitzHit', label: 'Combo Blitz Hit', file: 'combo-blitz-1.wav' },
  { id: 'weaponLaunch', label: 'Weapon Launch', file: 'Bonus-Firework-Launch.wav' },
  { id: 'weaponBoom', label: 'Weapon Boom', file: 'Bonus-Firework-Explode.wav' },
  { id: 'shopTap', label: 'Shop Tap', file: 'ui-button-push.wav' },
  { id: 'shopEnter', label: 'Shop Enter', file: 'ui-screen-whoosh.wav' },
  { id: 'tick', label: 'Tick', file: 'Time-tick.wav' },
  { id: 'gameStart', label: 'Game Start', file: 'Game-start.wav' },
  { id: 'gameOver', label: 'Game Over', file: 'Game-over.wav' },
  { id: 'critical', label: 'Critical', file: 'Critical.wav' },
  { id: 'splatterMed', label: 'Splatter Medium', file: 'Splatter-Medium-1.wav' },
];

export function clipKey(state: StudioState, dir: StudioDirection): string {
  if (state === 'idle' || state === 'hit' || state === 'death') return state;
  return `${state}_${dir}`;
}

/** Row-major frame index → pixel rect in the sheet. */
export function frameRect(
  index: number,
  cols: number,
  rows: number,
  sheetW: number,
  sheetH: number,
  frameW?: number,
  frameH?: number,
): { sx: number; sy: number; sw: number; sh: number; col: number; row: number } {
  const c = Math.max(1, Math.floor(cols));
  const r = Math.max(1, Math.floor(rows));
  const total = c * r;
  const i = ((index % total) + total) % total;
  const col = i % c;
  const row = Math.floor(i / c);
  const sw = frameW && frameW > 0 ? frameW : sheetW / c;
  const sh = frameH && frameH > 0 ? frameH : sheetH / r;
  return { sx: col * sw, sy: row * sh, sw, sh, col, row };
}

export function indexFromCell(col: number, row: number, cols: number): number {
  return row * Math.max(1, Math.floor(cols)) + col;
}

export function emptyEntityData(): EntityStudioData {
  return {
    sheetDataUrl: null,
    cols: 4,
    rows: 4,
    frameW: 0,
    frameH: 0,
    clips: {},
  };
}

export function defaultStore(): MediaStudioStore {
  return { version: 1, entities: {}, selectedEntity: 'enemy-normal' };
}

export function loadStudioStore(): MediaStudioStore {
  try {
    const raw = localStorage.getItem(MEDIA_STUDIO_STORAGE_KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw) as MediaStudioStore;
    if (!parsed || parsed.version !== 1 || typeof parsed.entities !== 'object') return defaultStore();
    return parsed;
  } catch {
    return defaultStore();
  }
}

export function saveStudioStore(store: MediaStudioStore): void {
  localStorage.setItem(MEDIA_STUDIO_STORAGE_KEY, JSON.stringify(store));
}

export function loadSoundBank(): SoundBankStore {
  try {
    const raw = localStorage.getItem(SOUND_BANK_STORAGE_KEY);
    if (!raw) return { version: 1, replacements: {} };
    const parsed = JSON.parse(raw) as SoundBankStore;
    if (!parsed || parsed.version !== 1) return { version: 1, replacements: {} };
    return parsed;
  } catch {
    return { version: 1, replacements: {} };
  }
}

export function saveSoundBank(store: SoundBankStore): void {
  localStorage.setItem(SOUND_BANK_STORAGE_KEY, JSON.stringify(store));
}

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function approxDataUrlKb(dataUrl: string | null | undefined): number {
  if (!dataUrl) return 0;
  return Math.round((dataUrl.length * 0.75) / 1024);
}

let installed = false;
let store: MediaStudioStore = defaultStore();
let soundStore: SoundBankStore = { version: 1, replacements: {} };
let sheetImg: HTMLImageElement | null = null;
let selectedFrame = 0;
let previewState: StudioState = 'walk';
let previewDir: StudioDirection = 'down';
let previewFps = 8;
let previewPlaying = false;
let previewFrameCursor = 0;
let previewRaf = 0;
let previewLastTs = 0;
let previewAudio: HTMLAudioElement | null = null;

function currentEntity(): EntityStudioData {
  const key = store.selectedEntity;
  if (!store.entities[key]) store.entities[key] = emptyEntityData();
  return store.entities[key];
}

function setStatus(msg: string, ok = true): void {
  const el = $('studio-status');
  if (!el) return;
  el.textContent = msg;
  el.className = ok ? 'studio-status studio-status--ok' : 'studio-status studio-status--err';
}

function fillEntitySelect(): void {
  const sel = $('studio-entity') as HTMLSelectElement | null;
  if (!sel) return;
  sel.innerHTML = STUDIO_ENTITY_OPTIONS.map(
    (o) => `<option value="${o.key}">${o.label}</option>`,
  ).join('');
  sel.value = store.selectedEntity;
}

function syncGridInputs(): void {
  const ent = currentEntity();
  const cols = $('studio-cols') as HTMLInputElement | null;
  const rows = $('studio-rows') as HTMLInputElement | null;
  const fw = $('studio-frame-w') as HTMLInputElement | null;
  const fh = $('studio-frame-h') as HTMLInputElement | null;
  if (cols) cols.value = String(ent.cols);
  if (rows) rows.value = String(ent.rows);
  if (fw) fw.value = ent.frameW ? String(ent.frameW) : '';
  if (fh) fh.value = ent.frameH ? String(ent.frameH) : '';
}

function syncClipInputs(): void {
  const ent = currentEntity();
  const state = ($('studio-clip-state') as HTMLSelectElement | null)?.value as StudioState | undefined;
  const dir = ($('studio-clip-dir') as HTMLSelectElement | null)?.value as StudioDirection | undefined;
  if (!state || !dir) return;
  const key = clipKey(state, dir);
  const clip = ent.clips[key] ?? { startFrame: selectedFrame, frameCount: 1 };
  const start = $('studio-clip-start') as HTMLInputElement | null;
  const count = $('studio-clip-count') as HTMLInputElement | null;
  const label = $('studio-clip-key');
  if (start) start.value = String(clip.startFrame);
  if (count) count.value = String(clip.frameCount);
  if (label) label.textContent = key;
}

function loadSheetImage(dataUrl: string | null): Promise<void> {
  return new Promise((resolve) => {
    if (!dataUrl) {
      sheetImg = null;
      resolve();
      return;
    }
    const img = new Image();
    img.onload = () => {
      sheetImg = img;
      resolve();
    };
    img.onerror = () => {
      sheetImg = null;
      resolve();
    };
    img.src = dataUrl;
  });
}

function drawSheet(): void {
  const canvas = $('studio-sheet-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const ent = currentEntity();
  const maxW = 640;
  const maxH = 400;

  if (!sheetImg) {
    canvas.width = maxW;
    canvas.height = 220;
    ctx.fillStyle = '#0c120a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px monospace';
    ctx.fillText('Upload a PNG sprite sheet to begin', 16, 28);
    return;
  }

  const scale = Math.min(maxW / sheetImg.width, maxH / sheetImg.height, 1);
  canvas.width = Math.max(1, Math.floor(sheetImg.width * scale));
  canvas.height = Math.max(1, Math.floor(sheetImg.height * scale));
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sheetImg, 0, 0, canvas.width, canvas.height);

  const cols = Math.max(1, ent.cols);
  const rows = Math.max(1, ent.rows);
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  ctx.strokeStyle = 'rgba(163, 230, 53, 0.45)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= cols; c++) {
    const x = Math.round(c * cellW) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = Math.round(r * cellH) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const sel = frameRect(selectedFrame, cols, rows, canvas.width, canvas.height);
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2;
  ctx.strokeRect(sel.sx + 1, sel.sy + 1, sel.sw - 2, sel.sh - 2);

  const info = $('studio-sheet-info');
  if (info) {
    info.textContent = `${sheetImg.width}×${sheetImg.height}px · ${cols}×${rows} · frame ${selectedFrame} (${sel.col},${sel.row}) · ~${approxDataUrlKb(ent.sheetDataUrl)} KB`;
  }
}

function activeClip(): ClipDef {
  const ent = currentEntity();
  const key = clipKey(previewState, previewDir);
  return ent.clips[key] ?? { startFrame: selectedFrame, frameCount: 1 };
}

function drawPreviewFrame(frameIndex: number): void {
  const canvas = $('studio-preview-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = 160;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = '#0b1208';
  ctx.fillRect(0, 0, size, size);

  if (!sheetImg) {
    ctx.fillStyle = '#64748b';
    ctx.font = '11px monospace';
    ctx.fillText('No sheet', 16, 24);
    return;
  }

  const ent = currentEntity();
  const rect = frameRect(
    frameIndex,
    ent.cols,
    ent.rows,
    sheetImg.width,
    sheetImg.height,
    ent.frameW || undefined,
    ent.frameH || undefined,
  );
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(size / rect.sw, size / rect.sh);
  const dw = rect.sw * scale;
  const dh = rect.sh * scale;
  const dx = (size - dw) / 2;
  const dy = (size - dh) / 2;
  ctx.drawImage(sheetImg, rect.sx, rect.sy, rect.sw, rect.sh, dx, dy, dw, dh);
}

function stopPreviewLoop(): void {
  previewPlaying = false;
  if (previewRaf) cancelAnimationFrame(previewRaf);
  previewRaf = 0;
}

function tickPreview(ts: number): void {
  if (!previewPlaying) return;
  const clip = activeClip();
  const interval = 1000 / Math.max(1, previewFps);
  if (!previewLastTs) previewLastTs = ts;
  if (ts - previewLastTs >= interval) {
    previewLastTs = ts;
    const count = Math.max(1, clip.frameCount);
    previewFrameCursor += 1;
    if (previewFrameCursor >= count) {
      if (previewState === 'hit' || previewState === 'death') {
        previewFrameCursor = count - 1;
        drawPreviewFrame(clip.startFrame + previewFrameCursor);
        stopPreviewLoop();
        return;
      }
      previewFrameCursor = 0;
    }
    drawPreviewFrame(clip.startFrame + previewFrameCursor);
  }
  previewRaf = requestAnimationFrame(tickPreview);
}

function playPreview(): void {
  const clip = activeClip();
  previewFrameCursor = 0;
  previewLastTs = 0;
  drawPreviewFrame(clip.startFrame);
  stopPreviewLoop();
  previewPlaying = true;
  previewRaf = requestAnimationFrame(tickPreview);
}

function applyClipFromInputs(): void {
  const state = ($('studio-clip-state') as HTMLSelectElement | null)?.value as StudioState;
  const dir = ($('studio-clip-dir') as HTMLSelectElement | null)?.value as StudioDirection;
  const start = Number(($('studio-clip-start') as HTMLInputElement | null)?.value || 0);
  const count = Number(($('studio-clip-count') as HTMLInputElement | null)?.value || 1);
  const key = clipKey(state, dir);
  currentEntity().clips[key] = {
    startFrame: Math.max(0, Math.floor(start)),
    frameCount: Math.max(1, Math.floor(count)),
  };
  syncClipInputs();
  setStatus(`Clip ${key} set (${start}+${count})`);
}

function persistAll(): void {
  saveStudioStore(store);
  const kb = approxDataUrlKb(currentEntity().sheetDataUrl);
  if (kb > 2500) {
    setStatus(`Saved to ${MEDIA_STUDIO_STORAGE_KEY} (~${kb} KB). Warning: localStorage often caps ~5MB.`, false);
  } else {
    setStatus(`Saved studio data to ${MEDIA_STUDIO_STORAGE_KEY} (~${kb} KB sheet).`);
  }
}

function exportSelectedFrame(): void {
  if (!sheetImg) {
    setStatus('No sheet loaded', false);
    return;
  }
  const ent = currentEntity();
  const rect = frameRect(
    selectedFrame,
    ent.cols,
    ent.rows,
    sheetImg.width,
    sheetImg.height,
    ent.frameW || undefined,
    ent.frameH || undefined,
  );
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(rect.sw));
  out.height = Math.max(1, Math.round(rect.sh));
  const ctx = out.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheetImg, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, out.width, out.height);
  const a = document.createElement('a');
  a.href = out.toDataURL('image/png');
  a.download = `${store.selectedEntity}-frame-${selectedFrame}.png`;
  a.click();
  setStatus(`Exported frame ${selectedFrame}`);
}

async function onEntityChange(): Promise<void> {
  stopPreviewLoop();
  selectedFrame = 0;
  syncGridInputs();
  syncClipInputs();
  await loadSheetImage(currentEntity().sheetDataUrl);
  drawSheet();
  drawPreviewFrame(selectedFrame);
}

function bindSheetCanvasClick(): void {
  const canvas = $('studio-sheet-canvas') as HTMLCanvasElement | null;
  if (!canvas) return;
  canvas.addEventListener('click', (e) => {
    const ent = currentEntity();
    if (!sheetImg) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const col = Math.min(ent.cols - 1, Math.max(0, Math.floor(x / (canvas.width / ent.cols))));
    const row = Math.min(ent.rows - 1, Math.max(0, Math.floor(y / (canvas.height / ent.rows))));
    selectedFrame = indexFromCell(col, row, ent.cols);
    const start = $('studio-clip-start') as HTMLInputElement | null;
    if (start) start.value = String(selectedFrame);
    drawSheet();
    drawPreviewFrame(selectedFrame);
  });
}

function renderSoundBank(): void {
  const list = $('studio-sound-list');
  if (!list) return;
  list.innerHTML = '';
  for (const slot of SOUND_BANK_SLOTS) {
    const row = document.createElement('div');
    row.className = 'studio-sfx-row';
    const hasCustom = Boolean(soundStore.replacements[slot.id]);
    row.innerHTML = `
      <div class="studio-sfx-meta">
        <strong>${slot.label}</strong>
        <span class="studio-sfx-file">${slot.file}${hasCustom ? ' · custom' : ''}</span>
      </div>
      <div class="studio-sfx-actions">
        <button type="button" class="studio-btn studio-btn--sm" data-sfx-play="${slot.id}">Play</button>
        <label class="studio-btn studio-btn--sm studio-btn--file">
          Upload
          <input type="file" accept="audio/*,.wav,.mp3,.ogg" data-sfx-upload="${slot.id}" hidden />
        </label>
        <button type="button" class="studio-btn studio-btn--sm studio-btn--danger" data-sfx-clear="${slot.id}" ${hasCustom ? '' : 'disabled'}>Clear</button>
      </div>
    `;
    list.appendChild(row);
  }

  list.querySelectorAll<HTMLButtonElement>('[data-sfx-play]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.sfxPlay!;
      const slot = SOUND_BANK_SLOTS.find((s) => s.id === id);
      if (!slot) return;
      const src = soundStore.replacements[id] || `/Sound/${slot.file}`;
      if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
      }
      previewAudio = new Audio(src);
      void previewAudio.play().catch(() => setStatus(`Could not play ${slot.file}`, false));
    });
  });

  list.querySelectorAll<HTMLInputElement>('[data-sfx-upload]').forEach((input) => {
    input.addEventListener('change', () => {
      const id = input.dataset.sfxUpload!;
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        soundStore.replacements[id] = dataUrl;
        saveSoundBank(soundStore);
        renderSoundBank();
        setStatus(`SFX ${id} replaced locally (~${approxDataUrlKb(dataUrl)} KB)`);
      };
      reader.readAsDataURL(file);
    });
  });

  list.querySelectorAll<HTMLButtonElement>('[data-sfx-clear]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.sfxClear!;
      delete soundStore.replacements[id];
      saveSoundBank(soundStore);
      renderSoundBank();
      setStatus(`Cleared custom SFX for ${id}`);
    });
  });
}

function bindControls(): void {
  $('studio-entity')?.addEventListener('change', (e) => {
    store.selectedEntity = (e.target as HTMLSelectElement).value;
    void onEntityChange();
  });

  const onGrid = () => {
    const ent = currentEntity();
    ent.cols = Math.max(1, Number(($('studio-cols') as HTMLInputElement).value) || 1);
    ent.rows = Math.max(1, Number(($('studio-rows') as HTMLInputElement).value) || 1);
    ent.frameW = Math.max(0, Number(($('studio-frame-w') as HTMLInputElement).value) || 0);
    ent.frameH = Math.max(0, Number(($('studio-frame-h') as HTMLInputElement).value) || 0);
    drawSheet();
    drawPreviewFrame(selectedFrame);
  };
  ['studio-cols', 'studio-rows', 'studio-frame-w', 'studio-frame-h'].forEach((id) => {
    $(id)?.addEventListener('input', onGrid);
  });

  $('studio-sheet-upload')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      currentEntity().sheetDataUrl = dataUrl;
      await loadSheetImage(dataUrl);
      selectedFrame = 0;
      drawSheet();
      drawPreviewFrame(0);
      setStatus(`Sheet loaded (~${approxDataUrlKb(dataUrl)} KB). Remember localStorage ~5MB limit.`);
    };
    reader.readAsDataURL(file);
  });

  $('studio-clip-state')?.addEventListener('change', () => {
    syncClipInputs();
  });
  $('studio-clip-dir')?.addEventListener('change', () => {
    syncClipInputs();
  });
  $('studio-apply-clip')?.addEventListener('click', () => applyClipFromInputs());
  $('studio-use-selected-start')?.addEventListener('click', () => {
    const start = $('studio-clip-start') as HTMLInputElement | null;
    if (start) start.value = String(selectedFrame);
    applyClipFromInputs();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-studio-state]').forEach((btn) => {
    btn.addEventListener('click', () => {
      previewState = btn.dataset.studioState as StudioState;
      document.querySelectorAll('[data-studio-state]').forEach((b) => b.classList.toggle('is-on', b === btn));
      playPreview();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-studio-dir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      previewDir = btn.dataset.studioDir as StudioDirection;
      document.querySelectorAll('[data-studio-dir]').forEach((b) => b.classList.toggle('is-on', b === btn));
      playPreview();
    });
  });

  $('studio-fps')?.addEventListener('input', (e) => {
    previewFps = Math.max(1, Number((e.target as HTMLInputElement).value) || 8);
    const label = $('studio-fps-label');
    if (label) label.textContent = `${previewFps} FPS`;
  });
  $('studio-play')?.addEventListener('click', () => playPreview());
  $('studio-stop')?.addEventListener('click', () => {
    stopPreviewLoop();
    drawPreviewFrame(activeClip().startFrame);
  });
  $('studio-save')?.addEventListener('click', () => persistAll());
  $('studio-export-frame')?.addEventListener('click', () => exportSelectedFrame());
  $('studio-clear-entity')?.addEventListener('click', async () => {
    store.entities[store.selectedEntity] = emptyEntityData();
    await onEntityChange();
    setStatus(`Cleared studio data for ${store.selectedEntity}`);
  });

  bindSheetCanvasClick();
}

export function installMediaStudio(): void {
  if (!$('admin-media-studio')) return;
  store = loadStudioStore();
  soundStore = loadSoundBank();
  if (!installed) {
    fillEntitySelect();
    bindControls();
    installed = true;
  } else {
    fillEntitySelect();
  }
  syncGridInputs();
  syncClipInputs();
  renderSoundBank();
  void loadSheetImage(currentEntity().sheetDataUrl).then(() => {
    drawSheet();
    drawPreviewFrame(selectedFrame);
  });
  const fps = $('studio-fps') as HTMLInputElement | null;
  if (fps) {
    previewFps = Number(fps.value) || 8;
    const label = $('studio-fps-label');
    if (label) label.textContent = `${previewFps} FPS`;
  }
  document.querySelectorAll('[data-studio-state]').forEach((b) =>
    b.classList.toggle('is-on', (b as HTMLElement).dataset.studioState === previewState),
  );
  document.querySelectorAll('[data-studio-dir]').forEach((b) =>
    b.classList.toggle('is-on', (b as HTMLElement).dataset.studioDir === previewDir),
  );
}
