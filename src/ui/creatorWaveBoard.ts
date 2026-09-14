/**
 * FruitTD Creator — Wave/Level Board UI.
 * Draft: fruittd-creator-waves-v1. Publish → saveAdminConfig({ waves }) + liveConfig.
 */
import {
  CREATOR_WAVES_STORAGE_KEY,
  ENEMY_KIND_OPTIONS,
  FRUIT_KIND_OPTIONS,
  defaultWavesCount,
  emptyCreatorWavesStore,
  emptySpawnRow,
  ensureAuthoredLevel,
  loadCreatorWavesStore,
  normalizeCreatorWavesStore,
  previewSummary,
  saveCreatorWavesStore,
  storeToAdminWaves,
  type AuthoredLevel,
  type AuthoredSpawnRow,
  type AuthoredWave,
  type CreatorWavesStore,
} from '../game/creatorWaves';
import { saveAdminConfig, type AdminConfig } from '../services/admin';
import { getLiveConfig, setLiveConfig } from '../services/liveConfig';

const MAX_LEVEL = 20;
let store: CreatorWavesStore = emptyCreatorWavesStore();
let selectedLevel = 1;
let installed = false;

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function status(msg: string, ok = true): void {
  const el = $('creator-waves-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `studio-status ${ok ? 'studio-status--ok' : 'studio-status--err'}`;
}

function currentLevel(): AuthoredLevel {
  const key = String(selectedLevel);
  if (!store.levels[key]) {
    store.levels[key] = ensureAuthoredLevel(selectedLevel);
  }
  return store.levels[key];
}

function persistDraft(): void {
  store = normalizeCreatorWavesStore(store);
  const ok = saveCreatorWavesStore(store);
  syncAdvancedJson();
  updatePreview();
  status(ok ? `Draft saved (${CREATOR_WAVES_STORAGE_KEY})` : 'Draft save failed (storage full?)', ok);
}

function syncAdvancedJson(): void {
  const ta = $('admin-waves-json') as HTMLTextAreaElement | null;
  if (ta) {
    ta.value = JSON.stringify(storeToAdminWaves(store), null, 2);
  }
}

function updatePreview(): void {
  const el = $('creator-waves-preview');
  if (!el) return;
  el.textContent = previewSummary(currentLevel());
}

function fruitOptions(selected: string): string {
  return FRUIT_KIND_OPTIONS.map(
    (f) => `<option value="${f}" ${f === selected ? 'selected' : ''}>${f}</option>`,
  ).join('');
}

function enemyOptions(selected: string): string {
  return ENEMY_KIND_OPTIONS.map(
    (e) => `<option value="${e.kind}" ${e.kind === selected ? 'selected' : ''}>${e.label}</option>`,
  ).join('');
}

function renderSpawnRow(waveIdx: number, rowIdx: number, row: AuthoredSpawnRow, bossSlot: boolean): string {
  const prefix = bossSlot ? 'boss' : `w${waveIdx}`;
  return `
    <div class="cw-spawn-row" data-wave="${waveIdx}" data-row="${rowIdx}" data-boss="${bossSlot ? '1' : '0'}">
      <label class="studio-label">Fruit
        <select class="studio-input cw-fruit" data-f="${prefix}-${rowIdx}">${fruitOptions(row.fruit)}</select>
      </label>
      <label class="studio-label">Enemy
        <select class="studio-input cw-enemy">${enemyOptions(row.enemy)}</select>
      </label>
      <label class="studio-label">Count
        <input class="studio-input studio-input--num cw-count" type="number" min="1" max="64" value="${row.count}" />
      </label>
      <label class="studio-label studio-check"><input class="cw-row-boss" type="checkbox" ${row.boss ? 'checked' : ''} /> Boss unit</label>
      <button type="button" class="studio-btn studio-btn--sm studio-btn--danger cw-del-row">Remove</button>
    </div>`;
}

function renderWaveCard(wave: AuthoredWave, waveIdx: number, bossSlot: boolean): string {
  const label = bossSlot ? 'Boss / Overlord slot' : `Wave ${waveIdx + 1}`;
  const spawns = (wave.spawns || []).map((r, i) => renderSpawnRow(waveIdx, i, r, bossSlot)).join('');
  return `
    <article class="cw-wave-card ${bossSlot ? 'cw-wave-card--boss' : ''}" data-wave="${waveIdx}" data-boss="${bossSlot ? '1' : '0'}">
      <header class="cw-wave-head">
        <strong>${label}</strong>
        <label class="studio-label studio-check"><input class="cw-wave-boss-toggle" type="checkbox" ${wave.boss || bossSlot ? 'checked' : ''} ${bossSlot ? 'disabled' : ''} /> Boss wave</label>
      </header>
      <div class="cw-wave-fields">
        <label class="studio-label">Title
          <input class="studio-input cw-title" type="text" value="${escapeAttr(wave.title || '')}" placeholder="LEVEL · WAVE" />
        </label>
        <label class="studio-label">Subtitle
          <input class="studio-input cw-subtitle" type="text" value="${escapeAttr(wave.subtitle || '')}" placeholder="Optional callout" />
        </label>
        <label class="studio-label">Gap
          <input class="studio-input studio-input--num cw-gap" type="number" min="0.05" max="5" step="0.05" value="${wave.gap ?? ''}" placeholder="auto" />
        </label>
        <label class="studio-label">HP scale
          <input class="studio-input studio-input--num cw-hpscale" type="number" min="0.1" max="50" step="0.1" value="${wave.hpScale ?? ''}" placeholder="auto" />
        </label>
      </div>
      <div class="cw-spawns">${spawns}</div>
      <button type="button" class="studio-btn studio-btn--sm cw-add-row">+ Spawn row</button>
    </article>`;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function readWaveFromCard(card: HTMLElement): AuthoredWave {
  const title = (card.querySelector('.cw-title') as HTMLInputElement | null)?.value?.trim() || undefined;
  const subtitle = (card.querySelector('.cw-subtitle') as HTMLInputElement | null)?.value?.trim() || undefined;
  const gapRaw = (card.querySelector('.cw-gap') as HTMLInputElement | null)?.value;
  const hpRaw = (card.querySelector('.cw-hpscale') as HTMLInputElement | null)?.value;
  const bossToggle = card.querySelector('.cw-wave-boss-toggle') as HTMLInputElement | null;
  const isBossSlot = card.dataset.boss === '1';
  const spawns: AuthoredSpawnRow[] = [];
  card.querySelectorAll<HTMLElement>('.cw-spawn-row').forEach((row) => {
    const fruit = (row.querySelector('.cw-fruit') as HTMLSelectElement)?.value || 'lemon';
    const enemy = (row.querySelector('.cw-enemy') as HTMLSelectElement)?.value || 'normal';
    const count = Number((row.querySelector('.cw-count') as HTMLInputElement)?.value || 1);
    const boss = Boolean((row.querySelector('.cw-row-boss') as HTMLInputElement)?.checked);
    spawns.push({
      fruit: fruit as AuthoredSpawnRow['fruit'],
      enemy: enemy as AuthoredSpawnRow['enemy'],
      count: Math.max(1, Math.min(64, Math.floor(count) || 1)),
      boss,
    });
  });
  return {
    title,
    subtitle,
    gap: gapRaw === '' || gapRaw == null ? undefined : Number(gapRaw),
    hpScale: hpRaw === '' || hpRaw == null ? undefined : Number(hpRaw),
    boss: isBossSlot || Boolean(bossToggle?.checked),
    spawns: spawns.length ? spawns : [emptySpawnRow()],
  };
}

function harvestFromDom(): void {
  const lvl = currentLevel();
  const countInput = $('creator-waves-count') as HTMLInputElement | null;
  const wavesCount = Math.max(1, Math.min(40, Math.floor(Number(countInput?.value) || lvl.wavesCount)));
  const cards = Array.from(document.querySelectorAll<HTMLElement>('#creator-waves-list .cw-wave-card'));
  const regular: AuthoredWave[] = [];
  let bossWave = lvl.bossWave;
  for (const card of cards) {
    const wave = readWaveFromCard(card);
    if (card.dataset.boss === '1') bossWave = wave;
    else regular.push(wave);
  }
  // Resize regular waves to wavesCount
  while (regular.length < wavesCount) {
    regular.push(ensureAuthoredLevel(selectedLevel, { wavesCount, waves: regular }).waves[regular.length]);
  }
  store.levels[String(selectedLevel)] = ensureAuthoredLevel(selectedLevel, {
    level: selectedLevel,
    wavesCount,
    waves: regular.slice(0, wavesCount),
    bossWave,
  });
}

function renderBoard(): void {
  const list = $('creator-waves-list');
  const levelSelect = $('creator-waves-level') as HTMLSelectElement | null;
  const countInput = $('creator-waves-count') as HTMLInputElement | null;
  if (!list) return;

  if (levelSelect && !levelSelect.options.length) {
    levelSelect.innerHTML = Array.from({ length: MAX_LEVEL }, (_, i) => {
      const n = i + 1;
      return `<option value="${n}">Level ${n}</option>`;
    }).join('');
  }
  if (levelSelect) levelSelect.value = String(selectedLevel);

  const lvl = currentLevel();
  if (countInput) countInput.value = String(lvl.wavesCount);

  const cards = lvl.waves.map((w, i) => renderWaveCard(w, i, false));
  if (lvl.bossWave) cards.push(renderWaveCard(lvl.bossWave, lvl.waves.length, true));
  list.innerHTML = cards.join('') || '<p class="studio-hint">No waves yet.</p>';
  updatePreview();
  bindCardHandlers();
}

function bindCardHandlers(): void {
  const list = $('creator-waves-list');
  if (!list) return;

  list.querySelectorAll('.cw-add-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      harvestFromDom();
      const card = (btn as HTMLElement).closest('.cw-wave-card') as HTMLElement;
      const boss = card?.dataset.boss === '1';
      const lvl = currentLevel();
      if (boss && lvl.bossWave) {
        lvl.bossWave.spawns.push(emptySpawnRow());
      } else {
        const idx = Number(card?.dataset.wave || 0);
        lvl.waves[idx]?.spawns.push(emptySpawnRow());
      }
      renderBoard();
    });
  });

  list.querySelectorAll('.cw-del-row').forEach((btn) => {
    btn.addEventListener('click', () => {
      harvestFromDom();
      const row = (btn as HTMLElement).closest('.cw-spawn-row') as HTMLElement;
      const boss = row?.dataset.boss === '1';
      const waveIdx = Number(row?.dataset.wave || 0);
      const rowIdx = Number(row?.dataset.row || 0);
      const lvl = currentLevel();
      const target = boss ? lvl.bossWave : lvl.waves[waveIdx];
      if (target && target.spawns.length > 1) {
        target.spawns.splice(rowIdx, 1);
        renderBoard();
      }
    });
  });
}

async function publishToLive(): Promise<void> {
  harvestFromDom();
  persistDraft();
  const waves = storeToAdminWaves(store);
  const live = getLiveConfig();
  const payload: Partial<AdminConfig> = {
    ...live,
    waves,
  };
  const res = await saveAdminConfig(payload);
  if (res.success) {
    setLiveConfig({ ...live, waves } as AdminConfig);
    // Keep admin controller config in sync if present via custom event
    window.dispatchEvent(new CustomEvent('fruittd-waves-published', { detail: waves }));
    status(res.message || 'Published waves to live admin config', true);
  } else {
    // Still apply locally so playtest works offline
    setLiveConfig({ ...live, waves } as AdminConfig);
    status(`Published locally (server: ${res.error || 'failed'}). Live play uses local override.`, false);
  }
}

function loadFromLiveOrDraft(): void {
  const live = getLiveConfig() as AdminConfig & { waves?: unknown };
  const draft = loadCreatorWavesStore();
  if (Object.keys(draft.levels).length) {
    store = draft;
  } else if (live.waves && typeof live.waves === 'object') {
    store = normalizeCreatorWavesStore(live.waves);
  } else {
    store = emptyCreatorWavesStore();
  }
  // Seed level 1 for empty stores so the board is usable
  if (!store.levels['1']) {
    store.levels['1'] = ensureAuthoredLevel(1);
  }
}

export function installCreatorWaveBoard(): void {
  if (installed) {
    loadFromLiveOrDraft();
    renderBoard();
    return;
  }
  if (!$('creator-waves-board')) return;
  installed = true;
  loadFromLiveOrDraft();

  $('creator-waves-level')?.addEventListener('change', (e) => {
    harvestFromDom();
    selectedLevel = Math.max(1, Math.min(MAX_LEVEL, Number((e.target as HTMLSelectElement).value) || 1));
    if (!store.levels[String(selectedLevel)]) {
      store.levels[String(selectedLevel)] = ensureAuthoredLevel(selectedLevel);
    }
    renderBoard();
  });

  $('creator-waves-count')?.addEventListener('change', () => {
    harvestFromDom();
    const lvl = currentLevel();
    const countInput = $('creator-waves-count') as HTMLInputElement | null;
    const wavesCount = Math.max(1, Math.min(40, Math.floor(Number(countInput?.value) || defaultWavesCount(selectedLevel))));
    store.levels[String(selectedLevel)] = ensureAuthoredLevel(selectedLevel, {
      ...lvl,
      wavesCount,
      waves: lvl.waves,
      bossWave: lvl.bossWave,
    });
    renderBoard();
  });

  $('creator-waves-save')?.addEventListener('click', () => {
    harvestFromDom();
    persistDraft();
  });

  $('creator-waves-publish')?.addEventListener('click', () => {
    void publishToLive();
  });

  $('creator-waves-reset-level')?.addEventListener('click', () => {
    store.levels[String(selectedLevel)] = ensureAuthoredLevel(selectedLevel);
    renderBoard();
    persistDraft();
  });

  // Advanced JSON collapse sync
  const adv = $('admin-waves-json') as HTMLTextAreaElement | null;
  $('creator-waves-apply-json')?.addEventListener('click', () => {
    if (!adv) return;
    try {
      store = normalizeCreatorWavesStore(JSON.parse(adv.value || '{}'));
      if (!store.levels[String(selectedLevel)]) {
        store.levels[String(selectedLevel)] = ensureAuthoredLevel(selectedLevel);
      }
      persistDraft();
      renderBoard();
      status('Applied Advanced JSON into board', true);
    } catch (err: any) {
      status(`Invalid JSON: ${err.message}`, false);
    }
  });

  renderBoard();
  syncAdvancedJson();
  status('Wave board ready', true);
}

export function getCreatorWavesDraft(): CreatorWavesStore {
  return normalizeCreatorWavesStore(store);
}
