import { getAuthToken } from './auth';

export interface ArenaRating {
  points: number; tier: string; season: string; matches: number; wins: number; ties: number; losses: number;
  nextTier?: { name: string; min: number } | null;
  tierMin?: number;
  arena?: { matches: number; wins: number; ties: number; losses: number };
}
export const ARENA_RANK_COLORS: Record<string, string> = {
  Amateur: '#94a3b8', Bronze: '#cd8b52', Silver: '#cad5e2', Gold: '#ffd34e',
  Diamond: '#67ddff', Emerald: '#42e899', Sapphire: '#9295ff',
};
const base = (import.meta.env?.VITE_PVP_API_URL || '/api/pvp').replace(/\/$/, '');
let tokenKey: string | null = null;
let rating: ArenaRating | null = null;
let loadedAt = 0;
let pending: Promise<void> | null = null;
let failed = false;
const bindings = new Map<HTMLElement, 'badge' | 'progress' | 'record'>();

export function arenaRankPresentation(value: ArenaRating | null, signedIn: boolean, unavailable = false) {
  return {
    title: value?.tier ?? (signedIn ? unavailable ? 'Rank unavailable' : 'Loading rank…' : 'Unranked'),
    color: ARENA_RANK_COLORS[value?.tier || ''] || '#94a3b8',
    progress: value ? `${value.points.toLocaleString()} FR · ${value.nextTier ? `${Math.max(0, value.nextTier.min - value.points).toLocaleString()} to ${value.nextTier.name}` : 'Highest tier'} · ${value.season}` : signedIn ? 'Ranked Arena rating' : 'Sign in for Ranked Arena',
    record: value ? `Ranked ${value.wins}W / ${value.ties}D / ${value.losses}L${value.arena ? ` · Normal Arena ${value.arena.wins}W / ${value.arena.ties}D / ${value.arena.losses}L` : ''}` : 'Ranked Arena record',
  };
}
function paint(node: HTMLElement, kind: 'badge' | 'progress' | 'record') {
  const view = arenaRankPresentation(rating, !!getAuthToken(), failed);
  node.textContent = kind === 'badge' ? view.title : view[kind];
  node.style.setProperty('--rank-color', view.color);
  if (kind === 'badge') { node.style.color = view.color; node.style.borderColor = view.color; node.title = 'Ranked Arena · server rating'; }
}
function repaint() {
  for (const [node, kind] of bindings) {
    if (!node.isConnected) { bindings.delete(node); continue; }
    paint(node, kind);
  }
}
export function acceptArenaRating(value: ArenaRating): void {
  tokenKey = getAuthToken(); rating = value; failed = false; loadedAt = Date.now(); repaint();
}
export function bindArenaRating(node: HTMLElement | null, kind: 'badge' | 'progress' | 'record' = 'badge'): void {
  if (!node) return;
  if (tokenKey !== getAuthToken()) { tokenKey = getAuthToken(); rating = null; loadedAt = 0; failed = false; }
  bindings.set(node, kind); paint(node, kind);
  void refreshArenaRating();
}
export function refreshArenaRating(): Promise<void> {
  const token = getAuthToken();
  if (!token || Date.now() - loadedAt < 30_000) return Promise.resolve();
  if (pending) return pending;
  pending = fetch(`${base}/rating`, { signal: AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${token}` } })
    .then(async (response) => { if (!response.ok) throw new Error('Rating unavailable'); return response.json(); })
    .then((data) => { if (token === getAuthToken() && data.rating) acceptArenaRating(data.rating); })
    .catch(() => { if (token === getAuthToken()) { failed = true; loadedAt = Date.now(); repaint(); } })
    .finally(() => { pending = null; });
  return pending;
}
