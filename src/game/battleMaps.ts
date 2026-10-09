import { ARENA_D, SOLO_ARENA_D, ARENA_W, LEAK_Z, PADS, WALL_Z } from './world';

/** Gameplay coordinates are normalized to the authored map, never CSS pixels. */
export type BattleMapMode = 'casual' | 'horde' | 'campaign' | 'coop' | 'pvp';
export type MapEntityKind = 'prop' | 'solid' | 'hazard' | 'pit' | 'light' | 'spawn' | 'turret-slot';
export type MapCollision = 'none' | 'solid' | 'trigger';

export interface MapPoint { x: number; y: number; }
export interface BattleMapRoute {
  id: string;
  name: string;
  points: MapPoint[];
  width: number;
}
export interface BattleMapSpawn {
  id: string;
  routeId: string;
  x: number;
  y: number;
  enabled: boolean;
  label: string;
}
export interface BattleMapEntity {
  id: string;
  kind: MapEntityKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  asset: string;
  collision: MapCollision;
  damage: number;
  slow: number;
  /** Optional friendly label shown only in the editor. */
  label: string;
}
export interface BattleMap {
  schemaVersion: 1;
  id: string;
  mode: BattleMapMode;
  name: string;
  background: string;
  nightBackground?: string;
  world: { width: number; depth: number; columns: number; rows: number };
  routes: BattleMapRoute[];
  spawns: BattleMapSpawn[];
  entities: BattleMapEntity[];
  tower: MapPoint;
  /** PvP places the opponent base at the far end; other modes omit it. */
  opponentTower?: MapPoint;
  published: boolean;
  revision: number;
}

const baseWorld = { width: ARENA_W, depth: ARENA_D, columns: 11, rows: 132 };
const routeEndY = .5 - LEAK_Z / ARENA_D;
const topGateY = .025;
const laneRoutes: Array<{ id: string; xs: number[] }> = [
  { id: 'west-outer', xs: [.12, .18, .31, .42, .5] },
  { id: 'west-inner', xs: [.31, .38, .26, .42, .5] },
  { id: 'center', xs: [.5, .44, .56, .48, .5] },
  { id: 'east-inner', xs: [.69, .62, .77, .58, .5] },
  { id: 'east-outer', xs: [.88, .82, .67, .56, .5] },
];
const standardRoutes = (): BattleMapRoute[] => laneRoutes.map((lane) => ({
  id: lane.id, name: lane.id.replace('-', ' '), width: 5,
  points: lane.xs.map((x, i) => ({ x, y: [.025, .18, .34, .47, routeEndY][i]! })),
}));
const entity = (id: string, kind: MapEntityKind, x: number, y: number, width: number, height = width, extra: Partial<BattleMapEntity> = {}): BattleMapEntity => ({
  id, kind, x, y, width, height, rotation: 0, visible: true, asset: '',
  collision: kind === 'solid' ? 'solid' : kind === 'hazard' || kind === 'pit' ? 'trigger' : 'none',
  damage: kind === 'hazard' || kind === 'pit' ? 1 : 0, slow: 0, label: id, ...extra,
});

function standardMap(mode: BattleMapMode, name: string, background: string): BattleMap {
  const depth = mode === 'pvp' ? ARENA_D : SOLO_ARENA_D;
  const end = .5 - LEAK_Z / depth;
  return {
    schemaVersion: 1, id: `sample-${mode}`, mode, name, background,
    world: { ...baseWorld, depth, rows: depth }, routes: standardRoutes().map(route => ({ ...route, points: route.points.map(p => ({ ...p, y: topGateY + (p.y - topGateY) * (end - topGateY) / (routeEndY - topGateY) })) })),
    spawns: laneRoutes.map((lane, i) => ({
      id: `${lane.id}-gate`, routeId: lane.id, x: lane.xs[0]!, y: .025, enabled: true,
      label: `${['West', 'West-center', 'Center', 'East-center', 'East'][i]} top spawn`,
    })),
    entities: [
      entity('left-lantern', 'light', .16, .43, .08, .08, { collision: 'none', damage: 0, label: 'Path light' }),
      entity('right-ruin', 'prop', .84, .62, .14, .1, { collision: 'none', label: 'Ruin prop' }),
      entity('rock-blocker', 'solid', .15, .73, .1, .07, { asset: '/assets/maps/samples/sample-rock.svg', label: 'Solid rock sample' }),
      entity('pit-hazard', 'pit', .83, .3, .12, .08, { asset: '/assets/maps/samples/sample-pit.svg', label: 'Pit sample' }),
      ...PADS.filter((pad) => !pad.main).map((pad, i) => entity(
        `tower-slot-${i + 1}`, 'turret-slot', (pad.x / ARENA_W) + .5,
        .5 - (pad.z / depth), .05, .04,
        { collision: 'none', damage: 0, visible: true, label: `Tower slot ${i + 1}` },
      )),
    ],
    tower: { x: .5, y: .5 - (WALL_Z / depth) },
    published: true, revision: 1,
  };
}

export const DEFAULT_BATTLE_MAPS: Record<BattleMapMode, BattleMap> = {
  casual: standardMap('casual', 'Ashen Road', '/assets/maps/samples/casual-fallen-orchard.svg'),
  horde: standardMap('horde', 'Scrapline', '/assets/maps/samples/horde-night-harvest.svg'),
  campaign: standardMap('campaign', 'Ruined Causeway', '/assets/maps/samples/campaign-old-orchard.svg'),
  coop: {
    ...standardMap('coop', 'Broken Junction', '/assets/maps/samples/coop-shared-grove.svg'),
    routes: [
      { id: 'west-route', name: 'West approach', width: 5, points: [{ x: .18, y: .025 }, { x: .3, y: .2 }, { x: .22, y: .38 }, { x: .5, y: .5 - LEAK_Z / SOLO_ARENA_D }] },
      { id: 'east-route', name: 'East approach', width: 5, points: [{ x: .82, y: .025 }, { x: .7, y: .2 }, { x: .78, y: .38 }, { x: .5, y: .5 - LEAK_Z / SOLO_ARENA_D }] },
    ],
    spawns: [
      { id: 'west-gate', routeId: 'west-route', x: .18, y: .025, enabled: true, label: 'West spawn' },
      { id: 'east-gate', routeId: 'east-route', x: .82, y: .025, enabled: true, label: 'East spawn' },
    ],
  },
  pvp: {
    ...standardMap('pvp', 'Twin Wastes', '/assets/maps/samples/pvp-twin-pass.svg'),
    tower: { x: .5, y: .94 },
    opponentTower: { x: .5, y: .06 },
    routes: [{ id: 'duel-route', name: 'Duel route', width: 4.5, points: [{ x: .5, y: .94 }, { x: .38, y: .72 }, { x: .62, y: .5 }, { x: .38, y: .28 }, { x: .5, y: .06 }] }],
    spawns: [{ id: 'opponent-gate', routeId: 'duel-route', x: .5, y: .06, enabled: true, label: 'Opponent side' }],
  },
};

const modes = new Set<BattleMapMode>(['casual', 'horde', 'campaign', 'coop', 'pvp']);
const kinds = new Set<MapEntityKind>(['prop', 'solid', 'hazard', 'pit', 'light', 'spawn', 'turret-slot']);
const safeAsset = (value: unknown): value is string => typeof value === 'string' && value.length <= 1_200_000 && (value === '' || value.startsWith('/') || /^data:image\/(png|webp|jpeg);base64,/.test(value));
const unit = (value: unknown, fallback = .5): number => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;

/** Normalize untrusted drafts before they reach localStorage, MongoDB, or Three.js. */
export function normalizeBattleMap(raw: unknown, fallbackMode: BattleMapMode = 'casual'): BattleMap {
  const row = raw && typeof raw === 'object' ? raw as Partial<BattleMap> : {};
  const mode = modes.has(row.mode as BattleMapMode) ? row.mode as BattleMapMode : fallbackMode;
  const fallback = DEFAULT_BATTLE_MAPS[mode];
  const targetDepth = mode === 'pvp' ? ARENA_D : SOLO_ARENA_D;
  const storedDepth = Number.isFinite(Number(row.world?.depth)) ? Math.max(1, Number(row.world?.depth)) : ARENA_D;
  // Rescale older authored approaches to the mode depth, preserving gates and the leak line.
  const migrateY = (value: unknown, fallbackY = .5): number => {
    const y = Math.max(topGateY, unit(value, fallbackY));
    if (storedDepth === targetDepth || y <= .05) return y;
    const oldEnd = .5 - LEAK_Z / storedDepth;
    const ratio = (.5 - LEAK_Z / targetDepth - topGateY) / Math.max(.001, oldEnd - topGateY);
    return Math.max(0, Math.min(1, topGateY + (y - topGateY) * ratio));
  };
  const routes = Array.isArray(row.routes) ? row.routes.slice(0, 12).map((r, i) => ({
    id: typeof r?.id === 'string' ? r.id.slice(0, 64) : `route-${i + 1}`,
    name: typeof r?.name === 'string' ? r.name.slice(0, 64) : `Route ${i + 1}`,
    width: Number.isFinite(Number(r?.width)) ? Math.max(.5, Math.min(12, Number(r?.width))) : 4,
    points: Array.isArray(r?.points) ? r.points.slice(0, 256).map((p) => ({ x: unit(p?.x), y: migrateY(p?.y) })) : [],
  })) : fallback.routes;
  const routeIds = new Set(routes.map((r) => r.id));
  const spawns = Array.isArray(row.spawns) ? row.spawns.slice(0, 32).map((s, i) => ({
    id: typeof s?.id === 'string' ? s.id.slice(0, 64) : `spawn-${i + 1}`,
    routeId: routeIds.has(s?.routeId || '') ? s!.routeId : routes[0]?.id || 'main-route',
    x: unit(s?.x), y: migrateY(s?.y, topGateY), enabled: s?.enabled !== false,
    label: typeof s?.label === 'string' ? s.label.slice(0, 80) : `Spawn ${i + 1}`,
  })) : fallback.spawns;
  const entities = Array.isArray(row.entities) ? row.entities.slice(0, 256).filter((e) => e && kinds.has(e.kind)).map((e, i) => ({
    id: typeof e.id === 'string' ? e.id.slice(0, 64) : `entity-${i + 1}`,
    kind: e.kind as MapEntityKind,
    x: unit(e.x), y: migrateY(e.y),
    width: Number.isFinite(Number(e.width)) ? Math.max(.005, Math.min(1, Number(e.width))) : .05,
    height: Number.isFinite(Number(e.height)) ? Math.max(.005, Math.min(1, Number(e.height))) : .05,
    rotation: Number.isFinite(Number(e.rotation)) ? Math.max(-360, Math.min(360, Number(e.rotation))) : 0,
    visible: e.visible !== false,
    asset: safeAsset(e.asset) ? e.asset : '',
    collision: (e.collision === 'solid' || e.collision === 'trigger' ? e.collision : 'none') as MapCollision,
    damage: Number.isFinite(Number(e.damage)) ? Math.max(0, Math.min(1000, Number(e.damage))) : 0,
    slow: Number.isFinite(Number(e.slow)) ? Math.max(0, Math.min(1, Number(e.slow))) : 0,
    label: typeof e.label === 'string' ? e.label.slice(0, 80) : `Entity ${i + 1}`,
  })) : fallback.entities;
  const point = (p: unknown, def: MapPoint): MapPoint => p && typeof p === 'object' ? { x: unit((p as MapPoint).x, def.x), y: unit((p as MapPoint).y, def.y) } : def;
  const suppliedBackground = safeAsset(row.background) && row.background ? row.background : fallback.background;
  const bg = /^\/assets\/maps\/samples\/(casual-fallen-orchard|campaign-old-orchard|horde-night-harvest|coop-shared-grove|pvp-twin-pass)\.webp$/.test(suppliedBackground) ? suppliedBackground.replace(/\.webp$/, '.svg') : suppliedBackground;
  // Match the physical world and tower anchors; responsive layouts come from
  // normalized coordinates, not from stretching gameplay physics per map.
  const width = ARENA_W;
  const depth = targetDepth;
  const storedRows = Math.floor(Number(row.world?.rows) || fallback.world.rows);
  const rows = Math.round(storedRows * targetDepth / storedDepth);
  return {
    schemaVersion: 1,
    id: typeof row.id === 'string' && /^[a-z0-9_-]{1,80}$/i.test(row.id) ? row.id : fallback.id,
    mode, name: typeof row.name === 'string' && row.name.trim() ? row.name.trim().slice(0, 80) : fallback.name,
    background: bg,
    ...(safeAsset(row.nightBackground) && row.nightBackground ? { nightBackground: row.nightBackground } : {}),
    world: { width, depth, columns: Math.max(4, Math.min(64, Math.floor(Number(row.world?.columns) || fallback.world.columns))), rows: Math.max(8, Math.min(256, rows)) },
    routes, spawns, entities,
    tower: mode === 'pvp' ? point(row.tower, fallback.tower) : { x: .5, y: .5 - WALL_Z / depth },
    ...(mode === 'pvp' ? { opponentTower: row.opponentTower && storedDepth < ARENA_D ? { ...point(row.opponentTower, fallback.opponentTower!), y: migrateY(row.opponentTower.y, fallback.opponentTower!.y) } : point(row.opponentTower, fallback.opponentTower!) } : {}),
    published: row.published !== false,
    revision: Number.isSafeInteger(row.revision) && Number(row.revision) > 0 ? Number(row.revision) : 1,
  };
}

/** Convert authored top-left map coordinates to the existing arena's world plane. */
export function mapPointToWorld(point: MapPoint, map: BattleMap): { x: number; z: number } {
  return { x: (unit(point.x) - .5) * map.world.width, z: (.5 - unit(point.y)) * map.world.depth };
}

export function defaultMapForMode(mode: BattleMapMode | 'arena' | 'ranked', stage?: number): BattleMap {
  const key = mode === 'arena' || mode === 'ranked' ? 'pvp' : mode;
  const base = DEFAULT_BATTLE_MAPS[key as BattleMapMode] || DEFAULT_BATTLE_MAPS.casual;
  const map = structuredClone(base);
  if (mode === 'campaign' && Number.isInteger(stage) && stage! > 1) map.id = `sample-campaign-${stage}`;
  return map;
}
