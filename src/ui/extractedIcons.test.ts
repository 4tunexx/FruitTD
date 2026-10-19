import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { EXTRACTED_ICON_IDS, ICON_ASSETS } from './extractedIcons';
import { EXTRACTED_ICON_BOUNDS } from './extractedIconBounds';

test('every selectable and default glyph has artwork and valid visible bounds', () => {
  for (const id of new Set([...EXTRACTED_ICON_IDS, ...Object.values(ICON_ASSETS)])) {
    assert.ok(existsSync(`public/assets/icons/extracted/${id}.png`), `Missing artwork: ${id}`);
    const bounds = EXTRACTED_ICON_BOUNDS[id];
    assert.ok(bounds, `Missing visible bounds: ${id}`);
    const [width, height, x, y, inkWidth, inkHeight] = bounds;
    assert.ok(inkWidth > 0 && inkHeight > 0 && x >= 0 && y >= 0);
    assert.ok(x + inkWidth <= width && y + inkHeight <= height, `Invalid bounds: ${id}`);
  }
});
