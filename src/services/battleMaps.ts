import type { BattleMap, BattleMapMode } from '../game/battleMaps';
import { getAuthToken } from './auth';

export async function fetchAdminBattleMaps(): Promise<BattleMap[]> {
  const response = await fetch('/api/admin/maps', { headers: authHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.maps)) throw new Error(data.error || 'Could not load maps.');
  return data.maps;
}

export async function saveAdminBattleMap(map: BattleMap, expectedRevision: number): Promise<BattleMap> {
  const response = await fetch('/api/admin/maps', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ map, expectedRevision }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.map) throw new Error(data.error || 'Could not save map.');
  return data.map;
}

export async function fetchPublishedBattleMap(mode: BattleMapMode): Promise<BattleMap | null> {
  try {
    const response = await fetch(`/api/maps/${mode}`);
    const data = await response.json();
    return response.ok && data.success ? data.map : null;
  } catch { return null; }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
