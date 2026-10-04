import type { EntityStudioData, MediaStudioStore } from '../ui/adminMediaStudio';
import { notifyStudioRuntimeChanged } from './studioRuntimeSignals';

const number = (value: unknown, fallback: number, min: number, max: number) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
/** The server and client accept exactly the same bounded Creator payload. */
export function normalizeCreatorMedia(raw: unknown): MediaStudioStore | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Creator pack must contain entities.');
  const row = raw as Partial<MediaStudioStore>;
  if (!row.entities || typeof row.entities !== 'object' || Array.isArray(row.entities)) throw new Error('Creator pack must contain entities.');
  if (Object.keys(row.entities).length > 200 || JSON.stringify(raw).length > 2_500_000) throw new Error('Creator pack is too large. Use smaller sprite sheets.');
  const entities: Record<string, EntityStudioData> = Object.create(null);
  for (const [key, value] of Object.entries(row.entities)) {
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(key) || !value || typeof value !== 'object') throw new Error('Invalid Creator entity.');
    const sheet = value.sheetDataUrl;
    if (sheet && (typeof sheet !== 'string' || sheet.length > 1_000_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(sheet))) throw new Error('Sprite sheets must be PNG, JPEG or WebP images under 1 MB.');
    const cols = Math.floor(number(value.cols, 1, 1, 64)); const rows = Math.floor(number(value.rows, 1, 1, 64));
    const clips: EntityStudioData['clips'] = {};
    for (const [clip, definition] of Object.entries(value.clips || {})) {
      if (!/^(idle|walk|run|hit|death)_(down|left|right|up)$/.test(clip) || !definition || typeof definition !== 'object') continue;
      const startFrame = Math.floor(number(definition.startFrame, 0, 0, cols * rows - 1));
      clips[clip] = { startFrame, frameCount: Math.floor(number(definition.frameCount, 1, 1, cols * rows - startFrame)), ...(definition.fps ? { fps: number(definition.fps, 10, 1, 60) } : {}), ...( ['none','juice-burst','spark','dark-pulse','screen-shake'].includes(definition.fx || '') ? { fx: definition.fx } : {}) };
    }
    const events: NonNullable<EntityStudioData['events']> = {};
    for (const hook of ['onSpawn','onHit','onDeath'] as const) {
      const event = value.events?.[hook]; if (!event) continue;
      events[hook] = { flash: Boolean(event.flash), shake: number(event.shake, 0, 0, 3), ...(typeof event.sfxSlot === 'string' && /^[a-z0-9-]{1,64}$/.test(event.sfxSlot) ? { sfxSlot: event.sfxSlot } : {}), ...(['none','juice-burst','spark','dark-pulse','screen-shake'].includes(event.fx || '') ? { fx: event.fx } : {}) };
    }
    entities[key] = { sheetDataUrl: sheet || null, cols, rows, frameW: Math.floor(number(value.frameW, 0, 0, 4096)), frameH: Math.floor(number(value.frameH, 0, 0, 4096)), clips, events, label: String(value.label || key).slice(0,80) };
  }
  return { version: 2, entities, selectedEntity: typeof row.selectedEntity === 'string' && entities[row.selectedEntity] ? row.selectedEntity : Object.keys(entities)[0] || 'enemy-normal' };
}
let published: MediaStudioStore | null = null;
let revision = 0;
export function setPublishedCreatorMedia(raw: unknown): void { published = normalizeCreatorMedia(raw); revision++; notifyStudioRuntimeChanged(); }
export function getPublishedCreatorMedia(): MediaStudioStore | null { return published; }
export function publishedCreatorRevision(): number { return revision; }
