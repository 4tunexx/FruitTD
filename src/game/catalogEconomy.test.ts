import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slicerCatalogError } from './catalogEconomy';
import { DEFAULT_SLICERS } from './slicers';

test('admin pricing accepts defaults and rejects unsafe prices and ambiguous IDs', () => {
  assert.equal(slicerCatalogError(DEFAULT_SLICERS), null);
  for (const patch of [
    { cost: 1.5 }, { sellValue: 181 }, { cost: -1 }, { sellValue: '60' },
    { cost: Infinity }, { id: 'wall-stone' }, { id: 'hero:jiju' },
  ]) assert.ok(slicerCatalogError([{ ...DEFAULT_SLICERS[1], ...patch }]));
  assert.ok(slicerCatalogError([DEFAULT_SLICERS[1], DEFAULT_SLICERS[1]]));
  assert.ok(slicerCatalogError([{ ...DEFAULT_SLICERS[0], cost: 10 }]));
});
