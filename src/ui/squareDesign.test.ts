import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('the final design layer keeps panels square and only icon tokens round', () => {
  const css = readFileSync(new URL('./squareDesign.css', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf8');
  assert.ok(main.indexOf("./ui/squareDesign.css") > main.indexOf("./ui/pvpCombatLayout.css"), 'loads after the combat layout');
  assert.match(css, /\.ftd-duel-panel[\s\S]*?border-radius:0!important; clip-path:var\(--ftd-chamfer\)!important/);
  assert.match(css, /\.ftd-duel-icon-button \{ border-radius:50%!important/);
  assert.match(css, /#modal-admin :is\([^)]*admin-card/);
  assert.match(css, /\.ftd-coop-vote/);
});
