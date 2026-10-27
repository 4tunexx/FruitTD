/** Continuous world movement. This navigation mesh is independent of build hexes. */
export interface ArenaPoint { x: number; y: number }
export function arenaNavigation(width: number, obstacles: ArenaPoint[], direction: -1 | 1) {
  const columns = width * 2, rows = 96, clearance = .72;
  const point = (cell: number) => ({ x: (cell % columns + .5) / 2, y: (Math.floor(cell / columns) + .5) / 2 - 24 });
  const index = (p: ArenaPoint) => Math.max(0, Math.min(rows - 1, Math.floor((p.y + 24) * 2))) * columns + Math.max(0, Math.min(columns - 1, Math.floor(p.x * 2)));
  const open = (p: ArenaPoint) => p.x >= .25 && p.x <= width - .25 && !obstacles.some(o => Math.hypot(p.x - o.x, p.y - o.y) < clearance);
  const blocked = Array.from({ length: columns * rows }, (_, cell) => !open(point(cell)));
  const distance = new Float64Array(columns * rows).fill(Infinity), queue: number[] = [];
  const goalRow = direction === -1 ? 0 : rows - 1;
  for (let x = 0; x < columns; x++) { const cell = goalRow * columns + x; if (!blocked[cell]) { distance[cell] = 0; queue.push(cell); } }
  const neighbors = (cell: number) => {
    const x = cell % columns, y = Math.floor(cell / columns), result: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || x + dx >= columns || y + dy < 0 || y + dy >= rows) continue;
      const next = cell + dy * columns + dx;
      if (!blocked[next] && !(dx && dy && (blocked[cell + dx] || blocked[cell + dy * columns]))) result.push(next);
    }
    return result;
  };
  for (let i = 0; i < queue.length; i++) for (const next of neighbors(queue[i]!)) if (distance[next] === Infinity) { distance[next] = distance[queue[i]!]! + 1; queue.push(next); }
  const clear = (from: ArenaPoint, to: ArenaPoint) => {
    const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy;
    return !obstacles.some(o => {
      const t = length2 ? Math.max(0, Math.min(1, ((o.x - from.x) * dx + (o.y - from.y) * dy) / length2)) : 0;
      return Math.hypot(from.x + t * dx - o.x, from.y + t * dy - o.y) < clearance;
    });
  };
  return {
    reachable: (from: ArenaPoint) => Number.isFinite(distance[index(from)]),
    clear,
    goal(from: ArenaPoint): ArenaPoint {
      const destination = { x: from.x, y: direction * 23.5 };
      if (clear(from, destination)) return destination;
      let cell = index(from), goal = from;
      // Skip visible waypoints, so an obstacle detour is one smooth heading.
      for (let i = 0; i < rows * 2; i++) {
        const next = neighbors(cell).filter(n => distance[n]! < distance[cell]!).sort((a, b) => distance[a]! - distance[b]! || Math.abs(point(a).x - from.x) - Math.abs(point(b).x - from.x))[0];
        if (next === undefined) break;
        const candidate = point(next);
        if (!clear(from, candidate)) break;
        goal = candidate; cell = next;
      }
      return goal;
    },
  };
}
