/** Apply only known, bounded balance fields, restoring omitted values to defaults. */
export function applyBalanceRows<T extends object>(target: Record<string,T>, defaults: Record<string,T>, rows: unknown, bounds: Record<string,[number,number]>, aliases: Record<string,string> = {}): void {
  for (const key of Object.keys(defaults)) Object.assign(target[key], structuredClone(defaults[key]));
  if (!Array.isArray(rows)) return;
  for (const row of rows.slice(0,100)) {
    if (!row || typeof row !== 'object') continue;
    const key = row.kind ?? row.id ?? row.type;
    if (typeof key !== 'string' || !Object.hasOwn(defaults,key)) continue;
    const result = target[key] as Record<string,unknown>;
    for (const [input,value] of Object.entries(row)) {
      const field = aliases[input] ?? input;
      const range = bounds[field];
      if (range && typeof value === 'number' && Number.isFinite(value)) result[field] = Math.max(range[0],Math.min(range[1],value));
      else if (range && typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) && /colou?r|emissive|juice|splash/.test(field)) result[field] = Number.parseInt(value.slice(1),16);
      else if (['label','description','flavor','warning'].includes(field) && typeof value === 'string' && Object.hasOwn(result,field)) result[field] = value.slice(0,500);
    }
  }
}
