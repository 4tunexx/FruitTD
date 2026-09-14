/**
 * FruitTD Creator — Slicer pack + VFX library authoring UI.
 * Draft: fruittd-creator-vfx-v1. Publish merges slicer overrides into admin live slicers.
 */
import {
  CREATOR_VFX_STORAGE_KEY,
  CREATOR_VFX_KINDS,
  applySlicerPackOverrides,
  defaultPresets,
  emptyCreatorVfxStore,
  ensureSlicerPack,
  loadCreatorVfxStore,
  mergeSlicerPacksIntoCatalog,
  newPresetId,
  normalizeCreatorVfxStore,
  previewVfxPayload,
  saveCreatorVfxStore,
  type CreatorSlicerPack,
  type CreatorVfxKind,
  type CreatorVfxPreset,
  type CreatorVfxStore,
  type SlicerVfxEvent,
} from '../game/creatorVfx';
import { DEFAULT_SLICERS, findSlicer, type CatalogSlicer } from '../game/slicers';
import { saveAdminConfig, type AdminConfig } from '../services/admin';
import { getLiveConfig, getSlicers, setLiveConfig } from '../services/liveConfig';

let store: CreatorVfxStore = emptyCreatorVfxStore();
let installed = false;
let previewRaf = 0;
let previewParticles: PreviewParticle[] = [];

interface PreviewParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  r: number;
  color: string;
  kind: string;
}

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function escapeAttr(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function status(msg: string, ok = true): void {
  const el = $('creator-svfx-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `studio-status ${ok ? 'studio-status--ok' : 'studio-status--err'}`;
}

function catalogList(): CatalogSlicer[] {
  try {
    const live = getSlicers();
    if (Array.isArray(live) && live.length) return live;
  } catch {
    /* ignore */
  }
  return DEFAULT_SLICERS;
}

function selectedCatalog(): CatalogSlicer {
  const list = catalogList();
  return (
    findSlicer(list, store.selectedSlicerId) ||
    list.find((s) => s.id === store.selectedSlicerId) ||
    list[0] ||
    DEFAULT_SLICERS[0]
  );
}

function currentPack(): CreatorSlicerPack {
  return ensureSlicerPack(store, store.selectedSlicerId);
}

function selectedPreset(): CreatorVfxPreset {
  return (
    store.presets.find((p) => p.id === store.selectedPresetId) ||
    store.presets[0] ||
    defaultPresets()[0]
  );
}

function persistDraft(): void {
  store = normalizeCreatorVfxStore(store);
  const ok = saveCreatorVfxStore(store);
  status(ok ? `Draft saved (${CREATOR_VFX_STORAGE_KEY})` : 'Draft save failed (storage full?)', ok);
}

function harvestSlicerFields(): void {
  const pack = currentPack();
  const color = ($('creator-svfx-color') as HTMLInputElement | null)?.value;
  const glow = ($('creator-svfx-glow') as HTMLInputElement | null)?.value;
  const dmg = Number(($('creator-svfx-dmg') as HTMLInputElement | null)?.value);
  const juice = Number(($('creator-svfx-juice') as HTMLInputElement | null)?.value);
  const brittle = Number(($('creator-svfx-brittle') as HTMLInputElement | null)?.value);
  if (color) pack.color = color;
  if (glow) pack.glowColor = glow;
  if (Number.isFinite(dmg)) pack.damageMul = dmg;
  if (Number.isFinite(juice)) pack.juiceMul = juice;
  if (Number.isFinite(brittle)) pack.brittleBonus = brittle;

  const onSlash = ($('creator-svfx-bind-slash') as HTMLSelectElement | null)?.value || '';
  const onCrit = ($('creator-svfx-bind-crit') as HTMLSelectElement | null)?.value || '';
  const onKill = ($('creator-svfx-bind-kill') as HTMLSelectElement | null)?.value || '';
  pack.binds = {
    ...(onSlash ? { onSlash } : {}),
    ...(onCrit ? { onCrit } : {}),
    ...(onKill ? { onKill } : {}),
  };
}

function harvestPresetFields(): void {
  const preset = selectedPreset();
  if (!preset) return;
  const name = ($('creator-svfx-preset-name') as HTMLInputElement | null)?.value?.trim();
  const kind = ($('creator-svfx-preset-kind') as HTMLSelectElement | null)?.value as CreatorVfxKind;
  const intensity = Number(($('creator-svfx-preset-intensity') as HTMLInputElement | null)?.value);
  const duration = Number(($('creator-svfx-preset-duration') as HTMLInputElement | null)?.value);
  const color = ($('creator-svfx-preset-color') as HTMLInputElement | null)?.value;
  if (name) preset.name = name;
  if (CREATOR_VFX_KINDS.includes(kind)) preset.kind = kind;
  if (Number.isFinite(intensity)) preset.intensity = intensity;
  if (Number.isFinite(duration)) preset.duration = duration;
  if (color) preset.color = color;
}

function presetOptions(selected: string, includeNone = false): string {
  const none = includeNone ? `<option value="" ${!selected ? 'selected' : ''}>— none —</option>` : '';
  const opts = store.presets
    .map(
      (p) =>
        `<option value="${escapeAttr(p.id)}" ${p.id === selected ? 'selected' : ''}>${escapeAttr(p.name)} (${escapeAttr(p.kind)})</option>`,
    )
    .join('');
  return none + opts;
}

function renderSlicerSelect(): void {
  const sel = $('creator-svfx-slicer') as HTMLSelectElement | null;
  if (!sel) return;
  const list = catalogList();
  if (!list.some((s) => s.id === store.selectedSlicerId) && list[0]) {
    store.selectedSlicerId = list[0].id;
  }
  sel.innerHTML = list
    .map(
      (s) =>
        `<option value="${escapeAttr(s.id)}" ${s.id === store.selectedSlicerId ? 'selected' : ''}>${escapeAttr(s.name)} (${escapeAttr(s.id)})</option>`,
    )
    .join('');
}

function renderPresetList(): void {
  const list = $('creator-svfx-preset-list');
  if (!list) return;
  list.innerHTML = store.presets
    .map((p) => {
      const on = p.id === store.selectedPresetId ? ' is-on' : '';
      return `<button type="button" class="studio-rail-item${on}" data-preset="${escapeAttr(p.id)}">
        <span class="svfx-swatch" style="background:${escapeAttr(p.color)}"></span>
        <span><strong>${escapeAttr(p.name)}</strong><small>${escapeAttr(p.kind)}</small></span>
      </button>`;
    })
    .join('');
  list.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      harvestPresetFields();
      store.selectedPresetId = btn.dataset.preset || store.selectedPresetId;
      renderAll();
    });
  });
}

function renderSlicerFields(): void {
  const base = selectedCatalog();
  const pack = currentPack();
  const merged = applySlicerPackOverrides(base, pack);

  const color = $('creator-svfx-color') as HTMLInputElement | null;
  const glow = $('creator-svfx-glow') as HTMLInputElement | null;
  const dmg = $('creator-svfx-dmg') as HTMLInputElement | null;
  const juice = $('creator-svfx-juice') as HTMLInputElement | null;
  const brittle = $('creator-svfx-brittle') as HTMLInputElement | null;
  if (color) color.value = merged.color;
  if (glow) glow.value = merged.glowColor;
  if (dmg) dmg.value = String(merged.damageMul);
  if (juice) juice.value = String(merged.juiceMul);
  if (brittle) brittle.value = String(merged.brittleBonus);

  const meta = $('creator-svfx-slicer-meta');
  if (meta) {
    meta.textContent = `${base.name} · ${base.rarity} · base dmg×${base.damageMul.toFixed(2)} juice×${base.juiceMul.toFixed(2)} brittle+${base.brittleBonus.toFixed(1)}s`;
  }

  const iconPrev = $('creator-svfx-icon-preview') as HTMLImageElement | null;
  if (iconPrev) {
    if (pack.iconDataUrl) {
      iconPrev.src = pack.iconDataUrl;
      iconPrev.classList.remove('hidden');
    } else {
      iconPrev.removeAttribute('src');
      iconPrev.classList.add('hidden');
    }
  }
  const trailPrev = $('creator-svfx-trail-preview') as HTMLImageElement | null;
  if (trailPrev) {
    if (pack.trailDataUrl) {
      trailPrev.src = pack.trailDataUrl;
      trailPrev.classList.remove('hidden');
    } else {
      trailPrev.removeAttribute('src');
      trailPrev.classList.add('hidden');
    }
  }

  const slash = $('creator-svfx-bind-slash') as HTMLSelectElement | null;
  const crit = $('creator-svfx-bind-crit') as HTMLSelectElement | null;
  const kill = $('creator-svfx-bind-kill') as HTMLSelectElement | null;
  if (slash) slash.innerHTML = presetOptions(pack.binds.onSlash || '', true);
  if (crit) crit.innerHTML = presetOptions(pack.binds.onCrit || '', true);
  if (kill) kill.innerHTML = presetOptions(pack.binds.onKill || '', true);

  const swatch = $('creator-svfx-swatch') as HTMLElement | null;
  if (swatch) {
    swatch.style.background = `linear-gradient(135deg, ${merged.color}, ${merged.glowColor})`;
  }
}

function renderPresetFields(): void {
  const preset = selectedPreset();
  const name = $('creator-svfx-preset-name') as HTMLInputElement | null;
  const kind = $('creator-svfx-preset-kind') as HTMLSelectElement | null;
  const intensity = $('creator-svfx-preset-intensity') as HTMLInputElement | null;
  const duration = $('creator-svfx-preset-duration') as HTMLInputElement | null;
  const color = $('creator-svfx-preset-color') as HTMLInputElement | null;
  if (name) name.value = preset.name;
  if (kind) {
    kind.innerHTML = CREATOR_VFX_KINDS.map(
      (k) => `<option value="${k}" ${k === preset.kind ? 'selected' : ''}>${k}</option>`,
    ).join('');
  }
  if (intensity) intensity.value = String(preset.intensity);
  if (duration) duration.value = String(preset.duration);
  if (color) color.value = preset.color;
}

function renderAll(): void {
  renderSlicerSelect();
  renderPresetList();
  renderSlicerFields();
  renderPresetFields();
  drawPreviewIdle();
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function spawnPreview(event: SlicerVfxEvent): void {
  harvestSlicerFields();
  harvestPresetFields();
  const payload = previewVfxPayload(store, store.selectedSlicerId, event);
  const log = $('creator-svfx-event-log');
  if (!payload) {
    if (log) log.textContent = `${event}: no VFX bound`;
    status(`${event} has no preset bound`, false);
    return;
  }
  if (log) {
    log.textContent = `${event} → ${payload.preset.name} (${payload.kind}) inten=${payload.preset.intensity} dur=${payload.preset.duration}s`;
  }
  const canvas = $('creator-svfx-preview') as HTMLCanvasElement | null;
  if (!canvas) return;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const color = payload.preset.color;
  const n = Math.max(8, Math.round(14 * payload.preset.intensity));
  for (let i = 0; i < n; i++) {
    const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const spd = 40 + Math.random() * 90 * payload.preset.intensity;
    previewParticles.push({
      x: cx,
      y: cy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - (payload.kind === 'screen-shake' ? 0 : 20),
      life: payload.preset.duration,
      maxLife: payload.preset.duration,
      r: payload.kind === 'slash-arc' ? 3 : 2 + Math.random() * 3,
      color,
      kind: payload.kind,
    });
  }
  if (payload.kind === 'slash-arc') {
    previewParticles.push({
      x: cx - 40,
      y: cy,
      vx: 180,
      vy: -10,
      life: payload.preset.duration,
      maxLife: payload.preset.duration,
      r: 5,
      color,
      kind: 'slash-arc',
    });
  }
  if (!previewRaf) tickPreview();
  status(`Simulated ${event}`, true);
}

function drawPreviewIdle(): void {
  const canvas = $('creator-svfx-preview') as HTMLCanvasElement | null;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const pack = currentPack();
  const base = selectedCatalog();
  const merged = applySlicerPackOverrides(base, pack);
  ctx.fillStyle = '#0a1008';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // blade stub
  const grad = ctx.createLinearGradient(40, canvas.height / 2, canvas.width - 40, canvas.height / 2);
  grad.addColorStop(0, merged.glowColor);
  grad.addColorStop(0.5, merged.color);
  grad.addColorStop(1, merged.glowColor);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(36, canvas.height / 2 + 18);
  ctx.quadraticCurveTo(canvas.width / 2, canvas.height / 2 - 28, canvas.width - 36, canvas.height / 2 + 10);
  ctx.stroke();
  ctx.fillStyle = 'rgba(236,252,203,0.55)';
  ctx.font = '10px sans-serif';
  ctx.fillText('Sandbox · Simulate Slash / Crit', 12, 18);
}

function tickPreview(): void {
  const canvas = $('creator-svfx-preview') as HTMLCanvasElement | null;
  if (!canvas) {
    previewRaf = 0;
    return;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    previewRaf = 0;
    return;
  }
  const dt = 1 / 60;
  drawPreviewIdle();
  // shake offset
  let shake = 0;
  for (const p of previewParticles) {
    if (p.kind === 'screen-shake') shake = Math.max(shake, (p.life / p.maxLife) * 6);
  }
  const ox = (Math.random() - 0.5) * shake;
  const oy = (Math.random() - 0.5) * shake;
  ctx.save();
  ctx.translate(ox, oy);
  previewParticles = previewParticles.filter((p) => {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    if (p.life <= 0) return false;
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    if (p.kind === 'slash-arc' && p.r >= 5) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 28 * a, -0.6, 0.8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    return true;
  });
  ctx.restore();
  ctx.globalAlpha = 1;
  if (previewParticles.length) {
    previewRaf = requestAnimationFrame(tickPreview);
  } else {
    previewRaf = 0;
    drawPreviewIdle();
  }
}

async function publishToLive(): Promise<void> {
  harvestSlicerFields();
  harvestPresetFields();
  persistDraft();
  const live = getLiveConfig();
  const baseSlicers = Array.isArray(live.slicers) && live.slicers.length ? live.slicers : DEFAULT_SLICERS;
  const slicers = mergeSlicerPacksIntoCatalog(structuredClone(baseSlicers), store);
  const payload: Partial<AdminConfig> = { ...live, slicers };
  const res = await saveAdminConfig(payload);
  if (res.success) {
    setLiveConfig({ ...live, slicers } as AdminConfig);
    window.dispatchEvent(new CustomEvent('fruittd-slicers-published', { detail: slicers }));
    status(res.message || 'Published slicer overrides to live admin config', true);
  } else {
    setLiveConfig({ ...live, slicers } as AdminConfig);
    status(`Published locally (server: ${res.error || 'failed'}). Live play uses local override.`, false);
  }
}

function loadFromDraft(): void {
  store = loadCreatorVfxStore();
  if (!store.presets.length) store.presets = defaultPresets();
  ensureSlicerPack(store, store.selectedSlicerId);
}

export function installCreatorSlicerVfx(): void {
  if (installed) {
    loadFromDraft();
    renderAll();
    return;
  }
  if (!$('creator-slicer-vfx')) return;
  installed = true;
  loadFromDraft();

  $('creator-svfx-slicer')?.addEventListener('change', (e) => {
    harvestSlicerFields();
    store.selectedSlicerId = (e.target as HTMLSelectElement).value;
    ensureSlicerPack(store, store.selectedSlicerId);
    renderAll();
  });

  for (const id of [
    'creator-svfx-color',
    'creator-svfx-glow',
    'creator-svfx-dmg',
    'creator-svfx-juice',
    'creator-svfx-brittle',
    'creator-svfx-bind-slash',
    'creator-svfx-bind-crit',
    'creator-svfx-bind-kill',
  ]) {
    $(id)?.addEventListener('change', () => {
      harvestSlicerFields();
      drawPreviewIdle();
    });
    $(id)?.addEventListener('input', () => {
      harvestSlicerFields();
      drawPreviewIdle();
    });
  }

  for (const id of [
    'creator-svfx-preset-name',
    'creator-svfx-preset-kind',
    'creator-svfx-preset-intensity',
    'creator-svfx-preset-duration',
    'creator-svfx-preset-color',
  ]) {
    $(id)?.addEventListener('change', () => {
      harvestPresetFields();
      renderPresetList();
    });
    $(id)?.addEventListener('input', () => harvestPresetFields());
  }

  $('creator-svfx-save')?.addEventListener('click', () => {
    harvestSlicerFields();
    harvestPresetFields();
    persistDraft();
    renderAll();
  });

  $('creator-svfx-publish')?.addEventListener('click', () => {
    void publishToLive();
  });

  $('creator-svfx-add-preset')?.addEventListener('click', () => {
    harvestPresetFields();
    const kind = (($('creator-svfx-preset-kind') as HTMLSelectElement | null)?.value ||
      'juice-burst') as CreatorVfxKind;
    const preset: CreatorVfxPreset = {
      id: newPresetId(kind),
      name: `New ${kind}`,
      kind,
      intensity: 1,
      duration: 0.3,
      color: '#a3e635',
    };
    store.presets.push(preset);
    store.selectedPresetId = preset.id;
    persistDraft();
    renderAll();
  });

  $('creator-svfx-reset-presets')?.addEventListener('click', () => {
    store.presets = defaultPresets();
    store.selectedPresetId = store.presets[0].id;
    persistDraft();
    renderAll();
    status('Reset VFX presets to defaults', true);
  });

  $('creator-svfx-clear-slicer')?.addEventListener('click', () => {
    store.slicers[store.selectedSlicerId] = { id: store.selectedSlicerId, binds: {} };
    persistDraft();
    renderAll();
    status(`Cleared Creator overrides for ${store.selectedSlicerId}`, true);
  });

  $('creator-svfx-sim-slash')?.addEventListener('click', () => spawnPreview('onSlash'));
  $('creator-svfx-sim-crit')?.addEventListener('click', () => spawnPreview('onCrit'));
  $('creator-svfx-sim-kill')?.addEventListener('click', () => spawnPreview('onKill'));

  const iconUpload = $('creator-svfx-icon-upload') as HTMLInputElement | null;
  iconUpload?.addEventListener('change', async () => {
    const file = iconUpload.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      currentPack().iconDataUrl = dataUrl;
      renderSlicerFields();
      status('Blade icon uploaded (save draft to keep)', true);
    } catch {
      status('Icon upload failed', false);
    }
    iconUpload.value = '';
  });

  const trailUpload = $('creator-svfx-trail-upload') as HTMLInputElement | null;
  trailUpload?.addEventListener('change', async () => {
    const file = trailUpload.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      currentPack().trailDataUrl = dataUrl;
      renderSlicerFields();
      status('Trail / color sheet uploaded (save draft to keep)', true);
    } catch {
      status('Trail upload failed', false);
    }
    trailUpload.value = '';
  });

  renderAll();
  status('Slicer + VFX Creator ready');
}
