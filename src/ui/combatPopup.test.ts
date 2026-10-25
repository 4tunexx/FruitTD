import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('solo combat separates the optional status drawer from contextual build and upgrade actions', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const drawerStart = html.indexOf('<aside id="sidebar"');
  const drawerEnd = html.indexOf('</aside>', drawerStart);
  const popupStart = html.indexOf('<section id="command-popup"');
  const popupEnd = html.indexOf('</section>', popupStart);
  const popup = html.slice(popupStart, popupEnd);

  assert.match(html, /id="btn-sidebar-toggle"[^>]*aria-controls="sidebar"[^>]*aria-expanded="false"/);
  assert.ok(drawerStart >= 0 && drawerEnd > drawerStart, 'status has its own drawer');
  assert.ok(popupStart > drawerEnd, 'quick actions sit outside the optional status drawer');
  assert.match(popup, /id="hud-shop"/);
  assert.match(popup, /id="action-btns"/);
  assert.match(popup, /id="turret-page-label"/);
  assert.match(popup, /id="btn-command-close"/);
});

test('combat status and quick action surfaces use the glass command treatment', () => {
  const css = readFileSync(new URL('./combatExperience.css', import.meta.url), 'utf8');
  const hud = readFileSync(new URL('./hud.ts', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const pvp = readFileSync(new URL('./screens/pvp.ts', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('./combatHudLayout.ts', import.meta.url), 'utf8');

  assert.match(css, /#app\.sidebar-open #sidebar \{\s*visibility:visible!important/);
  assert.match(css, /#command-popup \{[\s\S]*?backdrop-filter:blur\(18px\)/);
  assert.match(css, /\.ftd-pvp\.is-battle \.ftd-duel-powers \{\s*position:absolute/);
  assert.match(css, /#command-popup \{[\s\S]*?width:min\(340px,calc\(var\(--combat-field-width/);
  assert.match(css, /hero-ability-bar--solo \{[\s\S]*?right:calc\(100vw - var\(--combat-field-right/);
  assert.match(css, /#hud-shop \.turret-btn__name \{[\s\S]*?grid-column:1/);
  assert.match(css, /#hud-shop \.turret-btn__status \{[\s\S]*?grid-row:4/);
  assert.match(css, /#hud-shop \{\s*display:grid; grid-auto-flow:column; grid-auto-columns:calc\(\(100% - 18px\) \/ 4\)/);
  assert.match(css, /#action-btns \{\s*display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /#action-btns\.is-main-upgrade #btn-upgrade \{ grid-column:1\/-1/);
  assert.match(hud, /turret-btn__name/);
  assert.match(hud, /turret-btn__cost/);
  assert.match(hud, /this\.shop\.scrollBy\(\{ left: Math\.max\(1, this\.shop\.clientWidth\)/);
  assert.match(hud, /turretPageLabel\.textContent = `\$\{page\} \/ \$\{pageCount\}`/);
  assert.match(html, /id="turret-page-label"/);
  assert.match(pvp, /battlefield\.element\.appendChild\(powerRail\)/);
  assert.match(layout, /--combat-field-\$\{name\}/);
});
