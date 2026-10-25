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
  assert.match(popup, /id="btn-command-close"/);
});

test('combat status and quick action surfaces use the glass command treatment', () => {
  const css = readFileSync(new URL('./combatExperience.css', import.meta.url), 'utf8');

  assert.match(css, /#app\.sidebar-open #sidebar \{\s*visibility:visible!important/);
  assert.match(css, /#command-popup \{[\s\S]*?backdrop-filter:blur\(18px\)/);
  assert.match(css, /\.ftd-pvp\.is-battle \.ftd-duel-powers \{\s*position:fixed/);
  assert.match(css, /@media\(max-width:860px\)\s*\{[\s\S]*?hero-ability-bar--solo \{[\s\S]*?right:10px!important[\s\S]*?#command-popup \{[\s\S]*?bottom:calc\(104px/);
  assert.match(css, /@media\(max-width:520px\)[\s\S]*?hero-ability-bar--solo \.hero-ability-slot \{[\s\S]*?width:70px/);
});
