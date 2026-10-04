import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('boss transition uses the existing animated letterbox element', () => {
  const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const id = main.match(/const bossIntroEl = document.getElementById\('([^']+)'\)/)?.[1];
  assert.ok(id);
  assert.ok(html.includes(`id="${id}"`), 'Missing boss overlay freezes the final-wave transition');
  assert.ok(html.includes('id="boss-intro-title"'));
  assert.ok(html.includes('id="boss-intro-subtitle"'));
});
