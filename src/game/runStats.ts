import type { GameMode } from './save';
export interface RunRecord { id: string; mode: GameMode; score: number; wave: number; combo: number; kills: number; strokes: number; hits: number; completed: boolean; date: number }
const KEY = 'fruit-td-run-history-v1';
export function runHistory(): RunRecord[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(rows) ? rows.filter((r): r is RunRecord => r && typeof r.id === 'string' && ['casual','horde','campaign','coop','ranked','arena'].includes(r.mode) && ['score','wave','combo','kills','strokes','hits','date'].every(key => Number.isFinite(r[key]) && r[key] >= 0)).slice(-100) : [];
  } catch { return []; }
}
export function recordRun(run: RunRecord): void {
  try { const rows = runHistory(); if (!rows.some(row => row.id === run.id)) localStorage.setItem(KEY, JSON.stringify([...rows, run].slice(-100))); } catch { /* Storage may be disabled. */ }
}
