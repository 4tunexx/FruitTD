const MAX_COINS = 1_000_000;

/** Shared by the editor and server; invalid prices must never reach a wallet. */
export function gearPriceError(cost: unknown, sellValue: unknown): string | null {
  const valid = (value: unknown): value is number => typeof value === 'number'
    && Number.isSafeInteger(value) && value >= 0 && value <= MAX_COINS;
  if (!valid(cost) || !valid(sellValue)) return 'Prices must be whole coins between 0 and 1,000,000.';
  if (sellValue > cost) return 'Sell value cannot exceed the purchase price.';
  return null;
}

export function slicerCatalogError(value: unknown): string | null {
  if (!Array.isArray(value)) return 'Blades must be a list.';
  const ids = new Set<string>();
  for (const row of value) {
    if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(row.id)) return 'Each blade needs a valid ID.';
    if (row.id.startsWith('wall-') || ids.has(row.id)) return `Blade ID ${row.id} is reserved or repeated.`;
    ids.add(row.id);
    const error = gearPriceError(row.cost, row.sellValue);
    if (error) return `${row.id}: ${error}`;
    if (row.id === 'blade-default' && (row.cost !== 0 || row.sellValue !== 0)) return 'The starter blade must remain free and cannot be sold.';
  }
  return null;
}
